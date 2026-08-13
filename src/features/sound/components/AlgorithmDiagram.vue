<template>
  <svg class="algorithm-diagram" :class="{ pickable }" viewBox="0 0 152 91" :role="pickable ? 'button' : 'img'"
    :tabindex="pickable ? 0 : undefined" :aria-label="t('sound.algorithmN', { count: algorithmIndex + 1 })"
    @click="pickable && (sound.showAlgorithmPicker = true)" @keydown.enter.self.prevent="pickable && (sound.showAlgorithmPicker = true)">
    <g class="algorithm-routes" aria-hidden="true">
      <template v-for="operator in layout" :key="`route-${operator[0]}`">
        <path v-if="linkPath(operator)" :class="isCarrier(operator) ? 'output-line' : 'routing-line'" :d="linkPath(operator)" />
        <path v-if="feedbackPath(operator)" class="feedback-line" :d="feedbackPath(operator)" />
      </template>
    </g>
    <g v-for="operator in layout" :key="operator[0]" class="operator-node"
      :class="{ carrier: isCarrier(operator), off: !enabled[operator[0] - 1], selected: pickable && sound.selectedOperator === operator[0] - 1 }">
      <rect class="operator-block" :x="origin(operator).x + 1" :y="origin(operator).y - 1" width="14" height="14" rx="3"
        role="button" tabindex="0" @click.stop="pickable && sound.toggleOperator(operator[0] - 1)"
        @keydown.enter.stop.prevent="pickable && sound.toggleOperator(operator[0] - 1)" />
      <text :x="origin(operator).x + 8" :y="origin(operator).y + 6">{{ operator[0] }}</text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useSoundStore } from '@/stores/soundStore';
import { DEXED_ALGORITHM_LAYOUTS, type DexedAlgorithmOperator } from '@/utils/dexedAlgorithmLayout';

const props = withDefaults(defineProps<{ algorithm?: number; pickable?: boolean }>(), { pickable: false });
const { t } = useI18n();
const sound = useSoundStore();
const { program } = storeToRefs(sound);
const algorithmIndex = computed(() => props.algorithm ?? program.value.algorithm);
const enabled = computed(() => program.value.operators.map(operator => operator.enabled));
const layout = computed(() => DEXED_ALGORITHM_LAYOUTS[algorithmIndex.value] ?? DEXED_ALGORITHM_LAYOUTS[0]);
const origin = (operator: DexedAlgorithmOperator) => ({ x: operator[1] * 25 + 3, y: operator[2] * 21 + 5 });
const isCarrier = (operator: DexedAlgorithmOperator) => operator[2] === 3;
const isTerminalTail = (operator: DexedAlgorithmOperator) =>
  isCarrier(operator) && (operator[3] === 0 || operator[3] === 2);

const linkPath = (operator: DexedAlgorithmOperator) => {
  const { x, y } = origin(operator);
  if (isTerminalTail(operator)) return `M${x + 8} ${y + 13}V${y + 21}`;
  switch (operator[3]) {
    case 0: return `M${x + 8} ${y + 12}V${y + 21}`;
    case 1: return `M${x + 8} ${y + 12}V${y + 18}H${x + 34}`;
    case 2: return `M${x + 8} ${y + 12}V${y + 19}`;
    case 3: return `M${x + 8} ${y + 12}V${y + 21}M${x + 7} ${y + 18}H${x + 34}V${y + 21}`;
    case 4: return `M${x + 8} ${y + 12}V${y + 21}M${x - 17} ${y + 21}V${y + 18}H${x + 34}V${y + 21}`;
    case 6: return `M${x + 8} ${y + 12}V${y + 18}H${x + 58}`;
    case 7: return `M${x + 8} ${y + 12}V${y + 18}H${x - 17}`;
    default: return '';
  }
};

const feedbackPath = (operator: DexedAlgorithmOperator) => {
  const { x, y } = origin(operator);
  switch (operator[4]) {
    case 1: return `M${x + 8} ${y}V${y - 4}H${x + 20}V${y + 15}H${x + 8}`;
    case 2: return `M${x + 8} ${y}V${y - 4}H${x + 19}V${y + 58}H${x + 8}`;
    case 3: return `M${x + 8} ${y}V${y - 4}H${x + 19}V${y + 36}H${x + 8}`;
    case 4: return `M${x + 8} ${y}V${y - 4}H${x - 3}V${y + 15}H${x + 8}V${y + 12}`;
    default: return '';
  }
};
</script>

<style scoped>
.algorithm-diagram { width: 100%; height: 256px; border: 1px solid rgba(241,233,225,.18); border-radius: 8px; background: #1c1516; }
.algorithm-diagram.pickable { cursor: pointer; }
.algorithm-diagram.pickable:hover { border-color: rgba(206,179,147,.48); }
.algorithm-diagram.pickable:focus-visible { outline: 2px solid #ceb393; outline-offset: 2px; }
.routing-line,.feedback-line,.output-line { fill: none; stroke-width: 1.5; stroke-linecap: butt; stroke-linejoin: round; }
.routing-line { stroke: #f1e9e1; }
.feedback-line { stroke: #72d5ca; }
.output-line { stroke: #e7bd76; }
.operator-node { cursor: pointer; }
.operator-block { fill: #514044; stroke: #f1e9e1; stroke-width: 1.25; outline: none; }
.operator-node.carrier .operator-block { fill: #725f45; stroke: #e7bd76; }
.operator-node text { fill: #f8eee4; font-size: 9px; font-weight: 800; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.operator-node.selected .operator-block,.operator-block:focus-visible { fill: #d8bea0; stroke: #f8eee4; }
.operator-node.selected text,.operator-block:focus-visible ~ text { fill: #2b2022; }
.operator-node.off { opacity: .28; }
.operator-block:focus,.operator-block:focus-visible { outline: none; }
</style>
