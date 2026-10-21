/* The mods blob: right after NUX's code, which ends at 0x4E188, up to the most code the
   bootloader loads (header and code within 0x50000 bytes). It runs where it is loaded. */
MEMORY
{
  CAVE (rx) : ORIGIN = 0x4E200, LENGTH = 0x4FE00 - 0x4E200
}

INCLUDE firmware.ld

SECTIONS
{
  /* Everything in one block of bytes, variables included: the bootloader copies the whole blob
     into the processor's fast memory (read-write) at every boot, so variables start with their
     initial values, zero for .bss, without any startup code. */
  .text : {
    *(.text*)
    *(.rodata*)
    *(.data*)
    *(.bss*)
    . = ALIGN(4);
  } > CAVE
}
