#include "tuning.h"

struct StandardTuning : public TuningState {
    StandardTuning() {
        const int base = 50857777;
        const int step = (1 << 24) / 12;
        for (int midiNote = 0; midiNote < 128; ++midiNote) {
            logFreqTable[midiNote] = base + step * midiNote;
        }
    }

    int32_t midinote_to_logfreq(int midiNote) override {
        if (midiNote < 0) return logFreqTable[0];
        if (midiNote > 127) return logFreqTable[127];
        return logFreqTable[midiNote];
    }

    int logFreqTable[128];
};

std::shared_ptr<TuningState> createStandardTuning() {
    return std::make_shared<StandardTuning>();
}
