<template>
  <svg class="algorithm-diagram" viewBox="0 0 240 340" role="img" :aria-label="`Algorithm ${algorithm + 1}`">
    <defs>
      <marker id="algorithm-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#f1e9e1" /></marker>
      <marker id="feedback-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#72d5ca" /></marker>
      <marker id="output-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#e7bd76" /></marker>
    </defs>
    <path v-for="edge in graph.edges" :key="`${edge.from}-${edge.to}`" class="routing-line"
      :d="edgePath(edge.from, edge.to)" marker-end="url(#algorithm-arrow)" />
    <path v-for="node in graph.nodes.filter(node => node.feedback)" :key="`fb${node.id}`" class="feedback-line"
      :d="feedbackPath(node)" marker-end="url(#feedback-arrow)" />
    <path v-for="node in carriers" :key="`out${node.id}`" class="output-line" :d="`M${node.x} ${node.y + 10}V310`" />
    <path class="output-line" :d="outputBusPath" marker-end="url(#output-arrow)" />
    <g v-for="node in graph.nodes" :key="node.id" class="operator-node"
      :class="{ carrier: node.carrier, off: !enabled[node.id - 1], selected: selectedOperator === node.id - 1 }"
      role="button" tabindex="0" @click="$emit('select', node.id - 1)" @keydown.enter.prevent="$emit('select', node.id - 1)">
      <rect :x="node.x - 12" :y="node.y - 10" width="24" height="20" rx="5" />
      <text :x="node.x" :y="node.y + .5">{{ node.id }}</text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { buildAlgorithmGraph, type AlgorithmGraphNode } from '@/utils/dx7Algorithms';
const props = defineProps<{ algorithm: number; enabled: boolean[]; selectedOperator: number }>();
defineEmits<{ select: [operatorIndex: number] }>();
const graph = computed(() => buildAlgorithmGraph(props.algorithm));
const carriers = computed(() => graph.value.nodes.filter(node => node.carrier));
const outputBusPath = computed(() => {
  const xs = carriers.value.map(node => node.x);
  const left = Math.min(...xs), right = Math.max(...xs);
  return `M${left} 310H${right}M120 310V330`;
});
const nodeById = (id: number) => graph.value.nodes.find(node => node.id === id)!;
const NODE_HALF_HEIGHT = 10;
const MIN_ROUTE_STEM = 14;
const edgePath = (fromId: number, toId: number) => {
  const from = nodeById(fromId), to = nodeById(toId);
  const routeY = to.y - NODE_HALF_HEIGHT - MIN_ROUTE_STEM;
  return `M${from.x} ${from.y + NODE_HALF_HEIGHT}V${routeY}H${to.x}V${to.y - NODE_HALF_HEIGHT}`;
};
const feedbackPath = (node: AlgorithmGraphNode) => `M${node.x - 10} ${node.y - 10}C${node.x - 34} ${node.y - 34},${node.x + 34} ${node.y - 34},${node.x + 10} ${node.y - 10}`;
</script>

<style scoped>
.algorithm-diagram { width: 100%; height: 320px; border: 1px solid rgba(241,233,225,.18); border-radius: 8px; background: #1c1516; }
.routing-line { fill: none; stroke: #f1e9e1; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.feedback-line { fill: none; stroke: #72d5ca; stroke-width: 2.2; stroke-linecap: round; }
.output-line { fill: none; stroke: #e7bd76; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.operator-node { cursor: pointer; }.operator-node rect { fill: #514044; stroke: #a99496; stroke-width: 1.4; }.operator-node.carrier rect { fill: #725f45; stroke: #f0c77f; stroke-width: 1.8; }.operator-node text { fill: #fffaf5; font-size: 12px; font-weight: 850; text-anchor: middle; dominant-baseline: central; pointer-events: none; }.operator-node.selected rect { stroke: #ffffff; stroke-width: 2.8; }.operator-node.off { opacity: .28; }.operator-node:focus-visible { outline: none; }.operator-node:focus-visible rect { stroke: #ffffff; stroke-width: 2.8; }
</style>
