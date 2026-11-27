// The site: web/ built into build/site/, as GitHub Pages serves it. One script and one stylesheet,
// not minified and not hashed, so what runs in the browser stays readable and comparable between
// builds. `npm run dev` serves it on http://localhost:8000/ instead, updated on every change.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { FILES } from "./patch/index.js";
import release from "./release.json" with { type: "json" };

const here = (path) => resolve(import.meta.dirname, path);

// The files the patch needs (patch/index.js FILES), next to the page: the blob from `make`
// (build/mods/) and the pictures. The blob must be the one this release was tested with; `npm run
// dev` only warns about another one, and the patcher then refuses its own result (it is pinned).
function releaseFiles() {
  const source = (name) => here(name.startsWith("mods/") ? `build/${name}` : name);

  function checkBlob() {
    const blob = source("mods/mods.bin");
    if (!existsSync(blob)) return `${blob} is missing: build it with make first`;
    const hash = createHash("sha256").update(readFileSync(blob)).digest("hex");
    if (hash === release.mods_sha256) return null;
    return (
      `${blob} (sha256 ${hash}) is not the blob this release was tested with (${release.mods_sha256}): ` +
      "build it from these sources with Arm GNU Toolchain 14.2.rel1"
    );
  }

  let serving = false;
  return {
    name: "release-files",
    configResolved(config) {
      serving = config.command === "serve";
    },
    buildStart() {
      const problem = checkBlob();
      if (!problem) return;
      if (!serving) this.error(problem);
      this.warn(`${problem}; the patcher will refuse to patch`);
    },
    generateBundle() {
      for (const fileName of FILES) {
        this.emitFile({ type: "asset", fileName, source: readFileSync(source(fileName)) });
      }
      // The picture link previews show (index.html), at an address that stays.
      const fileName = "screens/mods.png";
      this.emitFile({ type: "asset", fileName, source: readFileSync(here(`web/${fileName}`)) });
    },
    configureServer(server) {
      const paths = FILES.map(source);
      server.watcher.add(paths);
      server.watcher.on("all", (_event, path) => {
        if (paths.includes(path)) server.ws.send({ type: "full-reload" });
      });
      server.middlewares.use((req, res, next) => {
        const name = FILES.find((file) => req.url === `/${file}`);
        if (!name || !existsSync(source(name))) return next();
        res.setHeader("Cache-Control", "no-store");
        res.end(readFileSync(source(name)));
      });
    },
  };
}

// index.html's Content-Security-Policy is for the built site; the dev server adds inline styles.
const noPolicyInDev = {
  name: "no-policy-in-dev",
  apply: "serve",
  transformIndexHtml: (html) => html.replace(/<meta http-equiv="Content-Security-Policy".*?>/, ""),
};

export default defineConfig({
  root: here("web"),
  base: "./", // the site is in a folder of its own on GitHub Pages
  publicDir: false,
  plugins: [vue(), releaseFiles(), noPolicyInDev],
  // JSZip's unminified browser build (the default is minified).
  resolve: { alias: { jszip: "jszip/dist/jszip.js" } },
  server: { port: 8000, fs: { allow: [here(".")] } },
  build: {
    outDir: here("build/site"),
    emptyOutDir: true,
    minify: false,
    cssMinify: false,
    assetsInlineLimit: 0, // the policy has no data: URLs
    modulePreload: { polyfill: false },
    rolldownOptions: {
      output: { codeSplitting: false, entryFileNames: "[name].js", assetFileNames: "assets/[name][extname]" },
    },
  },
});
