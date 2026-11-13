/* A+B SYNC: a loop recorded while the other loop plays starts where it was recorded. Always on.

   The pedal records all the time, and a recording that waits for the bar starts at a bar line: the
   firmware's recording engine waits until the drums are in the first beat of a bar, then starts
   the recording at that bar's line, cutting it from what has been recorded since. A record press
   that comes slightly late, during the bar's first beat, therefore still starts on the bar line
   just passed. In A+B SYNC both loops share one beat grid, and the recording also gets the beat of
   the other loop where its audio begins; playback places it there. The firmware sets that beat at
   the press, to the other loop's next bar line: a late press puts the audio one bar late (recorded
   A C G D plays as D A C G against the other loop).

   The engine (code at 0x0E2F0, in its critical section, right after it has set where the
   recording begins) calls here instead of ending the critical section: with the other loop
   playing in A+B SYNC, the beat becomes the other loop's beat at the bar line the recording
   starts on (for a press before the bar line, the beat the firmware gave it). */
#include "mods.h"

/* The engine's pointer at that point: the recording loop's fields from 0x49C on. */
#define ENGINE_FIELDS 0x49C

void mods_rec_bar_start(volatile uint8_t *fields)
{
    volatile fw_track *t = (volatile fw_track *)(fields - ENGINE_FIELDS);
    volatile fw_track *other = &fw_tracks[t == &fw_tracks[0]];
    uint32_t beat_len = other->beat_len, length = other->length;

    if (fw_loop_mode == 0 && (other->flags & FW_TRACK_PLAYING) && beat_len && length) {
        uint32_t beat, at;
        do {                                    /* beat and position from the same audio block */
            beat = other->beat;
            at = other->beat_pos;
        } while (beat != other->beat);
        /* The other loop's position now, less the audio recorded since the bar line, rounded to
           the nearest beat (the loops and the drums may be one audio block apart). */
        uint32_t samples = (beat + length) * beat_len + at + beat_len / 2 - t->rec_samples;
        t->rec_start = samples / beat_len % length;
    }
    fw_critical_exit();
}
