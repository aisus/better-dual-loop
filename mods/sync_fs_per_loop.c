/* SYNC: FS PER LOOP: in A+B SYNC mode, footswitch 1 works on loop 1 and footswitch 2 on loop 2.

   In A+B SYNC the firmware's footswitch 1 does everything (record, play, dub, stop, undo, clear)
   for the loop selected, and footswitch 2 only switches that selection. An external footswitch
   set to act as footswitch 1 or 2 does the same. With the row on, each footswitch selects its own
   loop and then does what footswitch 1 does, through the firmware's own code, so every press works
   as before, on that footswitch's loop. The LEDs then show each footswitch's own loop, as in A/B
   SPLIT, instead of the selected loop and the selection. The firmware calls ours only in A+B SYNC;
   the other modes already work this way. */
#include <stdbool.h>
#include "mods.h"

#define RED     0xFF0000
#define GREEN   0x00FF00
#define YELLOW  0xFFFF00

static bool direct(void)
{
    return fw_settings_mods & MODS_SYNC_FS_PER_LOOP;
}

/* Footswitch 1 in A+B SYNC. */
int mods_sync_footswitch1(const fw_event *e)
{
    if (direct())
        fw_settings_page.sync_track = 0;
    return fw_sync_footswitch(e);
}

/* Footswitch 2 in A+B SYNC. */
int mods_sync_footswitch2(const fw_event *e)
{
    if (!direct())
        return fw_sync_select(e);
    fw_settings_page.sync_track = 1;
    return fw_sync_footswitch(e);
}

/* A loop's LED colour, as the firmware shows it in A/B SPLIT: red recording (blinking while it
   waits for the bar to end it), green playing, yellow dubbing, otherwise off (blinking while the
   other loop is to follow, which never happens in A+B SYNC). */
static uint32_t colour(unsigned t)
{
    uint32_t flags = fw_tracks[t].flags;
    bool blink = fw_led_blink & 1;

    if (!(flags & (FW_TRACK_RECORDING | FW_TRACK_PLAYING))) {
        if (!(fw_looper_state & FW_SWITCH_PENDING) || !blink)
            return 0;
        return fw_tracks[t].audio ? GREEN : RED;
    }
    if (flags & FW_TRACK_RECORDING)
        return (flags & FW_TRACK_REC_ENDING) && !blink ? 0 : RED;
    return flags & FW_TRACK_DUBBING ? YELLOW : GREEN;
}

/* Wherever the firmware updates the footswitch LEDs. */
void mods_leds(void)
{
    if (fw_loop_mode != 0 || !direct()) {
        fw_leds();
        return;
    }
    for (unsigned t = 0; t < FW_TRACKS; t++)
        fw_set_led(FW_LED_1 + t, colour(t));
}
