import { NUM_OF_STEPS } from '../types/sequence';

export const MOTION_PATTERN_KEYS = ['linearUp', 'linearDown', 'sine', 'triangle', 'square', 'random'] as const;
export type MotionPatternKey = typeof MOTION_PATTERN_KEYS[number];

const clampMidi = (value: number) => Math.max(0, Math.min(127, Math.round(value + 1e-9)));
const normalizeRange = (min: number, max: number) => ({
  min: clampMidi(Math.min(min, max)),
  max: clampMidi(Math.max(min, max)),
});
const scale = (unitValue: number, min: number, max: number) => clampMidi(min + unitValue * (max - min));
const cyclePosition = (step: number, cycles: number) => ((step * cycles) / NUM_OF_STEPS) % 1;

export const createMotionPattern = (
  key: MotionPatternKey,
  options: { min?: number; max?: number; cycles?: number; random?: () => number } = {},
): number[] => {
  const { min, max } = normalizeRange(options.min ?? 0, options.max ?? 127);
  const cycles = Math.max(1, Math.min(8, Math.round(options.cycles ?? 1)));
  const random = options.random ?? Math.random;

  return Array.from({ length: NUM_OF_STEPS }, (_, step) => {
    const position = cyclePosition(step, cycles);
    switch (key) {
      case 'linearUp': return scale(step / (NUM_OF_STEPS - 1), min, max);
      case 'linearDown': return scale(1 - step / (NUM_OF_STEPS - 1), min, max);
      // Start at the minimum so the loop boundary (step 16 -> step 1) stays smooth.
      case 'sine': return scale((1 - Math.cos(position * Math.PI * 2)) / 2, min, max);
      case 'triangle': return scale(position < .5 ? position * 2 : 2 - position * 2, min, max);
      case 'square': return position < .5 ? min : max;
      case 'random': return scale(random(), min, max);
    }
  });
};

const previewRandom = [18, 96, 42, 122, 67, 8, 83, 51, 115, 31, 73, 126, 56, 13, 101, 39];
export const previewMotionPattern = (key: MotionPatternKey, min: number, max: number, cycles: number) => {
  let randomIndex = 0;
  return key === 'random'
    ? createMotionPattern(key, { min, max, cycles, random: () => previewRandom[randomIndex++] / 127 })
    : createMotionPattern(key, { min, max, cycles });
};
