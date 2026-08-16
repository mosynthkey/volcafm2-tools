<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="2.5" y="3.5" width="19" height="17" rx="2" />
    <path d="M9 3.5v17m6-17v17M2.5 12h19" opacity=".45" />
    <path d="M4.5 8h6.5M13 16h6.5" stroke-width="2.6" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 20 });
</script>
