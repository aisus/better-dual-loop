// The patcher, without its page: this release's files, and the user's NUX zip or .bin through the
// patch into the result in the same form (the zip with the modded .bin in place of the official
// one, or the .bin).
import { FILES, patch } from "../patch/index.js";
import release from "../release.json";
import { openInput, size } from "./input.js";
import { repackZip } from "./zip.js";

// The patch's files (patch/index.js FILES), from next to the page: {name: bytes}.
export async function loadFiles() {
  const entries = FILES.map(async (name) => {
    const response = await fetch(name);
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    return [name, new Uint8Array(await response.arrayBuffer())];
  });
  return Object.fromEntries(await Promise.all(entries));
}

// The result for the user's `file`: {name, blob}; throws what is wrong with it. Three lines in the
// console once done: the .bin it used, the check that the result is the tested image, the result's
// size (the browser shows its name). `line(text, kind)` adds one and returns the function that
// changes it in place.
export async function patchFile(file, files, line) {
  const { image, zip } = await openInput(file, line);
  const building = line("Building the modded firmware…", "busy");
  const out = await patch(image, files, release);
  building("SHA-256 matches the tested firmware.", "done");
  const binName = `NML-3DLS-${release.version}.bin`;
  if (!zip) {
    const blob = new Blob([out], { type: "application/octet-stream" });
    line(`Firmware file: ${size(blob.size)}.`, "done");
    return { name: binName, blob };
  }
  const packing = line("Packing the zip…", "busy");
  const tag = (s) => s.replaceAll(release.official, release.version);
  // Folders are renamed for the release, the .bin to binName; other files keep their names.
  const rename = (entry) => {
    const dir = entry.slice(0, entry.lastIndexOf("/") + 1);
    return tag(dir) + (entry === zip.bin.name ? binName : entry.slice(dir.length));
  };
  const blob = new Blob([await repackZip(zip, out, rename)], { type: "application/zip" });
  packing(`Zip packed: ${size(blob.size)}.`, "done");
  const stem = file.name.replace(/\.zip$/i, "");
  const name = stem.includes(release.official) ? `${tag(stem)}.zip` : `${stem}-${release.version}.zip`;
  return { name, blob };
}
