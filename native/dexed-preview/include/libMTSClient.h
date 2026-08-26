#pragma once

#include <math.h>

// No-op MTS-ESP client so Dexed's Apache-2.0 msfa engine can compile without MTS.

struct MTSClient;

inline MTSClient *MTS_RegisterClient() { return nullptr; }
inline void MTS_DeregisterClient(MTSClient *) {}
inline bool MTS_HasMaster(MTSClient *) { return false; }
inline bool MTS_ShouldFilterNote(MTSClient *, char, char) { return false; }
inline double MTS_NoteToFrequency(MTSClient *, char midiNote, char) {
    return 440.0 * pow(2.0, (static_cast<double>(midiNote) - 69.0) / 12.0);
}
