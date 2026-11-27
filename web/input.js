// What the patcher and the MIDI extractor share: the user's NUX zip or .bin.
import { readInput } from "./zip.js";

// The image in the user's `file`, and its zip (zip.js readInput), in a console line that then names
// the .bin used.
export async function openInput(file, line) {
  const step = line("Reading the file…", "busy");
  const { image, zip } = await readInput(new Uint8Array(await file.arrayBuffer()));
  step(`Using ${fit(zip ? zip.bin.name.slice(zip.bin.name.lastIndexOf("/") + 1) : file.name)}.`);
  return { image, zip };
}

// A file name that fits a console line of 44 columns with a few words: its middle left out.
export const fit = (name, room = 36) => (name.length <= room ? name : `${name.slice(0, room - 10)}…${name.slice(-9)}`);

// A file's size the way a download list shows it.
export const size = (bytes) => `${(bytes / 2 ** 20).toFixed(1)} MB`;
