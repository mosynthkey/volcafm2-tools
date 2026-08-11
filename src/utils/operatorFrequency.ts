import type { SoundOperator } from '@/types/soundProgram';

// Dexed uses JUCE String's default floating-point formatting: six significant digits.
const formatDexedNumber = (value: number) => Number(value.toPrecision(6)).toString();

export const formatOperatorFrequency = (operator: SoundOperator) => {
  const coarse = operator.coarse === 0 ? .5 : operator.coarse;
  const frequency = operator.oscillatorMode === 0
    ? coarse + coarse * (operator.fine / 100)
    : Math.pow(10, operator.coarse & 3) * Math.exp(Math.LN10 * (operator.fine / 100));
  const detune = operator.detune - 7;
  const detuneSuffix = detune === 0 ? '' : detune > 0 ? ` +${detune}` : ` ${detune}`;
  return `${operator.oscillatorMode === 0 ? `f = ${formatDexedNumber(frequency)}` : `${formatDexedNumber(frequency)} Hz`}${detuneSuffix}`;
};
