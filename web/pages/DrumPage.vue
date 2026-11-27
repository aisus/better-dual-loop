<script setup lang="ts">
import { computed } from "vue";
import { DRUM_MAP } from "../../drum/midi.js";
import CellGrid from "../components/CellGrid.vue";
import CellPanel from "../components/CellPanel.vue";
import ConsoleLog from "../components/ConsoleLog.vue";
import PageLayout from "../components/PageLayout.vue";
import PageNote from "../components/PageNote.vue";
import PageSection from "../components/PageSection.vue";
import { useFileDrop } from "../file-drop";
import {
  type Step,
  changed,
  connectDrive,
  connected,
  denied,
  lines,
  save,
  step,
  supported,
  there,
} from "../state/drums";

// What comes next: the console's last line, and nowhere else. Always an instruction.
const NEXT: Record<Step, string> = {
  connect: "Plug in the pedal, click and pick NUX LOOPER",
  reconnect: "Plug the pedal back in",
  edit: "Add a MIDI clip to a cell",
  save: "Save the changes to the pedal",
  restart: "Restart the pedal to apply the changes",
};
const next = computed(() => {
  if (!supported) return "";
  if (denied.value) return "Reconnect the pedal: the browser asks again";
  if (step.value === "restart" && !there.value) return "Restart the pedal and plug it back in";
  return NEXT[step.value];
});

// Only the cell panel takes files; elsewhere the browser must not open one.
useFileDrop(() => {});
</script>

<template>
  <PageLayout headline="Drum patterns" :press="supported && !connected ? 'Connect' : undefined" @press="connectDrive">
    <template #sub> Replaces the pedal's drum patterns with your MIDI clips. </template>

    <CellGrid :inert="!connected" />
    <template #bar>
      <div class="bar">
        <ConsoleLog class="console" :lines="lines">
          <li v-if="next" class="prompt">
            <span>{{ next }}</span>
          </li>
        </ConsoleLog>
        <button v-if="connected && !there" class="key" :class="{ lit: denied }" type="button" @click="connectDrive">
          Reconnect the pedal
        </button>
        <button v-else-if="connected && changed" class="key lit" type="button" @click="save">Save to the pedal</button>
      </div>
    </template>

    <template #detail>
      <CellPanel v-if="connected" />
      <PageNote v-else heading="Requirements" more="Stock patterns">
        A pedal with the mod installed, and Chrome or Edge on a computer.
        <template #more>Use <a href="#/midi">MIDI extractor</a> to get them as files.</template>
      </PageNote>
    </template>

    <template #sections>
      <PageSection heading="MIDI clips">
        <p>
          Drum clips of 1 to 8 bars, in the style's time signature. Most General MIDI clips work as they are. Note
          mapping:
        </p>
        <div class="map">
          <ul v-for="(group, i) in DRUM_MAP" :key="i">
            <li v-for="[note, name] in group" :key="note">
              <b>{{ note }}</b> {{ name }}
            </li>
          </ul>
        </div>
        <p>Use <a href="#/midi">MIDI extractor</a> to get stock patterns.</p>
      </PageSection>
      <PageSection heading="Removing custom patterns">
        Revert the cells to stock and save, or delete <code>NML-3DLS/DRUM/PATTERNS.BIN</code> on the pedal: all custom
        patterns are in this file.
      </PageSection>
    </template>
  </PageLayout>
</template>

<style scoped>
/* A fixed height: what the console says moves nothing else. A line across the screen over it. */
.bar {
  display: grid;
  align-content: start;
  height: 6.85rem;
  margin: -0.5rem calc(-1 * var(--gutter)) 0;
  padding: 0.5rem var(--gutter) 0;
  border-top: 1px solid rgb(255 255 255 / 0.12);
}
.console {
  max-height: 6.75rem; /* five lines */
  overflow-y: auto;
}
.console:not(:last-child) {
  max-height: 4.05rem; /* three, over the key */
}
.map {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6.8rem, auto));
  gap: 0.2rem 1rem;
  margin: 0.3rem 0;
  line-height: 1.4;
}
.map ul {
  padding: 0;
  list-style: none;
  white-space: nowrap;
}
.map ul li {
  margin: 0.1rem 0;
}
.map b {
  color: var(--fg);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
