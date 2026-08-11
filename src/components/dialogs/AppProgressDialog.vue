<template>
  <AppDialog :model-value="modelValue" :title="title" :max-width="maxWidth" persistent :closable="false">
    <p v-if="description" class="app-progress-copy">{{ description }}</p>
    <v-progress-linear :model-value="indeterminate ? undefined : value" :indeterminate="indeterminate" height="8" rounded />
    <div v-if="slots.status" class="app-progress-status"><slot name="status" /></div>
  </AppDialog>
</template>

<script setup lang="ts">
import AppDialog from './AppDialog.vue'
const slots = defineSlots<{ status?: () => unknown }>()
withDefaults(defineProps<{ modelValue: boolean; title: string; description?: string; value?: number; indeterminate?: boolean; maxWidth?: string | number }>(), {
  description: '', value: 0, indeterminate: false, maxWidth: 500,
})
</script>

<style scoped>
.app-progress-copy { margin: 0 0 16px; }
.app-progress-status { margin-top: 12px; }
</style>
