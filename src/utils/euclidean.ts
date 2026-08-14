/** Distribute `pulses` hits as evenly as possible across `stepCount` steps (Bjorklund / Euclidean). */
export const euclideanHits = (stepCount: number, pulses: number, rotation = 0): number[] => {
  const steps = Math.max(1, Math.round(stepCount));
  const hitCount = Math.max(0, Math.min(steps, Math.round(pulses)));
  const shift = ((Math.round(rotation) % steps) + steps) % steps;
  if (hitCount === 0) return [];
  return Array.from({ length: hitCount }, (_, pulseIndex) => {
    const base = Math.floor((pulseIndex * steps) / hitCount);
    return (base + shift) % steps;
  }).sort((left, right) => left - right);
};

export const euclideanPattern = (stepCount: number, pulses: number, rotation = 0): boolean[] => {
  const steps = Math.max(1, Math.round(stepCount));
  const hits = new Set(euclideanHits(steps, pulses, rotation));
  return Array.from({ length: steps }, (_, step) => hits.has(step));
};

/** Rotation that places an unrotated hit onto `sourceStep`. */
export const rotationAligningHitToStep = (stepCount: number, pulses: number, sourceStep: number): number => {
  const steps = Math.max(1, Math.round(stepCount));
  const unrotated = euclideanHits(steps, pulses, 0);
  if (unrotated.length === 0) return 0;
  const source = ((Math.round(sourceStep) % steps) + steps) % steps;
  return (source - unrotated[0] + steps) % steps;
};
