<script setup lang="ts">
// A part as a small drum roll: a row per note it uses, a column per 16th. `lost`: hits of its clip that
// the kit has no sound for, in rows of their own, by number.
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from "vue";
import { mapNumber, noteLabel } from "../../drum/midi.js";
import { TICKS } from "../../drum/patterns.js";
import { type Hit, type Part, bright } from "../state/drums";

const props = defineProps<{ part: Part; lost: Hit[] }>();

const STEP = TICKS / 4;

// The room there is, and the page's rem (the labels are text of the page's small size), followed as the
// window changes.
const wrap = useTemplateRef("wrap");
const room = ref(0);
const rem = ref(16);
const observer = new ResizeObserver(() => {
  room.value = wrap.value?.clientWidth ?? 0;
  rem.value = parseFloat(getComputedStyle(document.documentElement).fontSize);
});
const LABEL = computed(() => 6.5 * rem.value); // the names' width
const ROW = computed(() => 1.3 * rem.value);
onMounted(() => observer.observe(wrap.value!));
onUnmounted(() => observer.disconnect());

// The rows, the highest note first. (A lost note is never one of the part's: the kit has those.)
const notes = (hits: Hit[]) => [...new Set(hits.map((hit) => hit.note))];
const rows = computed(() =>
  [
    ...notes(props.part.events).map((note) => ({
      note,
      order: mapNumber(note, props.part.kit),
      label: noteLabel(note, props.part.kit),
      lost: false,
    })),
    ...notes(props.lost).map((note) => ({ note, order: note, label: String(note), lost: true })),
  ].sort((a, b) => b.order - a.order),
);
const hits = computed(() => [
  ...props.part.events.map((hit) => ({ ...hit, lost: false })),
  ...props.lost.map((hit) => ({ ...hit, lost: true })),
]);
const row = (hit: { note: number; lost: boolean }) =>
  rows.value.findIndex((r) => r.note === hit.note && r.lost === hit.lost);
const bars = computed(() => props.part.beats / props.part.meter);
// A 16th's width: the whole part in the panel, but no narrower than 2.5 units.
const column = computed(() =>
  Math.max(2.5, Math.min(14, (room.value - LABEL.value - 1) / ((props.part.beats * TICKS) / STEP))),
);
const x = (tick: number) => LABEL.value + (tick * column.value) / STEP;
const width = computed(() => x(props.part.beats * TICKS));
const height = computed(() => rows.value.length * ROW.value);

// The grid: the rows and the 16ths (where there is room), the beats, the bars; each line on top of the finer ones.
const upright = (step: number) => {
  const count = (props.part.beats * TICKS) / step;
  return Array.from({ length: count + 1 }, (_, i) => `M${x(i * step)} 0V${height.value}`).join("");
};
const fine = computed(() => {
  const across = Array.from(
    { length: rows.value.length + 1 },
    (_, i) => `M${LABEL.value} ${i * ROW.value}H${width.value}`,
  ).join("");
  return across + (column.value >= 6 ? upright(STEP) : "");
});
</script>

<template>
  <div ref="wrap" class="roll-wrap">
    <svg
      class="roll"
      :style="{ '--bright': bright }"
      role="img"
      :aria-label="`${part.events.length} hits over ${bars} bars`"
      :viewBox="`-0.5 -0.5 ${width + 1} ${height + 1}`"
      :width="width + 1"
      :height="height + 1"
    >
      <path class="grid" :d="fine" />
      <path class="grid" :d="upright(TICKS)" />
      <path class="grid bar" :d="upright(part.meter * TICKS)" />
      <text v-for="(r, i) in rows" :key="i" class="note" :class="{ lost: r.lost }" :x="0" :y="(i + 0.7) * ROW">
        {{ r.label }}
      </text>
      <rect
        v-for="(e, i) in hits"
        :key="i"
        class="hit"
        :class="{ lost: e.lost }"
        :x="x(e.tick) + 0.5"
        :y="(row(e) + 0.15) * ROW"
        :width="column - 1"
        :height="0.7 * ROW"
        rx="2"
        :fill-opacity="0.3 + (0.7 * e.vel) / 127"
      />
    </svg>
  </div>
</template>

<style scoped>
.roll-wrap {
  overflow-x: auto;
}
.roll {
  display: block;
  font-size: var(--small);
}
.note {
  fill: var(--muted);
}
.grid {
  stroke: rgb(255 255 255 / 0.045);
  shape-rendering: crispEdges;
}
.bar {
  stroke: rgb(255 255 255 / 0.18);
}
/* The colour of its cell; what the kit doesn't play is hollow. */
.hit {
  fill: var(--bright);
}
.note.lost {
  fill: var(--warn);
}
.hit.lost {
  fill: none;
  stroke: var(--warn);
}
</style>
