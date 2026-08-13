<template>
  <aside class="sound-panel global-editor">
    <section class="global-section">
      <h4>{{ t('sound.lfo') }}</h4>
      <div class="select-control"><label>{{ t('sound.waveform') }}</label><v-select v-model="program.lfoWave" :items="lfoWaveItems" :aria-label="t('sound.waveform')" density="compact" hide-details /></div>
      <div class="control-grid three mt-2">
        <NumberControl v-for="control in lfoControls" :key="control.key"
          :model-value="programNumber(control.key)" :label="t(control.label)" :min="control.min" :max="control.max"
          @update:model-value="setProgramNumber(control.key, $event)" />
        <div class="toggle-row stacked-control"><span>{{ t('sound.lfoKeySync') }}</span><AppToggle v-model="program.lfoSync" :aria-label="t('sound.lfoKeySync')" /></div>
        <div class="toggle-row stacked-control"><span>{{ t('sound.oscKeySync') }}</span><AppToggle v-model="program.oscillatorSync" :aria-label="t('sound.oscKeySync')" /></div>
      </div>
    </section>

    <section class="global-section">
      <h4>{{ t('sound.pitchEnvelope') }}</h4>
      <svg class="pitch-envelope" viewBox="0 0 320 90" :aria-label="t('sound.pitchEnvelope')">
        <path class="envelope-grid" d="M0 45H320M80 0V90M160 0V90M240 0V90" />
        <polyline class="envelope-line" :points="pitchEnvelopePoints" />
      </svg>
      <div class="pitch-values">
        <NumberControl v-for="index in 4" :key="`pl${index}`" v-model="program.pitchEgLevels[index - 1]"
          :label="t('sound.level', { count: index })" :min="0" :max="99" compact />
        <NumberControl v-for="index in 4" :key="`pr${index}`" v-model="program.pitchEgRates[index - 1]"
          :label="t('sound.rate', { count: index })" :min="0" :max="99" compact />
      </div>
    </section>
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
const levelPercent = (level: number) => Math.pow(Math.max(0, level - 31) / 68, 1.12);
const segmentDuration = (rate: number, from: number, to: number) => {
  const rising = to > from;
  const duration = Math.max(rising ? .003 : .008, (rising ? 38 : 318) * Math.exp(-(rising ? .087 : .098) * rate));
  return Math.max(.0001, duration * Math.abs(levelPercent(to) - levelPercent(from)));
};
const envelopeGeometry = (rates: number[], levels: number[], width: number, height: number) => {
  const durations = [segmentDuration(rates[0], levels[3], levels[0]), segmentDuration(rates[1], levels[0], levels[1]), segmentDuration(rates[2], levels[1], levels[2]), segmentDuration(rates[3], levels[2], levels[3])];
  const hold = Math.max(1, durations[0] + durations[1] + durations[2]) * .16;
  const scale = (width - 16) / (durations.reduce((sum, value) => sum + value, hold));
  const xs = [8, 8 + durations[0] * scale];
  xs.push(xs[1] + durations[1] * scale, xs[1] + (durations[1] + durations[2]) * scale);
  xs.push(xs[3] + hold * scale, width - 8);
  const y = (level: number) => height - 12 - level * ((height - 24) / 99);
  return [levels[3], levels[0], levels[1], levels[2], levels[2], levels[3]].map((level, index) => ({ x: xs[index], y: y(level) }));
};
const pitchEnvelopePoints = computed(() => envelopeGeometry(program.value.pitchEgRates, program.value.pitchEgLevels, 320, 90).map(point => `${point.x},${point.y}`).join(' '));
const NumberControl = KnobControl;
</script>

<style scoped>
.global-editor { padding-bottom: 8px; }
.global-section { padding: 13px; border-bottom: 1px solid rgba(206,179,147,.15); }
.global-section:last-child { border-bottom: 0; }
.global-section > h4 { margin: 0 0 9px; font-size: var(--volca-type-heading); }
.select-control { display: grid; align-content: start; gap: 5px; min-width: 0; }
.select-control > label { color: #ad9e96; font-size: var(--volca-type-label); line-height: 1.25; }
.select-control > :deep(.v-input) { margin-block: 12px; }
.control-grid { display: grid; gap: 8px; }
.control-grid.three { grid-template-columns: repeat(3, minmax(84px,1fr)); align-items: start; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: #ad9e96; font-size: var(--volca-type-label); }
.toggle-row.stacked-control { flex-direction: column; align-items: center; justify-content: flex-start; gap: 5px; }
.toggle-row.stacked-control > span { width: 100%; min-height: 18px; line-height: 1.25; text-align: center; }
.control-grid.three .toggle-row { flex-direction: column; justify-content: flex-start; }
.pitch-envelope { width: 100%; height: 90px; margin-bottom: 8px; border: 1px solid rgba(206,179,147,.15); border-radius: 8px; background: #251c1e; }
.envelope-grid { fill: none; stroke: rgba(206,179,147,.1); }
.envelope-line { fill: none; stroke: #ceb393; stroke-width: 2.5; }
.pitch-values { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; align-content: start; }
</style>
