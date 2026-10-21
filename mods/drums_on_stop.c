/* DRUMS ON STOP: stopping a loop no longer stops the drums.

   The firmware stops the drums wherever a loop stops, at most places also cutting the drum hits
   still sounding. It calls ours there instead, which do the same only while DRUMS ON STOP is off.
   Each call sits where the firmware called a function or right before a return, so it is an
   ordinary call. */
#include "mods.h"

/* Where the firmware stops the drums and cuts their sounds. */
void mods_drum_stop(void)
{
    if (!(fw_settings_mods & MODS_DRUMS_ON_STOP)) {
        fw_drum_flags &= ~FW_DRUMS_ON;
        fw_drum_silence_voices();
    }
}

/* Where it only stops them: the hits sounding ring out. */
void mods_drum_stop_only(void)
{
    if (!(fw_settings_mods & MODS_DRUMS_ON_STOP))
        fw_drum_flags &= ~FW_DRUMS_ON;
}
