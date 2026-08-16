<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6.5 8v3.5H12m5.5-3.5v3.5H12m0 0V15m0 5v2" />
    <path d="M20 5.5h2v5h-4.5" />
    <rect x="4" y="3" width="5" height="5" rx="1.2" />
    <rect x="15" y="3" width="5" height="5" rx="1.2" />
    <rect x="9.5" y="15" width="5" height="5" rx="1.2" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 20 });
</script>
