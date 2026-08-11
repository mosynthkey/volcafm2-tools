<template>
  <v-btn class="dialog-close-button" icon variant="text" size="small" :title="label" :aria-label="label"
    @click="emit('click')">
    <X :size="20" />
  </v-btn>
</template>

<script setup lang="ts">
import { X } from '@lucide/vue';

withDefaults(defineProps<{ label?: string }>(), { label: '閉じる' });
const emit = defineEmits<{ click: [] }>();
</script>
