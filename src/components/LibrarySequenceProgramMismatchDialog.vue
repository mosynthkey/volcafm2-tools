<template>
  <AppDialog
    :model-value="modelValue"
    :title="t('library.sequenceProgramMismatchTitle')"
    max-width="480"
    :persistent="true"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p>{{ t('library.sequenceProgramMismatch', { slot: paddedSlot, name: programName }) }}</p>
    <div class="sequence-load-choices">
      <button type="button" class="sequence-load-choice" @click="emit('keep')">
        <strong>{{ t('library.sequenceProgramKeep') }}</strong>
      </button>
      <button type="button" class="sequence-load-choice" @click="emit('load')">
        <strong>{{ t('library.sequenceProgramLoad') }}</strong>
      </button>
    </div>
    <template #actions>
      <v-btn variant="text" @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/dialogs/AppDialog.vue'

const props = defineProps<{
  modelValue: boolean
  programSlot: number
  programName: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  keep: []
  load: []
}>()
const { t } = useI18n()
const paddedSlot = computed(() => String(props.programSlot).padStart(2, '0'))
</script>

<style scoped>
.sequence-load-choices { display: grid; gap: 8px; margin: 14px 0 0; }
.sequence-load-choice {
  display: grid; min-height: 48px; padding: 12px 14px; place-items: start;
  border: 1px solid rgba(206,179,147,.18); border-radius: 8px; background: #2b2022; color: #d8ccc4;
  text-align: left; cursor: pointer;
}
.sequence-load-choice:hover { border-color: rgba(206,179,147,.48); background: #35282a; }
.sequence-load-choice strong { color: var(--volca-text); font-size: var(--volca-type-body); }
</style>
