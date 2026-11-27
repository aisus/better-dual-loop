// The zips: take the firmware image out of NUX's, pack the same zip again with the modded image in
// place of the official one, make a zip of files. JSZip does the zip format; this file decides what
// goes where.
import JSZip from "jszip";
import { USE_NUX } from "../patch/index.js";

// A zip starts with a local file header: "PK\x03\x04".
const isZip = (bytes) => bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4;

// The firmware image: a .bin, not one of the "._" files macOS adds to zips it makes.
function isImage(entry) {
  const base = entry.name.split("/").pop();
  return !entry.dir && /\.bin$/i.test(base) && !base.startsWith("._") && !entry.name.startsWith("__MACOSX/");
}

// The image from what the user has: the .bin itself, or the NUX zip it came in (exactly one .bin).
// Returns {image, zip}; `zip` ({archive, bin}, null for a plain .bin) is what repackZip needs.
export async function readInput(bytes) {
  if (!isZip(bytes)) return { image: bytes, zip: null };
  let archive;
  try {
    archive = await JSZip.loadAsync(bytes, { checkCRC32: true });
  } catch (e) {
    throw new Error(`This zip can't be read.\n${USE_NUX}`, { cause: e });
  }
  const bins = Object.values(archive.files).filter(isImage);
  if (bins.length !== 1) throw new Error(`The zip has ${bins.length} .bin files, not one.\n${USE_NUX}`);
  return { image: await bins[0].async("uint8array"), zip: { archive, bin: bins[0] } };
}

// A zip of {name, bytes} files.
export function makeZip(files) {
  const out = new JSZip();
  for (const { name, bytes } of files) out.file(name, bytes);
  return out.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

// The user's zip again with `image` in place of its .bin. Every entry keeps its contents, date and
// permissions (the macOS updater stays executable) and its order; `rename(name)` gives each
// entry's new name (for the .bin too).
export async function repackZip(zip, image, rename) {
  const out = new JSZip();
  const entries = Object.values(zip.archive.files);
  for (const e of entries) {
    const options = {
      date: e.date,
      unixPermissions: e.unixPermissions,
      dosPermissions: e.dosPermissions,
      comment: e.comment,
      dir: e.dir,
      createFolders: false,
    };
    const data = e.dir ? null : e === zip.bin ? image : await e.async("uint8array");
    out.file(rename(e.name), data, options);
  }
  // Zips made on macOS or Linux carry Unix permissions, ones made on Windows DOS attributes.
  const platform = entries.some((e) => e.unixPermissions !== null) ? "UNIX" : "DOS";
  return out.generateAsync({ type: "uint8array", compression: "DEFLATE", platform });
}
