/* What the mods' files share. The firmware's side is in fw.h. The functions named mods_* are
   called from the firmware's code, where patch/mods.js hooks them in (mods_drum_saved from our
   own assembly). */
#ifndef MODS_H
#define MODS_H
#include "fw.h"

/* The MODS page's rows, one bit each in fw_settings_mods (saved with the firmware's settings). */
#define MODS_DRUMS_ON_STOP  0x01
#define MODS_INHERIT_DRUMS  0x02
#define MODS_ROWS           2

#endif
