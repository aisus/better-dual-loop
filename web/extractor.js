// The MIDI extractor, without its page: the stock drum patterns in the user's NUX zip or .bin as MIDI
// files.
import { midiFiles } from "../drum/stock.js";
import { STYLE_LIST } from "../drum/styles.js";
import { readOfficial } from "../patch/index.js";
import release from "../release.json";
import { openInput, size } from "./input.js";
import { makeZip } from "./zip.js";

// The result for the user's `file`: {name, blob}; throws what is wrong with it. `line` as for the
// patcher (patcher.js).
export async function extractFile(file, line) {
  const { image } = await openInput(file, line);
  const extracting = line("Extracting the patterns…", "busy");
  const files = midiFiles((await readOfficial(image, release)).resources);
  extracting(`${files.length} patterns, ${STYLE_LIST.length} styles.`, "done");
  const packing = line("Packing the zip…", "busy");
  const blob = new Blob([await makeZip(files)], { type: "application/zip" });
  packing(`Zip packed: ${size(blob.size)}.`, "done");
  return { name: `NUX_DualLoopStereo_drums_${release.official}.zip`, blob };
}
