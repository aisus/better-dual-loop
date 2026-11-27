// The drum patterns' state: the user's parts per style and cell, from MIDI files, saved to the
// pedal's drive as PATTERNS.BIN (drum/patterns.js), checked against the pedal's STATUS.TXT. It stays
// while another page is shown.
import { computed, markRaw, reactive, ref, shallowRef, watch } from "vue";
import { brightColour, cellColour } from "../../drum/colours.js";
import { canConnect, connect, isThere, readDrive, writeDrive } from "../../drum/drive.js";
import { clipFromPart, partFromMidi, readMidi } from "../../drum/midi.js";
import {
  MIN_ROOM,
  PARTS,
  checkPart,
  decodePart,
  encodePart,
  parseStatus,
  readPatterns,
  writePatterns,
} from "../../drum/patterns.js";
import { STYLES, STYLE_LIST, cellName, clipName, stockPart } from "../../drum/styles.js";
import { startDownload } from "../download";
import { useConsole } from "./console";

export type Meter = 3 | 4;

export interface Hit {
  tick: number;
  note: number;
  vel: number;
}

// A part as the pedal plays it (drum/patterns.js).
export interface Part {
  tempo: number;
  meter: Meter;
  beats: number;
  kit: number;
  events: Hit[];
}

// A style of both meters, by name; a meter is missing where it has none.
interface StyleEntry {
  name: string;
  styles: Partial<Record<Meter, number>>;
}

interface UserPart {
  part: Part;
  lost: Hit[]; // of its clip: what the kit has no sound for
  warnings: string[]; // of its import
  saved: boolean; // as on the drive
}

// STATUS.TXT, parsed.
interface Status {
  mod?: string;
  format?: number;
  room?: number;
  state?: string;
  count?: number;
  loaded?: number;
}

type CellKind = "stock" | "custom" | "problem";

export const styles = STYLE_LIST as StyleEntry[];

// --- The selection -----------------------------------------------------------------------------------

export const meter = ref<Meter>(4);
const style = ref(1);
export const cell = ref(0); // the part, 0 to 15
// The selected style's index in `styles`.
export const styleIndex = computed(() => styles.findIndex((e) => e.styles[meter.value] === style.value));

// The selected style's colours, as on the pedal's drum page.
const family = computed(() => STYLES[meter.value][style.value - 1]!.family);
export const bright = computed(() => brightColour(family.value));
export const colour = (part: number) => cellColour(family.value, part);

// Another style: in 4/4, the most used, if it has it (3/4 stays with the style it was picked for).
export function selectStyle(index: number) {
  const entry = styles[index]!;
  meter.value = entry.styles[4] ? 4 : 3;
  style.value = entry.styles[meter.value]!;
  cell.value = 0;
}

// The same style in the other time signature, and the same cell.
export function selectMeter(to: Meter) {
  const other = styles[styleIndex.value]!.styles[to];
  if (to === meter.value || !other) return;
  meter.value = to;
  style.value = other;
}

// --- The parts ---------------------------------------------------------------------------------------

const key = (m: Meter, s: number, part: number) => `${m} ${s} ${part}`;
const parseKey = (k: string) => k.split(" ").map(Number) as [Meter, number, number];
const cellKey = (part: number) => key(meter.value, style.value, part);

const parts = reactive(new Map<string, UserPart>());
const root = shallowRef<FileSystemDirectoryHandle | null>(null); // the NML-3DLS folder, once it was read
const status = shallowRef<Status | null>(null); // null: no STATUS.TXT on the drive
const verdicts = reactive(new Map<string, string>()); // the pedal's, per part
let room = MIN_ROOM;

export const connected = computed(() => root.value !== null);
export const there = ref(false); // the drive, at the last look
export const denied = ref(false); // the browser withdrew the permission
export const changed = ref(false); // parts differ from what was last saved
const restart = ref(false); // parts on the drive, no STATUS.TXT: not loaded by the pedal yet
let onDrive: Uint8Array | null = null; // PATTERNS.BIN, as last seen or saved
let statusText: string | null = null; // STATUS.TXT, the same
export const supported = canConnect();

export const userPart = (part: number) => parts.get(cellKey(part));

// How many of a style's cells are the user's, in both meters.
export function userParts(entry: StyleEntry) {
  let count = 0;
  for (const m of [4, 3] as const) {
    const s = entry.styles[m];
    if (!s) continue;
    for (let part = 0; part < PARTS; part++) if (parts.has(key(m, s, part))) count++;
  }
  return count;
}

// The console: lines of 44 columns at most (components/PageLayout.vue).
const { lines, line: log, clear } = useConsole();
export { lines };
if (!supported) log("This needs Chrome or Edge on a computer.", "error");

addEventListener("beforeunload", (e) => {
  if (changed.value) e.preventDefault();
});

// --- Drive and files ---------------------------------------------------------------------------------

const errorName = (e: unknown) => (e as Error).name;
// Why the drive failed, in a word or two (the browser's own messages are long).
const reason = (e: unknown) =>
  ({ NotFoundError: "disconnected", NotAllowedError: "no permission" })[errorName(e)] ?? errorName(e);

interface Files {
  patterns: Uint8Array | null;
  status: string | null;
}

// Reading and writing take turns.
let turn: Promise<unknown> = Promise.resolve();
function inTurn<T>(what: () => Promise<T>): Promise<T> {
  const result = turn.then(what);
  turn = result.catch(() => {});
  return result;
}

function same(a: Uint8Array | null, b: Uint8Array | null) {
  return a === b || (!!a && !!b && a.length === b.length && a.every((byte, i) => byte === b[i]));
}

// Takes the drive's PATTERNS.BIN as the parts to edit.
function load(bytes: Uint8Array | null) {
  parts.clear();
  if (!bytes) return;
  const r = readPatterns(bytes, Math.max(room, bytes.length));
  if (r.state !== "OK") {
    log("Can't read the patterns on the pedal.", "error");
    log("Saving replaces them.", "info");
    return;
  }
  for (const e of r.entries as { meter: Meter; style: number; part: number; verdict: string; data: Uint8Array }[]) {
    if (e.verdict === "OK") {
      const part = markRaw(decodePart(e.data) as Part);
      parts.set(key(e.meter, e.style, e.part), { part, lost: [], warnings: [], saved: true });
    }
  }
}

function applyStatus(text: string | null) {
  statusText = text;
  verdicts.clear();
  status.value = null;
  if (!text) return;
  const s = parseStatus(text) as Status & {
    entries: { meter: Meter; style: number; part: number; verdict: string }[];
  };
  status.value = s;
  if (s.state === "OK") {
    for (const e of s.entries) {
      const k = key(e.meter, e.style, e.part);
      if (!verdicts.has(k)) verdicts.set(k, e.verdict);
    }
  }
  if (s.room) room = s.room;
}

const custom = (n: number) => `${n || "no"} custom ${n === 1 ? "pattern" : "patterns"}`;

function reportStatus() {
  const s = status.value;
  if (!s) {
    log(`The pedal has ${custom(parts.size)}.`, "info");
  } else if (s.format !== 1) {
    log("The pedal's mod is newer: reload this page.", "error");
  } else if (s.state === "OK") {
    const refused = s.count! - s.loaded!;
    if (refused) {
      log(`The pedal refused ${refused} of ${s.count} patterns.`, "error");
      log("Select a red cell to see why.", "info");
    } else log(`The pedal has ${custom(s.count!)}.`, "done");
  } else if (s.state === "NONE") {
    log(`The pedal has ${custom(0)}.`, "done");
  } else {
    log("The pedal refused the patterns file.", "error");
    log("It plays the stock patterns.", "info");
  }
}

export async function connectDrive() {
  let picked: FileSystemDirectoryHandle;
  try {
    picked = await connect();
  } catch (e) {
    if (errorName(e) === "AbortError") return;
    log(errorName(e) === "Error" ? (e as Error).message : `Could not connect: ${reason(e)}.`, "error");
    return;
  }
  await inTurn(async () => {
    let files: Files;
    try {
      files = await readDrive(picked);
    } catch (e) {
      // Not connected to a drive that can't be read: saving would replace parts nobody saw.
      log(`Could not read the pedal: ${reason(e)}.`, "error");
      return;
    }
    const again = connected.value;
    root.value = picked;
    denied.value = false;
    if (again) update(files, true);
    else first(files);
    there.value = true;
  });
}

// Takes what is on the drive.
function take(files: Files) {
  onDrive = files.patterns;
  applyStatus(files.status);
  load(files.patterns);
  restart.value = !!files.patterns && !files.status;
}

function first(files: Files) {
  clear();
  log("Connected.", "done");
  take(files);
  reportStatus();
}

// The drive again, after a while without it (`back`) or without looking. What isn't saved stays. The
// console starts anew: what it said is about the time before.
function update(files: Files, back: boolean) {
  const asBefore = same(files.patterns, onDrive);
  const answer = !!files.status && files.status !== statusText; // the pedal was restarted
  if (asBefore && !answer && !back) return;
  clear();
  if (back) log("Connected.", "done");
  if (asBefore) {
    applyStatus(files.status);
    if (answer) restart.value = false;
    if (restart.value) log("Not restarted yet, or the mod isn't on it.", "info");
    else if (answer || !changed.value) reportStatus();
  } else if (changed.value || restart.value) {
    if (changed.value) {
      log("The patterns on the pedal have changed.", "error");
      log("Saving replaces them.", "info");
    } else log("The last save didn't reach the pedal.", "error");
    onDrive = files.patterns;
    applyStatus(files.status);
    changed.value = true;
    restart.value = false;
    for (const v of parts.values()) v.saved = false;
  } else {
    log("The patterns on the pedal have changed.", "info");
    take(files);
    reportStatus();
  }
}

// The pedal's drive goes and comes back (ejected, unplugged, restarted): a look every now and then
// finds out, the browser has no event for it. Coming back it's read anew, also when nobody looked for
// a while, since it may have gone and come back meanwhile.
const LOOK_EVERY = 2000;
let looking = false;

// The drive went away (said once).
function away() {
  if (there.value) log("Disconnected.", "info");
  there.value = false;
}

async function look(anew: boolean) {
  if (!connected.value || looking || document.visibilityState !== "visible") return;
  looking = true;
  try {
    await inTurn(async () => {
      const gone = !(await isThere(root.value));
      if (!gone && (anew || !there.value)) update(await readDrive(root.value), !there.value);
      if (gone) away();
      else there.value = true;
      denied.value = false;
    });
  } catch (e) {
    // Also a drive that is just starting: the next look may do better.
    away();
    denied.value = errorName(e) === "NotAllowedError";
  }
  looking = false;
}
setInterval(() => look(false), LOOK_EVERY);
document.addEventListener("visibilitychange", () => look(true));

function fileBytes(): Uint8Array | null {
  const entries = [...parts.entries()]
    .map(([k, v]) => {
      const [m, s, part] = parseKey(k);
      return { meter: m, style: s, part, bytes: encodePart(v.part) };
    })
    .sort((a, b) => b.meter - a.meter || a.style - b.style || a.part - b.part);
  return entries.length ? writePatterns(entries) : null;
}

// After an edit: there is something to save unless it led back to what is saved.
function compare() {
  changed.value = !same(fileBytes(), onDrive);
  if (!changed.value) for (const v of parts.values()) v.saved = true;
}

function describe(k: string) {
  const [m, s, part] = parseKey(k);
  return `${STYLES[m][s - 1]!.name} ${m}/4, cell ${cellName(part)}`;
}

// What would stop the pedal from loading the parts, before writing: false if there is something, and
// it's said.
function canSave(bytes: Uint8Array | null) {
  const bad = [...parts].filter(([, v]) => checkPart(encodePart(v.part), v.part.meter) !== "OK");
  if (bad.length) {
    log(`Can't save: ${bad.length} ${bad.length === 1 ? "pattern has" : "patterns have"} problems.`, "error");
    for (const [k] of bad) log(describe(k), "info");
    return false;
  }
  if (bytes && bytes.length > room) {
    const kb = (n: number) => Math.ceil(n / 1024);
    log(`The patterns don't fit: ${kb(bytes.length)} of ${kb(room)} KB.`, "error");
    log("Shorten or remove some.", "info");
    return false;
  }
  return true;
}

export async function save() {
  const bytes = fileBytes();
  if (!canSave(bytes)) return;
  await inTurn(async () => {
    try {
      await writeDrive(root.value, bytes);
    } catch (e) {
      log(`Could not save: ${reason(e)}.`, "error");
      return;
    }
    onDrive = bytes;
    for (const v of parts.values()) v.saved = true;
    applyStatus(null);
    changed.value = false;
    restart.value = true;
    clear();
    log(bytes ? `Saved: ${custom(parts.size)}.` : "Saved: only stock patterns.", "done");
  });
}

// What comes next.
export type Step = "connect" | "reconnect" | "edit" | "save" | "restart";
export const step = computed<Step>(() => {
  if (!connected.value) return "connect";
  if (restart.value && !changed.value) return "restart";
  if (!there.value) return "reconnect";
  return changed.value ? "save" : "edit";
});

// --- The selected cell -------------------------------------------------------------------------------

// Why the last clip couldn't be used, for the cell it was meant for; until another is selected.
const clipError = shallowRef<{ key: string; text: string } | null>(null);
export const importError = computed(() => (clipError.value?.key === cellKey(cell.value) ? clipError.value.text : null));
watch([meter, style, cell], () => (clipError.value = null));

export async function importMidi(file: File) {
  // Where it was dropped, also if another cell is selected while it's read.
  const place = [meter.value, style.value, cell.value] as const;
  clipError.value = null;
  try {
    const midi = readMidi(new Uint8Array(await file.arrayBuffer()));
    // Only the pattern changes: the kit and tempo stay the stock part's.
    const { part, lost, warnings } = partFromMidi(midi, { meter: place[0], ...stockPart(...place) });
    parts.set(key(...place), { part: markRaw(part as Part), lost: markRaw(lost), warnings, saved: false });
    compare();
  } catch (e) {
    clipError.value = { key: key(...place), text: `${file.name}: ${(e as Error).message}` };
  }
}

export function exportMidi() {
  const v = userPart(cell.value);
  if (!v) return;
  const url = URL.createObjectURL(new Blob([clipFromPart(v.part)], { type: "application/octet-stream" }));
  startDownload(url, clipName(styles[styleIndex.value]!.name, meter.value, cell.value));
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function backToStock() {
  clipError.value = null;
  parts.delete(cellKey(cell.value));
  compare();
}

// --- A cell's state ----------------------------------------------------------------------------------

// Why a part or the file is refused, in words.
const PART_PROBLEM: Record<string, string> = {
  "BAD range": "this style or cell can't be replaced",
  "BAD duplicate": "the file has this cell twice",
  "BAD size": "it has too many hits (at most 508), or its data is damaged",
  "BAD meter": "it isn't in the style's time signature",
  "BAD beats": "its length isn't 1 to 8 whole bars",
  "BAD tempo": "its tempo is outside 30 to 250",
  "BAD kit": "the pedal has no such kit",
};
const FILE_PROBLEM: Record<string, string> = {
  "BAD format": "it's in a format this mod doesn't read",
  "BAD size": "it's damaged or too large",
  "BAD crc": "it's damaged",
};
const why = (verdict: string, table: Record<string, string>) => table[verdict] ?? "its data is damaged";

// What to say about a cell of the selected style.
export function cellState(part: number): { kind: CellKind; text: string } {
  const v = parts.get(cellKey(part));
  const verdict = verdicts.get(cellKey(part));
  const s = status.value;
  if (!connected.value) return { kind: "stock", text: "Connect the pedal first." };
  if (!v) {
    if (verdict && verdict !== "OK") {
      return {
        kind: "problem",
        text: `The pedal refused the pattern saved for this cell and uses the stock one: ${why(verdict, PART_PROBLEM)}.`,
      };
    }
    return { kind: "stock", text: "Stock" };
  }
  const local = checkPart(encodePart(v.part), v.part.meter);
  if (local !== "OK") {
    return { kind: "problem", text: `This pattern can't be saved: ${why(local, PART_PROBLEM)}.` };
  }
  if (!v.saved) return { kind: "custom", text: "Custom, not saved" };
  if (s && s.state !== "NONE" && s.state !== "OK") {
    const because = s.state?.startsWith("BAD") ? why(s.state, FILE_PROBLEM) : "it couldn't read it";
    return {
      kind: "problem",
      text: `The pedal refused the file with all custom patterns and uses the stock ones: ${because}.`,
    };
  }
  if (s?.state === "OK" && verdict && verdict !== "OK") {
    return {
      kind: "problem",
      text: `The pedal refused this pattern and uses the stock one: ${why(verdict, PART_PROBLEM)}.`,
    };
  }
  return { kind: "custom", text: "Custom, saved" };
}
