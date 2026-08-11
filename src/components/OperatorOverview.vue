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
          <div><dt>{{ item.label }}</dt><dd>
            <button v-if="item.field" type="button" class="drag-value" :aria-label="`${item.label} ${item.value}`"
              @pointerdown="startDrag($event, index, item.field, item.min, item.max, item.rawValue)"
              @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag"
              @keydown="adjustWithKeyboard($event, index, item.field, item.min, item.max, item.rawValue)">
              <span>{{ item.value }}</span><MiniKnob :value="item.rawValue" :min="item.min" :max="item.max" />
            </button>
            <span v-else>{{ item.value }}</span>
          </dd></div>
        </template>
      </dl>

      <div class="eg-values">
        <span>Level</span><button v-for="(value, valueIndex) in operator.egLevels" :key="`l${valueIndex}`" type="button"
          class="drag-value" :aria-label="`Level ${valueIndex + 1} ${value}`"
          @pointerdown="startDrag($event, index, 'egLevels', 0, 99, value, valueIndex)" @pointermove="moveDrag"
          @pointerup="endDrag" @pointercancel="endDrag"
          @keydown="adjustWithKeyboard($event, index, 'egLevels', 0, 99, value, valueIndex)">
          <span>{{ value }}</span><MiniKnob :value="value" :min="0" :max="99" />
        </button>
        <span>Rate</span><button v-for="(value, valueIndex) in operator.egRates" :key="`r${valueIndex}`" type="button"
          class="drag-value" :aria-label="`Rate ${valueIndex + 1} ${value}`"
          @pointerdown="startDrag($event, index, 'egRates', 0, 99, value, valueIndex)" @pointermove="moveDrag"
          @pointerup="endDrag" @pointercancel="endDrag"
          @keydown="adjustWithKeyboard($event, index, 'egRates', 0, 99, value, valueIndex)">
          <span>{{ value }}</span><MiniKnob :value="value" :min="0" :max="99" />
        </button>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SoundOperator } from '@/types/soundProgram';

defineProps<{ operators: SoundOperator[] }>();
const emit = defineEmits<{
  select: [operatorIndex: number];
  update: [payload: { operatorIndex: number; field: keyof SoundOperator; value: number; arrayIndex?: number }];
}>();
const { t } = useI18n();
const curveNames = ['−LN', '−EX', '+EX', '+LN'];
const MiniKnob = defineComponent({
  props: { value: { type: Number, required: true }, min: { type: Number, required: true }, max: { type: Number, required: true } },
  setup(props) {
    return () => {
      const percent = Math.max(0, Math.min(100, ((props.value - props.min) / Math.max(1, props.max - props.min)) * 100));
      const angle = (135 + percent * 2.7) * (Math.PI / 180);
      const pointerX = 9 + Math.cos(angle) * 5.2;
      const pointerY = 9 + Math.sin(angle) * 5.2;
      return h('svg', { class: 'mini-knob', viewBox: '0 0 18 18', 'aria-hidden': 'true' }, [
        h('path', { d: 'M4.05 13.95A7 7 0 1 1 13.95 13.95', pathLength: 100, fill: 'none',
          stroke: 'rgba(206,179,147,.2)', 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
        h('line', { x1: 9, y1: 9, x2: pointerX, y2: pointerY,
          stroke: '#ceb393', 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
      ]);
    };
  },
});
const dragState = ref<null | { operatorIndex: number; field: keyof SoundOperator; min: number; max: number; startY: number; startValue: number; arrayIndex?: number }>(null);

const setValue = (operatorIndex: number, field: keyof SoundOperator, min: number, max: number, value: number, arrayIndex?: number) => {
  emit('update', { operatorIndex, field, value: Math.max(min, Math.min(max, Math.round(value))), arrayIndex });
};
const startDrag = (event: PointerEvent, operatorIndex: number, field: keyof SoundOperator, min: number, max: number, value: number, arrayIndex?: number) => {
  dragState.value = { operatorIndex, field, min, max, startY: event.clientY, startValue: value, arrayIndex };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};
const moveDrag = (event: PointerEvent) => {
  const state = dragState.value;
  if (!state) return;
  const sensitivity = event.shiftKey ? 240 : 120;
  setValue(state.operatorIndex, state.field, state.min, state.max,
    state.startValue + ((state.startY - event.clientY) / sensitivity) * (state.max - state.min), state.arrayIndex);
};
const endDrag = (event: PointerEvent) => {
  dragState.value = null;
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
};
const adjustWithKeyboard = (event: KeyboardEvent, operatorIndex: number, field: keyof SoundOperator, min: number, max: number, value: number, arrayIndex?: number) => {
  const delta = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowDown' || event.key === 'ArrowLeft' ? -1 : 0;
  if (!delta) return;
  event.preventDefault();
  setValue(operatorIndex, field, min, max, value + delta, arrayIndex);
};

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
  { label: 'Coarse', value: operator.coarse, rawValue: operator.coarse, field: 'coarse' as const, min: 0, max: 31 },
  { label: 'Fine', value: operator.fine, rawValue: operator.fine, field: 'fine' as const, min: 0, max: 99 },
  { label: 'Detune', value: operator.detune - 7, rawValue: operator.detune, field: 'detune' as const, min: 0, max: 14 },
  { label: 'Output', value: operator.outputLevel, rawValue: operator.outputLevel, field: 'outputLevel' as const, min: 0, max: 99 },
  { label: 'Amp Mod', value: operator.ampModSensitivity, rawValue: operator.ampModSensitivity, field: 'ampModSensitivity' as const, min: 0, max: 3 },
  { label: 'Key Vel', value: operator.keyVelocitySensitivity, rawValue: operator.keyVelocitySensitivity, field: 'keyVelocitySensitivity' as const, min: 0, max: 7 },
  { label: 'Rate Scale', value: operator.rateScaling, rawValue: operator.rateScaling, field: 'rateScaling' as const, min: 0, max: 7 },
  { label: 'Break', value: operator.breakPoint, rawValue: operator.breakPoint, field: 'breakPoint' as const, min: 0, max: 99 },
  { label: 'L Depth', value: operator.leftDepth, rawValue: operator.leftDepth, field: 'leftDepth' as const, min: 0, max: 99 },
  { label: 'R Depth', value: operator.rightDepth, rawValue: operator.rightDepth, field: 'rightDepth' as const, min: 0, max: 99 },
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
.parameter-grid div { min-width: 0; padding: 4px 5px; background: #271d1f; }.parameter-grid dt { overflow: hidden; color: #9f918a; font-size: 10px; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }.parameter-grid dd { min-height: 18px; margin: 1px 0 0; color: #e1cab0; font-size: 12px; font-weight: 750; font-variant-numeric: tabular-nums; }
.drag-value { min-width: 42px; display: inline-grid; grid-template-columns: minmax(18px, auto) 16px; align-items: center; justify-content: end; gap: 3px; padding: 1px 3px 1px 4px; border: 0; border-radius: 4px; background: rgba(206,179,147,.08); color: #e1cab0; font: inherit; font-weight: 750; cursor: ns-resize; touch-action: none; }
.drag-value:hover { background: rgba(206,179,147,.18); color: #fff8f1; }.drag-value:focus-visible { outline: 1px solid #e1cab0; outline-offset: 1px; }
.mini-knob { width: 16px; height: 16px; overflow: visible; }
.eg-values { display: grid; grid-template-columns: 38px repeat(4, 1fr); gap: 1px; margin: 0 7px 7px; overflow: hidden; border-radius: 5px; background: rgba(206,179,147,.1); }
.eg-values span, .eg-values > button { padding: 3px 4px; background: #271d1f; font-size: 11px; line-height: 1.25; }.eg-values span { color: #9f918a; }.eg-values > button { width: 100%; grid-template-columns: minmax(14px, auto) 14px; gap: 2px; border-radius: 0; color: #d8ccc4; text-align: center; font-variant-numeric: tabular-nums; }.eg-values .mini-knob { width: 14px; height: 14px; }
@media (max-width: 1120px) { .operator-overview { grid-template-columns: 1fr; } }
</style>
