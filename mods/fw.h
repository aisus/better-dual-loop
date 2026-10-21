/* The parts of NUX's firmware V2.2.0 the mods use: functions and data, declared for C. Their
   addresses are in firmware.ld, in the same order. Structures show only the fields used. */
#ifndef MODS_FW_H
#define MODS_FW_H
#include <stdint.h>

/* --- LVGL 8, the firmware's UI library ---------------------------------------------------------- */

typedef struct _lv_obj_t lv_obj_t;
typedef int16_t lv_coord_t;
typedef uint16_t lv_color_t;                    /* RGB565 */

typedef struct lv_font_t {
    void (*get_glyph_dsc)(void);                /* callbacks (their arguments do not matter here) */
    void (*get_glyph_bitmap)(void);
    lv_coord_t line_height;
    lv_coord_t base_line;
    uint8_t subpx;
    int8_t underline_position;
    int8_t underline_thickness;
    const void *dsc;
    const struct lv_font_t *fallback;
    void *user_data;
} lv_font_t;

enum { LV_ALIGN_TOP_MID = 2, LV_ALIGN_TOP_RIGHT = 3 };
enum { LV_ANIM_OFF = 0 };
#define LV_PART_MAIN 0

lv_obj_t *lv_label_create(lv_obj_t *parent);
void lv_label_set_text(lv_obj_t *label, const char *text);
void lv_obj_set_style_text_color(lv_obj_t *obj, lv_color_t color, uint32_t selector);
void lv_obj_set_style_text_font(lv_obj_t *obj, const lv_font_t *font, uint32_t selector);
void lv_obj_align(lv_obj_t *obj, uint8_t align, lv_coord_t x, lv_coord_t y);
lv_obj_t *lv_img_create(lv_obj_t *parent);
void lv_img_set_src(lv_obj_t *img, const void *src);
void lv_bar_set_value(lv_obj_t *bar, int32_t value, int anim);
void lv_bar_set_start_value(lv_obj_t *bar, int32_t value, int anim);

/* --- The settings menu -------------------------------------------------------------------------- */

/* A key or knob event: a knob turned by `value` steps (negative: to the left), or a press (0). */
typedef struct {
    uint8_t key;
    uint8_t _pad;
    int16_t value;
} fw_event;

/* A message for the UI task: fw_ui_post() copies it and calls `callback` with it there. */
typedef struct fw_msg {
    void (*callback)(const struct fw_msg *m);
    uint8_t phase;                              /* UI_CREATE, UI_DESTROY or UI_UPDATE */
    uint8_t item;                               /* settings page */
    uint8_t cursor;                             /* selected row */
    uint8_t value[17];
} fw_msg;

enum { UI_CREATE = 0, UI_DESTROY = 1, UI_UPDATE = 2 };

typedef struct {
    uint8_t _0[7];
    uint8_t item;                               /* the page (tile) chosen */
    uint8_t cursor;                             /* the selected row on it */
    uint8_t in_page;                            /* nonzero while a page is open */
} fw_settings_page_t;

void fw_settings_list_draw(const fw_msg *m);    /* draws the tile list */
void fw_settings_draw(const fw_msg *m);         /* draws a page */
int fw_settings_para_press(const fw_event *e);  /* the menu's key and knob handlers */
int fw_settings_para_knob(const fw_event *e);
int fw_settings_home_knob(const fw_event *e);
void fw_ui_post(const fw_msg *m, unsigned size);
void fw_scroll(unsigned pos, uint16_t *scroll, int count, int visible);   /* keeps pos visible */
extern volatile fw_settings_page_t fw_settings_page;
extern lv_obj_t *fw_ui_objs[];                  /* the current screen's objects */
extern uint16_t fw_list_scroll;                 /* the first tile position shown */
extern volatile uint8_t fw_exp_mode;            /* & 7 == 7: tile 9 hidden, else tile 10 */
extern volatile uint8_t fw_settings_mods;       /* a spare byte saved with the settings */

/* --- Drums and loops ---------------------------------------------------------------------------- */

#define FW_TRACKS 2

typedef struct {
    uint8_t _0[0xF];
    uint8_t on;                                 /* the drums play with this loop */
} fw_drum_record;                               /* a loop's drum settings */

typedef struct {
    uint8_t _0[0x298];
    uint32_t audio;                             /* the recording; 0 while the loop is empty */
    uint8_t _1[0x4E8 - 0x29C];
    uint32_t flags;
    uint8_t _2[0x538 - 0x4EC];
} fw_track;

#define FW_TRACK_RECORDING 0x01                 /* fw_track flags */
#define FW_DRUMS_ON 0x01                        /* fw_drum_flags */

void fw_drum_silence_voices(void);              /* cuts the drum sounds playing */
void fw_drum_save_track(unsigned t);            /* saves the drums' state to loop t's record */
extern volatile uint32_t fw_drum_flags;
extern volatile fw_drum_record fw_drum_records[FW_TRACKS];
extern volatile fw_track fw_tracks[FW_TRACKS];
extern volatile int16_t fw_memory_slot;         /* the memory slot loaded */

/* --- Pictures ----------------------------------------------------------------------------------- */

/* A picture shown as a label's text: an LVGL font whose one glyph is the BMP. */
typedef struct {
    const uint8_t *bmp;                         /* the cache key */
    uint32_t tag;                               /* 0xFFFFFFFF, as the firmware sets it */
    lv_font_t font;
} fw_picture_font;

const uint8_t *fw_res_group(unsigned group);    /* a picture group: {count, offset[count]} */
const uint8_t *fw_res_image(unsigned group, unsigned id);   /* a picture (BMP) */
void *fw_img_dsc(const uint8_t *bmp);           /* an LVGL image of a BMP */
fw_picture_font *fw_font_cache(const uint8_t *bmp, int *found);   /* a BMP's cache entry */
void fw_glyph_dsc(void);                        /* callbacks of picture fonts */
void fw_glyph_bitmap(void);

/* --- The C library ------------------------------------------------------------------------------ */

void *memcpy(void *dst, const void *src, unsigned n);
void fw_zero(void *dst, unsigned n);            /* Arm's __aeabi_memclr (GCC would call memset) */

#endif
