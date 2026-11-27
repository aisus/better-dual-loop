// Tests of drum/drive.js on a made-up drive (the File System Access API's folders).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readDrive, writeDrive } from "../drum/drive.js";

const failure = (name) => Object.assign(new Error(name), { name });

// `state.error`: what every access fails with, as on a drive that is gone or can't be read.
function folder(state, kids = {}) {
  const access = () => {
    if (state.error) throw failure(state.error);
  };
  const get = (name, create, make) => {
    access();
    if (!kids[name] && !create) throw failure("NotFoundError");
    return (kids[name] ??= make());
  };
  return {
    kids,
    getDirectoryHandle: async (name, options) => get(name, options?.create, () => folder(state)),
    async getFileHandle(name, options) {
      const file = get(name, options?.create, () => ({ bytes: new Uint8Array() }));
      return {
        async getFile() {
          access();
          return new Blob([file.bytes]);
        },
        async createWritable() {
          let written;
          return { write: async (bytes) => (written = bytes), close: async () => (file.bytes = written) };
        },
      };
    },
    async removeEntry(name) {
      get(name);
      delete kids[name];
    },
  };
}

const text = (s) => new TextEncoder().encode(s);

test("reads both files; a missing file or DRUM folder is null", async () => {
  const state = {};
  const root = folder(state, { DATA: folder(state) });
  assert.deepEqual(await readDrive(root), { patterns: null, status: null });
  root.kids.DRUM = folder(state, { "STATUS.TXT": { bytes: text("status") } });
  assert.deepEqual(await readDrive(root), { patterns: null, status: "status" });
  root.kids.DRUM.kids["PATTERNS.BIN"] = { bytes: text("parts") };
  assert.deepEqual(await readDrive(root), { patterns: text("parts"), status: "status" });
});

test("a drive that is gone, or goes while it's read, is not an empty one", async () => {
  const state = { error: "NotFoundError" };
  const root = folder(state, { DATA: folder(state), DRUM: folder(state) });
  await assert.rejects(readDrive(root), /disconnected/);
  state.error = "NotReadableError";
  await assert.rejects(readDrive(root), { name: "NotReadableError" });
  state.error = null;
  const drum = root.kids.DRUM;
  root.getDirectoryHandle = async (name) => {
    if (name === "DRUM") return drum;
    throw failure("NotFoundError");
  };
  await assert.rejects(readDrive(root), /disconnected/);
});

test("a write stores the parts and removes STATUS.TXT; no parts remove the file", async () => {
  const state = {};
  const root = folder(state, { DATA: folder(state) });
  await writeDrive(root, text("parts"));
  root.kids.DRUM.kids["STATUS.TXT"] = { bytes: text("status") };
  await writeDrive(root, text("other"));
  assert.deepEqual(await readDrive(root), { patterns: text("other"), status: null });
  await writeDrive(root, null);
  assert.deepEqual(await readDrive(root), { patterns: null, status: null });
});
