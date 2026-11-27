<script setup lang="ts">
// A section of the page, closed at first; one open at a time. `open`: opened by the page itself.
defineProps<{ heading: string; open?: boolean }>();
</script>

<template>
  <details name="sections" :open="open">
    <summary>{{ heading }}</summary>
    <div class="text"><slot /></div>
  </details>
</template>

<style scoped>
summary {
  display: flex;
  gap: 0.6rem;
  width: fit-content;
  cursor: pointer;
  list-style: none;
  font-weight: 500;
}
summary::-webkit-details-marker {
  display: none;
}
summary::before {
  content: "+";
  width: 0.7em;
  color: var(--muted);
  font-weight: 400;
}
[open] > summary::before {
  content: "–";
}
summary:hover {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.22em;
}
.text {
  padding: 0.4rem 0 0 1.3rem;
  color: var(--muted);
  font-size: var(--small);
}
.text :slotted(ol) {
  padding-left: 1.2rem;
}
.text :slotted(li) {
  margin: 0.4rem 0;
}
.text :slotted(p + p) {
  margin-top: 0.4rem;
}
</style>
