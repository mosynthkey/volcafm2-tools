<template>
  <svg class="algorithm-diagram" :class="{ pickable, 'large-nodes': largeNodes }" viewBox="0 0 240 340" :role="pickable ? 'button' : 'img'"
    :tabindex="pickable ? 0 : undefined" :aria-label="`Algorithm ${algorithm + 1}`"
    @click="pickable && $emit('open')" @keydown.enter.self.prevent="pickable && $emit('open')">
    <defs>
      <marker id="algorithm-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#f1e9e1" /></marker>
      <marker id="feedback-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#72d5ca" /></marker>
      <marker id="output-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#e7bd76" /></marker>
    </defs>
    <path v-for="edge in graph.edges" :key="`${edge.from}-${edge.to}`" class="routing-line"
      :d="edgePath(edge.from, edge.to)" marker-end="url(#algorithm-arrow)" />
    <path v-for="node in graph.nodes.filter(node => node.feedback)" :key="`fb${node.id}`" class="feedback-line"
      :d="feedbackPath(node)" marker-end="url(#feedback-arrow)" />
    <path v-for="node in carriers" :key="`out${node.id}`" class="output-line" :d="`M${node.x} ${node.y + nodeHalfHeight}V310`" />
    <path class="output-line" :d="outputBusPath" marker-end="url(#output-arrow)" />
    <g v-for="node in graph.nodes" :key="node.id" class="operator-node"
      :class="{ carrier: node.carrier, off: !enabled[node.id - 1], selected: selectedOperator === node.id - 1 }"
      role="button" tabindex="0" @click.stop="$emit('select', node.id - 1)" @keydown.enter.stop.prevent="$emit('select', node.id - 1)">
      <rect :x="node.x - nodeHalfWidth" :y="node.y - nodeHalfHeight" :width="nodeHalfWidth * 2"
        :height="nodeHalfHeight * 2" :rx="largeNodes ? 6 : 5" />
      <text :x="node.x" :y="node.y + .5">{{ node.id }}</text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { buildAlgorithmGraph, type AlgorithmGraphNode } from '@/utils/dx7Algorithms';
const props = withDefaults(defineProps<{ algorithm: number; enabled: boolean[]; selectedOperator: number; pickable?: boolean; largeNodes?: boolean }>(), { pickable: false, largeNodes: false });
defineEmits<{ select: [operatorIndex: number]; open: [] }>();
const graph = computed(() => buildAlgorithmGraph(props.algorithm));
const carriers = computed(() => graph.value.nodes.filter(node => node.carrier));
const outputBusPath = computed(() => {
  const xs = carriers.value.map(node => node.x);
  const left = Math.min(...xs), right = Math.max(...xs);
  return `M${left} 310H${right}M120 310V330`;
});
const nodeById = (id: number) => graph.value.nodes.find(node => node.id === id)!;
const nodeHalfWidth = computed(() => props.largeNodes ? 16 : 12);
const nodeHalfHeight = computed(() => props.largeNodes ? 13 : 10);
const MIN_ROUTE_STEM = 14;
const edgePath = (fromId: number, toId: number) => {
  const from = nodeById(fromId), to = nodeById(toId);
  const routeY = to.y - nodeHalfHeight.value - MIN_ROUTE_STEM;
  return `M${from.x} ${from.y + nodeHalfHeight.value}V${routeY}H${to.x}V${to.y - nodeHalfHeight.value}`;
};
const feedbackPath = (node: AlgorithmGraphNode) => `M${node.x - nodeHalfWidth.value + 2} ${node.y - nodeHalfHeight.value}C${node.x - 38} ${node.y - 38},${node.x + 38} ${node.y - 38},${node.x + nodeHalfWidth.value - 2} ${node.y - nodeHalfHeight.value}`;
</script>

<style scoped>
.algorithm-diagram { width: 100%; height: 320px; border: 1px solid rgba(241,233,225,.18); border-radius: 8px; background: #1c1516; }
.algorithm-diagram.pickable { cursor: pointer; }
.algorithm-diagram.pickable:hover { border-color: rgba(206,179,147,.48); }
.algorithm-diagram.pickable:focus-visible { outline: 2px solid #ceb393; outline-offset: 2px; }
.routing-line { fill: none; stroke: #f1e9e1; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.feedback-line { fill: none; stroke: #72d5ca; stroke-width: 2.2; stroke-linecap: round; }
.output-line { fill: none; stroke: #e7bd76; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.operator-node { cursor: pointer; }.operator-node rect { fill: #514044; stroke: #a99496; stroke-width: 1.4; }.operator-node.carrier rect { fill: #725f45; stroke: #f0c77f; stroke-width: 1.8; }.operator-node text { fill: #fffaf5; font-size: 12px; font-weight: 850; text-anchor: middle; dominant-baseline: central; pointer-events: none; }.operator-node.selected rect { stroke: #ffffff; stroke-width: 2.8; }.operator-node.off { opacity: .28; }.operator-node:focus-visible { outline: none; }.operator-node:focus-visible rect { stroke: #ffffff; stroke-width: 2.8; }
.large-nodes .operator-node text { font-size: 14px; }
</style>
