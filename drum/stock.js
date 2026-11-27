// The stock drum parts, from the official firmware's resources, as MIDI files.
import { u32 } from "../patch/firmware.js";
import { clipFromPart } from "./midi.js";
import { PARTS, decodePart } from "./patterns.js";
import { STYLE_LIST, clipName } from "./styles.js";

// Where the resources name each meter's set of styles. A set and a style are {count, count offsets
// from their own start}: a set's styles (0 is the count-in), a style's parts.
const SETS = { 3: 0x64, 4: 0x74 };
const item = (resources, table, i) => table + u32(resources, table + 4 + 4 * i);

export function readStockPart(resources, meter, style, part) {
  const at = item(resources, item(resources, u32(resources, SETS[meter]), style), part);
  return decodePart(resources.subarray(at, at + 4 * u32(resources, at))); // (its size in words comes first)
}

// [{name, bytes}]: a folder per style, numbered to keep their order, in it one per meter.
export const midiFiles = (resources) =>
  STYLE_LIST.flatMap(({ name, styles }, i) =>
    [4, 3]
      .filter((meter) => styles[meter])
      .flatMap((meter) =>
        Array.from({ length: PARTS }, (_, part) => ({
          name: `${String(i + 1).padStart(2, "0")} ${name}/${meter}-4/${clipName(name, meter, part)}`,
          bytes: clipFromPart(readStockPart(resources, meter, styles[meter], part)),
        })),
      ),
  );
