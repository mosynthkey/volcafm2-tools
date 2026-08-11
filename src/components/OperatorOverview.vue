<template>
  <div class="operator-overview">
    <article v-for="(operator, index) in operators" :key="index" class="operator-summary" :class="{ off: !operator.enabled }">
      <button type="button" class="operator-summary-heading" :aria-label="t('sound.operator', { count: index + 1 })"
        @click="$emit('select', index)">
        <strong>{{ index + 1 }}</strong>
        <span>{{ frequencyLabel(operator) }}</span>
        <i :class="{ enabled: operator.enabled }">{{ operator.enabled ? 'ON' : 'OFF' }}</i>
      </button>

      <div class="mini-graphs">
        <div>
          <span>EG</span>
          <svg viewBox="0 0 180 62" aria-hidden="true">
            <path class="graph-grid" d="M0 31H180M45 0V62M90 0V62M135 0V62" />
            <polyline class="graph-line" :points="envelopePoints(operator)" />
          </svg>
        </div>
        <div>
          <span>Keyboard Scaling</span>
          <svg viewBox="0 0 180 62" aria-hidden="true">
            <path class="graph-grid" d="M0 31H180M90 0V62" />
            <path class="graph-line" :d="scalingPath(operator)" />
          </svg>
        </div>
      </div>

      <dl class="parameter-grid">
        <template v-for="item in parameters(operator)" :key="item.label">
          <div><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
        </template>
      </dl>

      <div class="eg-values">
        <span>Level</span><b v-for="(value, valueIndex) in operator.egLevels" :key="`l${valueIndex}`">{{ value }}</b>
        <span>Rate</span><b v-for="(value, valueIndex) in operator.egRates" :key="`r${valueIndex}`">{{ value }}</b>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { SoundOperator } from '@/types/soundProgram';

defineProps<{ operators: SoundOperator[] }>();
defineEmits<{ select: [operatorIndex: number] }>();
const { t } = useI18n();
const curveNames = ['−LN', '−EX', '+EX', '+LN'];

const frequencyLabel = (operator: SoundOperator) => operator.oscillatorMode === 0
  ? `Ratio ${Math.max(.5, operator.coarse) + operator.fine / 100}`
  : `Fixed C${operator.coarse} F${operator.fine}`;
const levelPercent = (level: number) => Math.pow(Math.max(0, level - 31) / 68, 1.12);
const segmentDuration = (rate: number, from: number, to: number) => {
  const rising = to > from;
  return Math.max(.0001, Math.max(rising ? .003 : .008, (rising ? 38 : 318) * Math.exp(-(rising ? .087 : .098) * rate))
    * Math.abs(levelPercent(to) - levelPercent(from)));
};
const envelopePoints = (operator: SoundOperator) => {
  const levels = operator.egLevels, rates = operator.egRates;
  const durations = [segmentDuration(rates[0], levels[3], levels[0]), segmentDuration(rates[1], levels[0], levels[1]), segmentDuration(rates[2], levels[1], levels[2]), segmentDuration(rates[3], levels[2], levels[3])];
  const hold = Math.max(1, durations[0] + durations[1] + durations[2]) * .16;
  const scale = 172 / (durations.reduce((sum, value) => sum + value, hold));
  const xs = [4, 4 + durations[0] * scale];
  xs.push(xs[1] + durations[1] * scale, xs[1] + (durations[1] + durations[2]) * scale, xs[1] + (durations[1] + durations[2] + hold) * scale, 176);
  const y = (level: number) => 58 - level * (54 / 99);
  return [levels[3], levels[0], levels[1], levels[2], levels[2], levels[3]].map((level, index) => `${xs[index]},${y(level)}`).join(' ');
};
const curveSegment = (startX: number, startY: number, endX: number, endY: number, curve: number) => {
  if (curve === 0 || curve === 3) return `L${endX} ${endY}`;
  const controlY = curve === 1 ? startY : endY;
  return `Q${(startX + endX) / 2} ${controlY} ${endX} ${endY}`;
};
const scalingPath = (operator: SoundOperator) => {
  const breakX = 18 + operator.breakPoint * (144 / 99);
  const centerY = 31;
  const leftY = operator.leftCurve < 2 ? centerY + operator.leftDepth * .27 : centerY - operator.leftDepth * .27;
  const rightY = operator.rightCurve < 2 ? centerY + operator.rightDepth * .27 : centerY - operator.rightDepth * .27;
  return `M4 ${leftY}${curveSegment(4, leftY, breakX, centerY, operator.leftCurve)}${curveSegment(breakX, centerY, 176, rightY, operator.rightCurve)}`;
};
const parameters = (operator: SoundOperator) => [
  { label: 'Coarse', value: operator.coarse }, { label: 'Fine', value: operator.fine },
  { label: 'Detune', value: operator.detune - 7 }, { label: 'Output', value: operator.outputLevel },
  { label: 'Amp Mod', value: operator.ampModSensitivity }, { label: 'Key Vel', value: operator.keyVelocitySensitivity },
  { label: 'Rate Scale', value: operator.rateScaling }, { label: 'Break', value: operator.breakPoint },
  { label: 'L Depth', value: operator.leftDepth }, { label: 'R Depth', value: operator.rightDepth },
  { label: 'L Curve', value: curveNames[operator.leftCurve] }, { label: 'R Curve', value: curveNames[operator.rightCurve] },
];
</script>

<style scoped>
.operator-overview { display: grid; grid-template-columns: repeat(2, minmax(270px, 1fr)); gap: 8px; padding: 8px; }
.operator-summary { min-width: 0; overflow: hidden; border: 1px solid rgba(206,179,147,.18); border-radius: 9px; background: #2b2022; }
.operator-summary.off { opacity: .58; }
.operator-summary-heading { width: 100%; height: 38px; display: grid; grid-template-columns: 32px 1fr auto; align-items: center; gap: 7px; padding: 4px 8px; border: 0; border-bottom: 1px solid rgba(206,179,147,.14); background: transparent; color: #d8ccc4; cursor: pointer; text-align: left; }
.operator-summary-heading:hover { background: rgba(206,179,147,.08); }
.operator-summary-heading:focus-visible { outline: 2px solid #e1cab0; outline-offset: -2px; }
.operator-summary-heading strong { width: 27px; height: 27px; display: grid; place-items: center; border-radius: 6px; background: rgba(206,179,147,.14); color: #e1cab0; font-size: var(--volca-type-body); }
.operator-summary-heading span { overflow: hidden; font-size: var(--volca-type-label); font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.operator-summary-heading i { color: #8f817a; font-size: 11px; font-style: normal; font-weight: 800; }.operator-summary-heading i.enabled { color: #9dce91; }
.mini-graphs { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; padding: 6px 7px 3px; }
.mini-graphs > div { min-width: 0; }.mini-graphs span { display: block; margin-bottom: 2px; color: #ad9e96; font-size: 11px; }
.mini-graphs svg { width: 100%; height: 54px; display: block; border-radius: 5px; background: #21191a; }
.graph-grid { fill: none; stroke: rgba(206,179,147,.09); }.graph-line { fill: none; stroke: #ceb393; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.parameter-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin: 3px 7px 6px; overflow: hidden; border-radius: 5px; background: rgba(206,179,147,.1); }
.parameter-grid div { min-width: 0; padding: 4px 5px; background: #271d1f; }.parameter-grid dt { overflow: hidden; color: #9f918a; font-size: 10px; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }.parameter-grid dd { margin: 1px 0 0; color: #e1cab0; font-size: 12px; font-weight: 750; font-variant-numeric: tabular-nums; }
.eg-values { display: grid; grid-template-columns: 38px repeat(4, 1fr); gap: 1px; margin: 0 7px 7px; overflow: hidden; border-radius: 5px; background: rgba(206,179,147,.1); }
.eg-values span, .eg-values b { padding: 3px 4px; background: #271d1f; font-size: 11px; line-height: 1.25; }.eg-values span { color: #9f918a; }.eg-values b { color: #d8ccc4; font-weight: 700; text-align: center; font-variant-numeric: tabular-nums; }
@media (max-width: 1120px) { .operator-overview { grid-template-columns: 1fr; } }
</style>
