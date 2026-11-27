/* Drum patterns from a file: any part of a stock style replaced by the user's. Always on.

   The page (Drum patterns) writes NML-3DLS/DRUM/PATTERNS.BIN to the pedal's USB drive. At every
   normal boot, after the boot's step at 0x2080, ours reads it into the pool (fast memory the
   firmware leaves unused, mods.ld), checks every part and writes NML-3DLS/DRUM/STATUS.TXT: what was
   loaded, and why the rest was refused. The drum clock loads each part through ours (0xA256): the
   stock part first, then the user's part over it, if there is one. Without the file, or with a
   file that fails its checks, every part stays stock.

   PATTERNS.BIN, little-endian: "BDLP", u16 format (1), u16 count, u32 size of the file, u32
   CRC-32/MPEG-2 of bytes 16 to size; then count entries {u8 meter (4 or 3), u8 style (from 1),
   u8 part (0-15), u8 0, u32 offset in the file (a multiple of 4), u32 bytes}; then the parts, in the
   firmware's own format (fw.h). The editor's writer (drum/patterns.js) checks parts by the same
   rules. */
#include "mods.h"

/* RELEASE: the version in release.json, from the Makefile. */
#define FORMAT 1
#define MAGIC 0x504C4442u                       /* "BDLP" */
#define STYLES_44 29                            /* styles in the 4/4 pattern set (from 1) */
#define STYLES_34 13                            /* and in the 3/4 one */
#define STYLES (STYLES_44 + STYLES_34)
#define PARTS 16                                /* per style: 4 strengths x 4 columns */
#define TICKS 120                               /* per beat */
#define BARS 8                                  /* the most a part may have, as the stock parts */
#define MIN_PART_WORDS 8                        /* the header and the end event */
#define END_EVENT 0x7FFFFFFFu
#define TICK_FLAG 0x80000000u

typedef struct {
    uint8_t meter, style, part, flags;
    uint32_t offset, bytes;
} entry;

typedef struct {
    uint32_t magic;
    uint16_t format, count;
    uint32_t size, crc;
    entry entries[];
} patterns_file;

#define HEADER_SIZE sizeof(patterns_file)
_Static_assert(HEADER_SIZE == 16 && sizeof(entry) == 12, "the file's layout");

/* What the checks found, per entry; the names as STATUS.TXT shows them. */
enum { OK, BAD_RANGE, BAD_DUPLICATE, BAD_PLACE, BAD_SIZE, BAD_HEADER, BAD_METER, BAD_BEATS,
       BAD_TEMPO, BAD_KIT, BAD_TICK, BAD_EVENT, BAD_END };
static const char *const verdicts[] = { "OK", "BAD range", "BAD duplicate", "BAD place",
    "BAD size", "BAD header", "BAD meter", "BAD beats", "BAD tempo", "BAD kit", "BAD tick",
    "BAD event", "BAD end" };

/* The pool: the boot's scratch, the index the drum clock reads, then the file as read. */
typedef struct {
    fw_file file;
    char path[48];
    char text[512];                             /* STATUS.TXT, a piece at a time */
    char back[512];                             /* the STATUS.TXT on the drive, to compare */
    uint8_t seen[STYLES][PARTS];
    uint8_t verdict[STYLES * PARTS];            /* per entry, in file order */
    const uint32_t *part[STYLES][PARTS];        /* the user's parts; 0: stock */
    uint32_t data[];                            /* PATTERNS.BIN */
} pool;

extern uint8_t drum_pool[], drum_pool_end[];
#define POOL ((pool *)drum_pool)

/* Bytes of the pool in use after the boot (for a check that nothing else writes them). */
uint32_t drum_pool_used;

static volatile uint8_t ready;                  /* POOL->part is complete */

/* The file's state, for STATUS.TXT. */
enum { NONE, LOADED, ERROR_OPEN, ERROR_READ, BAD_FORMAT, BAD_FILE_SIZE, BAD_CRC };
static struct {
    uint8_t state;
    int rc;
    unsigned count, loaded, size;
} result;

/* The styles of the 4/4 or the 3/4 pattern set, and a style's place in POOL->part. */
static unsigned styles_in(bool in_34)
{
    return in_34 ? STYLES_34 : STYLES_44;
}

static unsigned style_slot(bool in_34, unsigned style)
{
    return (in_34 ? STYLES_44 : 0) + style - 1u;
}

/* --- The drum clock ----------------------------------------------------------------------------- */

/* Instead of the firmware's part load in the drum clock (0xA256). */
void mods_part_load(int meter, uint8_t sel[2])
{
    fw_part_load(meter, sel);                   /* the stock part; sel is valid now */
    if (!ready || sel[0] == 0 || sel[0] > styles_in(meter != 0) || sel[1] >= PARTS)
        return;
    const uint32_t *p = POOL->part[style_slot(meter != 0, sel[0])][sel[1]];
    if (p)
        memcpy(fw_drum_part, p, p[0] * 4);
}

/* --- Checks ------------------------------------------------------------------------------------- */

static uint32_t crc32mpeg2(const uint8_t *p, unsigned n)
{
    uint32_t c = 0xFFFFFFFFu;
    while (n--) {
        c ^= (uint32_t)*p++ << 24;
        for (int i = 0; i < 8; i++)
            c = c & 0x80000000u ? (c << 1) ^ 0x04C11DB7u : c << 1;
    }
    return c;
}

static int kit_ok(uint32_t kit)
{
    return kit <= 9 || kit == 99;               /* the sample bank's kits */
}

/* A part of `bytes` bytes for the meter (4 or 3 beats per bar). */
static unsigned check_part(const uint32_t *p, uint32_t bytes, unsigned meter)
{
    uint32_t words = p[0], beats = p[4];
    if (words * 4 != bytes || words < MIN_PART_WORDS || words > FW_PART_WORDS || words % 2)
        return BAD_SIZE;
    if (p[1] != 6)
        return BAD_HEADER;
    if (p[3] != (meter == 4 ? 0x402u : 0x302u))
        return BAD_METER;
    if (beats == 0 || beats > BARS * meter || beats % meter)
        return BAD_BEATS;
    if (p[2] < 30 || p[2] > 250)
        return BAD_TEMPO;
    if (!kit_ok(p[5]))
        return BAD_KIT;
    uint32_t last = 0, end = beats * TICKS;
    for (uint32_t i = 6; i < words - 2; i += 2) {
        uint32_t tick = p[i] & ~TICK_FLAG, ev = p[i + 1];
        if (!(p[i] & TICK_FLAG) || tick < last || tick >= end)
            return BAD_TICK;
        last = tick;
        unsigned note = ev & 0xFF, vel = ev >> 8;
        if (note > 127 || vel == 0 || vel > 127)
            return BAD_EVENT;
    }
    if (p[words - 2] != ((end - 1) | TICK_FLAG) || p[words - 1] != END_EVENT)
        return BAD_END;
    return OK;
}

static unsigned check_entry(const patterns_file *h, const entry *e)
{
    if ((e->meter != 4 && e->meter != 3) || e->style == 0 || e->style > styles_in(e->meter == 3)
        || e->part >= PARTS || e->flags)
        return BAD_RANGE;
    unsigned s = style_slot(e->meter == 3, e->style);
    if (POOL->seen[s][e->part])
        return BAD_DUPLICATE;
    POOL->seen[s][e->part] = 1;
    uint32_t start = HEADER_SIZE + sizeof(entry) * h->count;
    if (e->offset % 4 || e->offset < start || e->offset > h->size || e->bytes > h->size - e->offset
        || e->bytes < MIN_PART_WORDS * 4)
        return BAD_PLACE;
    const uint32_t *p = POOL->data + e->offset / 4;
    unsigned v = check_part(p, e->bytes, e->meter);
    if (v == OK)
        POOL->part[s][e->part] = p;
    return v;
}

/* --- Files -------------------------------------------------------------------------------------- */

static char *put(char *p, const char *s)
{
    while (*s)
        *p++ = *s++;
    *p = 0;
    return p;
}

static const char *path(const char *name)
{
    put(POOL->path + fw_path_prefix(POOL->path), name);
    return POOL->path;
}

/* Reads PATTERNS.BIN into the pool and fills POOL->part. */
static void load(void)
{
    pool *P = POOL;
    unsigned room = (unsigned)(drum_pool_end - (uint8_t *)P->data), got = 0;
    fw_zero(P->part, sizeof P->part);
    fw_zero(P->seen, sizeof P->seen);
    result.count = result.loaded = result.size = 0;
    drum_pool_used = (uint32_t)((uint8_t *)P->data - drum_pool);

    int rc = f_open(&P->file, path("/DRUM/PATTERNS.BIN"), FW_FA_READ);
    if (rc) {
        result.state = rc == FW_FR_NO_FILE || rc == FW_FR_NO_PATH ? NONE : ERROR_OPEN;
        result.rc = rc;
        return;
    }
    rc = f_read(&P->file, P->data, room, &got);
    f_close(&P->file);
    const patterns_file *h = (const patterns_file *)P->data;
    result.rc = rc;
    result.size = got;
    if (rc)
        result.state = ERROR_READ;
    else if (got < HEADER_SIZE || h->magic != MAGIC || h->format != FORMAT)
        result.state = BAD_FORMAT;
    else if (h->size != got || h->count > STYLES * PARTS
             || h->size < HEADER_SIZE + sizeof(entry) * h->count)
        result.state = BAD_FILE_SIZE;
    else if (crc32mpeg2((const uint8_t *)P->data + HEADER_SIZE, h->size - HEADER_SIZE) != h->crc)
        result.state = BAD_CRC;
    else {
        result.state = LOADED;
        result.count = h->count;
        for (unsigned i = 0; i < h->count; i++) {
            P->verdict[i] = (uint8_t)check_entry(h, &h->entries[i]);
            result.loaded += P->verdict[i] == OK;
        }
        drum_pool_used += (h->size + 3) & ~3u;
    }
}

/* STATUS.TXT, written in pieces of POOL->text; or compared with the one on the drive. */
static struct {
    int write;                                  /* else compare */
    int same;                                   /* compare: no difference so far */
    unsigned len;
} out;

static void flush(void)
{
    pool *P = POOL;
    unsigned done = 0;
    if (out.write) {
        f_write(&P->file, P->text, out.len, &done);
    } else if (out.same) {
        if (f_read(&P->file, P->back, out.len, &done) || done != out.len)
            out.same = 0;
        for (unsigned i = 0; out.same && i < out.len; i++)
            out.same = P->back[i] == P->text[i];
    }
    out.len = 0;
}

static void text(const char *s)
{
    out.len = (unsigned)(put(POOL->text + out.len, s) - POOL->text);
}

static void num(unsigned v)
{
    char digits[12], *p = digits + sizeof digits - 1;
    *p = 0;
    do
        *--p = (char)('0' + v % 10);
    while (v /= 10);
    text(p);
}

static void line_end(void)
{
    text("\r\n");
    if (out.len > sizeof POOL->text - 96)
        flush();
}

static void status(void)
{
    static const char *const states[] = { "NONE", "OK", "ERROR open", "ERROR read", "BAD format",
        "BAD size", "BAD crc" };
    const patterns_file *h = (const patterns_file *)POOL->data;
    out.len = 0;
    text("BDL-DRUM-STATUS 1");
    line_end();
    text("mod " RELEASE);
    line_end();
    text("patterns-format ");
    num(FORMAT);
    line_end();
    text("patterns-room ");
    num((unsigned)(drum_pool_end - (uint8_t *)POOL->data));
    line_end();
    text("patterns ");
    text(states[result.state]);
    if (result.state == ERROR_OPEN || result.state == ERROR_READ) {
        text(" ");
        num((unsigned)result.rc);
    } else if (result.state == LOADED) {
        text(" ");
        num(result.count);
        text(" entries, ");
        num(result.loaded);
        text(" loaded, ");
        num(result.size);
        text(" bytes");
    }
    line_end();
    for (unsigned i = 0; i < result.count; i++) {
        const entry *e = &h->entries[i];
        text("entry ");
        num(e->meter);
        text(" ");
        num(e->style);
        text(" ");
        num(e->part);
        text(" ");
        text(verdicts[POOL->verdict[i]]);
        line_end();
    }
    flush();
}

/* Writes STATUS.TXT unless the drive has the same one (no flash write at every boot). */
static void write_status(void)
{
    pool *P = POOL;
    out.write = 0;
    out.same = f_open(&P->file, path("/DRUM/STATUS.TXT"), FW_FA_READ) == 0;
    if (out.same) {
        status();
        unsigned extra = 0;
        out.same = out.same && f_read(&P->file, P->back, 1, &extra) == 0 && extra == 0;
        f_close(&P->file);
        if (out.same)
            return;
    }
    if (f_open(&P->file, P->path, FW_FA_WRITE | FW_FA_CREATE_ALWAYS))
        return;                                 /* no DRUM folder: the editor makes it */
    out.write = 1;
    status();
    f_close(&P->file);
}

/* --- Boot --------------------------------------------------------------------------------------- */

/* Instead of the boot's step at 0x2080. */
int mods_boot_end(void *a, unsigned kind, unsigned c, unsigned d)
{
    int r = fw_boot_end(a, kind, c, d);
    if (kind == 2) {
        ready = 0;
        load();
        ready = 1;
        write_status();
    }
    return r;
}
