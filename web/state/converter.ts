// What a page that takes NUX's zip and gives a file back has (components/ZipPage.vue): its console, whether
// it asks for a file, its result. It stays while another page is shown.
import { ref, shallowRef } from "vue";
import { startDownload } from "../download";
import { type LineKind, useConsole } from "./console";

type AddLine = (text: string, kind?: LineKind) => (text: string, kind?: LineKind) => void;

// `convert` gives the result for the user's file, or throws why it can't be used.
export function useConverter(convert: (file: File, line: AddLine) => Promise<{ name: string; blob: Blob }>) {
  const { lines, line, fail, clear } = useConsole();
  // Before the first file, and again after one that couldn't be used.
  const asking = ref(false);
  const download = shallowRef<{ url: string; name: string } | null>(null);

  // The download starts on its own; the console's link is for when the browser holds it back (a
  // second download without a click in between, or downloads blocked for the site).
  async function handle(file: File) {
    if (!asking.value && !download.value) return; // not ready, or still at the last one
    clear();
    asking.value = false;
    if (download.value) URL.revokeObjectURL(download.value.url);
    download.value = null;
    let result;
    try {
      result = await convert(file, line);
    } catch (e) {
      fail((e as Error).message);
      asking.value = true;
      return;
    }
    download.value = { url: URL.createObjectURL(result.blob), name: result.name };
    startDownload(download.value.url, result.name);
    line("Download started.", "done");
  }

  return { lines, line, clear, asking, download, handle };
}

export type Converter = ReturnType<typeof useConverter>;
