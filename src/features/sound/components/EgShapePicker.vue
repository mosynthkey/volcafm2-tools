<template>
  <div class="eg-shapes" role="listbox" :aria-label="t('sound.egShape')">
    <button v-for="shape in EG_SHAPE_PRESETS" :key="shape.id" type="button" class="eg-shape"
      :class="{ active: activeId === shape.id }" role="option" :aria-selected="activeId === shape.id"
      @click="apply(shape)">
      <svg viewBox="0 0 72 28" aria-hidden="true">
        <polyline :points="envelopePoints(shape.rates, shape.levels)" />
      </svg>
      <span>{{ t(`sound.egShapes.${shape.id}`) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { EG_SHAPE_PRESETS, matchingEgShape, type EgShapePreset } from '@/features/sound/egShapePresets';
import { dx7EnvelopePoints } from '@/utils/dx7Envelope';

const props = defineProps<{ rates: number[]; levels: number[] }>();
const emit = defineEmits<{ apply: [shape: EgShapePreset] }>();
const { t } = useI18n();
const activeId = computed(() => matchingEgShape(props.rates, props.levels)?.id ?? null);
const envelopePoints = (rates: readonly number[], levels: readonly number[]) =>
  dx7EnvelopePoints([...rates], [...levels], 72, 28, 4);
const apply = (shape: EgShapePreset) => emit('apply', shape);
</script>

<style scoped>
.eg-shapes { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-bottom: 10px; }
.eg-shape { min-width: 0; display: grid; gap: 3px; padding: 5px 6px 6px; border: 1px solid rgba(206,179,147,.18); border-radius: 8px; background: #251c1e; color: #c7b9b0; font: inherit; cursor: pointer; }
.eg-shape:hover { border-color: rgba(206,179,147,.5); background: #2d2224; color: #f1e9e1; }
.eg-shape.active { border-color: #ceb393; background: rgba(206,179,147,.14); color: #f1e9e1; }
.eg-shape:focus-visible { outline: 2px solid #e1cab0; outline-offset: 1px; }
.eg-shape svg { width: 100%; height: 28px; display: block; border-radius: 4px; background: #1c1516; }
.eg-shape polyline { fill: none; stroke: #ceb393; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.eg-shape span { overflow: hidden; font-size: 11px; font-weight: 700; line-height: 1.2; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
</style>
