<template>
  <label class="knob-control" :class="{ compact }">
    <span class="knob-label">{{ label }}</span>
    <span class="knob" role="slider" tabindex="0" :aria-label="label" :aria-valuemin="min + displayOffset"
      :aria-valuemax="max + displayOffset" :aria-valuenow="displayValue" @pointerdown="startDrag"
      @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @wheel.prevent="onWheel"
      @keydown="onKeydown">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path class="knob-track" d="M15.7 50.3A24 24 0 1 1 48.3 50.3" pathLength="100" />
        <path class="knob-value" d="M15.7 50.3A24 24 0 1 1 48.3 50.3" pathLength="100"
          :style="{ strokeDasharray: `${percent} 100` }" />
        <circle cx="32" cy="32" r="18" />
        <line x1="32" y1="32" x2="32" y2="18" :transform="`rotate(${angle} 32 32)`" />
      </svg>
    </span>
    <output>{{ displayValue }}</output>
  </label>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: number; label: string; min: number; max: number; displayOffset?: number; compact?: boolean;
}>(), { displayOffset: 0, compact: false });
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
const dragging = ref(false);
let dragStartY = 0;
let dragStartValue = 0;
const range = computed(() => Math.max(1, props.max - props.min));
const percent = computed(() => ((props.modelValue - props.min) / range.value) * 100);
const angle = computed(() => -135 + percent.value * 2.7);
const displayValue = computed(() => props.modelValue + props.displayOffset);
const setValue = (value: number) => emit('update:modelValue', Math.max(props.min, Math.min(props.max, Math.round(value))));

const startDrag = (event: PointerEvent) => {
  dragging.value = true;
  dragStartY = event.clientY;
  dragStartValue = props.modelValue;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};
const moveDrag = (event: PointerEvent) => {
  if (!dragging.value) return;
  const sensitivity = event.shiftKey ? 240 : 120;
  setValue(dragStartValue + ((dragStartY - event.clientY) / sensitivity) * range.value);
};
const endDrag = (event: PointerEvent) => {
  dragging.value = false;
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
};
const onWheel = (event: WheelEvent) => setValue(props.modelValue + (event.deltaY < 0 ? 1 : -1));
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowUp' || event.key === 'ArrowRight') { event.preventDefault(); setValue(props.modelValue + 1); }
  if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') { event.preventDefault(); setValue(props.modelValue - 1); }
  if (event.key === 'Home') { event.preventDefault(); setValue(props.min); }
  if (event.key === 'End') { event.preventDefault(); setValue(props.max); }
};
</script>

<style scoped>
.knob-control { display: grid; min-width: 58px; justify-items: center; gap: 4px; color: #ad9e96; font-size: var(--volca-type-label); line-height: 1.25; text-align: center; }
.knob-label { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.knob { width: 58px; height: 58px; display: block; cursor: ns-resize; touch-action: none; }
.knob svg { width: 100%; height: 100%; overflow: visible; }
.knob-track, .knob-value { fill: none; stroke-width: 3; stroke-linecap: round; }
.knob-track { stroke: rgba(206,179,147,.16); }.knob-value { stroke: #ceb393; }
.knob circle { fill: #302426; stroke: rgba(206,179,147,.25); stroke-width: 1.5; }
.knob line { stroke: #f1e9e1; stroke-width: 2.5; stroke-linecap: round; }
.knob:focus-visible { outline: 2px solid #ceb393; outline-offset: 2px; border-radius: 50%; }
output { min-width: 32px; padding: 2px 5px; border-radius: 4px; background: #251c1e; color: #ceb393; font-size: var(--volca-type-body); font-variant-numeric: tabular-nums; }
.compact { min-width: 48px; }.compact .knob { width: 46px; height: 46px; }.compact output { font-size: var(--volca-type-label); }
</style>
