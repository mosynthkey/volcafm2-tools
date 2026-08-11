<template>
  <AppDialog :model-value="modelValue" :title="title" :max-width="maxWidth"
    @update:model-value="emit('update:modelValue', $event)">
    <slot>{{ message }}</slot>
    <template #actions><v-btn @click="emit('update:modelValue', false)">{{ t('common.ok') }}</v-btn></template>
  </AppDialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppDialog from './AppDialog.vue'

withDefaults(defineProps<{ modelValue: boolean; title: string; message?: string; maxWidth?: string | number }>(), { message: '', maxWidth: 440 })
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const { t } = useI18n()
</script>

