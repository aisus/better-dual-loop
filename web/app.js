// The page: load this release's files, take the user's NUX zip or .bin, run the patch, offer the
// result in the same form (the zip with the modded .bin in place of the official one, or the .bin).
import { FILES, patch } from "../patch/index.js";
import { readInput, repackZip } from "./zip.js";

const $ = (id) => document.getElementById(id);
let release = null;
let files = null;
let downloadUrl = null;

// One console line; a busy line ("Reading…") is completed in place with set().
function line(text, kind = "") {
  const li = document.createElement("li");
  const set = (t, k = "") => {
    li.textContent = t;
    li.className = k;
  };
  set(text, kind);
  $("log").append(li);
  return set;
}

// The console until a file arrives: a line that asks for the file and opens the file picker (its
// label covers the whole console, style.css), and where the file goes.
function prompt() {
  const li = document.createElement("li");
  li.className = "prompt";
  const label = document.createElement("label");
  label.htmlFor = "file";
  label.textContent = "Drop the firmware zip here, or click to choose it.";
  li.append(label);
  $("log").append(li);
  line("Patched in this tab, the file never leaves your computer.", "info");
}

async function fetchOk(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response;
}

async function init() {
  try {
    release = await (await fetchOk("release.json")).json();
    const loaded = await Promise.all(
      FILES.map(async (name) => new Uint8Array(await (await fetchOk(name)).arrayBuffer())),
    );
    files = Object.fromEntries(FILES.map((name, i) => [name, loaded[i]]));
  } catch {
    $("log").replaceChildren();
    line("Could not load this release's files. Reload the page to try again.", "error");
    return;
  }
  $("version").textContent = release.version;
  for (const el of document.querySelectorAll(".v")) el.textContent = release.version;
  $("log").replaceChildren();
  prompt();
}

// The file's size the way a download list shows it.
const size = (bytes) => `${(bytes / 2 ** 20).toFixed(1)} MB`;

// Four lines once done: the .bin it used, the check that the result is the tested image, the file,
// and a link to it. The download starts on its own; the link is for when the browser holds it back
// (a second download without a click in between, or downloads blocked for the site).
async function handle(file) {
  if (!files) return;
  $("log").replaceChildren();
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  let step = line(`Reading ${file.name}…`, "busy");
  try {
    const { image, zip } = await readInput(new Uint8Array(await file.arrayBuffer()));
    step(`Using ${zip ? zip.bin.name.slice(zip.bin.name.lastIndexOf("/") + 1) : file.name}.`);
    step = line("Building the modded firmware…", "busy");
    const out = await patch(image, files, release);
    const hash = release.output_sha256;
    step(`Same as the tested image: SHA-256 ${hash.slice(0, 8)}…${hash.slice(-6)}`, "done");
    const binName = `NML-3DLS-${release.version}.bin`;
    let name = binName;
    let blob = new Blob([out], { type: "application/octet-stream" });
    if (zip) {
      step = line("Packing the zip…", "busy");
      const tag = (s) => s.replaceAll(release.official, release.version);
      // Folders are renamed for the release, the .bin to binName; other files keep their names.
      const rename = (entry) => {
        const dir = entry.slice(0, entry.lastIndexOf("/") + 1);
        return tag(dir) + (entry === zip.bin.name ? binName : entry.slice(dir.length));
      };
      blob = new Blob([await repackZip(zip, out, rename)], { type: "application/zip" });
      const stem = file.name.replace(/\.zip$/i, "");
      name = stem.includes(release.official) ? `${tag(stem)}.zip` : `${stem}-${release.version}.zip`;
    }
    downloadUrl = URL.createObjectURL(blob);
    // The zip's packing line becomes the result; for a .bin it is a new line.
    (zip ? step : line)(`${name}, ${size(blob.size)}`, "done");
    const a = Object.assign(document.createElement("a"), {
      href: downloadUrl,
      download: name,
      textContent: "Click to download",
    });
    const li = document.createElement("li");
    li.append("Done. ", a, " if it doesn't start automatically.");
    $("log").append(li);
    a.click();
  } catch (e) {
    step(e.message, "error");
    prompt();
  }
}

$("file").addEventListener("change", (e) => {
  if (e.target.files.length) handle(e.target.files[0]);
  e.target.value = ""; // choosing the same file again is a change too
});

// A file dropped anywhere on the page goes to the patcher; while one is dragged over the page, the
// console lights up. Every element the file passes gets a dragenter and a dragleave, so the count
// is back at zero when it has left the page.
const drop = $("drop");
const isFile = (e) => e.dataTransfer.types.includes("Files");
let entered = 0;
addEventListener("dragenter", (e) => {
  if (isFile(e) && entered++ === 0) drop.classList.add("over");
});
addEventListener("dragleave", (e) => {
  if (isFile(e) && --entered === 0) drop.classList.remove("over");
});
addEventListener("dragover", (e) => {
  if (isFile(e)) e.preventDefault(); // take the drop instead of the browser opening the file
});
addEventListener("drop", (e) => {
  if (!isFile(e)) return;
  e.preventDefault();
  entered = 0;
  drop.classList.remove("over");
  if (e.dataTransfer.files.length) handle(e.dataTransfer.files[0]);
});

// Smooth scrolling, unless the system asks for reduced motion.
const motion = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

// The screens: the arrows step through them (wrapping around at the ends); the strip can also be
// scrolled or swiped, snapping to a screen.
const slides = $("slides");
function step(by) {
  const n = slides.children.length;
  const current = Math.round(slides.scrollLeft / slides.clientWidth);
  slides.scrollTo({ left: ((current + by + n) % n) * slides.clientWidth, behavior: motion() });
}
$("prev").addEventListener("click", () => step(-1));
$("next").addEventListener("click", () => step(1));

init();
