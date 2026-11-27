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

// What to use instead of a file that isn't NUX's. (Messages are lines of the page's console: 44
// columns at most.)
export const USE_NUX = "Use NUX's zip, or the .bin from it.";

// The official image's header, code and resources; throws for any other image.
export async function readOfficial(input, release) {
  const hash = await sha256(input);
  if (hash === release.output_sha256) {
    throw new Error(`This is the modded firmware.\n${USE_NUX}`);
  }
  if (hash !== release.input_sha256) {
    throw new Error(`Not the official ${release.official} firmware.\n${USE_NUX}`);
  }
  return parse(input);
}

// `files` maps each name in FILES to its bytes. Returns the modded image.
export async function patch(input, files, release, { development = false } = {}) {
  const official = await readOfficial(input, release);

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
    throw new Error("The result is not the released image.\nReload the page and try again.");
  }
  return image;
}
