// Standard MIDI files in, drum parts out: the editor's import. Pure functions on bytes, no DOM.
import { BARS, TICKS } from "./patterns.js";

// The file: {format, ppq, tempo (BPM of the first tempo event, or null), meter (beats per bar of
// the first time signature, null without one; {num, den} in timeSignature), notes: [{tick, note,
// vel, channel}] (note-ons of all tracks, by tick), end (the last tick of any track)}. Throws on
// what isn't a usable MIDI file.
export function readMidi(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (bytes.length < 14 || text(0) !== "MThd") throw new Error("Not a MIDI file.");
  const headerLength = v.getUint32(4);
  const format = v.getUint16(8);
  const trackCount = v.getUint16(10);
  const division = v.getUint16(12);
  if (division & 0x8000) throw new Error("MIDI files with SMPTE timing aren't supported; export with beats (PPQ).");
  if (division === 0) throw new Error("The MIDI file has no ticks per beat.");
  const file = { format, ppq: division, tempo: null, meter: null, timeSignature: null, notes: [], end: 0 };
  let at = 8 + headerLength;
  for (let t = 0; t < trackCount && at + 8 <= bytes.length; t++) {
    const length = v.getUint32(at + 4);
    const start = at + 8;
    if (text(at) === "MTrk") readTrack(bytes, start, Math.min(start + length, bytes.length), file);
    at = start + length;
  }
  file.notes.sort((a, b) => a.tick - b.tick);
  return file;
}

function readTrack(bytes, at, end, file) {
  let tick = 0;
  let status = 0;
  const varint = () => {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      if (at >= end) throw new Error("The MIDI file is cut short.");
      const b = bytes[at++];
      value = (value << 7) | (b & 0x7f);
      if (!(b & 0x80)) return value;
    }
    throw new Error("The MIDI file is damaged (a length over 4 bytes).");
  };
  while (at < end) {
    tick += varint();
    let b = bytes[at];
    if (b & 0x80) {
      at++;
    } else if (status) {
      b = status; // running status: the byte is the first data byte
    } else {
      throw new Error("The MIDI file is damaged (data without a status).");
    }
    if (b === 0xff) {
      const type = bytes[at++];
      const length = varint();
      const data = bytes.subarray(at, at + length);
      if (type === 0x51 && length === 3 && file.tempo === null) {
        file.tempo = 60e6 / ((data[0] << 16) | (data[1] << 8) | data[2]);
      } else if (type === 0x58 && length >= 2 && file.timeSignature === null) {
        file.timeSignature = { num: data[0], den: 2 ** data[1] };
        file.meter = file.timeSignature.num;
      } else if (type === 0x2f) {
        at = end;
      }
      at += length;
      status = 0;
    } else if (b === 0xf0 || b === 0xf7) {
      const length = varint(); // (not at += varint(): that would add to the old at)
      at += length;
      status = 0;
    } else {
      status = b;
      const kind = b & 0xf0;
      const data = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
      const [d1, d2] = [bytes[at], bytes[at + 1]];
      at += data;
      if (kind === 0x90 && d2 > 0) file.notes.push({ tick, note: d1, vel: d2, channel: b & 0x0f });
    }
    file.end = Math.max(file.end, tick);
  }
}

// The kits' notes (from the sample bank).
export const KIT_NOTES = {
  standard: [22, 26, 36, 38, 40, 41, 42, 45, 46, 48, 51, 52, 55], // kits 1-9
  kit0: [22, 36, 38, 40, 41, 44, 45, 46, 48, 49, 51, 52, 55],
  clicks: [36, 37, 38, 39], // kit 99, the count-in's sticks
};
export const notesOf = (kit) => (kit === 0 ? KIT_NOTES.kit0 : kit === 99 ? KIT_NOTES.clicks : KIT_NOTES.standard);

// The drum map: the notes to write a clip with, for every kit, named by ear. A kit that lacks one has
// the sound under another note (mapNote).
export const DRUM_MAP = [
  [
    [36, "kick"],
    [38, "snare"],
    [40, "rimshot"],
  ],
  [
    [42, "closed hat"],
    [44, "closed hat 2"],
    [46, "open hat"],
    [26, "open hat 2"],
  ],
  [
    [41, "tom 1"],
    [45, "tom 2"],
    [48, "tom 3"],
  ],
  [
    [51, "ride"],
    [52, "crash 1"],
    [55, "crash 2"],
  ],
];
const NAMES = { ...Object.fromEntries(DRUM_MAP.flat()), 49: "ride / crash" }; // 49: kit 0 only

// A kit's note as the map has it: 22 is the sound of 42 or 44, whichever the kit lacks.
export const mapNumber = (note, kit) => (note !== 22 ? note : kit === 0 ? 42 : 44);

// A part's note, for people. One the kit lacks plays the kit's first one.
export function noteLabel(note, kit) {
  const notes = notesOf(kit);
  const sound = NAMES[mapNumber(notes.includes(note) ? note : notes[0], kit)] ?? "click";
  return `${mapNumber(note, kit)} ${sound}`;
}

// General MIDI drum notes a kit lacks, to the nearest sound it has (first one present wins).
const GM_MAP = {
  35: [36], // acoustic bass drum
  37: [40], // side stick
  42: [42, 22], // closed hat
  44: [44, 22], // pedal hat
  26: [26, 46],
  43: [41], // high floor tom
  47: [45], // low-mid tom
  50: [48], // high tom
  49: [49, 52], // crash 1
  57: [55], // crash 2
  53: [51], // ride bell
  59: [51], // ride 2
};

// A note for the kit: itself if the kit has it, else its mapping, else null (the pedal would play
// the kit's first note, a closed hat, so the editor leaves it out).
export function mapNote(note, kit) {
  const notes = notesOf(kit);
  if (notes.includes(note)) return note;
  return (GM_MAP[note] ?? []).find((n) => notes.includes(n)) ?? null;
}

// Outside General MIDI's drums (35-81), and not one of the hats below them: from a drum plugin with a
// map of its own, whose other notes mean other drums, too.
const isForeign = (note) => (note < 35 || note > 81) && note !== 22 && note !== 26;

// The clip's length in whole bars: to the end of the file, and at least to the last hit's bar. A
// note's own length means nothing for a drum hit, so one ringing over the last bar line adds no bar;
// an end just short of a bar line (up to a 32nd) counts as on it.
function clipBars(midi, notes, meter) {
  const bar = meter * midi.ppq;
  const hits = Math.floor(notes.at(-1).tick / bar) + 1;
  return Math.max(hits, Math.floor((midi.end + midi.ppq / 8) / bar));
}

// The part from a MIDI file for a cell: {part, warnings, lost: the hits its kit has no sound for}.
// `meter` is the cell's beats per bar, `kit` and `tempo` the part's; its length is the clip's, at most
// BARS. Notes on channel 10 only if the file has any there.
export function partFromMidi(midi, { meter, kit, tempo }) {
  const warnings = [];
  if (midi.meter !== null && midi.meter !== meter) {
    throw new Error(`The MIDI file is in ${midi.meter}/${midi.timeSignature.den}, the style in ${meter}/4.`);
  }
  const drums = midi.notes.some((n) => n.channel === 9);
  const notes = drums ? midi.notes.filter((n) => n.channel === 9) : midi.notes;
  if (!notes.length) throw new Error("The MIDI file has no notes.");
  const toTicks = (t) => Math.round((t * TICKS) / midi.ppq);
  const bars = clipBars(midi, notes, meter);
  const length = Math.min(bars, BARS);
  if (bars > BARS) {
    warnings.push(`The clip has ${bars} bars: only the first ${BARS} are used.`);
  } else if (![1, 2, 4, 8].includes(bars)) {
    warnings.push(
      `This pattern is ${bars} bars long. If that's wrong, set the clip's length in your DAW and export it again.`,
    );
  }
  const end = length * meter * TICKS;
  const events = [];
  const lost = []; // what the kit has no sound for
  for (const n of notes) {
    if (n.tick >= length * meter * midi.ppq) continue; // past the last bar used
    const tick = Math.min(toTicks(n.tick), end - 1); // (rounding can reach the bar line)
    const note = mapNote(n.note, kit);
    const hit = { tick, note: note ?? n.note, vel: Math.min(127, n.vel) };
    (note === null ? lost : events).push(hit);
  }
  if (notes.some((n) => isForeign(n.note))) {
    warnings.push("This doesn't look like General MIDI, so drums may not sound right.");
  }
  const numbers = [...new Set(lost.map((hit) => hit.note))].sort((a, b) => a - b);
  if (numbers.length) warnings.push(`This kit has no sound for notes: ${numbers.join(", ")}.`);
  return { part: { tempo, meter, beats: length * meter, kit, events }, lost, warnings };
}

// A part as a MIDI file (type 0, 120 ticks per beat, channel 10): tempo, time signature, each note
// a 30-tick note-on/off, and the end of the track at the part's end.
export function writeMidi(part) {
  const varint = (n) => {
    const out = [n & 0x7f];
    while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
    return out;
  };
  const end = part.beats * TICKS;
  const timed = [];
  for (const e of part.events) {
    timed.push([e.tick, 1, [0x99, e.note, e.vel]]);
    timed.push([Math.min(e.tick + TICKS / 4, end), 0, [0x89, e.note, 0]]);
  }
  timed.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const us = Math.round(60e6 / part.tempo);
  const track = [0, 0xff, 0x51, 3, us >> 16, (us >> 8) & 0xff, us & 0xff];
  track.push(0, 0xff, 0x58, 4, part.meter, 2, 24, 8);
  let now = 0;
  for (const [tick, , bytes] of timed) {
    track.push(...varint(tick - now), ...bytes);
    now = tick;
  }
  track.push(...varint(end - now), 0xff, 0x2f, 0);
  const chunk = (id, data) => {
    const n = data.length;
    return [...id].map((c) => c.charCodeAt(0)).concat([n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff], data);
  };
  return Uint8Array.from([...chunk("MThd", [0, 0, 0, 1, 0, TICKS]), ...chunk("MTrk", track)]);
}

// A part as a MIDI file for a DAW, on the drum map's notes (22 is the pedal's own).
export const clipFromPart = (part) =>
  writeMidi({ ...part, events: part.events.map((e) => ({ ...e, note: mapNumber(e.note, part.kit) })) });
