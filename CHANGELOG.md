# Changelog

Releases are named after the official firmware they apply to: `V2.2.0-MOD1.0` is mod release
1.0 for NUX firmware V2.2.0.

## V2.2.0-MOD1.3 (2026-11-27)

- Custom drum patterns: the Drum patterns page replaces any of the pedal's 672 drum
  patterns with a MIDI clip. The pedal loads them from one file at every start.
  Without the file, the drums are stock.
- MIDI extractor on the page: the stock drum patterns as MIDI files, from NUX's official zip.
- New switches STRENGTH +1 and VARIATION +1, under SPLIT: INHERIT DRUMS: the loop recorded second
  gets the first loop's groove one strength higher, one variation further, or both.
- Fixes an official firmware issue in A/B mode: a loop started at once (recorded just as the other
  loop ended) played the other loop's drums.
- SPLIT: INHERIT DRUMS: loading a memory slot clears an empty loop's own drum choice.
- New page design.

## V2.2.0-MOD1.2 (2026-11-13)

- New switch SYNC: FS PER LOOP: in A+B mode, footswitch 1 works on loop 1 and footswitch 2 on
  loop 2, as in A/B mode.
- INHERIT DRUMS is renamed SPLIT: INHERIT DRUMS. Its setting is kept.
- DRUMS ON STOP: each recorded loop keeps its drums. Stopping the drums with DRUM ON/OFF after
  stopping a loop no longer switches them off for it: when you start it again, its drums start
  with it.
- Fixes an official firmware issue in A+B mode: a loop recorded while the other plays, with the
  record press slightly late (in the first beat of the bar), played one bar off. Always on.
- Fixes an official firmware issue in A/B mode: recording the second loop just as the first comes
  round left CTRL's single press doing nothing until another footswitch was pressed. Always on.

## V2.2.0-MOD1.1 (2026-11-07)

- INHERIT DRUMS also passes on the drum set and the groove, not only on/off. Choosing a drum set
  or groove while the empty loop is selected gives it its own, like DRUM ON/OFF.
- INHERIT DRUMS also fixes an official firmware issue in A/B mode: saving a memory slot again with
  a loop unchanged gave that loop the selected loop's drum on/off.
- The memory slot's delete confirmation is red. Always on.

## V2.2.0-MOD1.0 (2026-10-21)

First public release, for official firmware V2.2.0.

- MODS page in the settings menu, after RESET, with two switches, both off by default:
  - DRUMS ON STOP: stopping a loop no longer stops the drums. Only DRUM ON/OFF does.
  - INHERIT DRUMS: in A/B mode, a loop not recorded yet takes over the drums' on/off.
- The release is shown on the boot screen and in the MODS page's title bar.
- The page: drop the official NUX zip or `.bin`, get the modded zip or `.bin` back.
