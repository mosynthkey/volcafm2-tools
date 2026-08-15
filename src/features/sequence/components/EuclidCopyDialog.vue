<template>
  <AppDialog v-model="open" :title="t('sequence.euclidCopyTitle')" max-width="440">
    <p class="euclid-copy">{{ t('sequence.euclidCopyDescription') }}</p>
    <div class="euclid-ring" role="img" :aria-label="t('sequence.euclidRingAria', { count: pulses })">
      <svg viewBox="0 0 240 240" aria-hidden="true">
        <circle class="euclid-ring__face" cx="120" cy="120" r="78" />
        <polygon v-if="hitPoints.length >= 3" class="euclid-ring__shape" :points="hitPoints.join(' ')" />
        <polyline v-else-if="hitPoints.length === 2" class="euclid-ring__shape" :points="hitPoints.join(' ')" fill="none" />
      </svg>
      <button v-for="step in NUM_OF_STEPS" :key="step" type="button" class="euclid-pad"
        :class="{ hit: hits.has(step - 1), source: step - 1 === sourceStep }"
        :style="padStyle(step - 1)" :aria-label="t('sequence.stepAria', { count: step })"
        :aria-pressed="hits.has(step - 1)" @click="rotation = rotationAligningHitToStep(NUM_OF_STEPS, pulses, step - 1)">
        {{ step }}
      </button>
    </div>
    <label class="euclid-control">
      <span>{{ t('sequence.euclidPulses') }}</span>
      <input v-model.number="pulses" class="euclid-slider" type="range" min="1" :max="NUM_OF_STEPS" />
      <span class="euclid-control__value">{{ pulses }}</span>
    </label>
    <label class="euclid-control">
      <span>{{ t('sequence.euclidRotation') }}</span>
      <input v-model.number="rotation" class="euclid-slider" type="range" min="0" :max="NUM_OF_STEPS - 1" />
      <span class="euclid-control__value">{{ rotation }}</span>
    </label>
    <template #actions>
      <v-btn variant="text" @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn @click="confirm">{{ t('sequence.euclidPaste') }}</v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import { useSequencerStore } from '@/stores/sequencerStore'
import { NUM_OF_STEPS, type SequenceNote } from '@/types/sequence'
import { euclideanHits, rotationAligningHitToStep } from '@/utils/euclidean'

const props = defineProps<{
  modelValue: boolean
  sourceStep: number
  sourceNote: SequenceNote | null
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const { t } = useI18n()
const sequence = useSequencerStore()
const pulses = ref(4)
const rotation = ref(0)
const open = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})
const hits = computed(() => new Set(euclideanHits(NUM_OF_STEPS, pulses.value, rotation.value)))
const padStyle = (step: number) => {
  const angle = (step / NUM_OF_STEPS) * Math.PI * 2 - Math.PI / 2
  return {
    left: `${50 + Math.cos(angle) * 32.5}%`,
    top: `${50 + Math.sin(angle) * 32.5}%`,
  }
}
const hitPoints = computed(() =>
  [...hits.value].sort((left, right) => left - right).map(step => {
    const angle = (step / NUM_OF_STEPS) * Math.PI * 2 - Math.PI / 2
    return `${120 + Math.cos(angle) * 78},${120 + Math.sin(angle) * 78}`
  })
)
watch(() => props.modelValue, openNow => {
  if (!openNow) return
  pulses.value = 4
  rotation.value = rotationAligningHitToStep(NUM_OF_STEPS, 4, props.sourceStep)
})
const confirm = () => {
  const hitCount = Math.max(1, Math.min(NUM_OF_STEPS, Math.round(Number(pulses.value)) || 4))
  const turn = ((Math.round(Number(rotation.value)) % NUM_OF_STEPS) + NUM_OF_STEPS) % NUM_OF_STEPS
  if (props.sourceNote) sequence.copyNoteEuclid(props.sourceNote, hitCount, turn)
  else sequence.copyStepEuclid(props.sourceStep, hitCount, turn)
  open.value = false
}
</script>

<style scoped>
.euclid-copy { margin: 0 0 16px; }
.euclid-ring {
  position: relative;
  width: min(280px, 100%);
  aspect-ratio: 1;
  margin: 0 auto 18px;
}
.euclid-ring svg { display: block; width: 100%; height: 100%; }
.euclid-ring__face {
  fill: #251c1e;
  stroke: rgba(206, 179, 147, 0.28);
  stroke-width: 1.5;
}
.euclid-ring__shape {
  fill: rgba(206, 179, 147, 0.16);
  stroke: var(--volca-accent);
  stroke-width: 1.75;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.euclid-pad {
  position: absolute;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(206, 179, 147, 0.35);
  border-radius: 50%;
  background: #2b2022;
  color: var(--volca-muted);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  transform: translate(-50%, -50%);
  cursor: pointer;
}
.euclid-pad:hover { border-color: rgba(206, 179, 147, 0.7); color: var(--volca-text); }
.euclid-pad:focus-visible { outline: 2px solid var(--volca-accent); outline-offset: 2px; }
.euclid-pad.hit {
  background: var(--volca-accent);
  border-color: var(--volca-accent-bright);
  color: var(--volca-ink);
}
.euclid-pad.source {
  box-shadow: 0 0 0 3px rgba(225, 202, 176, 0.55);
  color: var(--volca-text);
}
.euclid-pad.hit.source { color: var(--volca-ink); }
.euclid-control {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  color: var(--volca-muted);
  font-size: var(--volca-type-label);
  font-weight: 700;
}
.euclid-control__value {
  color: var(--volca-text);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.euclid-slider {
  width: 100%;
  height: 16px;
  margin: 0;
  accent-color: var(--volca-accent);
  cursor: pointer;
}
</style>
