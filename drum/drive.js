// The pedal's USB drive (USB mode), through the browser's File System Access API (Chrome, Edge):
// the user picks the drive (or its NML-3DLS folder), the page reads and writes
// DRUM/PATTERNS.BIN and reads and removes DRUM/STATUS.TXT. Nothing else on the drive is touched.

const FOLDER = "NML-3DLS";
export const canConnect = () => typeof globalThis.showDirectoryPicker === "function";

// The NML-3DLS folder, from the folder the user picks.
export async function connect() {
  const picked = await globalThis.showDirectoryPicker({ id: "nux-dual-loop", mode: "readwrite" });
  let root = picked;
  // (The messages are lines of the page's console: 44 columns at most.)
  const notThePedal = () => new Error("Not the pedal: pick the NUX LOOPER drive.");
  if (picked.name.toUpperCase() !== FOLDER) {
    try {
      root = await picked.getDirectoryHandle(FOLDER);
    } catch {
      throw notThePedal();
    }
  }
  // The firmware's own folder, as a check that this is the pedal.
  try {
    await root.getDirectoryHandle("DATA");
  } catch {
    throw notThePedal();
  }
  return root;
}

// null for a file or folder that isn't there; other errors are the drive's.
async function ifThere(promise) {
  try {
    return await promise;
  } catch (e) {
    if (e.name === "NotFoundError" || e.name === "TypeMismatchError") return null;
    throw e;
  }
}

async function read(dir, name) {
  const handle = await ifThere(dir.getFileHandle(name));
  const file = handle && (await ifThere(handle.getFile()));
  return file && new Uint8Array(await file.arrayBuffer());
}

// Whether the drive is there. Throws what else is wrong with it, a withdrawn permission for one.
export const isThere = async (root) => (await ifThere(root.getDirectoryHandle("DATA"))) !== null;

// {patterns: bytes or null, status: text or null}.
export async function readDrive(root) {
  const drum = await ifThere(root.getDirectoryHandle("DRUM"));
  const status = drum && (await read(drum, "STATUS.TXT"));
  const patterns = drum && (await read(drum, "PATTERNS.BIN"));
  // On a drive that's gone every file looks missing, and the next write would replace parts nobody saw.
  if (!(await isThere(root))) throw Object.assign(new Error("The pedal was disconnected."), { name: "NotFoundError" });
  return { patterns, status: status && new TextDecoder().decode(status) };
}

// Writes PATTERNS.BIN (or removes it for no parts), then removes STATUS.TXT: the next STATUS.TXT
// on the drive is the mod's answer to this file.
export async function writeDrive(root, bytes) {
  const drum = await root.getDirectoryHandle("DRUM", { create: true });
  if (bytes) {
    const handle = await drum.getFileHandle("PATTERNS.BIN", { create: true });
    const out = await handle.createWritable();
    await out.write(bytes);
    await out.close();
  } else {
    await remove(drum, "PATTERNS.BIN");
  }
  await remove(drum, "STATUS.TXT");
}

async function remove(dir, name) {
  try {
    await dir.removeEntry(name);
  } catch (e) {
    if (e.name !== "NotFoundError") throw e;
  }
}
