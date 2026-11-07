/* INHERIT DRUMS: in A/B SPLIT mode, a loop not recorded yet follows the drums: on/off, drum set and
   groove.

   In A/B SPLIT mode each loop has its own drum record (on/off, drum set, groove; the tempo is
   shared), applied whenever that loop starts or records. With INHERIT DRUMS, a "fresh" loop (no
   recording yet, no explicit choice) follows the drums: every record save copies the on/off, drum
   set and groove into the fresh loops, so the first recording of a loop starts with the drums as
   they are. Pressing DRUM ON/OFF, or choosing another drum set or groove, while an empty loop is
   selected is an explicit choice for that loop: it keeps all of its drums until it has been
   recorded.

   Saving a memory slot stores each loop's drum on/off as well. The firmware takes it from the
   drums playing at that moment, which is that loop's only when the save has just loaded the
   loop's record: for a loop already saved unchanged (saving the slot again), it stores the state
   of the loop selected, so one loop's on/off ends up in the other's. With INHERIT DRUMS, in A/B SPLIT, the save takes it from the loop's own record. */
#include <stdbool.h>
#include "mods.h"

static uint8_t explicit_tracks;             /* bit t: empty track t has an explicit drum choice */
static int16_t explicit_slot;               /* memory slot the bits belong to */

static bool track_empty(unsigned t)
{
    return fw_tracks[t].audio == 0 && !(fw_tracks[t].flags & FW_TRACK_RECORDING);
}

static bool inherit(void)
{
    return fw_settings_mods & MODS_INHERIT_DRUMS;
}

/* The explicit choices belong to the memory slot loaded: forget them when it changes. */
static void check_slot(void)
{
    if (explicit_slot != fw_memory_slot) {
        explicit_slot = fw_memory_slot;
        explicit_tracks = 0;
    }
}

/* DRUM ON/OFF in A/B SPLIT mode saves the active loop's record through here. */
void mods_drum_toggle_save(unsigned t)
{
    check_slot();
    if (inherit() && track_empty(t))
        explicit_tracks |= 1u << t;
    fw_drum_save_track(t);
}

/* After loop t's drum record has been saved; `pattern` is the drum set and groove it had before.
   A changed pattern counts as a choice only for the active loop: the meter page saves both
   records, and the inactive one then just takes the active loop's pattern. */
void mods_drum_saved(unsigned t, unsigned pattern)
{
    check_slot();
    if (inherit() && t == fw_settings_page.track && track_empty(t)
        && fw_drum_records[t].pattern != pattern)
        explicit_tracks |= 1u << t;
    for (unsigned u = 0; u < FW_TRACKS; u++) {
        if (!track_empty(u)) {
            explicit_tracks &= ~(1u << u);
        } else if (u != t && inherit() && !(explicit_tracks >> u & 1)) {
            fw_drum_records[u].on = fw_drum_records[t].on;
            fw_drum_records[u].pattern = fw_drum_records[t].pattern;
        }
    }
}

/* Called by the slot save in place of its `ldrb.w r12, [r6]; lsls.w r3, r12, #25`, which put the
   drums' audible flag (0x40 of fw_drum_flags; r6 = &fw_drum_flags) into N for the following
   `ite mi`. Returns N the same way, with r3 and r12 changed as there; r9 = the loop's record +
   0xC, so its on/off is at [r9, #3]. Flags survive the return. */
_Static_assert(MODS_INHERIT_DRUMS == 0x02, "the stub tests bit 1");
__attribute__((naked))
void mods_slot_drum_on(void)
{
    __asm volatile(
        "ldr    r3, =fw_settings_mods\n"
        "ldrb   r3, [r3]\n"
        "lsls   r3, r3, #30\n"             /* MODS_INHERIT_DRUMS into N */
        "bpl    1f\n"
        "ldr    r3, =fw_loop_mode\n"
        "ldrb   r3, [r3]\n"
        "cmp    r3, #1\n"                  /* A/B SPLIT */
        "bne    1f\n"
        "ldrb.w r12, [r9, #3]\n"           /* the loop's own on/off (0 or 1) */
        "lsls.w r3, r12, #31\n"
        "bx     lr\n"
        "1:\n"
        "ldrb.w r12, [r6]\n"               /* as the firmware */
        "lsls.w r3, r12, #25\n"
        "bx     lr\n"
        ".ltorg\n");
}

/* The end of the firmware's record save jumps here: its last instructions (store of the pattern,
   return) moved here, then mods_drum_saved(t, old pattern), returning to the original caller. The
   firmware addresses loop t's record through r0 = &fw_drum_flags + 16 t. */
__attribute__((naked))
void mods_drum_save_tail(void)
{
    __asm volatile(
        "ldrh  r1, [r0, #0x44]\n"           /* the pattern before the save */
        "strh  r2, [r0, #0x44]\n"
        "pop   {r4, r5, r6, r7, lr}\n"
        "ldr   r2, =fw_drum_flags\n"
        "subs  r0, r0, r2\n"
        "lsrs  r0, r0, #4\n"                /* t = (r0 - &fw_drum_flags) / 16 */
        "b.w   mods_drum_saved\n"
        ".ltorg\n");
}
