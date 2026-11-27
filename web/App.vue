<script setup lang="ts">
import { computed, nextTick, watch } from "vue";
import AppFooter from "./components/AppFooter.vue";
import DrumPage from "./pages/DrumPage.vue";
import HomePage from "./pages/HomePage.vue";
import MidiPage from "./pages/MidiPage.vue";
import PatcherPage from "./pages/PatcherPage.vue";
import { route } from "./route";

const PAGES = {
  home: { component: HomePage, title: "Better Dual Loop" },
  patcher: { component: PatcherPage, title: "Firmware patcher · Better Dual Loop" },
  drums: { component: DrumPage, title: "Drum patterns · Better Dual Loop" },
  midi: { component: MidiPage, title: "MIDI extractor · Better Dual Loop" },
};
const page = computed(() => PAGES[route.value]);

watch(page, ({ title }) => (document.title = title), { immediate: true });
watch(page, async () => {
  await nextTick();
  scrollTo(0, 0);
});
</script>

<template>
  <main>
    <component :is="page.component" />
    <AppFooter />
  </main>
</template>
