/* Addresses in NUX's firmware V2.2.0 of what fw.h declares, in the same order (functions are Thumb
   code: address + 1). */

/* LVGL 8 */
lv_label_create = 0x00012ED5;
lv_label_set_text = 0x00012EEB;
lv_obj_set_style_text_color = 0x00013D1D;
lv_obj_set_style_text_font = 0x00013D29;
lv_obj_align = 0x00015951;
lv_img_create = 0x000181C3;
lv_img_set_src = 0x000181D9;
lv_bar_set_value = 0x000190F7;
lv_bar_set_start_value = 0x0001912D;

/* The settings menu */
fw_settings_list_draw = 0x00006499;
fw_settings_draw = 0x00006831;
fw_settings_para_press = 0x0000817D;
fw_settings_para_knob = 0x000088A5;
fw_settings_home_knob = 0x00008C59;
fw_ui_post = 0x0000B735;
fw_scroll = 0x0000C131;
fw_settings_page = 0x20001F7C;
fw_ui_objs = 0x2000EA60;
fw_list_scroll = 0x2000F4E4;
fw_exp_mode = 0x2000F3B0;
fw_settings_mods = 0x20279187;

/* Drums and loops */
fw_drum_silence_voices = 0x0001A2A9;
fw_drum_save_track = 0x00009F71;
fw_drum_flags = 0x2000EE20;
fw_drum_records = 0x2000EE5C;
fw_tracks = 0x2000B2A8;
fw_memory_slot = 0x20279168;

/* Pictures */
fw_res_group = 0x0000B775;
fw_res_image = 0x0000B875;
fw_img_dsc = 0x00018BAD;
fw_font_cache = 0x00018AE1;
fw_glyph_dsc = 0x00013D3D;
fw_glyph_bitmap = 0x00013E73;

/* Memory */
memcpy = 0x0001A3B9;
fw_zero = 0x0001D0D1;
