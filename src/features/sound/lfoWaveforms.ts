export const LFO_WAVE_KEYS = ['triangle', 'sawDown', 'sawUp', 'square', 'sine', 'sampleHold'] as const;
export type LfoWaveKey = typeof LFO_WAVE_KEYS[number];

const SAMPLE_HOLD_LEVELS = [0.2, 0.85, -0.35, 0.55, -0.8, 0.15, 0.7] as const;

export function lfoWaveformPoints(wave: number, width = 72, height = 28): string {
  const padX = 5;
  const padY = 5;
  const left = padX;
  const span = width - padX * 2;
  const mid = height / 2;
  const amplitude = mid - padY;
  const at = (t: number, level: number) =>
    `${(left + t * span).toFixed(1)},${(mid - level * amplitude).toFixed(1)}`;

  switch (wave) {
    case 0:
      return [at(0, -1), at(0.25, 1), at(0.5, -1), at(0.75, 1), at(1, -1)].join(' ');
    case 1:
      return [at(0, 1), at(0.5, -1), at(0.5, 1), at(1, -1)].join(' ');
    case 2:
      return [at(0, -1), at(0.5, 1), at(0.5, -1), at(1, 1)].join(' ');
    case 3:
      return [
        at(0, 1), at(0.25, 1), at(0.25, -1), at(0.5, -1),
        at(0.5, 1), at(0.75, 1), at(0.75, -1), at(1, -1),
      ].join(' ');
    case 4: {
      const sampleCount = 33;
      return Array.from({ length: sampleCount }, (_, sampleIndex) => {
        const t = sampleIndex / (sampleCount - 1);
        return at(t, Math.sin(t * Math.PI * 4));
      }).join(' ');
    }
    case 5: {
      const points: string[] = [];
      SAMPLE_HOLD_LEVELS.forEach((level, stepIndex) => {
        const t0 = stepIndex / SAMPLE_HOLD_LEVELS.length;
        const t1 = (stepIndex + 1) / SAMPLE_HOLD_LEVELS.length;
        points.push(at(t0, level), at(t1, level));
      });
      return points.join(' ');
    }
    default:
      return lfoWaveformPoints(0, width, height);
  }
}
