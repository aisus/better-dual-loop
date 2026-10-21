// npm run build: the page in build/site/, as GitHub Pages serves it. The page's script is bundled
// with JSZip into one file, not minified, so what runs in the browser stays readable. The blob
// comes from `make` (build/mods/) and must be the one this release was tested with.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { build } from "esbuild";

const SITE = "build/site";
const MODS = "build/mods";

if (!existsSync(`${MODS}/mods.bin`)) {
  console.error(`${MODS}/mods.bin is missing: build it with make first`);
  process.exit(1);
}
const release = JSON.parse(readFileSync("release.json", "utf8"));
const blobHash = createHash("sha256")
  .update(readFileSync(`${MODS}/mods.bin`))
  .digest("hex");
if (blobHash !== release.mods_sha256) {
  console.error(
    `${MODS}/mods.bin (sha256 ${blobHash}) is not the blob this release was tested with ` +
      `(${release.mods_sha256}): build it from these sources with Arm GNU Toolchain 14.2.rel1`,
  );
  process.exit(1);
}

rmSync(SITE, { recursive: true, force: true });
mkdirSync(`${SITE}/mods`, { recursive: true });
await build({
  entryPoints: ["web/app.js"],
  bundle: true,
  format: "esm",
  outfile: `${SITE}/app.js`,
  logLevel: "warning",
  alias: { jszip: "jszip/dist/jszip.js" }, // JSZip's unminified browser build (the default is minified)
});
for (const name of ["index.html", "style.css", "favicon.svg"]) cpSync(`web/${name}`, `${SITE}/${name}`);
cpSync("release.json", `${SITE}/release.json`);
for (const name of ["mods.bin", "mods.sym"]) cpSync(`${MODS}/${name}`, `${SITE}/mods/${name}`);
cpSync("images", `${SITE}/images`, { recursive: true });
cpSync("web/screens", `${SITE}/screens`, { recursive: true });
console.log(`${SITE}/ ready`);
