<script setup lang="ts">
// A page that takes NUX's zip and gives a file back: its console is the pedal's screen, under a title
// bar as the pedal's pages have. Slots: `sub`, `sections` (PageLayout.vue), `firmware` (more about
// the firmware it takes).
import { useTemplateRef } from "vue";
import release from "../../release.json";
import { chosenFile, useFileDrop } from "../file-drop";
import type { Converter } from "../state/converter";
import ConsoleLog from "./ConsoleLog.vue";
import PageLayout from "./PageLayout.vue";
import PageNote from "./PageNote.vue";

const props = defineProps<{ headline: string; title: string; converter: Converter }>();

const { lines, asking, download, handle } = props.converter;

// A file dropped anywhere on the page.
const over = useFileDrop(handle);

const input = useTemplateRef("input");
function choose(e: Event) {
  const file = chosenFile(e);
  if (file) handle(file);
}
</script>

<template>
  <PageLayout :headline :over :press="asking ? 'Choose the zip' : undefined" @press="input?.click()">
    <template #sub><slot name="sub" /></template>

    <p class="title">{{ title }}</p>
    <input id="file" ref="input" type="file" accept=".zip,.bin" hidden @change="choose" />
    <ConsoleLog class="console" :lines="lines">
      <li v-if="asking" class="prompt"><span>Drop the zip here, or click to choose it</span></li>
    </ConsoleLog>
    <template #bar>
      <div class="bar">
        <span v-if="asking" class="hint">Runs in the browser, nothing is uploaded.</span>
        <a v-else-if="download" class="key" :href="download.url" :download="download.name">Download again</a>
      </div>
    </template>

    <template #detail>
      <PageNote heading="Supported firmware">
        <a href="https://nuxaudio.com/product/dualloopstereo/">Official {{ release.official }}</a
        >, for Windows or macOS.<slot name="firmware" />
      </PageNote>
    </template>
    <template #sections><slot name="sections" /></template>
  </PageLayout>
</template>

<style scoped>
.console {
  margin-top: 1.9rem;
}
.bar {
  display: flex;
  align-items: end;
  min-height: 2.4rem;
}
</style>
