<script setup lang="ts">
import { ref } from "vue";
import release from "../../release.json";
import PageLayout from "../components/PageLayout.vue";
import PageNote from "../components/PageNote.vue";
import PageSection from "../components/PageSection.vue";

// The MODS page's rows as on the pedal, and what each does. A step is part of INHERIT DRUMS: it
// switches it on too.
const INHERIT = "SPLIT: INHERIT DRUMS";
const MODS: { name: string; on: string; off: string; step?: boolean }[] = [
  {
    name: "DRUMS ON STOP",
    off: "Stopping a loop also stops the drums.",
    on: "The drums keep playing after the loop is stopped, and can be stopped separately.",
  },
  {
    name: "SPLIT: INHERIT DRUMS",
    off: "In A/B Split mode, the second loop does not have drums by default.",
    on: "In A/B Split mode, the second loop gets the same drums as the first one, if not set differently.",
  },
  {
    name: "STRENGTH +1",
    step: true,
    off: "The second loop gets the same drums as the first.",
    on: "With SPLIT: INHERIT DRUMS, the second loop's drums get +1 strength.",
  },
  {
    name: "VARIATION +1",
    step: true,
    off: "The second loop gets the same drums as the first.",
    on: "With SPLIT: INHERIT DRUMS, the second loop's drums get +1 variation.",
  },
  {
    name: "SYNC: FS PER LOOP",
    off: "In A+B Sync mode, footswitch 1 controls the loop and footswitch 2 selects A or B.",
    on: "In A+B Sync mode, footswitch 1 controls loop A and footswitch 2 controls loop B.",
  },
];

// The selected one's switch is on, for what is described beside it (and INHERIT DRUMS' for a step).
const selected = ref(MODS[0]!);
const on = (name: string) => name === selected.value.name || (name === INHERIT && !!selected.value.step);
</script>

<template>
  <PageLayout headline="Better Dual Loop">
    <template #sub>
      An unofficial firmware mod for
      <a class="name" href="https://nuxaudio.com/product/dualloopstereo/">NUX Dual Loop Stereo</a>.
    </template>

    <p class="title">
      MODS<span class="version">{{ release.version }}</span>
    </p>
    <div class="rows" role="group" aria-label="Mods">
      <button
        v-for="mod in MODS"
        :key="mod.name"
        class="row"
        :class="{ on: on(mod.name), step: mod.step }"
        type="button"
        :aria-pressed="mod.name === selected.name"
        @click="selected = mod"
      >
        {{ mod.name }}<span class="switch" />
      </button>
    </div>
    <template #bar>
      <span class="hint">On the pedal: Settings &gt; MODS</span>
    </template>

    <template #detail>
      <PageNote :heading="selected.name" :more="selected.step ? 'OFF' : 'STOCK'" aria-live="polite">
        {{ selected.on }}
        <template #more>{{ selected.off }}</template>
      </PageNote>
    </template>

    <template #sections>
      <PageSection heading="Other changes">
        A red delete screen and some bugfixes: see
        <a href="https://github.com/aisus/better-dual-loop#always-on">README</a>.
      </PageSection>
      <PageSection heading="About">
        A hobby project, made with <a href="https://github.com/NationalSecurityAgency/ghidra">Ghidra</a> and Claude
        Code, tested on one pedal. Use on your device at your own responsibility.
      </PageSection>
    </template>
  </PageLayout>
</template>

<style scoped>
.rows {
  display: grid;
  gap: 0.3rem;
  margin: 1.9rem -0.6rem 0;
}
/* Named as on the pedal. */
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.65rem 0.9rem;
  border-radius: 8px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-align: left;
}
.row:hover {
  background: var(--fill);
}
.row[aria-pressed="true"] {
  background: var(--fill-hover);
}
.row:focus-visible {
  border-radius: 8px;
  outline-offset: -2px;
}
.switch {
  flex: none;
  width: 2.5rem;
  height: 1.35rem;
  padding: 0.175rem;
  border-radius: 1rem;
  background: #444644;
}
.switch::after {
  content: "";
  display: block;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #fff;
  transition: translate 0.15s;
}
/* The release at the title bar's right end, as on the pedal. */
.version {
  position: absolute;
  right: 1.1rem;
  color: var(--muted);
  font-size: var(--small);
  font-weight: 600;
  letter-spacing: 0;
}
/* The steps under INHERIT DRUMS, as on the pedal: indented after a hook from the row above. */
.step {
  position: relative;
  padding-left: 2.6rem;
}
.step::before {
  content: "";
  position: absolute;
  left: 1.25rem;
  top: 0.55rem;
  width: 0.75rem;
  height: calc(50% - 0.55rem);
  border: solid var(--muted);
  border-width: 0 0 2px 2px;
  opacity: 0.6;
}
.on .switch {
  background: var(--next);
}
.on .switch::after {
  translate: 1.15rem;
}
@media (prefers-reduced-motion: reduce) {
  .switch::after {
    transition: none;
  }
}
</style>
