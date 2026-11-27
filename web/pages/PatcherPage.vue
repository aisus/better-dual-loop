<script setup lang="ts">
import release from "../../release.json";
import PageSection from "../components/PageSection.vue";
import ZipPage from "../components/ZipPage.vue";
import { ensureLoaded, patcher } from "../state/patcher";

ensureLoaded();
</script>

<template>
  <ZipPage headline="Firmware patcher" title="FIRMWARE PATCHER" :converter="patcher">
    <template #sub> Adds the mod to the official firmware. </template>

    <template #firmware><br />Save the original file for a rollback.</template>

    <template #sections>
      <PageSection heading="Flashing">
        <ol>
          <li>Extract the downloaded zip. It has an updater and a patched <code>.bin</code> file.</li>
          <li>
            Unplug the pedal's power. Hold LOOP MODE and footswitch 2 and plug it back in: the screen shows "Device
            Firmware Update".
          </li>
          <li>
            Connect USB-C and open the updater. It is unsigned (the official one too): if you see the warning, on
            Windows click
            <em>More info</em>, <em>Run anyway</em>, on macOS go to <em>System Settings</em>,
            <em>Privacy &amp; Security</em>, <em>Open Anyway</em>.
          </li>
          <li>
            Set <em>MIDI Device Out</em> and <em>MIDI Device In</em> to <em>MIDI-DFU</em>. Leave the other settings as
            they are.
          </li>
          <li>
            Click <em>file...</em>, pick <code>NML-3DLS-{{ release.version }}.bin</code>, then click
            <em>Start Update</em>.
          </li>
          <li>
            When it reports success, unplug the power and plug it back in. The boot screen shows the mod version, and
            Settings ends with MODS.
          </li>
        </ol>
        <p>Your loops and settings are kept.</p>
      </PageSection>
      <PageSection heading="Removing the mod">
        Flash <code>NML-3DLSFirmwareV2.2.0.bin</code> from the original zip the same way. The mod doesn't change the
        bootloader.
      </PageSection>
    </template>
  </ZipPage>
</template>
