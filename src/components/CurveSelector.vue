<template>
  <div class="curve-control">
    <label :id="labelId">{{ label }}</label>
    <v-menu v-model="menuOpen" :close-on-content-click="false" location="bottom center" offset="6">
      <template #activator="{ props: activatorProps }">
        <button v-bind="activatorProps" type="button" class="curve-trigger" :aria-labelledby="labelId">
          <CurveGlyph :curve="modelValue" :direction="direction" />
          <span>{{ options[modelValue].short }}</span>
        </button>
      </template>
      <div class="curve-menu" role="listbox" :aria-label="label">
        <button v-for="option in options" :key="option.value" type="button" class="curve-option"
          :class="{ selected: modelValue === option.value }" role="option"
          :aria-selected="modelValue === option.value" @click="select(option.value)">
          <CurveGlyph :curve="option.value" :direction="direction" />
          <span>{{ option.short }}</span>
        </button>
      </div>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h, ref, useId } from 'vue';

const props = defineProps<{
  modelValue: number;
  label: string;
  direction: 'left' | 'right';
}>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
const labelId = `curve-${useId()}`;
const menuOpen = ref(false);
const options = [
  { value: 0, short: '−LN' },
  { value: 1, short: '−EX' },
  { value: 2, short: '+EX' },
  { value: 3, short: '+LN' },
];
const select = (value: number) => {
  emit('update:modelValue', value);
  menuOpen.value = false;
};

const paths = [
  'M7 8 L57 31',
  'M7 8 C29 8 50 13 57 31',
  'M7 31 C29 31 50 26 57 8',
  'M7 31 L57 8',
];

const CurveGlyph = defineComponent({
  props: { curve: { type: Number, required: true }, direction: { type: String, required: true } },
  setup(glyphProps) {
    return () => h('svg', { class: 'curve-glyph', viewBox: '0 0 64 39', 'aria-hidden': 'true' }, [
      h('path', {
        d: paths[glyphProps.curve] ?? paths[0],
        transform: glyphProps.direction === 'right' ? 'translate(64 0) scale(-1 1)' : undefined,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      }),
    ]);
  },
});
</script>

<style scoped>
.curve-control { display: grid; min-width: 0; justify-items: center; align-content: start; gap: 5px; }
.curve-control > label { width: 100%; min-height: 18px; color: #ad9e96; font-size: var(--volca-type-label); line-height: 1.25; text-align: center; }
.curve-trigger { width: 112px; height: 64px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 5px; padding: 7px 9px; border: 1px solid rgba(206,179,147,.3); border-radius: 9px; background: #251c1e; color: #d8ccc4; cursor: pointer; }
.curve-trigger:hover { border-color: rgba(206,179,147,.62); background: #2d2224; }
.curve-trigger:focus-visible, .curve-option:focus-visible { outline: 2px solid #e1cab0; outline-offset: 2px; }
.curve-trigger svg { width: 58px; height: 36px; color: #ceb393; }
.curve-trigger span { font-size: var(--volca-type-label); font-weight: 700; }
.curve-menu { display: grid; grid-template-columns: repeat(2, 124px); gap: 7px; padding: 8px; border: 1px solid rgba(206,179,147,.3); border-radius: 11px; background: #2b2022; box-shadow: 0 12px 32px rgba(0,0,0,.38); }
.curve-option { height: 70px; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 6px; padding: 7px 9px; border: 1px solid rgba(206,179,147,.16); border-radius: 8px; background: #251c1e; color: #d8ccc4; cursor: pointer; }
.curve-option:hover { border-color: rgba(206,179,147,.55); background: #35282a; }
.curve-option.selected { border-color: #ceb393; background: rgba(206,179,147,.16); color: #f1e9e1; }
.curve-option svg { width: 64px; height: 42px; color: #ceb393; }
.curve-option span { font-size: var(--volca-type-label); font-weight: 750; }
</style>
