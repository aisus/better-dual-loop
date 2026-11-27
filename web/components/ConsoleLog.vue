<script setup lang="ts">
import { onMounted, onUpdated, useTemplateRef } from "vue";
import type { Line } from "../state/console";

defineProps<{ lines: Line[] }>();
const list = useTemplateRef("list");

// The newest line stays in view.
const toEnd = () => list.value?.scrollTo(0, list.value.scrollHeight);
onMounted(toEnd);
onUpdated(toEnd);
</script>

<template>
  <ol ref="list" class="log" role="log" aria-live="polite">
    <li v-for="(line, i) in lines" :key="i" :class="line.kind">{{ line.text }}</li>
    <slot />
  </ol>
</template>

<style>
/* Not scoped: the lines in the slot are styled as the others. */
.log {
  list-style: none;
  padding: 0;
  font: var(--small) / 1.5 var(--mono);
  overflow-wrap: anywhere;
  white-space: pre-line;
}
.log li {
  padding-left: 1.5em;
  text-indent: -1.5em;
}
.log li::before {
  content: "› ";
  display: inline-block;
  width: 1.5em;
  text-indent: 0;
  opacity: 0.6;
}
.log .busy,
.log .info {
  color: var(--muted);
}
.log .done {
  color: var(--ok);
}
.log .done::before {
  content: "✓ ";
  opacity: 1;
}
.log .error {
  color: var(--error);
}
.log .error::before {
  content: "✗ ";
  opacity: 1;
}
.log .prompt::after {
  content: "▌";
  margin-left: 0.35em;
  color: var(--next);
  animation: blink 1.1s steps(1) infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .log .prompt::after {
    animation: none;
  }
}
</style>
