<template>
  <AppDialog :model-value="modelValue" :title="t('sound.lfoSpeedUtilityTitle')" max-width="460"
    @update:model-value="emit('update:modelValue', $event)">
    <p class="utility-copy">{{ t('sound.lfoSpeedUtilityDescription') }}</p>

    <label class="bpm-field">
      <span>{{ t('sound.lfoSpeedUtilityBpm') }}</span>
      <input v-model.number="bpm" type="number" :min="LFO_UTILITY_BPM_MIN" :max="LFO_UTILITY_BPM_MAX"
        :aria-label="t('sound.lfoSpeedUtilityBpm')" @change="persist" />
    </label>

    <div class="note-block">
      <span id="lfo-speed-note-label">{{ t('sound.lfoSpeedUtilityNote') }}</span>
      <div class="segment notes" role="group" aria-labelledby="lfo-speed-note-label">
        <button v-for="value in LFO_NOTE_VALUES" :key="value" type="button"
          :class="{ active: note === value }" :aria-pressed="note === value"
          @click="setNote(value)">{{ value }}</button>
      </div>
      <div class="segment modifiers" role="group" :aria-label="t('sound.lfoSpeedUtilityFeel')">
        <button v-for="value in LFO_NOTE_MODIFIERS" :key="value" type="button"
          :class="{ active: modifier === value }" :aria-pressed="modifier === value"
          @click="setModifier(value)">{{ t(`sound.lfoSpeedUtilityModifiers.${value}`) }}</button>
      </div>
    </div>

    <div class="result" :class="{ clamped: match.clamped }">
      <span class="result-label">{{ t('sound.speed') }}</span>
      <strong class="result-speed">{{ match.speed }}</strong>
      <p class="result-time">
        {{ t('sound.lfoSpeedUtilityPeriod', { seconds: formatSeconds(match.periodSeconds) }) }}
        <span aria-hidden="true"> · </span>
        {{ t('sound.lfoSpeedUtilityHz', { hz: formatHz(match.frequencyHz) }) }}
      </p>
      <p v-if="match.clamped === 'low'" class="result-hint warn">{{ t('sound.lfoSpeedUtilityTooSlow') }}</p>
      <p v-else-if="match.clamped === 'high'" class="result-hint warn">{{ t('sound.lfoSpeedUtilityTooFast') }}</p>
      <p v-else-if="alreadyApplied" class="result-hint">{{ t('sound.lfoSpeedUtilityAlready') }}</p>
      <p v-else class="result-hint">{{ t('sound.lfoSpeedUtilityNearest') }}</p>
    </div>

    <template #actions>
      <v-btn variant="text" @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</v-btn>
      <v-btn :disabled="alreadyApplied" @click="apply">{{ t('sound.lfoSpeedUtilityApply') }}</v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppDialog from '@/components/dialogs/AppDialog.vue';
import {
  LFO_NOTE_MODIFIERS,
  LFO_NOTE_VALUES,
  LFO_UTILITY_BPM_MAX,
  LFO_UTILITY_BPM_MIN,
  clampLfoUtilityBpm,
  speedFromBpmAndNote,
  type LfoNoteModifier,
  type LfoNoteValue,
} from '@/features/sound/lfoSpeedFromTime';

const STORAGE_KEY = 'volca-fm2-lfo-speed-utility';

const props = defineProps<{
  modelValue: boolean;
  currentSpeed: number;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  apply: [speed: number];
}>();
const { t } = useI18n();

const bpm = ref(120);
const note = ref<LfoNoteValue>('1/4');
const modifier = ref<LfoNoteModifier>('straight');

const match = computed(() => speedFromBpmAndNote(clampLfoUtilityBpm(Number(bpm.value)), note.value, modifier.value));
const alreadyApplied = computed(() => match.value.speed === props.currentSpeed);

const isNoteValue = (value: unknown): value is LfoNoteValue =>
  typeof value === 'string' && (LFO_NOTE_VALUES as readonly string[]).includes(value);
const isModifier = (value: unknown): value is LfoNoteModifier =>
  typeof value === 'string' && (LFO_NOTE_MODIFIERS as readonly string[]).includes(value);

const restore = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '');
    if (stored && typeof stored === 'object') {
      if (typeof stored.bpm === 'number') bpm.value = clampLfoUtilityBpm(stored.bpm);
      if (isNoteValue(stored.note)) note.value = stored.note;
      if (isModifier(stored.modifier)) modifier.value = stored.modifier;
    }
  } catch {
    /* ignore quota / private mode / bad JSON */
  }
};

const persist = () => {
  bpm.value = clampLfoUtilityBpm(Number(bpm.value));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      bpm: bpm.value,
      note: note.value,
      modifier: modifier.value,
    }));
  } catch {
    /* ignore quota / private mode */
  }
};

const setNote = (value: LfoNoteValue) => {
  note.value = value;
  persist();
};
const setModifier = (value: LfoNoteModifier) => {
  modifier.value = value;
  persist();
};

watch(() => props.modelValue, open => {
  if (open) restore();
});

const formatSeconds = (seconds: number) => (seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2));
const formatHz = (hz: number) => (hz >= 10 ? hz.toFixed(1) : hz.toFixed(2));

const apply = () => {
  persist();
  emit('apply', match.value.speed);
  emit('update:modelValue', false);
};
</script>

<style scoped>
.utility-copy { margin: 0 0 16px; color: var(--volca-text); }
.bpm-field, .note-block { display: grid; gap: 7px; margin-bottom: 14px; }
.bpm-field > span, .note-block > span {
  color: var(--volca-muted);
  font-size: var(--volca-type-label);
  font-weight: 700;
}
.bpm-field input {
  width: 112px;
  height: 40px;
  box-sizing: border-box;
  padding: 0 10px;
  border: 1px solid rgba(206, 179, 147, 0.3);
  border-radius: 8px;
  background: #251c1e;
  color: var(--volca-text);
  font: inherit;
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.bpm-field input:focus-visible { outline: 2px solid #e1cab0; outline-offset: 1px; }
.segment {
  display: grid;
  overflow: hidden;
  border: 1px solid rgba(206, 179, 147, 0.3);
  border-radius: 8px;
  background: #251c1e;
}
.segment.notes { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.segment.modifiers { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.segment button {
  height: 34px;
  padding: 0 6px;
  border: 0;
  background: transparent;
  color: #ad9e96;
  font: inherit;
  font-size: var(--volca-type-label);
  font-weight: 700;
  cursor: pointer;
}
.segment button + button { border-left: 1px solid rgba(206, 179, 147, 0.28); }
.segment button.active { background: #ceb393; color: #33282a; }
.segment button:focus-visible { outline: 2px solid #e1cab0; outline-offset: -2px; }
.result {
  display: grid;
  justify-items: center;
  gap: 2px;
  margin-top: 4px;
  padding: 14px 12px 12px;
  border: 1px solid rgba(206, 179, 147, 0.18);
  border-radius: 10px;
  background: #251c1e;
  text-align: center;
}
.result-label { color: var(--volca-muted); font-size: var(--volca-type-label); font-weight: 700; }
.result-speed {
  color: var(--volca-accent-bright);
  font-size: 40px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.result-time {
  margin: 6px 0 0;
  color: var(--volca-teal);
  font-variant-numeric: tabular-nums;
}
.result-hint { margin: 8px 0 0; color: var(--volca-muted); font-size: var(--volca-type-label); }
.result.clamped { border-color: rgba(240, 107, 151, 0.45); }
.result-hint.warn { color: var(--volca-pink); }
</style>
