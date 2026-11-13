# Better Dual Loop

An unofficial firmware mod for the [NUX Dual Loop Stereo](https://nuxaudio.com/product/dualloopstereo/) (NML-3DLS) looper pedal.

**[Patch the firmware in your browser](https://aisus.github.io/better-dual-loop/)**

<details>
<summary><b>AI usage disclaimer</b></summary>

The code in this project is the result of an involved reverse-engineering process done with the [Ghidra](https://github.com/NationalSecurityAgency/ghidra) framework and an AI coding assistant (Claude Code).

The author does not claim the expertise in embedded software and reverse engineering needed to build a similar solution without AI tools, or to verify that the way the firmware is modified is optimal.

Each modification is the result of many iterations of on-device testing and tweaking, but was only tried on one real pedal. Everything is provided as is, with no guarantee. Using this patch on your device is your own responsibility.

If you have the expertise to improve the solution, contributions are very welcome.

</details>

## Mods

<p>
  <img src="web/screens/menu.png" width="49%" alt="The settings menu with the new MODS tile after RESET">
  <img src="web/screens/mods.png" width="49%" alt="The MODS page: DRUMS ON STOP switched on, SPLIT: INHERIT DRUMS and SYNC: FS PER LOOP off">
</p>

Modifications in the new MODS settings menu (V2.2.0-MOD1.2):

| Switch | Default | Patched |
|---|---|---|
| **DRUMS ON STOP** | Stopping a loop also stops the drum machine. | The drums keep playing after stopping the loop; only DRUM ON/OFF stops them. Each recorded loop keeps its drums as it last played. |
| **SPLIT: INHERIT DRUMS** | In A/B mode each loop has its own drums (on/off, drum set, groove): drums started with the first loop stop when you record the second, unless you switch them on for it. | The second loop, until recorded, takes over the first loop's drums: on/off, drum set and groove (variation and strength). |
| **SYNC: FS PER LOOP** | In A+B mode, footswitch 1 works on the selected loop and footswitch 2 selects the loop. | Footswitch 1 works on loop 1 and footswitch 2 on loop 2, as in A/B mode. |

Every switch is off by default, which behaves like the official firmware, apart from the always-on changes below.

Details:
- DRUMS ON STOP covers every way a loop stops: CTRL, external footswitch, any STOP MODE (LOOP END, ONE SHOT, FADE OUT).
- DRUMS ON STOP also lets each recorded loop keep its drums. For example: a loop plays with drums, you stop the loop, the drums play on, and you stop them with DRUM ON/OFF. When you start the loop again, its drums start with it. In the official firmware, that DRUM ON/OFF press also switched the drums off for the loop, so it came back without them. A recorded loop's drums now change only while it plays (or on the drum page). A loop not recorded yet starts with the drums as they are when you record it.
- SYNC: FS PER LOOP: every press works as footswitch 1 does in A+B mode (record, play, dub, undo, stop, clear), on that footswitch's loop. Each footswitch's LED shows its own loop, as in A/B mode. An external footswitch set to act as footswitch 1 or 2 does the same. CTRL is unchanged.
- SPLIT: INHERIT DRUMS: pressing DRUM ON/OFF, or choosing another drum set or groove, while a loop not recorded yet is selected counts as an explicit choice for that loop: it keeps its own drums instead. The tempo is shared by both loops anyway.
- SPLIT: INHERIT DRUMS also fixes an issue of the official firmware: saving a memory slot again while a loop is unchanged stored the selected loop's drum on/off for it, so one loop could take the other's. With SPLIT: INHERIT DRUMS (or DRUMS ON STOP) on, each loop keeps its own.

### Always on

| Change | Default | Patched |
|---|---|---|
| **Red delete screen** | The memory slot's delete confirmation looks just like the save one, so a SAVE held a little too long, which asks to delete, is easily confirmed by mistake. | The delete confirmation is red (its title bar and the dim around it). |
| **A+B mode: recording start** | A loop recorded while the other plays, with the record press slightly late (in the first beat of the bar), plays one bar off against the other loop. | The new loop plays where it was recorded. |
| **A/B mode: CTRL after recording** | Recording a loop just as the other comes round (in its first beat) leaves CTRL's single press doing nothing until another footswitch is pressed. | CTRL works on the new loop as usual. |

## Using it

1. Download firmware **V2.2.0** from [NUX's website](https://nuxaudio.com/product/dualloopstereo/) and keep the zip: this release modifies only V2.2.0.
2. Open [the page](https://aisus.github.io/better-dual-loop/), drop the zip on it and download the result.
3. Flash it with NUX's updater, as described on the page: it is the standard update procedure from NUX's firmware update guide.

To go back, flash `NML-3DLSFirmwareV2.2.0.bin` from the NUX zip the same way. Your loops, settings and boot GIF are kept either way.

The page accepts only the official V2.2.0 image and produces only the exact image that was tested on the pedal, both checked by SHA-256. Your file is processed in your browser and never leaves your computer. Flashing was tested on Windows. NUX's macOS updater should work the same way but is not tested. NUX has no updater for Linux.

## How it works

The page runs the patch (`patch/`) on your file, in your browser:

1. It checks that your file is the official V2.2.0 image, by its SHA-256.
2. It adds our code, compiled from `mods/`, right after NUX's code, and points the firmware to it:
   - The settings menu's drawing, knobs and buttons go through our code, which adds the MODS tile and page and passes everything else on unchanged.
   - The 11 places where stopping a loop also stops the drums call our code instead.
   - When a loop's drum settings are saved, our code passes the drum on/off, drum set and groove on to the loops not recorded yet, unless a choice was made for them; with DRUMS ON STOP and all loops stopped, it keeps the drums of the loops already recorded. The drum page's DRUM 1/2 tab, which sets a loop's drums on directly, goes through our code too.
   - A loop starting while the other is stopped restarts the drums through our code, which in A+B mode switches them on or off as that loop last played (DRUMS ON STOP on).
   - Saving a memory slot takes each loop's drum on/off from that loop's own settings instead of from the drums playing at that moment (SPLIT: INHERIT DRUMS on in A/B mode, or DRUMS ON STOP on).
   - In A+B mode, footswitches 1 and 2 (and an external footswitch acting as either) go through our code, which lets each work on its own loop when SYNC: FS PER LOOP is on; every update of the footswitch LEDs goes through our code too.
   - Where a recording starts at a bar line, and where A/B mode starts one at once, our code sets the recording's first beat and the active loop.
   - The memory slot's save/delete dialog sets two of its colours through our code, which paints the delete one red.
3. It adds our pictures (`images/`) for the MODS tile and page, and stacks the release lines under the NUX logo on the boot screen.
4. It updates the image's sizes and checksums, and moves the space the pedal keeps for a custom boot GIF past the added pictures.
5. It checks that the result is exactly the image that was tested on a pedal, by its SHA-256.

The patched image is written only to the firmware area. The bootloader's update mode, which the official updater uses, is never touched, so the pedal can always go back to the official firmware.

Every change, with its address in the firmware and a short comment: [`patch/mods.js`](patch/mods.js).

## Repository

| Path | Contents |
|---|---|
| `web/` | The page |
| `patch/` | The patch the page runs: the firmware's file format, and every change (`mods.js`) |
| `mods/` | The C source of the code the mod adds; `fw.h` and `firmware.ld` name the firmware functions and data it uses |
| `images/` | The pictures the mod adds, exactly as they go into the firmware (BMP) |
| `release.json` | The version and SHA-256 checksums: official input, our compiled code, output |
| `tests/` | Tests on synthetic data, no NUX firmware needed |

Run `npm ci` first (Node 22.13+). Then:
- `npm test` runs the tests
- `npm run lint` checks the JavaScript with ESLint and its formatting with Prettier (`npm run format` fixes the formatting)
- `npm run build` assembles the page in `build/site/` (run `make` first, see below)
- `npm run dev` serves the page on <http://localhost:8000/>, rebuilt and reloaded on every change (also after `make`).

`make` compiles `mods/` with the [Arm GNU Toolchain 14.2.rel1](https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads) (`make TOOLCHAIN=<its folder>` if it is not on the PATH).
Every deploy does the same and stops if the result differs from `release.json`.

The pictures use the [Open Sans](https://fonts.google.com/specimen/Open+Sans) typeface.

## Support

A hobby project, tested on one pedal. Issues (bugs, reports from other devices, feature requests) are welcome. Fixes come on a best-effort basis, with no promise of a port to a newer NUX firmware.

## Legal

Provided as is, without warranty. Flashing modified firmware is at your own risk. This project is not affiliated with or endorsed by NUX / Cherub Technology. NUX, Dual Loop Stereo and other product names are trademarks of their owners. No NUX firmware is included here: the page uses the file you provide.

Licence: MIT, see [LICENSE](LICENSE).
