# The mods blob from mods/. Needs GNU make. (The page: npm test, npm run build.)
#
#   make              compile mods/*.c into build/mods/mods.bin and its symbol list mods.sym
#                     (Arm GNU Toolchain 14.2.rel1; arm-none-eabi-* on PATH, or TOOLCHAIN=<its
#                     directory>). npm run build checks mods.bin against release.json.

TOOLCHAIN ?=
CROSS := $(if $(TOOLCHAIN),$(TOOLCHAIN)/bin/)arm-none-eabi-
OUT ?= build/mods

# The blob is linked at 0x4E200, right after NUX's code (mods/mods.ld), with no C library: only the
# code in mods/ and the firmware's own functions (mods/firmware.ld).
CFLAGS := -mcpu=cortex-m7 -mthumb -mfpu=fpv5-d16 -mfloat-abi=hard \
	-Os -ffreestanding -fno-builtin -nostdlib -fno-common \
	-Wall -Wextra -Werror -std=c11
SOURCES := $(sort $(wildcard mods/*.c))

.PHONY: mods clean

mods: $(OUT)/mods.bin $(OUT)/mods.sym $(OUT)/mods.lst

$(OUT)/mods.elf: $(SOURCES) $(wildcard mods/*.h mods/*.ld) Makefile
	@mkdir -p $(OUT)
	$(CROSS)gcc $(CFLAGS) -I mods -T mods/mods.ld -L mods \
		-Wl,-Map,$(OUT)/mods.map -o $@ $(SOURCES)

$(OUT)/mods.bin: $(OUT)/mods.elf
	$(CROSS)objcopy -O binary -j .text $< $@

# The addresses of the functions the patch hooks in (patch/mods.js), and of the firmware's.
$(OUT)/mods.sym: $(OUT)/mods.elf
	$(CROSS)nm -n $< > $@

$(OUT)/mods.lst: $(OUT)/mods.elf
	$(CROSS)objdump -d --no-show-raw-insn $< > $@

clean:
	rm -rf build
