<template>
  <div class="toolbar-icon-btn">
    <span class="toolbar-icon-btn__label">{{ label }}</span>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()
</script>
