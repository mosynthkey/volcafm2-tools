<template>
  <div class="lfo-wave-control" :class="{ compact }">
    <label :id="labelId">{{ t('sound.waveform') }}</label>
    <div class="lfo-waves" role="listbox" :aria-labelledby="labelId">
      <button v-for="(key, wave) in LFO_WAVE_KEYS" :key="key" type="button" class="lfo-wave"
        :class="{ selected: modelValue === wave }" role="option"
        :aria-selected="modelValue === wave" :aria-label="t(`sound.lfoWaves.${key}`)"
        :title="t(`sound.lfoWaves.${key}`)" @click="emit('update:modelValue', wave)">
        <svg viewBox="0 0 72 28" aria-hidden="true">
          <polyline :points="lfoWaveformPoints(wave)" />
        </svg>
        <span>{{ t(compact ? `sound.lfoWaveShort.${key}` : `sound.lfoWaves.${key}`) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { LFO_WAVE_KEYS, lfoWaveformPoints } from '@/features/sound/lfoWaveforms';

withDefaults(defineProps<{
  modelValue: number;
  compact?: boolean;
}>(), { compact: false });
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
const { t } = useI18n();
const labelId = `lfo-wave-${useId()}`;
</script>

<style scoped>
.lfo-wave-control { display: grid; align-content: start; gap: 5px; flex: 0 0 auto; }
.lfo-wave-control > label { color: #ad9e96; font-size: var(--volca-type-label); line-height: 1.25; text-align: center; }
.lfo-waves { display: grid; grid-template-columns: repeat(6, 58px); gap: 6px; }
.lfo-wave { min-width: 0; display: grid; gap: 3px; padding: 5px 4px 6px; border: 1px solid rgba(206,179,147,.18); border-radius: 8px; background: #251c1e; color: #c7b9b0; font: inherit; cursor: pointer; }
.lfo-wave:hover { border-color: rgba(206,179,147,.5); background: #2d2224; color: #f1e9e1; }
.lfo-wave.selected { border-color: #ceb393; background: rgba(206,179,147,.14); color: #f1e9e1; }
.lfo-wave:focus-visible { outline: 2px solid #e1cab0; outline-offset: 1px; }
.lfo-wave svg { width: 100%; height: 28px; display: block; border-radius: 4px; background: #1c1516; }
.lfo-wave polyline { fill: none; stroke: #ceb393; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.lfo-wave span { overflow: hidden; font-size: 11px; font-weight: 700; line-height: 1.2; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.lfo-wave-control.compact .lfo-waves { grid-template-columns: repeat(6, 54px); gap: 5px; }
.lfo-wave-control.compact .lfo-wave { padding: 4px 3px 5px; }
.lfo-wave-control.compact .lfo-wave svg { height: 22px; }
.lfo-wave-control.compact .lfo-wave span { font-size: 10px; }
</style>
