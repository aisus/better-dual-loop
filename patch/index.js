// The patch: the official firmware image plus our files -> the modded image. It accepts only the
// official image and, unless `development`, produces only the released, pedal-tested image (both
// pinned by SHA-256 in release.json). No I/O: the caller passes every file's contents.
import { build, parse } from "./firmware.js";
import { addPictures, concat, groups, stack } from "./pictures.js";
import { MODS_BASE, PICTURES, codeChanges } from "./mods.js";

export const FILES = ["mods/mods.bin", "mods/mods.sym", ...PICTURES.map((p) => `images/${p.file}`)];

export async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

// The symbol addresses in mods.sym (`nm` output: "address type name").
export function symbols(text) {
  const out = {};
  for (const line of text.trim().split("\n")) {
    const [address, , name] = line.split(" ");
    out[name] = parseInt(address, 16);
  }
  return out;
}

// `files` maps each name in FILES to its bytes. Returns the modded image.
export async function patch(input, files, release, { development = false } = {}) {
  const inputHash = await sha256(input);
  if (inputHash === release.output_sha256) {
    throw new Error(
      `This is already the modded ${release.version} firmware: flash it as it is.\n` +
        "To patch, use the zip as downloaded from NUX, or the .bin from it.",
    );
  }
  if (inputHash !== release.input_sha256) {
    throw new Error(
      `This is not the official ${release.official} firmware. ` +
        `Use the zip as downloaded from NUX, or the .bin from it.\nsha256\u00a0${inputHash}`,
    );
  }
  const official = parse(input);

  // Code: NUX's with our changes, then mods.bin.
  const blob = files["mods/mods.bin"];
  const code = concat([official.code, new Uint8Array(MODS_BASE - official.code.length), blob]);
  for (const [at, bytes] of codeChanges(symbols(new TextDecoder().decode(files["mods/mods.sym"])))) {
    code.set(bytes, at);
  }

  // Resources: our pictures added.
  const res = official.resources;
  const pictures = PICTURES.map(({ group, id, file, under }) => {
    const bmp = files[`images/${file}`];
    return { group, id, bmp: under === undefined ? bmp : stack(res, groups(res)[group][under], bmp) };
  });

  const image = build(official.header, code, addPictures(res, pictures));
  if (!development && (await sha256(image)) !== release.output_sha256) {
    throw new Error(`The result is not the released ${release.version} image. Reload the page and try again.`);
  }
  return image;
}
