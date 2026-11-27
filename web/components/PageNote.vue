<script setup lang="ts">
// What matters now, beside the screen: a heading and its text, and maybe a second, quieter pair (slot
// `more`).
defineProps<{ heading: string; more?: string }>();
</script>

<template>
  <div class="note">
    <h2>{{ heading }}</h2>
    <p><slot /></p>
    <template v-if="more">
      <h3>{{ more }}</h3>
      <p class="more"><slot name="more" /></p>
    </template>
  </div>
</template>

<style scoped>
.note {
  text-wrap: pretty;
}
h2,
h3 {
  margin-bottom: 0.3rem;
}
h3 {
  margin-top: 1rem;
}
h3,
.more {
  color: var(--muted);
}
</style>
