// The pictures in the resources: groups of BMP files, looked up by (group, id). The word at 0x34
// points to a table {count, offset[count]} of the groups; each group is a table of the same shape
// whose offsets, relative to the table itself, point to the BMPs.
import { setU32, u32 } from "./firmware.js";

// The firmware reads group 3 through a RAM copy of 0x19000 bytes starting at its table, so this
// group moves as a whole, its own pictures included.
const COPIED_GROUP = 3;

const align4 = (n) => (n + 3) & ~3;
const pad4 = (bytes) => new Uint8Array(align4(bytes.length) - bytes.length);

export function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// Offsets add up as 32-bit numbers, as in the firmware: a table moved behind its pictures holds
// negative offsets.
const entries = (res, table) =>
  Array.from({ length: u32(res, table) }, (_, i) => (table + u32(res, table + 4 + 4 * i)) >>> 0);
const groupTables = (res) => entries(res, u32(res, 0x34));

// The offsets of every group's pictures.
export const groups = (res) => groupTables(res).map((table) => entries(res, table));

// Where a group's own pictures lie: from its first one up to whatever comes next.
function groupBlock(res, group) {
  const all = groups(res);
  const last = all[group].at(-1);
  const later = [...groupTables(res), ...all.flat()].filter((p) => p > last);
  return [all[group][0], later.length ? Math.min(...later) : res.length];
}

// Add pictures ([{group, id, bmp}], ids following each group's last one). A table cannot grow in
// place, so each group's table is written anew at the end of the resources, followed by the new
// pictures.
export function addPictures(res, additions) {
  const stock = groups(res);
  const parts = [res, pad4(res)];
  const moved = []; // [group, new table offset]
  let end = align4(res.length);
  const byGroup = new Map(); // by hand: Map.groupBy needs Safari 17.4
  for (const a of additions) byGroup.set(a.group, [...(byGroup.get(a.group) ?? []), a]);
  for (const [group, items] of byGroup) {
    const table = new Uint8Array(4 + 4 * (stock[group].length + items.length));
    parts.push(table);
    let at = table.length; // offsets are relative to the table
    let offsets;
    if (group === COPIED_GROUP) {
      const [start, stop] = groupBlock(res, group);
      offsets = stock[group].map((o) => at + o - start);
      parts.push(res.subarray(start, stop));
      at += stop - start;
    } else {
      offsets = stock[group].map((o) => o - end);
    }
    for (const { bmp } of items) {
      offsets.push(at);
      parts.push(bmp, pad4(bmp));
      at += align4(bmp.length);
    }
    setU32(table, 0, offsets.length);
    offsets.forEach((o, i) => setU32(table, 4 + 4 * i, o));
    moved.push([group, end]);
    end += at;
  }
  const out = concat(parts);
  const top = u32(res, 0x34);
  for (const [group, table] of moved) setU32(out, top + 4 + 4 * group, table - top);
  return out;
}

// Where the run-length records starting at `at` reach their end-of-picture record: [its offset,
// x, y].
function rle4End(bytes, at) {
  let x = 0;
  let y = 0;
  for (;;) {
    const count = bytes[at];
    const value = bytes[at + 1];
    if (count) {
      x += count; // a run of one colour
      at += 2;
    } else if (value === 0) {
      x = 0; // end of row
      y++;
      at += 2;
    } else if (value === 1) {
      return [at, x, y]; // end of picture
    } else if (value === 2) {
      x += bytes[at + 2]; // move
      y += bytes[at + 3];
      at += 4;
    } else {
      const n = (value + 1) >> 1; // `value` pixels as they are, padded to 16 bits
      x += value;
      at += 2 + n + (n & 1);
    }
  }
}

// One picture of two stacked: the top one (in `res` at offset `at`) with `bottom` under it, both
// top-down 4-bit RLE BMPs of the same width and palette. The top picture's records are copied
// as they are, so none of its pixels is re-encoded.
export function stack(res, at, bottom) {
  const bmp = (bytes, at = 0) => new DataView(bytes.buffer, bytes.byteOffset + at);
  const pixels = at + bmp(res, at).getUint32(10, true);
  const height = -bmp(res, at).getInt32(22, true);
  const [end, x, y] = rle4End(res, pixels);
  const join = x ? [0, 0] : []; // finish the row
  const row = x ? y + 1 : y;
  if (row < height) join.push(0, 2, 0, height - row); // move down to the top picture's end
  const out = concat([
    res.subarray(at, end), // the top picture's header, palette and records
    Uint8Array.from(join),
    bottom.subarray(bmp(bottom).getUint32(10, true)),
  ]);
  bmp(out).setUint32(2, out.length, true); // file size
  bmp(out).setInt32(22, -(height - bmp(bottom).getInt32(22, true)), true); // height, negative: top-down
  bmp(out).setUint32(34, out.length - (pixels - at), true); // size of the records
  return out;
}
