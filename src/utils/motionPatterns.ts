import { NUM_OF_STEPS } from '../types/sequence';

export const MOTION_PATTERN_KEYS = ['linearUp', 'linearDown', 'sine1', 'sine2', 'triangle1', 'triangle2', 'square', 'random'] as const;
export type MotionPatternKey = typeof MOTION_PATTERN_KEYS[number];

const clamp = (value: number) => Math.max(0, Math.min(127, Math.round(value + 1e-9)));
const phase = (step: number, cycles: number) => (step / NUM_OF_STEPS) * Math.PI * 2 * cycles;
const triangle = (step: number, cycles: number) => {
  const position = ((step / NUM_OF_STEPS) * cycles) % 1;
  return position < .25 ? .5 + position * 2 : position < .75 ? 1 - (position - .25) * 2 : (position - .75) * 2;
};

export const createMotionPattern = (key: MotionPatternKey, random: () => number = Math.random): number[] =>
  Array.from({ length: NUM_OF_STEPS }, (_, step) => {
    switch (key) {
      case 'linearUp': return clamp((step / (NUM_OF_STEPS - 1)) * 127);
      case 'linearDown': return clamp((1 - step / (NUM_OF_STEPS - 1)) * 127);
      case 'sine1': return clamp(63.5 + Math.sin(phase(step, 1)) * 63.5);
      case 'sine2': return clamp(63.5 + Math.sin(phase(step, 2)) * 63.5);
      case 'triangle1': return clamp(triangle(step, 1) * 127);
      case 'triangle2': return clamp(triangle(step, 2) * 127);
      case 'square': return step < NUM_OF_STEPS / 2 ? 127 : 0;
      case 'random': return clamp(random() * 127);
    }
  });

const previewRandom = [18, 96, 42, 122, 67, 8, 83, 51, 115, 31, 73, 126, 56, 13, 101, 39];
export const previewMotionPattern = (key: MotionPatternKey) => key === 'random' ? previewRandom : createMotionPattern(key);
