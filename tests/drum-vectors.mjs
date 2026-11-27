// Test files for the drum patterns: the same file checks the editor's code here and the mod on the
// pedal (copied to the drive, the pedal's STATUS.TXT must equal `status`). Style 1 (ROCK-1) in
// 4/4: the parts that pass play markers that tell them apart by ear; every refused part is on its
// own cell, which must still play the stock part.
import { PART_WORDS, TICKS, encodePart, writePatterns } from "../drum/patterns.js";

const KICK = 36;
const SNARE = 38;
const HAT = 42;
const CRASH = 55;

// A bar-long figure repeated: the kick on beat 1, `snares` snares from beat 3 in 8ths, a crash on
// the first beat of the part (where it restarts).
function marker({ meter = 4, bars = 8, kit = 1, snares = 1, tempo = 120 }) {
  const events = [{ tick: 0, note: CRASH, vel: 100 }];
  for (let b = 0; b < bars; b++) {
    const bar = b * meter * TICKS;
    events.push({ tick: bar, note: KICK, vel: 110 });
    for (let i = 0; i < snares; i++) events.push({ tick: bar + 2 * TICKS + 60 * i, note: SNARE, vel: 100 });
  }
  return { tempo, meter, beats: bars * meter, kit, events };
}

// Words of a part, to break one rule.
function edit(part, change) {
  const bytes = encodePart(part);
  const words = new Uint32Array(bytes.buffer);
  change(words);
  return bytes;
}

// The largest part: PART_WORDS words, hats ramping in velocity over 8 bars.
function largest() {
  const n = (PART_WORDS - 8) / 2;
  const events = Array.from({ length: n }, (_, i) => ({
    tick: Math.floor((i * 32 * TICKS) / n),
    note: HAT,
    vel: 20 + Math.floor((100 * i) / n),
  }));
  return { tempo: 120, meter: 4, beats: 32, kit: 1, events };
}

export const RELEASE = "V2.2.0-MOD1.3";

// [entry, the STATUS.TXT verdict, what the cell plays on the pedal]
export const CASES = [
  [
    { meter: 4, style: 1, part: 0, bytes: encodePart(marker({ snares: 1 })) },
    "OK",
    "crash, then kick + 1 snare per bar",
  ],
  [{ meter: 4, style: 1, part: 1, bytes: edit(marker({}), (w) => (w[8] = 0x80000000 + 600)) }, "BAD tick", "stock"],
  [{ meter: 4, style: 1, part: 2, bytes: edit(marker({}), (w) => (w[w.length - 2] -= 1)) }, "BAD end", "stock"],
  [
    { meter: 4, style: 1, part: 3, bytes: encodePart(marker({ bars: 2, snares: 2 })) },
    "OK",
    "2-bar part: kick + 2 snares, crash every 2 bars",
  ],
  [{ meter: 4, style: 1, part: 4, bytes: encodePart(marker({ kit: 10 })) }, "BAD kit", "stock"],
  [{ meter: 4, style: 1, part: 5, bytes: edit(marker({}), (w) => (w[4] = 30)) }, "BAD beats", "stock"],
  [{ meter: 4, style: 1, part: 6, bytes: edit(marker({}), (w) => (w[3] = 0x302)) }, "BAD meter", "stock"],
  [{ meter: 4, style: 1, part: 7, bytes: encodePart(marker({ tempo: 20 })) }, "BAD tempo", "stock"],
  [{ meter: 4, style: 1, part: 8, bytes: edit(marker({}), (w) => (w[9] &= 0xff)) }, "BAD event", "stock"],
  [{ meter: 4, style: 1, part: 9, bytes: edit(marker({}), (w) => (w[0] -= 2)) }, "BAD size", "stock"],
  [{ meter: 4, style: 1, part: 10, bytes: edit(marker({}), (w) => (w[1] = 7)) }, "BAD header", "stock"],
  [{ meter: 4, style: 1, part: 11, offset: 0x10000, length: 64 }, "BAD place", "stock"],
  [
    { meter: 4, style: 1, part: 12, bytes: encodePart(marker({ kit: 4, snares: 3 })) },
    "OK",
    "kit 4 (electronic): kick + 3 snares",
  ],
  [
    { meter: 4, style: 1, part: 15, bytes: encodePart(largest()) },
    "OK",
    "the largest part: hats getting louder over 8 bars",
  ],
  [{ meter: 4, style: 30, part: 0, bytes: encodePart(marker({})) }, "BAD range", "-"],
  [
    { meter: 4, style: 1, part: 0, bytes: encodePart(marker({ snares: 4 })) },
    "BAD duplicate",
    "(cell 1.1 keeps 1 snare)",
  ],
  [
    { meter: 3, style: 1, part: 0, bytes: encodePart(marker({ meter: 3, snares: 2 })) },
    "OK",
    "3/4: crash, then kick + 2 snares per bar",
  ],
  [{ meter: 3, style: 1, part: 1, bytes: encodePart(marker({ meter: 4 })) }, "BAD meter", "stock"],
];

export const vectors = () => writePatterns(CASES.map(([e]) => e));
