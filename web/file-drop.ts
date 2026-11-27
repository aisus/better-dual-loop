// A file dropped on `area` (without one: anywhere on the page) goes to `onFile`, for as long as the
// component is shown; nowhere does the browser open it. Returns whether a file is being dragged over
// the page.
import { type Ref, onMounted, onUnmounted, ref } from "vue";

const isFile = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;

export function useFileDrop(onFile: (file: File) => void, area?: Readonly<Ref<HTMLElement | null>>) {
  const over = ref(false);
  // Every element the file passes gets a dragenter and a dragleave, so the count is back at zero
  // when it has left the page.
  let entered = 0;

  const inArea = (e: DragEvent) => !area || !!area.value?.contains(e.target as Node);

  function dragenter(e: DragEvent) {
    if (isFile(e) && entered++ === 0) over.value = true;
  }
  function dragleave(e: DragEvent) {
    if (isFile(e) && --entered === 0) over.value = false;
  }
  function dragover(e: DragEvent) {
    if (!isFile(e)) return;
    e.preventDefault(); // take the drop instead of the browser opening the file
    if (!inArea(e)) e.dataTransfer!.dropEffect = "none";
  }
  function drop(e: DragEvent) {
    if (!isFile(e)) return;
    e.preventDefault();
    entered = 0;
    over.value = false;
    const file = e.dataTransfer?.files[0];
    if (file && inArea(e)) onFile(file);
  }

  onMounted(() => {
    addEventListener("dragenter", dragenter);
    addEventListener("dragleave", dragleave);
    addEventListener("dragover", dragover);
    addEventListener("drop", drop);
  });
  onUnmounted(() => {
    removeEventListener("dragenter", dragenter);
    removeEventListener("dragleave", dragleave);
    removeEventListener("dragover", dragover);
    removeEventListener("drop", drop);
  });
  return over;
}

// The file chosen in an <input type="file">, whose value is cleared: choosing the same file again
// is a change too.
export function chosenFile(e: Event): File | undefined {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  return file;
}
