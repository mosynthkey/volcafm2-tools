<template>
  <main class="sound-panel operator-editor">
    <header class="operator-heading">
      <h3>{{ soundStore.selectedOperator < 0 ? t('sound.allOperators') : t('sound.operator', { count: soundStore.selectedOperator + 1 }) }}</h3>
      <button v-if="soundStore.selectedOperator >= 0" type="button" class="show-all-operators" @click="soundStore.clearOperatorSelection()">
        {{ t('sound.showAllOperators') }}
      </button>
    </header>

    <div class="operator-body" :class="{ 'is-overview': soundStore.selectedOperator < 0 }">
    <OperatorOverview v-if="soundStore.selectedOperator < 0" />

    <template v-else>
    <section class="edit-section">
      <div class="section-heading frequency-heading">
        <h4>{{ t('sound.frequencyOutput') }}</h4>
        <div class="frequency-heading-controls">
          <span>{{ frequencyLabel(selected) }}</span>
          <AppToggle v-model="selected.enabled" :aria-label="t('sound.operator', { count: soundStore.selectedOperator + 1 })" />
        </div>
      </div>
      <div class="control-grid four">
        <div class="mode-control">
          <label>{{ t('sound.mode') }}</label>
          <div class="mode-segment" role="group" :aria-label="t('sound.oscillatorMode')">
            <button type="button" :class="{ active: selected.oscillatorMode === 0 }"
              :aria-pressed="selected.oscillatorMode === 0" @click="selected.oscillatorMode = 0">{{ t('sound.ratio') }}</button>
            <button type="button" :class="{ active: selected.oscillatorMode === 1 }"
              :aria-pressed="selected.oscillatorMode === 1" @click="selected.oscillatorMode = 1">{{ t('sound.fixed') }}</button>
          </div>
        </div>
        <NumberControl v-for="control in operatorFrequencyControls" :key="control.key"
          :model-value="operatorNumber(control.key)" :label="t(control.label)" :min="control.min" :max="control.max"
          :display-offset="control.displayOffset" @update:model-value="setOperatorNumber(control.key, $event)" />
      </div>
    </section>

    <section class="edit-section">
      <div class="section-heading"><h4>{{ t('sound.amplitudeEnvelope') }}</h4><span>{{ t('sound.rateLevel') }}</span></div>
      <EgShapePicker :rates="selected.egRates" :levels="selected.egLevels" @apply="applyEgShape" />
      <div class="envelope-layout">
        <EnvelopeCopyMenu :rates="selected.egRates" :levels="selected.egLevels" @apply="applyEnvelope">
          <svg class="envelope-graph" viewBox="0 0 420 170" role="img" :aria-label="t('sound.amplitudeEnvelope')">
            <path class="envelope-grid" d="M0 35H420M0 85H420M0 135H420M105 0V170M210 0V170M315 0V170" />
            <g class="envelope-levels">
              <g v-for="mark in envelopeView.levelMarks" :key="mark.label">
                <line x1="28" x2="410" :y1="mark.y" :y2="mark.y" />
                <text x="4" :y="mark.labelY">{{ mark.label }}</text>
              </g>
            </g>
            <polyline class="envelope-line" :points="envelopePoints" />
            <g class="envelope-rates">
              <text v-for="mark in envelopeView.rateMarks" :key="mark.label"
                :x="mark.x" :y="mark.y" :transform="`rotate(${mark.angle} ${mark.x} ${mark.y})`">{{ mark.label }}</text>
            </g>
            <circle v-for="(point, index) in envelopeView.points" :key="index" :cx="point.x" :cy="point.y" r="5" />
          </svg>
        </EnvelopeCopyMenu>
        <div class="envelope-side">
          <div class="envelope-values">
            <NumberControl v-for="index in 4" :key="`l${index}`" v-model="selected.egLevels[index - 1]"
              :label="t('sound.level', { count: index })" :min="0" :max="99" compact />
            <NumberControl v-for="index in 4" :key="`r${index}`" v-model="selected.egRates[index - 1]"
              :label="t('sound.rate', { count: index })" :min="0" :max="99" compact />
          </div>
          <EgAdsrControls :operator-index="soundStore.selectedOperator" :rates="selected.egRates"
            :levels="selected.egLevels" @apply="applyEnvelope" />
        </div>
      </div>
    </section>

    <section class="edit-section keyboard-scaling">
      <div class="section-heading"><h4>{{ t('sound.keyboardScaling') }}</h4><span>{{ t('sound.keyResponse') }}</span></div>
      <div class="control-grid scaling-grid">
        <CurveSelector v-model="selected.leftCurve" :label="t('sound.leftCurve')" direction="right" />
        <NumberControl v-model="selected.leftDepth" :label="t('sound.leftDepth')" :min="0" :max="99" />
        <NumberControl v-model="selected.breakPoint" :label="t('sound.breakPoint')" :min="0" :max="99" />
        <NumberControl v-model="selected.rateScaling" :label="t('sound.rateScaling')" :min="0" :max="7" />
        <NumberControl v-model="selected.rightDepth" :label="t('sound.rightDepth')" :min="0" :max="99" />
        <CurveSelector v-model="selected.rightCurve" :label="t('sound.rightCurve')" direction="left" />
      </div>
    </section>
    </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import AppToggle from '@/components/AppToggle.vue';
import KnobControl from '@/components/KnobControl.vue';
import CurveSelector from '@/features/sound/components/CurveSelector.vue';
import EnvelopeCopyMenu from '@/features/sound/components/EnvelopeCopyMenu.vue';
import EgAdsrControls from '@/features/sound/components/EgAdsrControls.vue';
import EgShapePicker from '@/features/sound/components/EgShapePicker.vue';
import OperatorOverview from '@/features/sound/components/OperatorOverview.vue';
import { type EgShapePreset } from '@/features/sound/egShapePresets';
import { operatorFrequencyControls, type OperatorNumberKey } from '@/features/sound/soundControlDefinitions';
import { useSoundStore } from '@/stores/soundStore';
import { dx7EnvelopeMarks } from '@/utils/dx7Envelope';
import { formatOperatorFrequency } from '@/utils/operatorFrequency';

const { t } = useI18n();
const soundStore = useSoundStore();
const { program, selectedOperator } = storeToRefs(soundStore);
const selected = computed(() => program.value.operators[Math.max(0, selectedOperator.value)]);
const operatorNumber = (key: OperatorNumberKey) => selected.value[key] as number;
const setOperatorNumber = (key: OperatorNumberKey, value: number) => { (selected.value[key] as number) = value; };
const frequencyLabel = formatOperatorFrequency;
const envelopeView = computed(() => dx7EnvelopeMarks(selected.value.egRates, selected.value.egLevels, 420, 170, 18));
const envelopePoints = computed(() => envelopeView.value.points.map(point => `${point.x},${point.y}`).join(' '));
const applyEgShape = (shape: EgShapePreset) => {
  selected.value.egRates = [...shape.rates];
  selected.value.egLevels = [...shape.levels];
};
const applyEnvelope = (rates: number[], levels: number[]) => {
  selected.value.egRates = [...rates];
  selected.value.egLevels = [...levels];
};
const NumberControl = KnobControl;
</script>

<style scoped>
.operator-editor { display: grid; grid-template-rows: 42px minmax(0, 1fr); min-height: 0; overflow: hidden; }
.operator-heading { display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; height: 42px; min-height: 42px; max-height: 42px; overflow: hidden; padding: 0 12px; border-bottom: 1px solid rgba(206,179,147,.16); background: #302426; }
.operator-heading h3 { margin: 0; overflow: hidden; font-size: var(--volca-type-heading); line-height: 1; white-space: nowrap; text-overflow: ellipsis; }
.operator-body { min-height: 0; overflow: auto; }
.operator-body.is-overview { display: grid; grid-template-rows: minmax(0, 1fr); }
.show-all-operators { box-sizing: border-box; height: 28px; padding: 0 8px; border: 1px solid rgba(206,179,147,.28); border-radius: 7px; background: transparent; color: #c7b9b0; font: inherit; font-size: var(--volca-type-label); line-height: 1; cursor: pointer; }
.show-all-operators:hover { border-color: rgba(206,179,147,.58); background: rgba(206,179,147,.08); color: #f1e9e1; }
.show-all-operators:focus-visible { outline: 2px solid #e1cab0; outline-offset: 2px; }
.edit-section { padding: 13px; border-bottom: 1px solid rgba(206,179,147,.15); }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }
.section-heading h4 { margin: 0; font-size: var(--volca-type-heading); }
.section-heading span { color: #ad9e96; font-size: var(--volca-type-label); }
.frequency-heading { align-items: center; }
.frequency-heading-controls { display: flex; align-items: center; gap: 12px; }
.control-grid { display: grid; gap: 8px; }
.control-grid.scaling-grid { grid-template-columns: repeat(6, minmax(72px,1fr)); }
.control-grid.four { grid-template-columns: repeat(4, minmax(92px,1fr)); }
.mode-control { display: grid; justify-items: center; align-content: start; gap: 5px; }
.mode-control > label { color: #ad9e96; font-size: var(--volca-type-label); text-align: center; }
.mode-segment { width: fit-content; height: 40px; display: grid; grid-template-columns: 1fr 1fr; padding: 3px; box-sizing: border-box; border: 1px solid rgba(206,179,147,.3); border-radius: 9px; background: #251c1e; }
.mode-segment button { width: 72px; height: 32px; padding: 0 12px; border: 0; background: transparent; color: #ad9e96; font: inherit; font-size: var(--volca-type-body); font-weight: 700; cursor: pointer; }
.mode-segment button + button { border-left: 1px solid rgba(206,179,147,.32); }
.mode-segment button:first-child { border-radius: 5px 0 0 5px; }
.mode-segment button:last-child { border-radius: 0 5px 5px 0; }
.mode-segment button:hover { background: rgba(206,179,147,.1); color: #f1e9e1; }
.mode-segment button.active { background: #ceb393; color: #33282a; }
.mode-segment button:focus-visible { position: relative; z-index: 1; outline: 2px solid #e1cab0; outline-offset: -2px; }
.envelope-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; align-items: start; }
.envelope-side { display: grid; align-content: start; }
.envelope-graph { width: 100%; display: block; border: 1px solid rgba(206,179,147,.15); border-radius: 8px; background: #251c1e; }
.envelope-grid { fill: none; stroke: rgba(206,179,147,.1); }
.envelope-levels line { stroke: rgba(80,221,213,.28); stroke-dasharray: 3 4; }
.envelope-levels text { fill: #50ddd5; font-size: 9px; font-weight: 700; dominant-baseline: middle; }
.envelope-rates text { fill: #e1cab0; font-size: 9px; font-weight: 700; text-anchor: middle; dominant-baseline: middle; }
.envelope-line { fill: none; stroke: #ceb393; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.envelope-graph circle { fill: #302426; stroke: #ceb393; stroke-width: 2; }
.envelope-values { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; align-content: start; }
.keyboard-scaling { border-bottom: 0; }
</style>
