# Changelog

Releases are named after the official firmware they apply to: `V2.2.0-MOD1.0` is mod release
1.0 for NUX firmware V2.2.0.

## V2.2.0-MOD1.1 (2026-11-07)

- INHERIT DRUMS also passes on the drum set and the groove (variation and strength), not only the
  on/off: in A/B mode, the second loop starts with exactly the drums of the first. Choosing another
  drum set or groove while the empty loop is selected counts as an explicit choice for it, like
  DRUM ON/OFF.
- INHERIT DRUMS also fixes an issue of the official firmware in A/B mode: saving a memory slot again
  while a loop is unchanged gave that loop the selected loop's drum on/off. Now each loop keeps its
  own.
- The memory slot's delete confirmation is red (its title bar and the dim around it), so it no
  longer looks like the save one. Always on, like the release lines on the boot screen.

## V2.2.0-MOD1.0 (2026-10-21)

First public release, for official firmware V2.2.0.

- MODS page in the settings menu, after RESET, with two switches, both off by default:
  - DRUMS ON STOP: stopping a loop no longer stops the drum machine; only DRUM ON/OFF does.
  - INHERIT DRUMS: in A/B mode, a loop not recorded yet takes over the drums' on/off.
- The release is shown on the boot screen and in the MODS page's title bar.
- Browser page: drop the official NUX zip or `.bin`, get the modded zip or `.bin` back.
