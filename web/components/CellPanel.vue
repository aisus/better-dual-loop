<script setup lang="ts">
// The selected cell: its state, the box that takes a clip for it and shows its pattern (a click or a drop
// on it takes another), what was wrong with the clip, and what to do with the pattern.
import { computed, useTemplateRef } from "vue";
import { chosenFile, useFileDrop } from "../file-drop";
import { backToStock, cell, cellState, exportMidi, importError, importMidi, userPart } from "../state/drums";
import DrumRoll from "./DrumRoll.vue";

const own = computed(() => userPart(cell.value));
const state = computed(() => cellState(cell.value));
// A clip that couldn't be used, or the warnings of the one that was.
const notes = computed(() => (importError.value ? [importError.value] : (own.value?.warnings ?? [])));

const dragging = useFileDrop(importMidi, useTemplateRef<HTMLElement>("box"));
const input = useTemplateRef("input");
function choose(e: Event) {
  const file = chosenFile(e);
  if (file) importMidi(file);
}
</script>

<template>
  <section class="panel" aria-live="polite">
    <div>
      <h2>Strength {{ (cell >> 2) + 1 }}, variation {{ (cell & 3) + 1 }}</h2>
      <p class="state" :class="state.kind">{{ state.text }}</p>
    </div>
    <input id="midi" ref="input" type="file" accept=".mid,.midi" hidden @change="choose" />
    <div ref="box" class="box" :class="{ dragging }">
      <button v-if="own" type="button" class="roll" aria-label="Replace the MIDI clip" @click="input?.click()">
        <DrumRoll :part="own.part" :lost="own.lost" />
      </button>
      <button v-else type="button" @click="input?.click()">Drop a MIDI clip here, or click to choose one</button>
    </div>
    <ul v-if="notes.length" class="warnings">
      <li v-for="w in notes" :key="w">{{ w }}</li>
    </ul>
    <template v-if="own">
      <div class="actions">
        <button class="quiet" type="button" @click="exportMidi">Export MIDI file</button>
        <button class="quiet" type="button" @click="backToStock">Revert to stock</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.panel {
  display: grid;
  gap: 0.7rem;
}
.state {
  color: var(--muted);
  font-size: var(--small);
}
.state.problem {
  color: var(--error);
}
.actions {
  display: flex;
  gap: 1.2rem;
}
.box {
  display: grid;
  align-items: center;
  min-height: 13.3rem; /* nine rows of the drum roll, and its margins */
  border-radius: 8px;
  background: var(--fill);
}
.box > button {
  align-self: stretch;
  padding: 1rem;
  border-radius: 8px;
  color: var(--muted);
}
.box > .roll {
  min-width: 0;
  padding: 0.8rem 1rem;
}
.box > button:hover {
  background: var(--fill-hover);
  color: var(--fg);
}
.dragging {
  outline: 2px dashed var(--next);
  outline-offset: -2px;
}
.warnings {
  padding: 0;
  list-style: none;
  color: var(--warn);
  font-size: var(--small);
}
</style>
