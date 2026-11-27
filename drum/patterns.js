// The drum patterns file PATTERNS.BIN, which the mod reads at boot (mods/drum_patterns.c), and the
// STATUS.TXT it writes. The checks here are the mod's, rule for rule and in the same order, so the
// editor knows before writing what the pedal will load.
import { crc32mpeg2 } from "../patch/firmware.js";

const FORMAT = 1;
const MAGIC = 0x504c4442; // "BDLP"
export const HEADER_SIZE = 16;
const ENTRY_SIZE = 12;
export const STYLES = { 4: 29, 3: 13 }; // per meter (beats per bar), styles from 1
export const PARTS = 16; // per style: part = 4 x (strength - 1) + (column - 1)
export const TICKS = 120; // per beat
export const BARS = 8; // the most a part may have
export const PART_WORDS = 0x400; // the most words a part may have
const MIN_PART_WORDS = 8; // the header and the end event
export const KITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 99];
const TEMPO = { min: 30, max: 250 };
const END_EVENT = 0x7fffffff;
const TICK_FLAG = 0x80000000;

// The format guarantees at least this much room for the file on the pedal (STATUS.TXT tells the
// mod's actual room).
export const MIN_ROOM = 120 * 1024;

const TIME_SIGNATURE = { 4: 0x402, 3: 0x302 };

// A part in the firmware's format: {tempo, meter, beats, kit, events: [{tick, note, vel}]}.
// Events are sorted by tick (stable); the end event is added.
export function encodePart({ tempo, meter, beats, kit, events }) {
  const sorted = events.map((e, i) => [e, i]).sort((a, b) => a[0].tick - b[0].tick || a[1] - b[1]);
  const words = new Uint32Array(6 + 2 * (sorted.length + 1));
  words.set([words.length, 6, tempo, TIME_SIGNATURE[meter], beats, kit]);
  sorted.forEach(([e], i) => {
    words[6 + 2 * i] = (e.tick | TICK_FLAG) >>> 0;
    words[7 + 2 * i] = e.note | (e.vel << 8);
  });
  words[words.length - 2] = ((beats * TICKS - 1) | TICK_FLAG) >>> 0;
  words[words.length - 1] = END_EVENT;
  return new Uint8Array(words.buffer);
}

const wordsOf = (bytes) => {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: bytes.byteLength >> 2 }, (_, i) => v.getUint32(4 * i, true));
};

// The part back from its bytes (no checks: see checkPart).
export function decodePart(bytes) {
  const w = wordsOf(bytes);
  const meter = w[3] === 0x302 ? 3 : 4;
  const events = [];
  for (let i = 6; i < w[0] - 2; i += 2) {
    events.push({ tick: (w[i] & ~TICK_FLAG) >>> 0, note: w[i + 1] & 0xff, vel: w[i + 1] >>> 8 });
  }
  return { tempo: w[2], meter, beats: w[4], kit: w[5], events };
}

// "OK" or the reason the mod refuses the part, as STATUS.TXT names it.
export function checkPart(bytes, meter) {
  if (bytes.byteLength < MIN_PART_WORDS * 4) return "BAD place"; // the mod checks the entry's size first
  const w = wordsOf(bytes);
  const words = w[0];
  const beats = w[4];
  if (words * 4 !== bytes.byteLength || words < MIN_PART_WORDS || words > PART_WORDS || words % 2) {
    return "BAD size";
  }
  if (w[1] !== 6) return "BAD header";
  if (w[3] !== TIME_SIGNATURE[meter]) return "BAD meter";
  if (beats === 0 || beats > BARS * meter || beats % meter) return "BAD beats";
  if (w[2] < TEMPO.min || w[2] > TEMPO.max) return "BAD tempo";
  if (!KITS.includes(w[5])) return "BAD kit";
  const end = beats * TICKS;
  let last = 0;
  for (let i = 6; i < words - 2; i += 2) {
    const tick = (w[i] & ~TICK_FLAG) >>> 0;
    if (!(w[i] & TICK_FLAG) || tick < last || tick >= end) return "BAD tick";
    last = tick;
    const ev = w[i + 1];
    const note = ev & 0xff;
    const vel = ev >>> 8;
    if (note > 127 || vel === 0 || vel > 127) return "BAD event";
  }
  if (w[words - 2] !== ((end - 1) | TICK_FLAG) >>> 0 || w[words - 1] !== END_EVENT) return "BAD end";
  return "OK";
}

// The file from entries [{meter, style, part, bytes, flags?, offset?}]: parts laid out in entry
// order. An `offset` given is written as is (for test files) and its part not stored.
export function writePatterns(entries) {
  const start = HEADER_SIZE + ENTRY_SIZE * entries.length;
  let size = start;
  const placed = entries.map((e) => {
    if (e.offset !== undefined) return { ...e, length: e.length ?? e.bytes?.byteLength ?? 0 };
    const at = size;
    size += (e.bytes.byteLength + 3) & ~3;
    return { ...e, offset: at, length: e.bytes.byteLength };
  });
  const file = new Uint8Array(size);
  const v = new DataView(file.buffer);
  v.setUint32(0, MAGIC, true);
  v.setUint16(4, FORMAT, true);
  v.setUint16(6, entries.length, true);
  v.setUint32(8, size, true);
  placed.forEach((e, i) => {
    const at = HEADER_SIZE + ENTRY_SIZE * i;
    file.set([e.meter, e.style, e.part, e.flags ?? 0], at);
    v.setUint32(at + 4, e.offset, true);
    v.setUint32(at + 8, e.length, true);
    if (entries[i].offset === undefined) file.set(e.bytes, e.offset);
  });
  v.setUint32(12, crc32mpeg2(file.subarray(HEADER_SIZE)), true);
  return file;
}

// What the mod makes of a file: {state, count, loaded, size, entries: [{meter, style, part,
// offset, bytes, verdict, data}]}, state "OK", "BAD format", "BAD size" or "BAD crc" (the mod
// also reports "NONE", "ERROR open" and "ERROR read"). `room`: the mod's room for the file.
export function readPatterns(file, room = MIN_ROOM) {
  const got = Math.min(file.byteLength, room);
  const v = new DataView(file.buffer, file.byteOffset, got);
  const result = { state: "OK", count: 0, loaded: 0, size: got, entries: [] };
  if (got < HEADER_SIZE || v.getUint32(0, true) !== MAGIC || v.getUint16(4, true) !== FORMAT) {
    return { ...result, state: "BAD format" };
  }
  const count = v.getUint16(6, true);
  const size = v.getUint32(8, true);
  const start = HEADER_SIZE + ENTRY_SIZE * count;
  if (size !== got || count > PARTS * (STYLES[4] + STYLES[3]) || size < start) {
    return { ...result, state: "BAD size" };
  }
  if (crc32mpeg2(file.subarray(HEADER_SIZE, size)) !== v.getUint32(12, true)) {
    return { ...result, state: "BAD crc" };
  }
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    const at = HEADER_SIZE + ENTRY_SIZE * i;
    const [meter, style, part, flags] = file.subarray(at, at + 4);
    const offset = v.getUint32(at + 4, true);
    const bytes = v.getUint32(at + 8, true);
    const entry = { meter, style, part, offset, bytes, verdict: "OK", data: null };
    const key = `${meter} ${style} ${part}`;
    if (!(style >= 1 && style <= (STYLES[meter] ?? 0)) || part >= PARTS || flags) {
      entry.verdict = "BAD range";
    } else if (seen.has(key)) {
      entry.verdict = "BAD duplicate";
    } else {
      seen.add(key);
      if (offset % 4 || offset < start || offset > size || bytes > size - offset || bytes < MIN_PART_WORDS * 4) {
        entry.verdict = "BAD place";
      } else {
        entry.data = file.subarray(offset, offset + bytes);
        entry.verdict = checkPart(entry.data, meter);
        if (entry.verdict !== "OK") entry.data = null;
      }
    }
    result.loaded += entry.verdict === "OK";
    result.entries.push(entry);
  }
  return { ...result, count };
}

// The STATUS.TXT the mod writes for a read result (readPatterns, or {state: "NONE"}).
export function statusText(result, { release, room }) {
  const lines = ["BDL-DRUM-STATUS 1", `mod ${release}`, `patterns-format ${FORMAT}`, `patterns-room ${room}`];
  if (result.state === "OK") {
    lines.push(`patterns OK ${result.count} entries, ${result.loaded} loaded, ${result.size} bytes`);
    for (const e of result.entries) lines.push(`entry ${e.meter} ${e.style} ${e.part} ${e.verdict}`);
  } else {
    lines.push(`patterns ${result.state}${result.rc !== undefined ? ` ${result.rc}` : ""}`);
  }
  return lines.map((l) => `${l}\r\n`).join("");
}

// STATUS.TXT read back: {status, mod, format, room, state, rc, count, loaded, size, entries:
// [{meter, style, part, verdict}]}. Unknown lines are ignored (later mods may add some).
export function parseStatus(text) {
  const status = { entries: [] };
  for (const line of text.split(/\r?\n/)) {
    let m;
    if ((m = line.match(/^BDL-DRUM-STATUS (\d+)$/))) status.status = Number(m[1]);
    else if ((m = line.match(/^mod (\S+)$/))) status.mod = m[1];
    else if ((m = line.match(/^patterns-format (\d+)$/))) status.format = Number(m[1]);
    else if ((m = line.match(/^patterns-room (\d+)$/))) status.room = Number(m[1]);
    else if ((m = line.match(/^patterns OK (\d+) entries, (\d+) loaded, (\d+) bytes$/))) {
      Object.assign(status, { state: "OK", count: +m[1], loaded: +m[2], size: +m[3] });
    } else if ((m = line.match(/^patterns (NONE|BAD \w+|ERROR \w+)(?: (\d+))?$/))) {
      status.state = m[1];
      if (m[2] !== undefined) status.rc = Number(m[2]);
    } else if ((m = line.match(/^entry (\d+) (\d+) (\d+) (OK|BAD \w+)$/))) {
      status.entries.push({ meter: +m[1], style: +m[2], part: +m[3], verdict: m[4] });
    }
  }
  return status;
}
