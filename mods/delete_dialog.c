/* The memory slot's save and delete confirmations look the same in the firmware: one dialog, one
   layout, only the words differ. The delete one is painted red here: its title bar, and the dim
   around it. Always on, like the boot screen lines; the save dialog stays as it is.

   The firmware's home screen builds the dialog (code at 0x2934 and 0x29B2) with
   lv_obj_set_style_bg_color calls that come here instead; byte 0xD of the message being drawn
   (in r4 there) is 1 for delete. The panel stays grey: the dialog's text is a picture with the
   panel colour as its background. */
#include "mods.h"

#define STOCK_DIM     0x0000                /* RGB565, as the firmware sets them */
#define STOCK_TITLE   0x52AA
#define DELETE_DIM    0x7800                /* dark red */
#define DELETE_TITLE  0xC000                /* red */

__attribute__((used))
static void dialog_bg(lv_obj_t *obj, lv_color_t color, uint32_t selector, unsigned deleting)
{
    if (deleting && color == STOCK_DIM)
        color = DELETE_DIM;
    else if (deleting && color == STOCK_TITLE)
        color = DELETE_TITLE;
    lv_obj_set_style_bg_color(obj, color, selector);
}

/* In place of the firmware's call: its arguments, plus whether the dialog is the delete one. */
__attribute__((naked))
void mods_dialog_bg(void)
{
    __asm volatile(
        "ldrb  r3, [r4, #0xd]\n"            /* the message: 0 save, 1 delete */
        "b.w   dialog_bg\n");
}
