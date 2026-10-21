// The few Thumb-2 instructions the patch writes into the firmware's code, as bytes.

export const nops = (count) => Array(count).fill([0x00, 0xbf]).flat();

// `bl target` (call) or `b.w target` (jump) at code address `at`.
function branch(at, target, link) {
  const off = target - (at + 4);
  const s = (off >> 24) & 1;
  const j1 = (~(off >> 23) ^ s) & 1;
  const j2 = (~(off >> 22) ^ s) & 1;
  const hw1 = 0xf000 | (s << 10) | ((off >> 12) & 0x3ff);
  const hw2 = (link ? 0xd000 : 0x9000) | (j1 << 13) | (j2 << 11) | ((off >> 1) & 0x7ff);
  return [hw1 & 0xff, hw1 >> 8, hw2 & 0xff, hw2 >> 8];
}

export const bl = (at, target) => branch(at, target, true);
export const bw = (at, target) => branch(at, target, false);

// A function table entry: the address of a Thumb function (lowest bit set), little-endian.
export const pointer = (address) => [0, 8, 16, 24].map((shift) => ((address | 1) >>> shift) & 0xff);
