export const LFO_NOTE_VALUES = ['1/1', '1/2', '1/4', '1/8', '1/16'] as const;
export type LfoNoteValue = (typeof LFO_NOTE_VALUES)[number];

export const LFO_NOTE_MODIFIERS = ['straight', 'dotted', 'triplet'] as const;
export type LfoNoteModifier = (typeof LFO_NOTE_MODIFIERS)[number];

export const LFO_SPEED_MIN = 0;
export const LFO_SPEED_MAX = 99;
export const LFO_UTILITY_BPM_MIN = 20;
export const LFO_UTILITY_BPM_MAX = 300;

const QUARTER_BEATS: Record<LfoNoteValue, number> = {
  '1/1': 4,
  '1/2': 2,
  '1/4': 1,
  '1/8': 0.5,
  '1/16': 0.25,
};

/**
 * DX7 LFO rate (0–99) frequencies in Hz, copied from Dexed/MSFA `lfoSource`.
 * The table is the authentic DX7 period curve (slow linear, then steeper),
 * not a linear 0–99 guess. volca fm2 Speed uses the same 0–99 DX7 parameter.
 */
export const DX7_LFO_RATE_HZ = [
  0.062541, 0.125031, 0.312393, 0.437120, 0.624610,
  0.750694, 0.936330, 1.125302, 1.249609, 1.436782,
  1.560915, 1.752081, 1.875117, 2.062494, 2.247191,
  2.374451, 2.560492, 2.686728, 2.873976, 2.998950,
  3.188013, 3.369840, 3.500175, 3.682224, 3.812065,
  4.000800, 4.186202, 4.310716, 4.501260, 4.623209,
  4.814636, 4.930480, 5.121901, 5.315191, 5.434783,
  5.617346, 5.750431, 5.946717, 6.062811, 6.248438,
  6.431695, 6.564264, 6.749460, 6.868132, 7.052186,
  7.250580, 7.375719, 7.556294, 7.687577, 7.877738,
  7.993605, 8.181967, 8.372405, 8.504848, 8.685079,
  8.810573, 8.986341, 9.122423, 9.300595, 9.500285,
  9.607994, 9.798158, 9.950249, 10.117361, 11.251125,
  11.384335, 12.562814, 13.676149, 13.904338, 15.092062,
  16.366612, 16.638935, 17.869907, 19.193858, 19.425019,
  20.833333, 21.034918, 22.502250, 24.003841, 24.260068,
  25.746653, 27.173913, 27.578599, 29.052876, 30.693677,
  31.191516, 32.658393, 34.317090, 34.674064, 36.416606,
  38.197097, 38.550501, 40.387722, 40.749796, 42.625746,
  44.326241, 44.883303, 46.772685, 48.590865, 49.261084,
] as const;

export type LfoSpeedClamp = 'low' | 'high' | null;

export type LfoSpeedMatch = {
  speed: number;
  frequencyHz: number;
  periodSeconds: number;
  targetHz: number;
  targetPeriodSeconds: number;
  clamped: LfoSpeedClamp;
};

export function clampLfoUtilityBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 120;
  return Math.max(LFO_UTILITY_BPM_MIN, Math.min(LFO_UTILITY_BPM_MAX, Math.round(bpm)));
}

export function lfoFrequencyHz(speed: number): number {
  const index = Math.max(LFO_SPEED_MIN, Math.min(LFO_SPEED_MAX, Math.round(speed)));
  return DX7_LFO_RATE_HZ[index];
}

export function lfoPeriodSeconds(speed: number): number {
  return 1 / lfoFrequencyHz(speed);
}

export function noteBeats(note: LfoNoteValue, modifier: LfoNoteModifier): number {
  const beats = QUARTER_BEATS[note];
  if (modifier === 'dotted') return beats * 1.5;
  if (modifier === 'triplet') return beats * (2 / 3);
  return beats;
}

export function targetFrequencyHz(bpm: number, note: LfoNoteValue, modifier: LfoNoteModifier): number {
  const safeBpm = Math.max(1, bpm);
  return safeBpm / (60 * noteBeats(note, modifier));
}

export function speedFromFrequencyHz(targetHz: number): Omit<LfoSpeedMatch, 'targetHz' | 'targetPeriodSeconds'> {
  const slowest = DX7_LFO_RATE_HZ[LFO_SPEED_MIN];
  const fastest = DX7_LFO_RATE_HZ[LFO_SPEED_MAX];
  if (targetHz <= slowest) {
    return {
      speed: LFO_SPEED_MIN,
      frequencyHz: slowest,
      periodSeconds: 1 / slowest,
      clamped: targetHz < slowest ? 'low' : null,
    };
  }
  if (targetHz >= fastest) {
    return {
      speed: LFO_SPEED_MAX,
      frequencyHz: fastest,
      periodSeconds: 1 / fastest,
      clamped: targetHz > fastest ? 'high' : null,
    };
  }

  let closestSpeed = LFO_SPEED_MIN;
  let closestDiff = Infinity;
  DX7_LFO_RATE_HZ.forEach((frequencyHz, speed) => {
    const diff = Math.abs(frequencyHz - targetHz);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestSpeed = speed;
    }
  });
  const frequencyHz = DX7_LFO_RATE_HZ[closestSpeed];
  return {
    speed: closestSpeed,
    frequencyHz,
    periodSeconds: 1 / frequencyHz,
    clamped: null,
  };
}

export function speedFromBpmAndNote(
  bpm: number,
  note: LfoNoteValue,
  modifier: LfoNoteModifier,
): LfoSpeedMatch {
  const targetHz = targetFrequencyHz(bpm, note, modifier);
  return {
    ...speedFromFrequencyHz(targetHz),
    targetHz,
    targetPeriodSeconds: 1 / targetHz,
  };
}
