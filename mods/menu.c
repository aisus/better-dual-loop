/* The MODS page: a tile after RESET in the settings menu, and its page of switches, one row per
   mod. */
#include <stdbool.h>
#include "mods.h"

#define RESET_ITEM       12     /* NUX's last settings page */
#define MODS_ITEM        13     /* ours, after it */
#define LIST_COUNT       13     /* tile positions: 14 pages, one of 9 and 10 hidden (NUX: 12) */
#define LIST_VISIBLE     4
#define TILE_GROUP       0x11   /* tile pictures: id 10 + 2 x page (+1 selected) */
#define TEXT_GROUP       0x12
#define MODS_TITLE_ID    0x75   /* our pictures in group 0x12 (patch/mods.js adds them) */
#define MODS_VERSION_ID  0x76   /* the release, at the right end of the title bar */
#define MODS_ROW_ID      0x77   /* rows: 4 pictures each (off, off selected, on, on selected) */
#define ROW_Y            100    /* first row, below the 60-pixel title bar */
#define ROW_PITCH        96
#define VERSION_X        (-40)  /* the release in the title bar: right end, */
#define VERSION_Y        23     /* centred on the title's capitals */
#define VERSION_GREY     0x8C71 /* RGB565 of (140, 140, 140) */
#define SLIDER_SPAN      70     /* the scroll bar under the tiles: 0..100, the thumb 30 long */
#define SLIDER_THUMB     30

/* The screen objects in fw_ui_objs: [0] the screen; on the tile list [1..4] the tiles and [5]
   the scroll bar; on the MODS page [1] the title, [2] the release and [3..] the rows (the
   firmware clears 35 slots when a page closes). */
#define OBJ_SCREEN       0
#define OBJ_TILES        1
#define OBJ_SLIDER       5
#define OBJ_TITLE        1
#define OBJ_VERSION      2
#define OBJ_ROWS         3

/* One of our pictures (from the firmware's own resources: the external pack that fw_res_image()
   can switch to does not have them). */
static const uint8_t *own_image(unsigned group, unsigned id)
{
    const uint8_t *table = fw_res_group(group);
    return table + ((const uint32_t *)table)[1 + id];
}

/* Tile picture of a settings page. */
static const uint8_t *tile_image(unsigned item, bool selected)
{
    unsigned id = 10 + 2 * item + selected;
    return item == MODS_ITEM ? own_image(TILE_GROUP, id) : fw_res_image(TILE_GROUP, id);
}

/* The tile list, redrawn for 13 positions (NUX: 12, no MODS). The firmware's code runs first and
   creates the tiles and the scroll bar; its scroll position is replaced by ours. */
void mods_settings_list_draw(const fw_msg *m)
{
    lv_obj_t **objs = fw_ui_objs;
    uint16_t scroll = fw_list_scroll;
    fw_settings_list_draw(m);
    if (m->phase != UI_UPDATE || !objs[OBJ_SCREEN])
        return;
    unsigned hidden = (fw_exp_mode & 7) == 7 ? 9 : 10;
    uint8_t items[LIST_COUNT];
    for (unsigned item = 0, n = 0; n < LIST_COUNT; item++)
        if (item != hidden)
            items[n++] = item;
    unsigned pos = m->item > hidden ? m->item - 1u : m->item;
    fw_list_scroll = scroll;
    fw_scroll(pos, &fw_list_scroll, LIST_COUNT, LIST_VISIBLE);
    for (unsigned k = 0; k < LIST_VISIBLE; k++) {
        unsigned p = fw_list_scroll + k;
        lv_img_set_src(objs[OBJ_TILES + k], fw_img_dsc(tile_image(items[p], p == pos)));
    }
    int v = pos * SLIDER_SPAN / (LIST_COUNT - 1);
    lv_bar_set_value(objs[OBJ_SLIDER], v + SLIDER_THUMB, LV_ANIM_OFF);
    lv_bar_set_start_value(objs[OBJ_SLIDER], v, LV_ANIM_OFF);
}

/* A picture as a font, so a label shows it (as the firmware's page titles do): its one glyph is
   the BMP, drawn by alpha in the label's colour. */
static const lv_font_t *picture_font(const uint8_t *bmp)
{
    int found;
    fw_picture_font *e = fw_font_cache(bmp, &found);
    if (!found) {
        int32_t height;
        memcpy(&height, bmp + 0x16, sizeof height);     /* the BMP's height, negative: top-down */
        e->bmp = bmp;
        e->tag = 0xFFFFFFFF;
        fw_zero(&e->font, sizeof e->font);
        e->font.get_glyph_dsc = fw_glyph_dsc;
        e->font.get_glyph_bitmap = fw_glyph_bitmap;
        e->font.line_height = -height;
        e->font.user_data = e;
    }
    return &e->font;
}

static void create_page(const fw_msg *m)
{
    lv_obj_t **objs = fw_ui_objs;
    fw_msg reset = *m;
    reset.item = RESET_ITEM;            /* the screen and title bar as for RESET, then our title */
    fw_settings_draw(&reset);
    lv_obj_set_style_text_font(objs[OBJ_TITLE], picture_font(own_image(TEXT_GROUP, MODS_TITLE_ID)),
                               LV_PART_MAIN);
    /* The release: a label showing its picture, like the title (any text shows the one glyph). */
    lv_obj_t *version = objs[OBJ_VERSION] = lv_label_create(objs[OBJ_SCREEN]);
    lv_label_set_text(version, " ");
    lv_obj_align(version, LV_ALIGN_TOP_RIGHT, VERSION_X, VERSION_Y);
    lv_obj_set_style_text_color(version, VERSION_GREY, LV_PART_MAIN);
    lv_obj_set_style_text_font(version, picture_font(own_image(TEXT_GROUP, MODS_VERSION_ID)), LV_PART_MAIN);
}

/* One picture per row, by the row's state and whether it is selected. */
static void draw_rows(unsigned cursor)
{
    lv_obj_t **objs = fw_ui_objs;
    for (unsigned row = 0; row < MODS_ROWS; row++) {
        lv_obj_t **img = &objs[OBJ_ROWS + row];
        if (!*img) {
            *img = lv_img_create(objs[OBJ_SCREEN]);
            lv_obj_align(*img, LV_ALIGN_TOP_MID, 0, ROW_Y + ROW_PITCH * row);
        }
        unsigned state = (fw_settings_mods >> row & 1) * 2 + (cursor == row);
        lv_img_set_src(*img, fw_img_dsc(own_image(TEXT_GROUP, MODS_ROW_ID + 4 * row + state)));
    }
}

/* Settings page callback: the MODS page; other pages go to the firmware's. */
void mods_settings_draw(const fw_msg *m)
{
    bool open = fw_ui_objs[OBJ_SCREEN] != 0;
    if (m->item != MODS_ITEM || m->phase == UI_DESTROY)
        fw_settings_draw(m);
    else if (m->phase == UI_CREATE && !open)
        create_page(m);
    else if (m->phase == UI_UPDATE && open)
        draw_rows(m->cursor);
}

static bool on_mods_page(void)
{
    return fw_settings_page.in_page && fw_settings_page.item == MODS_ITEM;
}

/* Redraw the MODS page (in the UI task). */
static void post_update(void)
{
    fw_msg m;
    fw_zero(&m, sizeof m);
    m.callback = mods_settings_draw;
    m.phase = UI_UPDATE;
    m.item = MODS_ITEM;
    m.cursor = fw_settings_page.cursor;
    fw_ui_post(&m, sizeof m);
}

/* Settings PARA knob: on the MODS page it switches the selected row on (right) or off (left),
   like the MIDI page's switches. */
int mods_settings_para_knob(const fw_event *e)
{
    if (!on_mods_page())
        return fw_settings_para_knob(e);
    if (fw_settings_page.cursor >= MODS_ROWS)
        return 0;
    uint8_t bit = 1u << fw_settings_page.cursor;
    if (e->value > 0)
        fw_settings_mods |= bit;
    else if (e->value < 0)
        fw_settings_mods &= (uint8_t)~bit;
    post_update();
    return 0;
}

/* Settings HOME knob: on the MODS page it moves the cursor between the rows. */
int mods_settings_home_knob(const fw_event *e)
{
    if (!on_mods_page())
        return fw_settings_home_knob(e);
    int cursor = fw_settings_page.cursor + e->value;
    fw_settings_page.cursor = cursor < 0 ? 0 : cursor >= MODS_ROWS ? MODS_ROWS - 1 : cursor;
    post_update();
    return 0;
}

/* Settings PARA press (value 0 = press): on the MODS page it toggles the selected row. */
int mods_settings_para_press(const fw_event *e)
{
    if (!on_mods_page())
        return fw_settings_para_press(e);
    if (e->value == 0 && fw_settings_page.cursor < MODS_ROWS) {
        fw_settings_mods ^= 1u << fw_settings_page.cursor;
        post_update();
    }
    return 0;
}
