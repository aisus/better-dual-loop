// Tests of drum/patterns.js: the patterns file, the mod's checks, STATUS.TXT.
import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32mpeg2 } from "../patch/firmware.js";
import {
  HEADER_SIZE,
  MIN_ROOM,
  PART_WORDS,
  checkPart,
  decodePart,
  encodePart,
  parseStatus,
  readPatterns,
  statusText,
  writePatterns,
} from "../drum/patterns.js";
import { CASES, RELEASE, vectors } from "./drum-vectors.mjs";

const part = (over = {}) => ({
  tempo: 120,
  meter: 4,
  beats: 32,
  kit: 1,
  events: [
    { tick: 0, note: 36, vel: 100 },
    { tick: 240, note: 38, vel: 90 },
  ],
  ...over,
});
const words = (bytes) => new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);

test("a part encodes in the firmware's format and decodes back", () => {
  const bytes = encodePart(part());
  assert.deepEqual(
    [...words(bytes)],
    [
      12,
      6,
      120,
      0x402,
      32,
      1,
      0x80000000,
      36 | (100 << 8),
      0x80000000 + 240,
      38 | (90 << 8),
      0x80000000 + 3839,
      0x7fffffff,
    ],
  );
  assert.deepEqual(decodePart(bytes), part());
  assert.equal(checkPart(bytes, 4), "OK");
});

test("events are sorted by tick, keeping the order of equal ticks", () => {
  const events = [
    { tick: 480, note: 36, vel: 1 },
    { tick: 0, note: 42, vel: 2 },
    { tick: 0, note: 36, vel: 3 },
  ];
  assert.deepEqual(decodePart(encodePart(part({ events }))).events, [events[1], events[2], events[0]]);
});

test("a 3/4 part, an empty part and the largest part pass", () => {
  assert.equal(checkPart(encodePart(part({ meter: 3, beats: 24 })), 3), "OK");
  assert.equal(checkPart(encodePart(part({ events: [] })), 4), "OK");
  const n = (PART_WORDS - 8) / 2;
  const big = encodePart(part({ events: Array.from({ length: n }, (_, i) => ({ tick: i, note: 42, vel: 1 })) }));
  assert.equal(big.byteLength, 4 * PART_WORDS);
  assert.equal(checkPart(big, 4), "OK");
  const over = encodePart(part({ events: Array.from({ length: n + 1 }, (_, i) => ({ tick: i, note: 42, vel: 1 })) }));
  assert.equal(checkPart(over, 4), "BAD size");
});

test("every rule of a part", () => {
  const bad = (over, change, meter = 4) => {
    const bytes = encodePart(part(over));
    if (change) change(words(bytes));
    return checkPart(bytes, meter);
  };
  assert.equal(
    bad({}, (w) => (w[0] = 10)),
    "BAD size",
  );
  assert.equal(
    bad({}, (w) => (w[1] = 5)),
    "BAD header",
  );
  assert.equal(bad({}, null, 3), "BAD meter");
  assert.equal(bad({ beats: 0 }), "BAD beats");
  assert.equal(bad({ beats: 6 }), "BAD beats");
  assert.equal(bad({ beats: 36 }), "BAD beats");
  assert.equal(bad({ meter: 3, beats: 27 }, null, 3), "BAD beats");
  assert.equal(bad({ beats: 8 }), "OK");
  assert.equal(bad({ tempo: 29 }), "BAD tempo");
  assert.equal(bad({ tempo: 251 }), "BAD tempo");
  assert.equal(bad({ tempo: 250 }), "OK");
  assert.equal(bad({ kit: 10 }), "BAD kit");
  assert.equal(bad({ kit: 99 }), "OK");
  assert.equal(
    bad({}, (w) => (w[6] = 0)),
    "BAD tick",
  );
  assert.equal(
    bad({}, (w) => (w[8] = 0x80000000)),
    "OK",
  );
  assert.equal(
    bad(
      {
        events: [
          { tick: 300, note: 36, vel: 1 },
          { tick: 200, note: 36, vel: 1 },
        ],
      },
      (w) => (w[8] = 0x80000000 + 100),
    ),
    "BAD tick",
  );
  assert.equal(bad({ events: [{ tick: 3840, note: 36, vel: 1 }] }), "BAD tick");
  assert.equal(bad({ events: [{ tick: 3839, note: 36, vel: 1 }] }), "OK");
  assert.equal(bad({ events: [{ tick: 0, note: 128, vel: 1 }] }), "BAD event");
  assert.equal(bad({ events: [{ tick: 0, note: 36, vel: 0 }] }), "BAD event");
  assert.equal(bad({ events: [{ tick: 0, note: 36, vel: 128 }] }), "BAD event");
  assert.equal(
    bad({}, (w) => (w[10] = 0x80000000 + 3838)),
    "BAD end",
  );
  assert.equal(
    bad({}, (w) => (w[11] = 0)),
    "BAD end",
  );
});

test("the file: header, entries, parts in entry order, CRC", () => {
  const a = encodePart(part());
  const b = encodePart(part({ kit: 4, meter: 3, beats: 24 }));
  const file = writePatterns([
    { meter: 4, style: 1, part: 0, bytes: a },
    { meter: 3, style: 13, part: 15, bytes: b },
  ]);
  const v = new DataView(file.buffer);
  assert.equal(new TextDecoder().decode(file.subarray(0, 4)), "BDLP");
  assert.deepEqual([v.getUint16(4, true), v.getUint16(6, true), v.getUint32(8, true)], [1, 2, file.length]);
  assert.equal(v.getUint32(12, true), crc32mpeg2(file.subarray(HEADER_SIZE)));
  assert.deepEqual([...file.subarray(16, 20)], [4, 1, 0, 0]);
  assert.deepEqual([v.getUint32(20, true), v.getUint32(24, true)], [40, a.length]);
  assert.deepEqual([...file.subarray(28, 32)], [3, 13, 15, 0]);
  assert.deepEqual([v.getUint32(32, true), v.getUint32(36, true)], [40 + a.length, b.length]);
  const r = readPatterns(file);
  assert.equal(r.state, "OK");
  assert.equal(r.loaded, 2);
  assert.deepEqual(r.entries[1].data, b);
});

test("a file the mod refuses whole", () => {
  const good = writePatterns([{ meter: 4, style: 1, part: 0, bytes: encodePart(part()) }]);
  const changed = (at, value, size = 1) => {
    const f = good.slice();
    new DataView(f.buffer)[size === 1 ? "setUint8" : size === 2 ? "setUint16" : "setUint32"](at, value, true);
    return f;
  };
  assert.equal(readPatterns(good.subarray(0, 15)).state, "BAD format");
  assert.equal(readPatterns(changed(0, 0x41)).state, "BAD format");
  assert.equal(readPatterns(changed(4, 2, 2)).state, "BAD format");
  assert.equal(readPatterns(changed(8, good.length + 4, 4)).state, "BAD size");
  assert.equal(readPatterns(good.subarray(0, good.length - 4)).state, "BAD size");
  assert.equal(readPatterns(changed(6, 673, 2)).state, "BAD size");
  assert.equal(readPatterns(changed(40, 0x37)).state, "BAD crc");
  assert.equal(readPatterns(new Uint8Array(MIN_ROOM + 4)).state, "BAD format");
  const tooBig = writePatterns([{ meter: 4, style: 1, part: 0, offset: 40, length: 32 }]);
  const padded = new Uint8Array(MIN_ROOM + 4);
  padded.set(tooBig);
  new DataView(padded.buffer).setUint32(8, padded.length, true);
  assert.equal(readPatterns(padded).state, "BAD size");
});

test("the shared vectors: every verdict as the cases say", () => {
  const r = readPatterns(vectors());
  assert.equal(r.state, "OK");
  assert.deepEqual(
    r.entries.map((e) => e.verdict),
    CASES.map(([, verdict]) => verdict),
  );
  assert.ok(vectors().length <= MIN_ROOM);
});

test("STATUS.TXT: written as the mod writes it, and read back", () => {
  const file = vectors();
  const text = statusText(readPatterns(file), { release: RELEASE, room: 125416 });
  const lines = text.split("\r\n");
  assert.deepEqual(lines.slice(0, 6), [
    "BDL-DRUM-STATUS 1",
    `mod ${RELEASE}`,
    "patterns-format 1",
    "patterns-room 125416",
    `patterns OK ${CASES.length} entries, 5 loaded, ${file.length} bytes`,
    "entry 4 1 0 OK",
  ]);
  assert.equal(lines.at(-1), "");
  const s = parseStatus(text);
  assert.deepEqual(
    [s.status, s.mod, s.format, s.room, s.state, s.count, s.loaded, s.size],
    [1, RELEASE, 1, 125416, "OK", CASES.length, 5, file.length],
  );
  assert.deepEqual(s.entries[1], { meter: 4, style: 1, part: 1, verdict: "BAD tick" });
  assert.equal(s.entries.length, CASES.length);
  assert.deepEqual(parseStatus(statusText({ state: "NONE" }, { release: RELEASE, room: 1 })).state, "NONE");
  const err = parseStatus(statusText({ state: "ERROR read", rc: 1 }, { release: RELEASE, room: 1 }));
  assert.deepEqual([err.state, err.rc], ["ERROR read", 1]);
});

test("the drum page's colours: every style's family has them", async () => {
  const { STYLES } = await import("../drum/styles.js");
  const { brightColour, cellColour } = await import("../drum/colours.js");
  for (const s of [...STYLES[4], ...STYLES[3]]) {
    assert.match(brightColour(s.family), /^#[0-9a-f]{6}$/, s.name);
    for (let part = 0; part < 16; part++) assert.match(cellColour(s.family, part), /^rgb\(\d+ \d+ \d+\)$/);
  }
  assert.equal(cellColour("ROCK", 0), "rgb(124 72 71)"); // 1.1
  assert.equal(cellColour("ROCK", 3), "rgb(95 38 35)"); // 1.4
  assert.equal(cellColour("ROCK", 12), "rgb(101 45 43)"); // 4.1
});

test("the style table: as many styles per meter as the mod takes, kits the bank has", async () => {
  const { STYLES: TABLE, cellName, stockPart } = await import("../drum/styles.js");
  const { STYLES, KITS } = await import("../drum/patterns.js");
  for (const meter of [4, 3]) {
    assert.equal(TABLE[meter].length, STYLES[meter]);
    for (const s of TABLE[meter]) {
      assert.ok(KITS.includes(s.kit) && s.tempo >= 30 && s.tempo <= 250 && s.bars >= 1 && s.bars <= 8, s.name);
    }
  }
  // A cell's own kit: the style's, but for 18 cells on kit 0 (4/4 JAZZ is style 19, 3/4 WALTZ 13).
  assert.deepEqual(stockPart(4, 1, 0), { kit: 1, tempo: 90 });
  assert.deepEqual(stockPart(4, 19, 1), { kit: 0, tempo: 130 });
  assert.deepEqual(stockPart(4, 19, 0), { kit: 6, tempo: 130 });
  assert.deepEqual(stockPart(3, 13, 0), { kit: 0, tempo: 120 });
  assert.deepEqual([stockPart(4, 14, 0).tempo, stockPart(4, 14, 2).tempo], [91, 90]); // DH_JW_FUNK
  let exceptions = 0;
  for (const meter of [4, 3]) {
    for (const s of TABLE[meter]) {
      for (let part = 0; part < 16; part++) exceptions += stockPart(meter, s.style, part).kit !== s.kit;
    }
  }
  assert.equal(exceptions, 18);
  // The page's list: every style of both meters once (in the 4/4 order), families together.
  const { STYLE_LIST } = await import("../drum/styles.js");
  for (const meter of [4, 3]) {
    const listed = STYLE_LIST.filter((e) => e.styles[meter]).map((e) => e.styles[meter]);
    assert.deepEqual(
      listed.sort((a, b) => a - b),
      TABLE[meter].map((s) => s.style),
    );
    for (const e of STYLE_LIST) if (e.styles[meter]) assert.equal(TABLE[meter][e.styles[meter] - 1].name, e.name);
  }
  assert.equal(STYLE_LIST.length, 33);
  const names = STYLE_LIST.map((e) => e.name);
  assert.deepEqual(names.slice(names.indexOf("BLUES"), names.indexOf("BLUES") + 3), [
    "BLUES",
    "BLUES SHUFFLE-1",
    "BLUES SHUFFLE-2",
  ]);
  assert.equal(names.at(-1), "WALTZ");
  assert.deepEqual([0, 3, 4, 15].map(cellName), ["1.1", "1.4", "2.1", "4.4"]);
});
