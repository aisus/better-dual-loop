/* DRUMS ON STOP: stopping a loop no longer stops the drums, and stopping the drums no longer changes
   the loops.

   The firmware stops the drums wherever a loop stops, at most places also cutting the drum hits
   still sounding. It calls ours there instead, which do the same only while DRUMS ON STOP is off.
   Each call sits where the firmware called a function or right before a return, so it is an
   ordinary call.

   With the drums playing on, DRUM ON/OFF is how they stop. The firmware saves every drum change
   into a loop's drum record: with no loop playing, into the loop that played last (A/B SPLIT) or
   both (A+B SYNC). That made a stop of the drums an edit of a loop, so the loop came back without
   them. With DRUMS ON STOP, every loop keeps its drums as it last played: with no loop playing or
   recording, a save leaves the on/off of loops that have a recording as it was, and on the
   looper's screen also their drum set and groove (the drum pages edit a chosen loop's on purpose).
   Loops not recorded yet are saved as before: a first recording starts with the drums as they are.
   The drum page's DRUM 1/2 tab sets a loop's on/off outside the save, so it is kept there too.
   A+B SYNC applies no record when a loop starts, so there the start applies it, as A/B SPLIT
   does. */
#include <stdbool.h>
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

static bool loop_active(void)
{
    for (unsigned u = 0; u < FW_TRACKS; u++)
        if (fw_tracks[u].flags & (FW_TRACK_RECORDING | FW_TRACK_PLAYING))
            return true;
    return false;
}

void drums_keep_loop(unsigned t, unsigned pattern, unsigned on)
{
    if (!(fw_settings_mods & MODS_DRUMS_ON_STOP) || fw_tracks[t].audio == 0 || loop_active())
        return;
    fw_drum_records[t].on = on;
    if (fw_screen == fw_main_screen)
        fw_drum_records[t].pattern = pattern;
}

/* The drum page's DRUM 1/2 tab, turned with no loop playing or recording (code at 0x5D3A, after
   it loaded that loop's record and made the drums heard): the firmware then set the loop's record
   to drums on, outside the record save. With DRUMS ON STOP, a loop that has a recording keeps its
   on/off; the drums still play on the page. */
void mods_drum_tab(void)
{
    unsigned t = fw_settings_page.track;

    if (!(fw_settings_mods & MODS_DRUMS_ON_STOP) || fw_tracks[t].audio == 0)
        fw_drum_records[t].on = 1;
}

/* A loop starting with no other loop playing (code at 0x10650, in its critical section), where
   the firmware restarts the drums: in A+B SYNC their on/off then comes from the loop's record. */
__attribute__((used)) static void play_drums(volatile fw_track *t)
{
    fw_drum_flags |= FW_DRUMS_ON;
    if (!(fw_settings_mods & MODS_DRUMS_ON_STOP) || fw_loop_mode != 0)
        return;
    if (fw_drum_records[t != &fw_tracks[0]].on) {
        fw_drum_flags |= FW_DRUMS_AUDIBLE;
    } else if (fw_drum_flags & FW_DRUMS_AUDIBLE) {
        fw_drum_flags &= ~FW_DRUMS_AUDIBLE;
        fw_drum_silence_voices();
    }
}

/* In place of `ldr r1,[r5]; orr r1,#1; str r1,[r5]` (r5 = &fw_drum_flags), with r7 = the loop. */
__attribute__((naked)) void mods_play_drums(void)
{
    __asm volatile(
        "mov   r0, r7\n"
        "b.w   play_drums\n");
}
