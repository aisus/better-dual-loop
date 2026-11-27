<script setup lang="ts">
// Every page: the pedal on the left, always the same box in the same place, the words beside it. Its
// screen has a fixed width, as a device's: a line of 44 columns fits, also in the widest monospace
// fonts (the page tests check both). What is on its screen acts; its buttons, and links among the
// words, lead to the other pages.
// Slots: `sub` (the sentence under the headline), `default` (the screen), `bar` (the screen's last
// row), `detail` (what the screen's selection is), `sections`. While the screen waits for one thing
// (`press`, its name), a click anywhere on it does that.
import PedalButtons from "./PedalButtons.vue";

defineProps<{
  headline: string;
  over?: boolean; // a file is being dragged over the page
  press?: string;
}>();
defineEmits<{ press: [] }>();
</script>

<template>
  <div class="layout">
    <div class="head">
      <h1>{{ headline }}</h1>
      <p class="sub"><slot name="sub" /></p>
    </div>
    <section class="pedal" :class="{ over }">
      <div class="screen">
        <div class="face">
          <div class="body"><slot /></div>
          <div class="bar"><slot name="bar" /></div>
        </div>
        <button v-if="press" class="press" type="button" :aria-label="press" @click="$emit('press')" />
        <svg class="filters" aria-hidden="true">
          <!-- The halo: the bright pixels only, blurred, laid over the face in their own colours. -->
          <filter id="halo" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.6 1.2 0.2 0 -0.9" />
            <feGaussianBlur stdDeviation="3" />
            <feComponentTransfer result="halo"><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
            <feBlend in="SourceGraphic" in2="halo" mode="screen" />
          </filter>
        </svg>
      </div>
      <PedalButtons />
    </section>
    <div class="detail"><slot name="detail" /></div>
    <div class="sections"><slot name="sections" /></div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  gap: 1.4rem;
  padding: 1.4rem 0 1.2rem;
}
.layout > * {
  min-width: 0;
}
h1 {
  font-size: var(--big);
  line-height: 1.2;
  font-weight: 650;
  letter-spacing: -0.015em;
  text-wrap: balance;
}
.sub {
  margin-top: 0.6rem;
  color: var(--muted);
  text-wrap: balance;
}
/* Glossy painted metal, lit from above and seen from a little below the front, as the buttons are. The
   top face is evenly lit up to its edges; the edges are sharp, a thin soft highlight along each, and below
   the bottom one the front face shows, flat and darker; then the soft shadow on the table. */
.pedal {
  position: relative;
  display: grid;
  gap: 1.1rem;
  align-self: start;
  width: min(100%, 34rem);
  padding: 0.7rem 0.7rem 1rem;
  border-radius: 16px;
  background:
    radial-gradient(120% 80% at 25% -15%, rgb(255 238 165 / 0.32), transparent 60%),
    linear-gradient(color-mix(in srgb, var(--pedal) 94%, #fff), color-mix(in srgb, var(--pedal) 90%, #000));
  box-shadow:
    /* the edges' highlights */
    inset 0 1px 1.5px rgb(255 248 215 / 0.85),
    inset 0 4px 4px -3px rgb(255 238 165 / 0.35),
    inset 1px 0 1.5px rgb(255 244 200 / 0.45),
    inset -1px 0 1.5px rgb(255 244 200 / 0.3),
    inset 0 -1px 1.5px rgb(255 240 190 / 0.6),
    /* the front face */ 0 1px 0 color-mix(in srgb, var(--pedal) 72%, #2a1600),
    0 2px 0 color-mix(in srgb, var(--pedal) 70%, #2a1600),
    0 3px 0 color-mix(in srgb, var(--pedal) 67%, #2a1600),
    0 4px 0 color-mix(in srgb, var(--pedal) 63%, #2a1600),
    0 5px 0 color-mix(in srgb, var(--pedal) 52%, #1e1000),
    /* the shadow */ 0 6px 3px rgb(0 0 0 / 0.45),
    0 10px 12px rgb(0 0 0 / 0.35),
    0 22px 34px rgb(0 0 0 / 0.35),
    0 40px 70px rgb(0 0 0 / 0.3);
}
/* The paint, under the screen and the buttons: a faint grain, a tone not quite even. */
.pedal > * {
  position: relative;
  z-index: 1;
}
.pedal::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    url(../textures/grain.svg) 0 0 / 256px,
    url(../textures/mottle.svg) 0 0 / 640px;
  mix-blend-mode: overlay;
  opacity: 0.1;
}
/* The screen, set into a black frame, set into the plate: a dark groove, the plate's lit lip under it. */
.screen {
  position: relative;
  height: 25.5rem; /* the same on every page */
  --gutter: 1.75rem;
  border: 0.6rem solid transparent;
  border-radius: 10px;
  background:
    linear-gradient(var(--screen), var(--screen)) padding-box,
    linear-gradient(165deg, #1e1f22, #080909 25%, #040404) border-box;
  box-shadow:
    0 1.5px 0 rgb(255 246 205 / 0.55),
    0 0 0 1px rgb(40 22 0 / 0.6),
    0 -1px 4px rgb(60 30 0 / 0.5);
  overflow: hidden;
}
/* Its glass, over what is on it: the frame's shadow along the edge, a reflection, a backlight darker
   toward the edges, a faint pixel grid. */
.screen::after {
  content: "";
  position: absolute;
  z-index: 2;
  inset: 0;
  background:
    linear-gradient(118deg, rgb(255 255 255 / 0.035), rgb(255 255 255 / 0.015) 34%, transparent 34.3%),
    radial-gradient(140% 90% at 50% 0%, rgb(255 255 255 / 0.025), transparent 45%),
    radial-gradient(130% 120% at 50% 45%, transparent 55%, rgb(0 0 0 / 0.35)),
    repeating-linear-gradient(0deg, rgb(0 0 0 / 0.07) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgb(0 0 0 / 0.07) 0 1px, transparent 1px 3px);
  box-shadow:
    inset 0 3px 9px rgb(0 0 0 / 0.85),
    inset 0 0 0 1px rgb(0 0 0 / 0.6);
  pointer-events: none;
}
/* What the screen shows, under its cover, which is not quite clear: a halo around what is bright. The
   face is exactly the screen's inside, so what is placed on the screen (title, key bar) is placed on
   it as before. */
.face {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 1rem;
  padding: 1.6rem var(--gutter) 1.3rem;
  filter: url(#halo);
}
.filters {
  position: absolute;
  width: 0;
  height: 0;
}
.body,
.bar {
  min-width: 0;
  min-height: 0;
}
.press {
  position: absolute;
  inset: 0;
}
.press:hover {
  background: rgb(255 255 255 / 0.04);
}
.press:focus-visible {
  border-radius: 6px;
  outline-offset: -0.6rem;
}
/* A file dropped now goes here. */
.over .screen {
  outline: 2px dashed var(--next);
  outline-offset: -0.6rem;
}
.detail:empty {
  display: none;
}
.sections {
  display: grid;
  gap: 0.7rem;
}
/* Phones: the pedal smaller, to keep its shape. */
@media (width < 30rem) {
  .pedal {
    zoom: 0.8;
  }
  .screen {
    --gutter: 1.1rem;
  }
}
/* Two columns: the pedal at a fixed size and, on tall windows, a place that depends only on the
   window, so it is the same on every page. */
@media (min-width: 62rem) {
  .layout {
    grid-template: auto 1fr auto / 34rem minmax(0, 1fr);
    grid-template-areas: "pedal head" "pedal detail" "pedal sections";
    column-gap: 4rem;
    padding-top: max(1.4rem, (100dvh - 41rem) / 3);
  }
  .head {
    grid-area: head;
  }
  .pedal {
    grid-area: pedal;
    padding: 1.35rem 1.35rem 1.1rem;
  }
  .detail {
    grid-area: detail;
  }
  .sections {
    grid-area: sections;
    align-self: end;
  }
}
</style>
