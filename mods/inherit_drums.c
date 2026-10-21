/* INHERIT DRUMS: in A/B mode, a loop not recorded yet follows the drums' on/off.

   In A/B mode each loop has its own drum record (on/off, tempo, style), applied whenever that loop
   starts or records. With INHERIT DRUMS, a "fresh" loop (no recording yet, no explicit choice)
   follows the drums: every record save copies the on/off into the fresh loops, so the first
   recording of a loop starts with the drums as they are. DRUM ON/OFF pressed while an empty loop
   is selected is an explicit choice for that loop: it keeps it until it has been recorded. */
#include <stdbool.h>
#include "mods.h"

static uint8_t explicit_tracks;             /* bit t: empty track t has an explicit drum choice */
static int16_t explicit_slot;               /* memory slot the bits belong to */

static bool track_empty(unsigned t)
{
    return fw_tracks[t].audio == 0 && !(fw_tracks[t].flags & FW_TRACK_RECORDING);
}

/* The explicit choices belong to the memory slot loaded: forget them when it changes. */
static void check_slot(void)
{
    if (explicit_slot != fw_memory_slot) {
        explicit_slot = fw_memory_slot;
        explicit_tracks = 0;
    }
}

/* DRUM ON/OFF in A/B mode saves the active loop's record through here. */
void mods_drum_toggle_save(unsigned t)
{
    check_slot();
    if ((fw_settings_mods & MODS_INHERIT_DRUMS) && track_empty(t))
        explicit_tracks |= 1u << t;
    fw_drum_save_track(t);
}

/* After loop t's drum record has been saved. */
void mods_drum_saved(unsigned t)
{
    check_slot();
    for (unsigned u = 0; u < FW_TRACKS; u++) {
        if (!track_empty(u))
            explicit_tracks &= ~(1u << u);
        else if (u != t && (fw_settings_mods & MODS_INHERIT_DRUMS) && !(explicit_tracks >> u & 1))
            fw_drum_records[u].on = fw_drum_records[t].on;
    }
}

/* The end of the firmware's record save jumps here: its last instructions (store, return) moved
   here, then mods_drum_saved(t), returning to the original caller. The firmware addresses loop
   t's record through r0 = &fw_drum_flags + 16 t. */
__attribute__((naked))
void mods_drum_save_tail(void)
{
    __asm volatile(
        "strh  r2, [r0, #0x44]\n"
        "pop   {r4, r5, r6, r7, lr}\n"
        "ldr   r1, =fw_drum_flags\n"
        "subs  r0, r0, r1\n"
        "lsrs  r0, r0, #4\n"                /* t = (r0 - &fw_drum_flags) / 16 */
        "b.w   mods_drum_saved\n"
        ".ltorg\n");
}
