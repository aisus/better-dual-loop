<script setup lang="ts">
import release from "../../release.json";

const REPO = "https://github.com/aisus/better-dual-loop";
</script>

<template>
  <footer>
    <p>
      Unofficial project, not affiliated with NUX Audio / Cherub Technology. All trademarks are the property of their
      respective owners.
    </p>
    <a :href="`${REPO}/blob/main/CHANGELOG.md`">{{ release.version }}</a>
    <a :href="REPO">GitHub</a>
  </footer>
</template>

<style scoped>
footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 1.5rem;
  margin-top: auto;
  padding: 1.2rem 0;
  color: var(--muted);
  font-size: var(--small);
}
p {
  margin-right: auto;
}
</style>
