// Tests of drum/stock.js on resources made here (no NUX firmware needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readMidi } from "../drum/midi.js";
import { PARTS, STYLES, encodePart } from "../drum/patterns.js";
import { midiFiles, readStockPart } from "../drum/stock.js";

// A table {count, offsets from its start}, then its items.
function table(items) {
  let at = 4 + 4 * items.length;
  const words = [items.length];
  for (const item of items) {
    words.push(at);
    at += item.byteLength;
  }
  const out = new Uint8Array(at);
  out.set(new Uint8Array(Uint32Array.from(words).buffer));
  items.forEach((item, i) => out.set(item, words[1 + i]));
  return out;
}

// One bar; style and part can be told from its hits.
const part = (meter, style, p) => ({
  tempo: 100 + style,
  meter,
  beats: meter,
  kit: 1,
  events: [
    { tick: 0, note: 36, vel: 1 + style },
    { tick: 37, note: 38, vel: 1 + p },
    { tick: 60, note: 22, vel: 90 },
  ],
});
const set = (meter) =>
  table(
    Array.from({ length: STYLES[meter] + 1 }, (_, style) =>
      table(Array.from({ length: style ? PARTS : 1 }, (_, p) => encodePart(part(meter, style, p)))),
    ),
  );

function resources() {
  const sets = { 4: set(4), 3: set(3) };
  const out = new Uint8Array(0x80 + sets[4].length + sets[3].length);
  const v = new DataView(out.buffer);
  v.setUint32(0x74, 0x80, true);
  v.setUint32(0x64, 0x80 + sets[4].length, true);
  out.set(sets[4], 0x80);
  out.set(sets[3], 0x80 + sets[4].length);
  return out;
}

test("a stock part of either meter", () => {
  const res = resources();
  assert.deepEqual(readStockPart(res, 4, 1, 0), part(4, 1, 0));
  assert.deepEqual(readStockPart(res, 3, 13, 15), part(3, 13, 15));
});

test("a MIDI file per part, in the styles' order, with the pedal's ticks", () => {
  const files = midiFiles(resources());
  assert.equal(files.length, (STYLES[4] + STYLES[3]) * PARTS);
  assert.equal(new Set(files.map((f) => f.name)).size, files.length);
  assert.equal(files[0].name, "01 ROCK-1/4-4/ROCK-1-44-1.1.mid");
  assert.equal(files[16].name, "01 ROCK-1/3-4/ROCK-1-34-1.1.mid");
  assert.equal(files.at(-1).name, "33 WALTZ/3-4/WALTZ-34-4.4.mid");
  assert.deepEqual(
    files.map((f) => f.name.slice(0, 2)),
    files.map((f) => f.name.slice(0, 2)).sort(),
  );
  const midi = readMidi(files.find((f) => f.name.endsWith("/ROCK-2-34-2.3.mid")).bytes);
  assert.deepEqual([midi.ppq, midi.meter, Math.round(midi.tempo), midi.end], [120, 3, 102, 360]);
  assert.deepEqual(
    midi.notes.map((n) => [n.tick, n.note, n.vel, n.channel]),
    [
      [0, 36, 3, 9],
      [37, 38, 7, 9],
      [60, 44, 90, 9], // 22 as the drum map has it
    ],
  );
});
