// Tests of patch/ on a small made-up firmware image (no NUX firmware needed), and of the release's
// committed files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FILE_ALIGN, HEADER_SIZE, build, crc32mpeg2, parse, u32 } from "../patch/firmware.js";
import { addPictures, groups, stack } from "../patch/pictures.js";
import { bl, bw } from "../patch/thumb.js";
import { MODS_BASE, PICTURES, codeChanges } from "../patch/mods.js";
import { patch, sha256, symbols } from "../patch/index.js";

const u32le = (...words) => new Uint8Array(new Uint32Array(words).buffer);
const GREY = Uint8Array.from({ length: 64 }, (_, i) => (i % 4 === 3 ? 0 : (i >> 2) * 0x11));

// A top-down 4-bit RLE BMP with the grey palette.
function rle4(width, height, records) {
  const bmp = new Uint8Array(118 + records.length);
  const v = new DataView(bmp.buffer);
  bmp.set([0x42, 0x4d]);
  v.setUint32(2, bmp.length, true);
  v.setUint32(10, 118, true);
  v.setUint32(14, 40, true);
  v.setInt32(18, width, true);
  v.setInt32(22, -height, true);
  v.setUint16(26, 1, true);
  v.setUint16(28, 4, true);
  v.setUint32(30, 2, true);
  v.setUint32(34, records.length, true);
  bmp.set(GREY, 54);
  bmp.set(records, 118);
  return bmp;
}

// Rows of palette indices of such a BMP (encoded runs, end of row, end of picture, moves).
function decode(bytes, at = 0) {
  const v = new DataView(bytes.buffer, bytes.byteOffset + at);
  const width = v.getInt32(18, true);
  const height = -v.getInt32(22, true);
  const rows = Array.from({ length: height }, () => new Array(width).fill(0));
  let p = at + v.getUint32(10, true);
  let x = 0;
  let y = 0;
  for (;;) {
    const [count, value] = [bytes[p], bytes[p + 1]];
    p += 2;
    if (count) for (let i = 0; i < count; i++) rows[y][x++] = i % 2 ? value & 15 : value >> 4;
    else if (value === 0) [x, y] = [0, y + 1];
    else if (value === 1) return rows;
    else if (value === 2) [x, y, p] = [x + bytes[p], y + bytes[p + 1], p + 2];
    else throw new Error("absolute runs not used here");
  }
}

const LOGO = rle4(4, 3, [4, 0x12, 0, 0, 4, 0x34, 0, 1]); // third row blank
const STRIP = rle4(4, 1, [4, 0x56, 0, 1]);
const SIZES = { 3: 17, 0x11: 36, 0x12: 0x75 }; // pictures per group, as NUX's groups

// Resources: two files (the second holds the pictures: 0x13 groups, each table followed by its
// pictures; picture 3/14 is LOGO, the others 8-byte stand-ins).
function resources() {
  const parts = [];
  const top = 0x200;
  const count = 0x13;
  let at = top + 4 + 4 * count;
  const rel = [];
  for (let g = 0; g < count; g++) {
    const n = SIZES[g] || 1;
    const pics = Array.from({ length: n }, (_, i) =>
      g === 3 && i === 14 ? LOGO : Uint8Array.of(0x42, 0x4d, g, i, 0, 0, 0, 0),
    );
    rel.push(at - top);
    const offs = [];
    let p = 4 + 4 * n;
    for (const pic of pics) {
      offs.push(p);
      p += pic.length + (-pic.length & 3);
    }
    parts.push([at, u32le(n, ...offs)]);
    p = at + 4 + 4 * n;
    for (const pic of pics) {
      parts.push([p, pic]);
      p += pic.length + (-pic.length & 3);
    }
    at = p;
  }
  const res = new Uint8Array(at);
  for (const [o, b] of parts) res.set(b, o);
  res.set(u32le(count, ...rel), top);
  res.set([2, 0], 0x20); // two files
  res.set(u32le(0x100, 0x10), 0x24);
  res.set(u32le(top, at - top), 0x34); // the second file: the pictures
  return res;
}

const CODE = new Uint8Array(0x4e188).fill(0xee);
const officialImage = (res = resources()) => build(new Uint8Array(HEADER_SIZE), CODE, res);

const HOOKS = [
  "mods_settings_draw",
  "mods_settings_para_knob",
  "mods_settings_home_knob",
  "mods_settings_para_press",
  "mods_drum_stop",
  "mods_drum_stop_only",
  "mods_drum_toggle_save",
  "mods_drum_save_tail",
  "mods_settings_list_draw",
];
const SYM = HOOKS.map((name, i) => `${(MODS_BASE + 8 * i).toString(16).padStart(8, "0")} T ${name}`).join("\n");

// The symbols, failing on a name they lack: a missing one would still encode as bytes (a pointer
// to 1, a branch to NaN).
const strict = (mods) =>
  new Proxy(mods, { get: (o, name) => (name in o ? o[name] : assert.fail(`no symbol ${String(name)}`)) });

function files() {
  const out = { "mods/mods.bin": new Uint8Array(64).fill(0xab), "mods/mods.sym": new TextEncoder().encode(SYM) };
  for (const { file, under } of PICTURES) {
    out[`images/${file}`] = under === undefined ? Uint8Array.of(0x42, 0x4d, 1, 2) : STRIP;
  }
  return out;
}

// --- the image format -----------------------------------------------------------------------------

test("CRC-32/MPEG-2 check value", () => {
  assert.equal(crc32mpeg2(new TextEncoder().encode("123456789")), 0x0376e6e7);
});

test("build: sections, sizes and checksums in the header", () => {
  const image = officialImage();
  const fw = parse(image);
  assert.equal(u32(image, 0x34) % 0x400, 0);
  assert.equal(fw.code.length, u32(image, 0x34) - HEADER_SIZE);
  assert.equal(u32(image, 0x44), crc32mpeg2(fw.code));
  assert.equal(u32(image, 0x54), crc32mpeg2(fw.resources));
  assert.deepEqual(fw.code.subarray(0, CODE.length), CODE);
  assert.equal(image.length % FILE_ALIGN, 0);
});

test("build: the last file is extended over appended data", () => {
  const res = resources();
  const longer = new Uint8Array(res.length + 100);
  longer.set(res);
  const out = parse(officialImage(longer)).resources;
  assert.equal(u32(out, 0x34) + u32(out, 0x38), out.length);
  assert.deepEqual(out.subarray(0x24, 0x2c), res.subarray(0x24, 0x2c));
});

test("branches encode as in NUX's code", () => {
  const hex = (b) => Buffer.from(b).toString("hex");
  assert.equal(hex(bl(0x3046, 0x1a2a8)), "17f02ff9");
  assert.equal(hex(bl(0xf104, 0x1a2a8)), "0bf0d0f8");
  assert.equal(hex(bw(0x107d8, 0x1a2a8)), "09f066bd");
  assert.equal(hex(bw(0x93f4, 0x37f0)), "faf7fcb9");
});

// --- pictures -------------------------------------------------------------------------------------

test("added pictures follow the stock ones, which stay as they were", () => {
  const res = resources();
  const before = groups(res);
  const add = [
    { group: 0x11, id: 36, bmp: Uint8Array.of(1, 2, 3) },
    { group: 3, id: 17, bmp: Uint8Array.of(4, 5) },
  ];
  const out = addPictures(res, add);
  const after = groups(out);
  assert.deepEqual(out.subarray(after[0x11][36], after[0x11][36] + 3), Uint8Array.of(1, 2, 3));
  assert.deepEqual(after[0x11].slice(0, 36), before[0x11]);
  assert.deepEqual(after[0x12], before[0x12]);
  // Group 3 moves whole, behind its new table, its pictures unchanged.
  const top = u32(out, 0x34);
  const table = top + u32(out, top + 4 * 4);
  assert.ok(after[3].every((p) => p > table && p - table < 0x19000));
  before[3].forEach((p, i) => assert.deepEqual(out.subarray(after[3][i], after[3][i] + 8), res.subarray(p, p + 8)));
});

test("our picture ids follow each group's last one", () => {
  const next = { ...SIZES };
  for (const { group, id } of PICTURES) assert.equal(id, next[group]++, `${group}/${id}`);
});

test("stacked pictures: the top one's rows, then the bottom one's", () => {
  const res = resources();
  const logo = groups(res)[3][14];
  const both = stack(res, logo, STRIP);
  assert.deepEqual(decode(both), [...decode(res, logo), ...decode(STRIP)]);
  assert.deepEqual(decode(both).at(-1), [5, 6, 5, 6]);
});

// --- the whole patch ------------------------------------------------------------------------------

test("patch: our changes, code and pictures, in whole blocks", async () => {
  const input = officialImage();
  const release = { official: "V2.2.0", input_sha256: await sha256(input), output_sha256: "0" };
  const out = await patch(input, files(), release, { development: true });
  const fw = parse(out);
  const mods = strict(symbols(SYM));
  assert.equal(out.length % FILE_ALIGN, 0);
  for (const [at, bytes] of codeChanges(mods)) {
    assert.deepEqual(fw.code.subarray(at, at + bytes.length), Uint8Array.from(bytes));
  }
  // The changes lie in NUX's code and do not overlap.
  const spans = codeChanges(mods)
    .map(([at, bytes]) => [at, at + bytes.length])
    .sort((x, y) => x[0] - y[0]);
  spans.forEach(([, end], i) => assert.ok(end <= (spans[i + 1]?.[0] ?? CODE.length), `change ending at ${end}`));
  assert.equal(fw.code[0xc42a], 40);
  assert.deepEqual(fw.code.subarray(MODS_BASE, MODS_BASE + 64), new Uint8Array(64).fill(0xab));
  const pics = groups(fw.resources);
  assert.deepEqual(decode(fw.resources, pics[3][17]), [...decode(LOGO), ...decode(STRIP)]);
  assert.equal(pics[0x12].length, 0x75 + 10);
  // The pins: only the official input, only the released output.
  release.output_sha256 = await sha256(out);
  assert.deepEqual(await patch(input, files(), release), out);
  await assert.rejects(patch(input, files(), { ...release, output_sha256: "1" }), /not the released/);
  const other = input.slice();
  other[HEADER_SIZE] ^= 1;
  await assert.rejects(patch(other, files(), release), /not the official V2.2.0 firmware/);
  await assert.rejects(patch(out, files(), release), /already the modded/);
});

// --- the committed release ------------------------------------------------------------------------

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoPath = (name) => join(ROOT, name.startsWith("mods/") ? "build" : "", name); // the blob: from make
const built = existsSync(repoPath("mods/mods.bin"));

test("the release names its version and the pins", () => {
  const release = JSON.parse(readFileSync(join(ROOT, "release.json"), "utf8"));
  assert.match(release.version, new RegExp(`^${release.official}-MOD\\d+\\.\\d+$`));
  for (const key of ["input_sha256", "mods_sha256", "output_sha256"]) assert.match(release[key], /^[0-9a-f]{64}$/);
});

test("every picture the patch adds is in the repository", () => {
  for (const { file } of PICTURES) assert.ok(existsSync(join(ROOT, "images", file)), file);
});

const noBlob = !built && "no build/mods/ (run make)";

test("the built blob is the release's, and mods.sym has every hook", { skip: noBlob }, async () => {
  const release = JSON.parse(readFileSync(join(ROOT, "release.json"), "utf8"));
  assert.equal(await sha256(readFileSync(repoPath("mods/mods.bin"))), release.mods_sha256);
  codeChanges(strict(symbols(readFileSync(repoPath("mods/mods.sym"), "utf8"))));
});
