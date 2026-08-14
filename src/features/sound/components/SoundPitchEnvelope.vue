<template>
  <section class="sound-panel pitch-envelope-panel">
    <h4>{{ t('sound.pitchEnvelope') }}</h4>
    <EnvelopeCopyMenu :rates="program.pitchEgRates" :levels="program.pitchEgLevels" @apply="applyEnvelope">
      <svg class="pitch-envelope" viewBox="0 0 320 90" :aria-label="t('sound.pitchEnvelope')">
        <path class="envelope-grid" d="M0 45H320M80 0V90M160 0V90M240 0V90" />
        <polyline class="envelope-line" :points="pitchEnvelopePoints" />
      </svg>
    </EnvelopeCopyMenu>
    <div class="pitch-values">
      <NumberControl v-for="index in 4" :key="`pl${index}`" v-model="program.pitchEgLevels[index - 1]"
        :label="t('sound.level', { count: index })" :min="0" :max="99" compact />
      <NumberControl v-for="index in 4" :key="`pr${index}`" v-model="program.pitchEgRates[index - 1]"
        :label="t('sound.rate', { count: index })" :min="0" :max="99" compact />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import EnvelopeCopyMenu from '@/features/sound/components/EnvelopeCopyMenu.vue';
import KnobControl from '@/components/KnobControl.vue';
import { useSoundStore } from '@/stores/soundStore';

const { t } = useI18n();
const soundStore = useSoundStore();
const { program } = storeToRefs(soundStore);
const NumberControl = KnobControl;
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
const applyEnvelope = (rates: number[], levels: number[]) => {
  program.value.pitchEgRates = [...rates];
  program.value.pitchEgLevels = [...levels];
};
</script>

<style scoped>
.pitch-envelope-panel { padding: 13px; }
.pitch-envelope-panel > h4 { margin: 0 0 9px; font-size: var(--volca-type-heading); }
.pitch-envelope { width: 100%; height: 90px; display: block; border: 1px solid rgba(206,179,147,.15); border-radius: 8px; background: #251c1e; }
.envelope-grid { fill: none; stroke: rgba(206,179,147,.1); }
.envelope-line { fill: none; stroke: #ceb393; stroke-width: 2.5; }
.pitch-values { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; align-content: start; margin-top: 8px; }
</style>
