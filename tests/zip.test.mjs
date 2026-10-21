// Tests of web/zip.js on zips made here (no NUX firmware needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { readInput, repackZip } from "../web/zip.js";

const DATE = new Date(Date.UTC(2025, 3, 29, 10, 20, 30));

// A zip of {name: bytes or null for a folder}; files named "*.app/..." are executables.
async function zip(entries, { store = false, platform = "UNIX" } = {}) {
  const z = new JSZip();
  for (const [name, data] of Object.entries(entries)) {
    const mode = data === null ? 0o40755 : name.includes(".app/") ? 0o100755 : 0o100644;
    z.file(name, data, { dir: data === null, date: DATE, unixPermissions: mode, createFolders: false });
  }
  return z.generateAsync({ type: "uint8array", compression: store ? "STORE" : "DEFLATE", platform });
}

test("a plain image passes through", async () => {
  const image = Uint8Array.from([1, 2, 3]);
  assert.deepEqual(await readInput(image), { image, zip: null });
});

test("takes the one .bin from a zip, ignoring macOS metadata", async () => {
  const image = Uint8Array.from({ length: 5000 }, (_, i) => i % 7);
  for (const store of [false, true]) {
    const data = await zip(
      {
        "NUX_FW/readme.txt": Uint8Array.of(1),
        "__MACOSX/NUX_FW/._fw.bin": Uint8Array.of(2),
        "NUX_FW/._fw.bin": Uint8Array.of(3),
        "NUX_FW/fw.BIN": image,
      },
      { store },
    );
    const got = await readInput(data);
    assert.deepEqual(got.image, image);
    assert.equal(got.zip.bin.name, "NUX_FW/fw.BIN");
  }
});

test("refuses a zip without or with several .bin files", async () => {
  for (const entries of [{ "a.txt": Uint8Array.of(1) }, { "a.bin": Uint8Array.of(1), "b/c.bin": Uint8Array.of(2) }]) {
    await assert.rejects(readInput(await zip(entries)), /expected exactly one/);
  }
});

test("refuses a damaged zip", async () => {
  const data = await zip({ "fw.bin": new TextEncoder().encode("the official image") }, { store: true });
  const at = Buffer.from(data).indexOf("official"); // stored as is
  data[at] ^= 1;
  await assert.rejects(readInput(data), /CRC32/);
  await assert.rejects(readInput(new TextEncoder().encode("PK\x03\x04 not really a zip")));
});

test("repacks the zip with the new image in place of the .bin", async () => {
  const image = Uint8Array.from({ length: 5000 }, (_, i) => i % 7);
  const modded = Uint8Array.from({ length: 6000 }, (_, i) => i % 5);
  const readme = new TextEncoder().encode("read me ".repeat(50));
  const tool = Uint8Array.of(0xca, 0xfe);
  const rename = (name) => name.replace("FW_V1/", "FW_V1-MOD/").replace("fw.bin", "fw-mod.bin");
  for (const platform of ["UNIX", "DOS"]) {
    const input = await readInput(
      await zip(
        { "FW_V1/": null, "FW_V1/readme.txt": readme, "FW_V1/Tool.app/run": tool, "FW_V1/fw.bin": image },
        { platform },
      ),
    );
    const again = await readInput(await repackZip(input.zip, modded, rename));
    assert.deepEqual(again.image, modded);
    const [before, after] = [input.zip.archive.files, again.zip.archive.files];
    assert.deepEqual(Object.keys(after), [
      "FW_V1-MOD/",
      "FW_V1-MOD/readme.txt",
      "FW_V1-MOD/Tool.app/run",
      "FW_V1-MOD/fw-mod.bin",
    ]);
    for (const name of ["FW_V1/readme.txt", "FW_V1/Tool.app/run"]) {
      const [a, b] = [before[name], after[rename(name)]];
      assert.deepEqual(await b.async("uint8array"), await a.async("uint8array"), name);
      for (const k of ["date", "unixPermissions", "dosPermissions"]) assert.deepEqual(b[k], a[k], `${name} ${k}`);
    }
    if (platform === "UNIX") assert.equal(after["FW_V1-MOD/Tool.app/run"].unixPermissions, 0o100755);
    assert.equal(after["FW_V1-MOD/"].dir, true);
  }
});
