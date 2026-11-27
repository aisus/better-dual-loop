// Tests of drum/midi.js on MIDI files built here.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DRUM_MAP,
  KIT_NOTES,
  mapNote,
  mapNumber,
  noteLabel,
  notesOf,
  partFromMidi,
  readMidi,
  writeMidi,
} from "../drum/midi.js";
import { checkPart, encodePart } from "../drum/patterns.js";

const u32 = (n) => [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const chunk = (id, data) => [...id].map((c) => c.charCodeAt(0)).concat(u32(data.length), data);
const smf = (format, ppq, ...tracks) =>
  Uint8Array.from([
    ...chunk("MThd", [0, format, 0, tracks.length, ppq >> 8, ppq & 0xff]),
    ...tracks.flatMap((t) => chunk("MTrk", t)),
  ]);
const END = [0xff, 0x2f, 0];

test("format 1, 480 PPQ: tempo, meter, running status, sysex, notes of all tracks by tick", () => {
  const conductor = [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20, 0, 0xff, 0x58, 4, 4, 2, 24, 8, 0, ...END];
  const drums = [
    0,
    0xf0,
    2,
    0x7e,
    0xf7, // a sysex event
    0,
    0x99,
    36,
    100, // note-on, channel 10
    0,
    42,
    80, // running status
    0x83,
    0x60,
    0x89,
    36,
    0, // 480 ticks later: note-off
    0,
    0x99,
    38,
    0, // note-on with velocity 0 is a note-off
    0x81,
    0x70,
    38,
    90, // running status after the note-on above, 240 ticks
    0x8f,
    0x00,
    ...END, // end of track 1920 ticks later
  ];
  const midi = readMidi(smf(1, 480, conductor, drums));
  assert.equal(midi.format, 1);
  assert.equal(midi.ppq, 480);
  assert.equal(midi.tempo, 120);
  assert.deepEqual([midi.meter, midi.timeSignature], [4, { num: 4, den: 4 }]);
  assert.deepEqual(midi.notes, [
    { tick: 0, note: 36, vel: 100, channel: 9 },
    { tick: 0, note: 42, vel: 80, channel: 9 },
    { tick: 720, note: 38, vel: 90, channel: 9 },
  ]);
  assert.equal(midi.end, 720 + 1920);
});

test("what isn't a usable MIDI file", () => {
  assert.throws(() => readMidi(new Uint8Array(20)), /Not a MIDI file/);
  assert.throws(() => readMidi(smf(0, 0xe728, [0, ...END])), /SMPTE/);
  assert.throws(() => readMidi(smf(0, 96, [0x80, 0x80, 0x80, 0x80, 0x01])), /damaged/);
  assert.throws(() => readMidi(smf(0, 96, [0, 36, 100])), /damaged/);
});

test("a part from a clip: rescaled, mapped to the kit, length in whole bars", () => {
  const notes = [
    0,
    0x99,
    35,
    100, // acoustic bass drum -> kick
    0x60,
    0x99,
    49,
    110, // crash 1 at tick 96 (a beat at 96 PPQ)
    0x60,
    0x99,
    39,
    90, // hand clap: no sound in the kit
    0x60,
    0x99,
    42,
    70, // closed hat
    0x60,
    ...END,
  ];
  const midi = readMidi(smf(0, 96, notes));
  const { part, warnings } = partFromMidi(midi, { meter: 4, kit: 1, tempo: 90 });
  assert.deepEqual(part, {
    tempo: 90,
    meter: 4,
    beats: 4,
    kit: 1,
    events: [
      { tick: 0, note: 36, vel: 100 },
      { tick: 120, note: 52, vel: 110 },
      { tick: 360, note: 42, vel: 70 },
    ],
  });
  assert.match(warnings.join(" "), /no sound for notes: 39\./);
  assert.equal(warnings.length, 1); // none about the missing time signature
  assert.equal(checkPart(encodePart(part), 4), "OK");
  assert.equal(partFromMidi(midi, { meter: 4, kit: 0, tempo: 90 }).part.events[1].note, 49);
});

test("channel 10 only when the file has it; other channels otherwise", () => {
  const mixed = readMidi(smf(0, 120, [0, 0x90, 60, 100, 0, 0x99, 36, 100, 0, ...END]));
  assert.deepEqual(partFromMidi(mixed, { meter: 4, kit: 1, tempo: 120 }).part.events, [
    { tick: 0, note: 36, vel: 100 },
  ]);
  const plain = readMidi(smf(0, 120, [0, 0x90, 38, 100, 0, ...END]));
  assert.deepEqual(partFromMidi(plain, { meter: 4, kit: 1, tempo: 120 }).part.events, [
    { tick: 0, note: 38, vel: 100 },
  ]);
});

// A 4/4 clip at 480 PPQ: a hit per [tick, length]; the track ends at `end`, or with its last event.
function clip(hits, end = 0) {
  const varint = (n) => (n < 128 ? [n] : [...varint(n >> 7).map((b) => b | 0x80), n & 0x7f]);
  const events = hits
    .flatMap(([tick, length]) => [
      [tick, [0x99, 36, 100]],
      [tick + length, [0x89, 36, 0]],
    ])
    .sort((a, b) => a[0] - b[0]);
  const track = [0, 0xff, 0x58, 4, 4, 2, 24, 8];
  let now = 0;
  for (const [tick, bytes] of events) {
    track.push(...varint(tick - now), ...bytes);
    now = tick;
  }
  return readMidi(smf(0, 480, [...track, ...varint(Math.max(0, end - now)), ...END]));
}
const BAR = 4 * 480;
const beats = (bars) => [...Array(bars * 4).keys()].map((beat) => [beat * 480, 100]);

test("length: the clip's, in whole bars", () => {
  const length = (midi) => {
    const { part, warnings } = partFromMidi(midi, { meter: 4, kit: 1, tempo: 120 });
    assert.equal(checkPart(encodePart(part), 4), "OK");
    return [part.beats / 4, part.events.length, warnings.length];
  };
  assert.deepEqual(length(clip(beats(4), 4 * BAR)), [4, 16, 0]);
  assert.deepEqual(length(clip(beats(4))), [4, 16, 0]); // the track ends with the last note
  assert.deepEqual(length(clip(beats(3), 4 * BAR)), [4, 12, 0]); // the last bar is empty
  assert.deepEqual(length(clip(beats(3), 4 * BAR - 10)), [4, 12, 0]); // ... and its end a bit short
  // A note ringing over the last bar line adds no bar.
  assert.deepEqual(length(clip([...beats(3), [3 * BAR, 100], [3 * BAR + 1440, 720]])), [4, 14, 0]);
  assert.deepEqual(length(clip([...beats(4), [4 * BAR - 10, 100]])), [4, 17, 0]);
  // A hit that rounds to the bar line stays in its bar; one on the bar line starts another.
  assert.deepEqual(length(clip([...beats(4), [4 * BAR - 1, 100]])), [4, 17, 0]);
  assert.deepEqual(length(clip([...beats(4), [4 * BAR, 100]])), [5, 17, 1]);
  // An empty last bar the file doesn't tell about: the hint.
  assert.deepEqual(length(clip(beats(3))), [3, 12, 1]);
  assert.match(partFromMidi(clip(beats(3)), { meter: 4, kit: 1, tempo: 120 }).warnings[0], /3 bars long/);
});

test("longer clips are cut at 8 bars, the meter must match", () => {
  const { part, warnings } = partFromMidi(clip(beats(10)), { meter: 4, kit: 1, tempo: 120 });
  assert.deepEqual([part.beats, part.events.length], [32, 32]);
  assert.deepEqual(warnings, ["The clip has 10 bars: only the first 8 are used."]);
  const waltz = readMidi(smf(0, 120, [0, 0xff, 0x58, 4, 3, 2, 24, 8, 0, 0x99, 36, 100, 0, ...END]));
  assert.throws(() => partFromMidi(waltz, { meter: 4, kit: 1, tempo: 120 }), /in 3\/4, the style in 4\/4/);
  assert.equal(partFromMidi(waltz, { meter: 3, kit: 6, tempo: 120 }).part.beats, 3);
});

test("note mapping per kit", () => {
  assert.equal(mapNote(38, 1), 38);
  assert.equal(mapNote(44, 1), 22);
  assert.equal(mapNote(44, 0), 44);
  assert.equal(mapNote(42, 0), 22);
  assert.equal(mapNote(26, 0), 46);
  assert.equal(mapNote(57, 4), 55);
  assert.equal(mapNote(56, 1), null);
});

test("a part written as MIDI reads back as the same part", () => {
  const part = {
    tempo: 96,
    meter: 3,
    beats: 6,
    kit: 6,
    events: [
      { tick: 0, note: 36, vel: 100 },
      { tick: 0, note: 42, vel: 60 },
      { tick: 240, note: 38, vel: 90 },
      { tick: 700, note: 55, vel: 127 },
    ],
  };
  const midi = readMidi(writeMidi(part));
  assert.equal(Math.round(midi.tempo), 96);
  assert.equal(midi.meter, 3);
  assert.deepEqual(partFromMidi(midi, { meter: 3, kit: 6, tempo: 96 }).part, part);
});

test("the drum map: every note plays in every kit, and kits 1-9 have no other sound", () => {
  const map = DRUM_MAP.flat().map(([note]) => note);
  for (let kit = 0; kit < 10; kit++) {
    for (const note of map) assert.ok(notesOf(kit).includes(mapNote(note, kit)), `kit ${kit} note ${note}`);
    for (const note of notesOf(kit)) assert.equal(mapNote(mapNumber(note, kit), kit), note);
  }
  assert.deepEqual(map.map((note) => mapNote(note, 1)).sort(), [...KIT_NOTES.standard].sort());
  assert.equal(noteLabel(22, 1), "44 closed hat 2");
  assert.equal(noteLabel(22, 0), "42 closed hat");
  assert.equal(noteLabel(44, 0), "44 closed hat 2");
  assert.equal(noteLabel(54, 1), "54 closed hat 2"); // a note the kit lacks
});

test("a clip with notes outside General MIDI's drums gets a warning", () => {
  const clip = (...notes) => {
    const events = notes.map((note, i) => ({ tick: i * 120, note, vel: 100 }));
    return readMidi(writeMidi({ tempo: 100, meter: 4, beats: 4, kit: 1, events }));
  };
  const warnings = (...notes) => partFromMidi(clip(...notes), { meter: 4, kit: 1, tempo: 100 }).warnings;
  assert.match(warnings(36, 33, 23)[0], /General MIDI/);
  assert.deepEqual(warnings(22, 26, 35, 36, 57), []);
  assert.match(warnings(36, 54)[0], /no sound for notes: 54/); // General MIDI, but no sound for it
  const { part, lost } = partFromMidi(clip(36, 54, 33), { meter: 4, kit: 1, tempo: 100 });
  assert.deepEqual(part.events, [{ tick: 0, note: 36, vel: 100 }]);
  assert.deepEqual(lost, [
    { tick: 120, note: 54, vel: 100 },
    { tick: 240, note: 33, vel: 100 },
  ]);
});
