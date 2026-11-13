/* What the mods' files share. The firmware's side is in fw.h. The functions named mods_* are
   called from the firmware's code, where patch/mods.js hooks them in (mods_drum_saved from our
   own assembly; the other functions of mods.h are called by ours only). */
#ifndef MODS_H
#define MODS_H
#include "fw.h"

/* The MODS page's rows, one bit each in fw_settings_mods (saved with the firmware's settings). */
#define MODS_DRUMS_ON_STOP 0x01
#define MODS_SPLIT_INHERIT_DRUMS 0x02
#define MODS_SYNC_FS_PER_LOOP 0x04
#define MODS_ROWS 3

/* DRUMS ON STOP, from the end of saving loop t's drums: with no loop playing, a loop that has a
   recording keeps its drums (`pattern`, `on`: what its record had before the save). */
void drums_keep_loop(unsigned t, unsigned pattern, unsigned on);

#endif
