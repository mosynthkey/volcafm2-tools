#pragma once

#include <string>

// Minimal stand-in for surge-synthesizer/tuning-library. Preview uses 12-TET only.

namespace Tunings {
struct Scale {
    int count = 12;
};

struct Tuning {
    Scale scale;
    double logScaledFrequencyForMidiNote(int) const { return 0; }
};
}
