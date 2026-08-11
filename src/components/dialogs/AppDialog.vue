<template>
  <v-dialog :model-value="modelValue" :max-width="maxWidth" :persistent="persistent"
    @update:model-value="emit('update:modelValue', $event)">
    <v-card class="app-dialog">
      <div class="dialog-title-row">
        <v-card-title>{{ title }}</v-card-title>
        <DialogCloseButton v-if="closable && !persistent" :label="t('common.close')"
          @click="emit('update:modelValue', false)" />
      </div>
      <v-card-text><slot /></v-card-text>
      <v-card-actions v-if="slots.actions"><v-spacer /><slot name="actions" /></v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import DialogCloseButton from '@/components/DialogCloseButton.vue'

withDefaults(defineProps<{ modelValue: boolean; title: string; maxWidth?: string | number; persistent?: boolean; closable?: boolean }>(), {
  maxWidth: 440, persistent: false, closable: true,
})
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const slots = defineSlots<{ default?: () => unknown; actions?: () => unknown }>()
const { t } = useI18n()
</script>
