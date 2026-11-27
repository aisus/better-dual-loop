<script setup lang="ts">
import PageSection from "../components/PageSection.vue";
import ZipPage from "../components/ZipPage.vue";
import { extractor } from "../state/extractor";
</script>

<template>
  <ZipPage headline="MIDI extractor" title="MIDI EXTRACTOR" :converter="extractor">
    <template #sub> Extracts stock drum patterns from the official firmware as MIDI files. </template>

    <template #sections>
      <PageSection heading="The files">
        One clip per pattern, 4 or 8 bars long. <code>ROCK-1-44-2.3.mid</code> is <span class="name">ROCK-1</span> in
        4/4, strength 2, variation 3.
      </PageSection>
      <PageSection heading="Differences from the pedal">
        76 patterns have a few notes the pedal has no sound for, such as a tambourine. The pedal plays a closed hat
        instead.
      </PageSection>
    </template>
  </ZipPage>
</template>
