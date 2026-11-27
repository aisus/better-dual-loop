<script lang="ts">
// The pedal is drawn anew for every page: the button just pressed keeps the keyboard focus.
let pressed = false;
</script>

<script setup lang="ts">
// The pages: the pedal's small buttons, the shown page's one lit. The MIDI extractor has none: the drum
// patterns' is red there, and leads back.
import { onMounted, useTemplateRef } from "vue";
import { type Route, route } from "../route";

const BUTTONS: { to: Route; href: string; name: string }[] = [
  { to: "home", href: "#/", name: "MOD\nLIST" },
  { to: "patcher", href: "#/patcher", name: "FIRMWARE\nPATCHER" },
  { to: "drums", href: "#/drums", name: "DRUM\nPATTERNS" },
];

const nav = useTemplateRef("nav");
onMounted(() => {
  if (pressed) nav.value?.querySelector<HTMLElement>("[aria-current]")?.focus({ preventScroll: true });
  pressed = false;
});
</script>

<template>
  <nav ref="nav" aria-label="Pages">
    <a
      v-for="b in BUTTONS"
      :key="b.to"
      :href="b.href"
      :aria-current="route === b.to ? 'page' : route === 'midi' && b.to === 'drums' ? 'true' : undefined"
      @click="pressed = route !== b.to"
    >
      <span class="button" />{{ b.name }}
    </a>
  </nav>
</template>

<style scoped>
nav {
  --ink: #1c1412;
  display: flex;
  justify-content: center;
  gap: min(1.6rem, 3vw);
}
a {
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  min-width: 4.6rem;
  color: var(--ink);
  /* Printed on the body: wide square capitals, as near as installed fonts get. */
  font:
    600 0.85rem/1.1 Eurostile,
    Bahnschrift,
    "DIN Alternate",
    system-ui,
    sans-serif;
  letter-spacing: 0.06em;
  text-align: center;
  white-space: pre-line;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}
a:focus-visible {
  outline-color: var(--ink);
}
/* A black frame, on it a clear cap, in that a dark cube: the light. Lit from above and seen from a
   little below the front, as the pedal is. The frame and the cap are drawn from straight above: their
   height shows only as their edges (a thin soft highlight along each, as the pedal's) and their
   shadows (the button's on the paint, the cap's on the frame). */
.button {
  --frame-shadows:
    inset 0 1px 1px rgb(255 255 255 / 0.3), inset 1px 0 1px rgb(255 255 255 / 0.14),
    inset -1px 0 1px rgb(255 255 255 / 0.1), inset 0 -1px 1px rgb(255 255 255 / 0.16), 0 0 0 1px rgb(30 16 0 / 0.35),
    0 2px 2px rgb(30 16 0 / 0.5), 0 5px 8px rgb(30 16 0 / 0.4);
  position: relative;
  width: 2.2rem;
  aspect-ratio: 1;
  border-radius: 0.4rem;
  background: linear-gradient(#2c2523, #1a1514 45%, #141010);
  box-shadow: var(--frame-shadows);
}
.button::before,
.button::after {
  content: "";
  position: absolute;
}
.button::before {
  inset: 0.28rem;
  border-radius: 0.32rem;
  background: linear-gradient(135deg, #c9ced6, #777a82 45%, #8d8a8c 70%, #b9b4b0);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 0.75),
    inset 1px 0 1px rgb(255 255 255 / 0.4),
    inset -1px 0 1px rgb(255 255 255 / 0.3),
    inset 0 -1px 1px rgb(255 255 255 / 0.45),
    0 0 0 1px rgb(0 0 0 / 0.7),
    0 2px 3px rgb(0 0 0 / 0.9);
}
/* The cube's top face is nearer than its base, so it sits a little higher and further from the pedal's
   middle (--dx: which way), and the walls facing the eye show: the lower one, away from the light, and
   on the outer buttons the inner side one. Over it, the cap's top reflects a little. */
a:first-child {
  --dx: -1;
}
a:last-child {
  --dx: 1;
}
.button::after {
  --wall-down: #16141a;
  --wall-side: #24212a;
  inset: 0.63rem;
  border-radius: 0.1rem;
  transform: translate(calc(var(--dx, 0) * 0.6px), -1px);
  background: linear-gradient(165deg, rgb(255 255 255 / 0.1), transparent 45%), linear-gradient(#2a2630, #2f2b36);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.12),
    calc(var(--dx, 0) * -0.5px) 1px 0 var(--wall-down),
    calc(var(--dx, 0) * -1px) 2px 0 color-mix(in srgb, var(--wall-down) 80%, #000),
    calc(var(--dx, 0) * -1.5px) 2px 0 var(--wall-side),
    0 0 0 0.5px rgb(0 0 0 / 0.4);
}
a:hover .button::before {
  filter: brightness(1.2);
}
/* Pressed: the cap goes down, its shadow goes. */
a:active .button::before {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.4),
    inset 0 0 0 1px rgb(255 255 255 / 0.18),
    0 0 0 1px rgb(0 0 0 / 0.7);
}
/* Lit: the light spills onto the paint; the cube is the light, its walls in its colour. */
[aria-current] .button {
  box-shadow:
    var(--frame-shadows),
    0 0 0.55rem 0.12rem color-mix(in srgb, var(--light) 75%, transparent),
    0 0 1.3rem 0.3rem color-mix(in srgb, var(--light) 30%, transparent),
    0 0 3.2rem 1.4rem color-mix(in srgb, var(--light) 13%, transparent);
}
[aria-current] .button::before {
  background: radial-gradient(#fff 25%, color-mix(in srgb, var(--light) 55%, #fff) 45%, var(--light) 78%);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 0.9),
    inset 1px 0 1px color-mix(in srgb, var(--light) 40%, #fff),
    inset -1px 0 1px color-mix(in srgb, var(--light) 50%, #fff),
    inset 0 -1px 1px color-mix(in srgb, var(--light) 30%, #fff),
    inset 0 0 0.25rem 0.05rem color-mix(in srgb, var(--light) 75%, #000),
    0 0 0 1px rgb(0 0 0 / 0.6),
    0 2px 3px rgb(0 0 0 / 0.7);
}
[aria-current] .button::after {
  --wall-down: color-mix(in srgb, var(--light) 80%, #fff);
  --wall-side: color-mix(in srgb, var(--light) 60%, #fff);
  background: linear-gradient(165deg, rgb(255 255 255 / 0.5), transparent 45%), #fff;
  box-shadow:
    calc(var(--dx, 0) * -0.5px) 1px 0 var(--wall-down),
    calc(var(--dx, 0) * -1px) 2px 0 color-mix(in srgb, var(--wall-down) 85%, #000),
    calc(var(--dx, 0) * -1.5px) 2px 0 var(--wall-side),
    0 0 0.35rem 0.1rem color-mix(in srgb, var(--light) 30%, #fff);
}
[aria-current="true"] .button {
  --light: var(--light-red);
}
/* Where colours are the system's, the light is not seen. */
@media (forced-colors: active) {
  [aria-current] {
    text-decoration: underline;
  }
}
</style>
