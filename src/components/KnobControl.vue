<template>
  <label class="knob-control" :class="{ compact }">
    <span class="knob-label">{{ label }}</span>
    <span class="knob" role="slider" tabindex="0" :aria-label="label" :aria-valuemin="min + displayOffset"
      :aria-valuemax="max + displayOffset" :aria-valuenow="displayValue" @pointerdown="startDrag"
      @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @wheel.prevent="onWheel"
      @keydown="onKeydown">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path class="knob-track" d="M15.03 48.97A24 24 0 1 1 48.97 48.97" pathLength="100" />
        <path v-if="valueArc.length > 0" class="knob-value" d="M15.03 48.97A24 24 0 1 1 48.97 48.97" pathLength="100"
          :style="{ strokeDasharray: `${valueArc.length} 100`, strokeDashoffset: -valueArc.start }" />
      </svg>
      <output>{{ displayValue }}</output>
    </span>
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
const displayMin = computed(() => props.min + props.displayOffset);
const displayMax = computed(() => props.max + props.displayOffset);
const isBipolar = computed(() => displayMin.value < 0 && displayMax.value > 0);
const zeroPercent = computed(() => ((0 - displayMin.value) / (displayMax.value - displayMin.value)) * 100);
const valueArc = computed(() => {
  const value = Math.max(0, Math.min(100, percent.value));
  if (!isBipolar.value) return { start: 0, length: value };
  const zero = zeroPercent.value;
  return { start: Math.min(value, zero), length: Math.abs(value - zero) };
});
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
.knob-control { display: grid; min-width: 50px; justify-items: center; gap: 4px; color: #ad9e96; font-size: var(--volca-type-label); line-height: 1.25; text-align: center; }
.knob-label { width: 100%; min-height: 18px; overflow: hidden; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.knob { position: relative; width: 50px; height: 50px; display: block; cursor: ns-resize; touch-action: none; }
.knob svg { width: 100%; height: 100%; overflow: visible; }
.knob-track, .knob-value { fill: none; stroke-width: 5; stroke-linecap: round; }
.knob-track { stroke: rgba(206,179,147,.18); }
.knob-value { stroke: #ceb393; }
.knob:hover .knob-track { stroke: rgba(206,179,147,.3); }
.knob:focus-visible { outline: 2px solid #ceb393; outline-offset: 2px; border-radius: 50%; }
output { position: absolute; top: 50%; left: 50%; z-index: 2; min-width: 24px; transform: translate(-50%, -50%); color: #e1cab0; font-size: var(--volca-type-body); font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; pointer-events: none; }
.compact output { min-width: 20px; font-size: var(--volca-type-label); }
</style>
