#include "dexed_preview.h"

#include "aligned_buf.h"
#include "controllers.h"
#include "dx7note.h"
#include "env.h"
#include "exp2.h"
#include "fm_core.h"
#include "freqlut.h"
#include "lfo.h"
#include "pitchenv.h"
#include "porta.h"
#include "sin.h"
#include "synth.h"
#include "tuning.h"

#include <algorithm>
#include <cstring>
#include <memory>
#include <stdarg.h>
#include <stdio.h>

namespace {

constexpr int kMaxNotes = 8;
constexpr int kVoiceSize = 156;

struct Voice {
    std::unique_ptr<Dx7Note> note;
    int midiNote = -1;
    bool keyDown = false;
    bool live = false;
};

int sampleRate = 44100;
uint8_t voiceData[kVoiceSize];
float extraSamples[N];
int extraCount = 0;
std::shared_ptr<TuningState> tuning;
FmCore engine;
Lfo lfo;
Controllers controllers;
Voice voices[kMaxNotes];

void silenceVoices() {
    for (auto &voice : voices) {
        if (voice.note) voice.note->keyup();
        voice.keyDown = false;
        voice.live = false;
        voice.midiNote = -1;
    }
    extraCount = 0;
}

int findVoice(int midiNote) {
    for (int voiceIndex = 0; voiceIndex < kMaxNotes; ++voiceIndex) {
        if (voices[voiceIndex].keyDown && voices[voiceIndex].midiNote == midiNote) return voiceIndex;
    }
    return -1;
}

int allocateVoice() {
    for (int voiceIndex = 0; voiceIndex < kMaxNotes; ++voiceIndex) {
        if (!voices[voiceIndex].live) return voiceIndex;
    }
    for (int voiceIndex = 0; voiceIndex < kMaxNotes; ++voiceIndex) {
        if (!voices[voiceIndex].keyDown) return voiceIndex;
    }
    return 0;
}

void mixBlock(float *out, int frames, int startFrame) {
    AlignedBuf<int32_t, N> audioBuf;
    float sum[N];
    for (int sampleIndex = 0; sampleIndex < N; ++sampleIndex) {
        audioBuf.get()[sampleIndex] = 0;
        sum[sampleIndex] = 0;
    }

    const int32_t lfoValue = lfo.getsample();
    const int32_t lfoDelay = lfo.getdelay();
    for (auto &voice : voices) {
        if (!voice.live || !voice.note) continue;
        voice.note->compute(audioBuf.get(), lfoValue, lfoDelay, &controllers);
        for (int sampleIndex = 0; sampleIndex < N; ++sampleIndex) {
            int32_t value = audioBuf.get()[sampleIndex] >> 4;
            const int clipped = value < -(1 << 24) ? 0x8000 : value >= (1 << 24) ? 0x7fff : value >> 9;
            float sample = static_cast<float>(clipped) / static_cast<float>(0x8000);
            sample = std::max(-1.0f, std::min(1.0f, sample));
            sum[sampleIndex] += sample;
            audioBuf.get()[sampleIndex] = 0;
        }
        if (!voice.keyDown && !voice.note->isPlaying()) {
            voice.live = false;
            voice.midiNote = -1;
        }
    }

    const int copyCount = std::min(N, frames - startFrame);
    for (int sampleIndex = 0; sampleIndex < copyCount; ++sampleIndex) {
        out[startFrame + sampleIndex] = sum[sampleIndex];
    }
    extraCount = 0;
    for (int sampleIndex = copyCount; sampleIndex < N; ++sampleIndex) {
        extraSamples[extraCount++] = sum[sampleIndex];
    }
}

}  // namespace

void dexed_trace(const char *, const char *, ...) {}

extern "C" void dexed_preview_init(int nextSampleRate) {
    sampleRate = nextSampleRate > 0 ? nextSampleRate : 44100;
    Exp2::init();
    Tanh::init();
    Sin::init();
    Freqlut::init(sampleRate);
    Lfo::init(sampleRate);
    PitchEnv::init(sampleRate);
    Env::init_sr(sampleRate);
    Porta::init_sr(sampleRate);

    tuning = createStandardTuning();
    std::memset(voiceData, 0, sizeof(voiceData));
    std::memset(&controllers, 0, sizeof(controllers));
    controllers.core = &engine;
    controllers.mpeEnabled = false;
    controllers.portamento_enable_cc = false;
    controllers.portamento_cc = 0;
    controllers.masterTune = 0;
    controllers.values_[kControllerPitch] = 0x2000;
    controllers.values_[kControllerPitchRangeUp] = 3;
    controllers.values_[kControllerPitchRangeDn] = 3;
    std::strcpy(controllers.opSwitch, "111111");
    controllers.refresh();

    for (auto &voice : voices) {
        voice.note = std::make_unique<Dx7Note>(tuning, nullptr);
        voice.keyDown = false;
        voice.live = false;
        voice.midiNote = -1;
    }
    extraCount = 0;
}

extern "C" void dexed_preview_reset() {
    silenceVoices();
}

extern "C" void dexed_preview_set_voice(const uint8_t *unpacked155, const char *opSwitch6) {
    if (!unpacked155) return;
    std::memcpy(voiceData, unpacked155, 155);
    voiceData[155] = 0;
    if (opSwitch6) {
        for (int operatorIndex = 0; operatorIndex < 6; ++operatorIndex) {
            controllers.opSwitch[operatorIndex] = opSwitch6[operatorIndex] == '0' ? '0' : '1';
        }
        controllers.opSwitch[6] = 0;
    } else {
        std::strcpy(controllers.opSwitch, "111111");
    }
    lfo.reset(voiceData + 137);
    extraCount = 0;
}

extern "C" void dexed_preview_note_on(int midiNote, int velocity) {
    midiNote = std::max(0, std::min(127, midiNote));
    velocity = std::max(1, std::min(127, velocity));
    const int existing = findVoice(midiNote);
    if (existing >= 0) dexed_preview_note_off(midiNote);

    const int voiceIndex = allocateVoice();
    auto &voice = voices[voiceIndex];
    lfo.keydown();
    voice.note->init(voiceData, midiNote, velocity, 1, &controllers);
    voice.midiNote = midiNote;
    voice.keyDown = true;
    voice.live = true;
}

extern "C" void dexed_preview_note_off(int midiNote) {
    const int voiceIndex = findVoice(midiNote);
    if (voiceIndex < 0) return;
    voices[voiceIndex].keyDown = false;
    voices[voiceIndex].note->keyup();
}

extern "C" void dexed_preview_render(float *out, int frames) {
    if (!out || frames <= 0) return;
    int frameIndex = 0;
    while (frameIndex < frames && extraCount > 0) {
        out[frameIndex++] = extraSamples[0];
        extraCount -= 1;
        std::memmove(extraSamples, extraSamples + 1, static_cast<size_t>(extraCount) * sizeof(float));
    }
    while (frameIndex < frames) {
        mixBlock(out, frames, frameIndex);
        frameIndex += std::min(N, frames - frameIndex);
    }
}
