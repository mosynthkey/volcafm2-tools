<template>
  <aside class="sound-panel lfo-editor">
    <h4>{{ t('sound.lfo') }}</h4>
    <div class="lfo-row">
      <div class="select-control">
        <label>{{ t('sound.waveform') }}</label>
        <v-select v-model="program.lfoWave" :items="lfoWaveItems" :aria-label="t('sound.waveform')" density="compact" hide-details />
      </div>
      <NumberControl v-for="control in lfoControls" :key="control.key"
        :model-value="programNumber(control.key)" :label="t(control.label)" :min="control.min" :max="control.max"
        compact @update:model-value="setProgramNumber(control.key, $event)" />
      <div class="toggle-row stacked-control">
        <span>{{ t('sound.lfoKeySync') }}</span>
        <AppToggle v-model="program.lfoSync" :aria-label="t('sound.lfoKeySync')" />
      </div>
      <div class="toggle-row stacked-control">
        <span>{{ t('sound.oscKeySync') }}</span>
        <AppToggle v-model="program.oscillatorSync" :aria-label="t('sound.oscKeySync')" />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import AppToggle from '@/components/AppToggle.vue';
import KnobControl from '@/components/KnobControl.vue';
import { lfoControls, type ProgramNumberKey } from '@/features/sound/soundControlDefinitions';
import { useSoundStore } from '@/stores/soundStore';

const { t } = useI18n();
const soundStore = useSoundStore();
const { program } = storeToRefs(soundStore);
const programNumber = (key: ProgramNumberKey) => program.value[key] as number;
const setProgramNumber = (key: ProgramNumberKey, value: number) => { (program.value[key] as number) = value; };
const lfoWaveItems = computed(() =>
  (['triangle', 'sawDown', 'sawUp', 'square', 'sine', 'sampleHold'] as const)
    .map((key, value) => ({ title: t(`sound.lfoWaves.${key}`), value })));
const NumberControl = KnobControl;
</script>

<style scoped>
.lfo-editor { display: flex; align-items: center; gap: 14px; padding: 10px 14px; overflow-x: auto; }
.lfo-editor > h4 { flex: 0 0 auto; margin: 0; font-size: var(--volca-type-heading); }
.lfo-row { display: flex; flex: 1 1 auto; align-items: start; gap: 10px; min-width: min-content; }
.select-control { display: grid; align-content: start; gap: 5px; flex: 0 0 148px; min-width: 132px; }
.select-control > label { color: #ad9e96; font-size: var(--volca-type-label); line-height: 1.25; text-align: center; }
.select-control > :deep(.v-input) { margin-block: 0; }
.lfo-row > :deep(.knob-control) { flex: 0 0 auto; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: #ad9e96; font-size: var(--volca-type-label); }
.toggle-row.stacked-control { flex: 0 0 auto; flex-direction: column; align-items: center; justify-content: flex-start; gap: 5px; min-width: 72px; }
.toggle-row.stacked-control > span { width: 100%; min-height: 18px; line-height: 1.25; text-align: center; }
</style>
