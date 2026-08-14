<template>
  <button type="button" class="adsr-mode" :class="{ active: adsrMode }" :aria-pressed="adsrMode"
    @click="toggleMode">
    {{ t('sound.adsrMode') }}
  </button>
  <div class="adsr-knobs" :class="{ inactive: !adsrMode }" :inert="!adsrMode">
    <KnobControl v-model="adsr.attack" :label="t('sound.adsr.attack')" :min="0" :max="99" compact />
    <KnobControl v-model="adsr.decay" :label="t('sound.adsr.decay')" :min="0" :max="99" compact />
    <KnobControl v-model="adsr.sustain" :label="t('sound.adsr.sustain')" :min="0" :max="99" compact />
    <KnobControl v-model="adsr.release" :label="t('sound.adsr.release')" :min="0" :max="99" compact />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import KnobControl from '@/components/KnobControl.vue';
import { adsrToEg, egToAdsr, type Adsr } from '@/utils/adsrEnvelope';

const props = defineProps<{ operatorIndex: number; rates: number[]; levels: number[] }>();
const emit = defineEmits<{ apply: [rates: number[], levels: number[]] }>();
const { t } = useI18n();
const modes = reactive([false, false, false, false, false, false]);
const values = reactive<Adsr[]>(Array.from({ length: 6 }, () => ({ attack: 0, decay: 0, sustain: 99, release: 0 })));
const adsrMode = computed(() => modes[props.operatorIndex] ?? false);
const adsr = computed(() => values[props.operatorIndex] ?? values[0]);
const envelopeEquals = (rates: readonly number[], levels: readonly number[]) =>
  rates.every((rate, index) => rate === props.rates[index])
  && levels.every((level, index) => level === props.levels[index]);
const applyAdsr = () => {
  const envelope = adsrToEg(adsr.value);
  if (envelopeEquals(envelope.rates, envelope.levels)) return;
  emit('apply', [...envelope.rates], [...envelope.levels]);
};
const syncFromEg = () => Object.assign(adsr.value, egToAdsr(props.rates, props.levels));
const toggleMode = () => {
  if (adsrMode.value) {
    modes[props.operatorIndex] = false;
    return;
  }
  syncFromEg();
  modes[props.operatorIndex] = true;
  applyAdsr();
};

watch(() => [props.operatorIndex, ...props.rates, ...props.levels], () => {
  if (adsrMode.value) {
    const envelope = adsrToEg(adsr.value);
    if (!envelopeEquals(envelope.rates, envelope.levels)) modes[props.operatorIndex] = false;
  }
  if (!adsrMode.value) syncFromEg();
}, { immediate: true });

watch(values, () => {
  if (!adsrMode.value) return;
  applyAdsr();
}, { deep: true });
</script>

<style scoped>
.adsr-mode {
  box-sizing: border-box;
  width: 100%;
  height: 28px;
  margin-top: 8px;
  padding: 0 8px;
  border: 1px solid rgba(206,179,147,.28);
  border-radius: 7px;
  background: transparent;
  color: #c7b9b0;
  font: inherit;
  font-size: var(--volca-type-label);
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}
.adsr-mode:hover { border-color: rgba(206,179,147,.58); background: rgba(206,179,147,.08); color: #f1e9e1; }
.adsr-mode.active { border-color: #ceb393; background: rgba(206,179,147,.14); color: #f1e9e1; }
.adsr-mode:focus-visible { outline: 2px solid #e1cab0; outline-offset: 2px; }
.adsr-knobs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
.adsr-knobs.inactive { opacity: .42; }
</style>
