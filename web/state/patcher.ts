// The patcher's state.
import { loadFiles, patchFile } from "../patcher.js";
import { useConverter } from "./converter";

let files: Record<string, Uint8Array>;

export const patcher = useConverter((file, line) => patchFile(file, files, line));
const { line, clear, asking } = patcher;

async function load() {
  line("Loading…", "busy");
  try {
    files = await loadFiles();
    clear();
    asking.value = true;
  } catch {
    clear();
    line("Could not load the mod's files.", "error");
    line("Reload the page to try again.", "info");
  }
}

// Once, when the patcher is first shown.
let loading: Promise<void> | null = null;
export const ensureLoaded = () => (loading ??= load());
