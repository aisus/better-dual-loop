// A console's lines (components/ConsoleLog.vue shows them).
import { ref } from "vue";

export type LineKind = "" | "busy" | "info" | "done" | "error";
export interface Line {
  text: string;
  kind: LineKind;
}

export function useConsole() {
  const lines = ref<Line[]>([]);

  // Adds a line; the function returned changes it in place (a busy "Reading…" into its result).
  function line(text: string, kind: LineKind = "") {
    lines.value.push({ text, kind });
    const added = lines.value[lines.value.length - 1]!;
    return (newText: string, newKind: LineKind = "") => {
      added.text = newText;
      added.kind = newKind;
    };
  }

  // What went wrong: in place of the busy line of what was being done, else a line of its own.
  function fail(text: string) {
    const last = lines.value.at(-1);
    if (last?.kind === "busy") Object.assign(last, { text, kind: "error" });
    else line(text, "error");
  }

  const clear = () => (lines.value = []);
  return { lines, line, fail, clear };
}
