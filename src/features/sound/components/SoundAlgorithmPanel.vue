<template>
  <aside class="sound-panel operator-nav">
    <div class="algorithm-control">
      <AlgorithmDiagram pickable />
      <div class="algorithm-legend" :aria-label="t('sound.algorithmLegend')">
        <span><i class="route"></i>{{ t('sound.modulator') }}</span>
        <span><i class="feedback"></i>{{ t('sound.feedback') }}</span>
        <span><i class="output"></i>{{ t('sound.carrierOutput') }}</span>
      </div>
    </div>
    <div class="global-mini-grid">
      <NumberControl :model-value="program.algorithm + 1" :label="t('sound.algorithm')" :min="1" :max="32"
        @update:model-value="program.algorithm = $event - 1" />
      <NumberControl v-model="program.feedback" :label="t('sound.feedback')" :min="0" :max="7" />
    </div>

    <div class="left-utility-grid">
      <section class="global-section volca-macros">
        <h4>{{ t('sound.macros') }}</h4>
        <div class="control-grid two">
          <NumberControl v-for="control in macroControls" :key="control.key"
            :model-value="programNumber(control.key)" :label="t(control.label)" :min="control.min" :max="control.max"
            @update:model-value="setProgramNumber(control.key, $event)" />
        </div>
      </section>
      <section class="global-section transpose-section">
        <h4>{{ t('sound.transpose') }}</h4>
        <div class="transpose-controls">
          <NumberControl v-model="program.transpose" :label="t('sound.semitone')" :min="0" :max="48" :display-offset="-24" />
          <NumberControl v-model="program.octave" :label="t('sound.octave')" :min="-2" :max="2" />
        </div>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import KnobControl from '@/components/KnobControl.vue';
import AlgorithmDiagram from '@/features/sound/components/AlgorithmDiagram.vue';
import { macroControls, type ProgramNumberKey } from '@/features/sound/soundControlDefinitions';
import { useSoundStore } from '@/stores/soundStore';

const { t } = useI18n();
const soundStore = useSoundStore();
const { program } = storeToRefs(soundStore);
const programNumber = (key: ProgramNumberKey) => program.value[key] as number;
const setProgramNumber = (key: ProgramNumberKey, value: number) => { (program.value[key] as number) = value; };
const NumberControl = KnobControl;
</script>

<style scoped>
.operator-nav { padding-bottom: 10px; }
.algorithm-control { display: grid; grid-template-columns: 1fr; justify-items: center; gap: 8px; margin: 8px 12px 10px; }
.algorithm-control > :deep(.algorithm-diagram) { width: min(100%, 248px); height: 148px; justify-self: center; }
.algorithm-legend { display: flex; grid-column: 1 / -1; justify-content: center; gap: 10px; color: #ad9e96; font-size: var(--volca-type-label); }
.algorithm-legend span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.algorithm-legend i { width: 13px; height: 2px; display: inline-block; background: #f1e9e1; }
.algorithm-legend i.feedback { background: var(--volca-teal); }.algorithm-legend i.output { background: var(--volca-accent-bright); }
.global-mini-grid { display: grid; grid-template-columns: 1fr 1fr; align-items: start; gap: 10px; padding: 2px 12px 14px; border-bottom: 1px solid rgba(206,179,147,.16); }
.global-section { padding: 13px; }
.global-section > h4 { margin: 0 0 9px; font-size: var(--volca-type-heading); }
.control-grid { display: grid; gap: 8px; }
.control-grid.two { grid-template-columns: 1fr 1fr; }
.left-utility-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(110px, 1fr); border-bottom: 1px solid rgba(206,179,147,.15); }
.left-utility-grid .global-section { border-bottom: 0; }
.transpose-section { border-left: 1px solid rgba(206,179,147,.15); }
.transpose-controls { display: grid; justify-items: center; gap: 12px; }
</style>
