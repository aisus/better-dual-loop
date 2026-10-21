// Every change the patch makes to NUX's firmware V2.2.0. Code addresses are offsets in the code
// section, which runs at address 0, so they are also the addresses the mods' sources use. `mods`
// maps the names of our functions in mods.bin to their addresses.
import { bl, bw, nops, pointer } from "./thumb.js";

// Where mods.bin goes: right after NUX's code, which ends at 0x4E188 (mods/mods.ld links it here).
export const MODS_BASE = 0x4e200;

// Changes to NUX's code: [address, new bytes, what for].
export const codeChanges = (mods) => [...MENU(mods), ...DRUMS_ON_STOP(mods), ...INHERIT_DRUMS(mods), ...BOOT_SCREEN];

// --- The MODS page ---------------------------------------------------------------------------------
// The settings menu's tile list, page drawing, knobs and button go through our code, which adds a
// MODS tile after RESET and its page, and passes everything else on unchanged.
const MENU = (mods) => [
  [0x6820, pointer(mods.mods_settings_list_draw), "settings menu opens: draw the tile list with ours"],
  [0x8c4c, pointer(mods.mods_settings_list_draw), "settings menu keys: draw the tile list with ours"],
  [0x8880, pointer(mods.mods_settings_draw), "settings menu keys: draw a page with ours"],
  [0x9624, pointer(mods.mods_settings_draw), "settings menu keys: draw a page with ours"],
  [0x997c, pointer(mods.mods_settings_draw), "CTRL settings: draw a page with ours"],
  [0x88c4, [13], "PARA knob on the tile list: last tile 12 -> 13 (compare)"],
  [0x88c8, [13], "PARA knob on the tile list: last tile 12 -> 13 (limit)"],
  [0x4d824, pointer(mods.mods_settings_para_press), "settings key table: PARA press -> ours"],
  [0x4d82c, pointer(mods.mods_settings_para_knob), "settings key table: PARA knob -> ours"],
  [0x4d834, pointer(mods.mods_settings_home_knob), "settings key table: HOME knob -> ours"],
];

// --- DRUMS ON STOP ---------------------------------------------------------------------------------
// The 11 places where stopping a loop also stops the drums call ours instead, which stop them only
// while DRUMS ON STOP is off. At most places the stop is followed by a call that silences the drum
// voices: mods_drum_stop replaces both and does both. Elsewhere mods_drum_stop_only only stops them.
const DRUMS_ON_STOP = (mods) => {
  const stopAndSilence = (at, what) => [at, [...nops(4), ...bl(at + 8, mods.mods_drum_stop)], what];
  const stopOnly = (at, what) => [at, [...bl(at, mods.mods_drum_stop_only), ...nops(2)], what];
  return [
    stopAndSilence(0x303e, "footswitch press: pending stop cleared"),
    stopOnly(0x315c, "footswitch double press: stop"),
    stopAndSilence(0x31fc, "footswitch: pending stops cleared on both tracks"),
    stopAndSilence(0x3752, "footswitch: track stopped"),
    stopOnly(0x3798, "footswitch: stop by the STOP MODE setting"),
    [0x9022, nops(4), "CTRL press in A+B SYNC, no track playing (goes on to 0x939A)"],
    stopAndSilence(0x91fe, "CTRL press in A/B SPLIT: pending stop"),
    stopAndSilence(0x9392, "CTRL press in A/B SPLIT: track stopped"),
    stopOnly(0x93ec, "CTRL double press"),
    stopAndSilence(0xf0fc, "loop end reached in LOOP END or ONE SHOT mode"),
    [0x107cc, nops(4), "CTRL immediate stop (its jump follows at 0x107D8)"],
    [0x107d8, bw(0x107d8, mods.mods_drum_stop), "CTRL immediate stop: jump to ours instead"],
  ];
};

// --- INHERIT DRUMS ---------------------------------------------------------------------------------
// Each loop's drum settings are saved through our code, which passes the drum on/off on to the
// loops not recorded yet; DRUM ON/OFF on an empty loop is remembered as that loop's own choice.
const INHERIT_DRUMS = (mods) => [
  [0x392e, bw(0x392e, mods.mods_drum_toggle_save), "DRUM ON/OFF in A/B mode: save the loop's drums with ours"],
  [0x9ff4, [...bw(0x9ff4, mods.mods_drum_save_tail), ...nops(1)], "end of saving a loop's drums: continue in ours"],
];

// --- Boot screen -----------------------------------------------------------------------------------
// The NUX logo moves up and shows picture 3/17 instead of 3/14: the logo with the release lines.
const BOOT_SCREEN = [
  [0xc42a, [40], "boot logo: y 96 -> 40, making room for the release lines"],
  [0xc440, [17], "boot logo: picture 3/14 -> 3/17"],
];

// --- Pictures --------------------------------------------------------------------------------------
// Our pictures (files in images/), added to the firmware's picture groups as the next ids.
const ROWS = ["drums_on_stop", "inherit_drums"];
const STATES = ["off", "off_selected", "on", "on_selected"];

export const PICTURES = [
  // Settings tiles, group 0x11: id 10 + 2 x page (+1 selected); MODS is page 13.
  { group: 0x11, id: 36, file: "mods_tile.bmp" },
  { group: 0x11, id: 37, file: "mods_tile_selected.bmp" },
  // Page titles and rows, group 0x12: the MODS page's title, the release shown at its right end,
  // and four pictures per row (row r is bit r of the MODS setting).
  { group: 0x12, id: 0x75, file: "mods_page_title.bmp" },
  { group: 0x12, id: 0x76, file: "mods_page_release.bmp" },
  ...ROWS.flatMap((row, r) =>
    STATES.map((state, s) => ({ group: 0x12, id: 0x77 + 4 * r + s, file: `${row}_${state}.bmp` })),
  ),
  // Boot screen, group 3: NUX's logo (3/14) with our release lines stacked under it.
  { group: 3, id: 17, file: "boot_release_lines.bmp", under: 14 },
];
