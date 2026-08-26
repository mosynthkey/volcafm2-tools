#pragma once

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

void dexed_preview_init(int sample_rate);
void dexed_preview_reset(void);
void dexed_preview_set_voice(const uint8_t *unpacked155, const char *op_switch6);
void dexed_preview_note_on(int midi_note, int velocity);
void dexed_preview_note_off(int midi_note);
void dexed_preview_render(float *out, int frames);

#ifdef __cplusplus
}
#endif
