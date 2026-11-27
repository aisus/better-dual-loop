<script setup lang="ts">
// The style picker and the selected style's 4 x 4 cells. Empty until the pedal is connected.
import { computed, ref } from "vue";
import { PARTS } from "../../drum/patterns.js";
import { cellName } from "../../drum/styles.js";
import {
  type Meter,
  bright,
  cell,
  cellState,
  colour,
  connected,
  meter,
  selectMeter,
  selectStyle,
  styleIndex,
  styles,
  userParts,
} from "../state/drums";

const METERS: Meter[] = [4, 3];
const pickedStyle = computed({ get: () => styleIndex.value, set: selectStyle });
const pickedMeter = computed({ get: () => meter.value, set: selectMeter });
const entry = computed(() => styles[styleIndex.value]!);

// A field stays focused after a pick, and the browser shows it as for the keyboard: not after a click.
const clicked = ref(false);
function leave(e: FocusEvent) {
  if (!(e.currentTarget as Element).contains(e.relatedTarget as Node | null)) clicked.value = false;
}

// As on the pedal: strength 1 at the bottom, 4 at the top.
const cells = computed(() =>
  Array.from({ length: PARTS }, (_, i) => {
    const part = 4 * (3 - (i >> 2)) + (i & 3);
    return { part, name: cellName(part), ...cellState(part) };
  }),
);

function label(i: number) {
  const n = userParts(styles[i]!);
  return n ? `${styles[i]!.name} (${n} custom)` : styles[i]!.name;
}
</script>

<template>
  <div class="cells" :class="{ off: !connected }">
    <div
      class="pickers"
      :class="{ clicked }"
      @pointerdown="clicked = true"
      @keydown="clicked = false"
      @focusout="leave"
    >
      <span class="field">
        <select v-model="pickedStyle" aria-label="Style">
          <option v-for="(s, i) in styles" :key="s.name" :value="i">{{ label(i) }}</option>
        </select>
      </span>
      <span class="field">
        <select v-model="pickedMeter" :disabled="!entry.styles[3] || !entry.styles[4]" aria-label="Time signature">
          <!-- Only the time signatures the style has. -->
          <template v-for="m in METERS" :key="m">
            <option v-if="entry.styles[m]" :value="m">{{ m }}/4</option>
          </template>
        </select>
      </span>
    </div>
    <div class="chart">
      <div class="axis strength" aria-hidden="true">STRENGTH</div>
      <div class="grid" role="group" aria-label="Cells" :style="{ '--bright': bright }">
        <button
          v-for="c in cells"
          :key="c.part"
          class="cell"
          :class="c.kind"
          :style="{ '--colour': colour(c.part) }"
          type="button"
          :aria-pressed="c.part === cell"
          :aria-label="`${c.name}: ${c.text}`"
          :title="`${c.name}: ${c.text}`"
          @click="cell = c.part"
        />
      </div>
      <div class="axis variation" aria-hidden="true">VARIATION</div>
    </div>
  </div>
</template>

<style scoped>
/* A title bar as the pedal's pages have, and the grid, its cells near the pedal's (1.29 : 1). */
.pickers {
  position: absolute;
  inset: 0 0 auto;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  min-height: 2.5rem;
  padding: 0.4rem 1.1rem;
  background: var(--fill-hover);
}
/* Fields as on the pedal's drum page: the value in a box, white when it's the one to change, and the
   pedal's mark for a choice, a small triangle turned right. */
.field {
  position: relative;
  display: flex;
  align-self: center;
  min-width: 0;
}
.field::after {
  content: "";
  position: absolute;
  top: 50%;
  right: 0.55rem;
  width: 0.35rem;
  height: 0.6rem;
  translate: 0 -50%;
  background: currentColor;
  clip-path: polygon(0 0, 100% 50%, 0 100%);
  opacity: 0.7;
  pointer-events: none;
}
.field:has(select:enabled:hover)::after,
.pickers:not(.clicked) .field:has(select:focus-visible)::after {
  color: #000;
}
.field:has(select:disabled)::after {
  content: none;
}
select {
  appearance: none;
  field-sizing: content;
  min-width: 0;
  padding: 0 1.4rem 0 0.6rem;
  border: 0;
  border-radius: 5px;
  background: rgb(255 255 255 / 0.1);
  color: inherit;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
select:enabled:hover,
.pickers:not(.clicked) select:focus-visible {
  background: #fff;
  color: #000;
}
.clicked select {
  outline: none;
}
select:disabled {
  padding-right: 0.6rem;
  background: none;
  opacity: 1;
  cursor: default;
}
option {
  background: var(--fill-hover);
  color: var(--fg);
}
/* The pedal's grid: joined cells near its 93 x 72, and the axes. */
.chart {
  --high: calc(4 * 2.75rem + 5px);
  position: relative;
  width: min(100% - 2.4rem, 15.6rem);
  margin: 1.5rem auto 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  height: var(--high);
  padding: 1px;
  background: #5b5e60;
}
.axis {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  height: 1.2rem;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.axis::before,
.axis::after {
  content: "";
  flex: 1;
  height: 1px;
  background: currentColor;
}
.axis::after {
  height: 7px;
  clip-path: polygon(
    0 3px,
    calc(100% - 7px) 3px,
    calc(100% - 7px) 0,
    100% 50%,
    calc(100% - 7px) 100%,
    calc(100% - 7px) 4px,
    0 4px
  );
}
.strength {
  position: absolute;
  top: var(--high);
  left: -1.3rem;
  width: var(--high);
  transform: rotate(-90deg);
  transform-origin: 0 0;
}
.cell {
  border: 1px solid #08090a;
  background: var(--colour);
}
.cell:hover {
  filter: brightness(1.25);
}
/* The user's are lit; a refused one is out. */
.cell.custom {
  background: var(--bright);
}
.cell.problem {
  background: var(--screen);
  box-shadow: inset 0 0 0 1px var(--error);
}
.cell[aria-pressed="true"] {
  outline: 2px solid #fff;
  outline-offset: -2px;
}
.cell:focus-visible {
  z-index: 1;
  border-radius: 0;
  outline: 2px solid var(--next);
  outline-offset: 2px;
}
/* Not connected: nothing to pick yet. */
.off .field {
  visibility: hidden;
}
.off .grid {
  background: #34383b;
}
.off .cell {
  outline: none;
  background: var(--fill);
}
.off .axis {
  opacity: 0.45;
}
</style>
