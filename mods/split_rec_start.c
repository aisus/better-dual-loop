/* A/B SPLIT: a loop recorded straight after the other becomes the active loop. Always on.

   In A/B SPLIT, the CTRL footswitch's single press acts on the active loop: the loop started last,
   which the firmware also uses for the drums. Recording an empty loop while the other plays
   normally waits for the playing loop's end, where the firmware switches over and makes the new
   loop active. A press that comes in the first beat of the playing loop (just after its end)
   starts the recording at once instead, backdated to that loop's start, and leaves the active loop
   as it was: the loop just stopped. Until a footswitch changes it, CTRL's single press then does
   nothing (its double press and hold do not depend on it).

   That start (code at 0x3444, in its critical section, right after it has set the new loop
   recording and before it stops the other) ends the critical section through here, with r0 = the
   new loop's fields from 0x4B4 on: the new loop becomes the active one, as at the switch-over. */
#include "mods.h"

#define START_FIELDS 0x4B4

void mods_split_rec_start(volatile uint8_t *fields)
{
    volatile fw_track *t = (volatile fw_track *)(fields - START_FIELDS);
    fw_settings_page.track = t != &fw_tracks[0];
    fw_critical_exit();
}
