<template>
  <AppDialog v-model="open" :title="t('library.backupLoadProgramSlotTitle')" max-width="560" :persistent="loading" :closable="!loading">
    <p class="slot-copy">{{ t('library.backupLoadProgramSlotDescription') }}</p>
    <p class="slot-source">
      <span>{{ t('library.backupLoadProgramSource') }}</span>
      <strong>{{ sourceLabel }}</strong>
    </p>
    <label class="start-slot">
      <span>{{ t('library.backupLoadProgramDestination') }}</span>
      <v-text-field
        v-model.number="destSlot"
        type="number"
        min="0"
        :max="slotCount - 1"
        density="compact"
        hide-details
        :disabled="loading"
        :aria-label="t('library.backupLoadProgramDestination')"
      />
    </label>
    <div ref="listEl" class="slot-list" role="listbox" :aria-label="t('library.backupLoadProgramDestination')">
      <button
        v-for="slot in slots"
        :key="slot"
        type="button"
        class="slot-option"
        :class="{ selected: slot === clampedDest }"
        role="option"
        :aria-selected="slot === clampedDest"
        :disabled="loading"
        @click="destSlot = slot"
      >
        <span class="slot-index">{{ String(slot).padStart(2, '0') }}</span>
        <strong>{{ destName(slot) }}</strong>
      </button>
    </div>
    <p class="slot-overwrite">{{ t('library.backupLoadProgramOverwrite', { slot: paddedDest, name: destName(clampedDest) }) }}</p>
    <p v-if="errorMessage" class="dialog-error">{{ errorMessage }}</p>
    <template #actions>
      <v-btn variant="text" :disabled="loading" @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn :loading="loading" @click="emit('confirm', clampedDest)">{{ t('library.backupLoadWithProgram') }}</v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import { SOUND_LIST_SLOT_COUNT } from '@/utils/soundListBackup'

const props = withDefaults(defineProps<{
  modelValue: boolean
  sourceSlot: number
  sourceName: string
  destNames: { name: string }[]
  loading?: boolean
  errorMessage?: string
}>(), {
  loading: false,
  errorMessage: '',
})
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [slot: number]
}>()
const { t } = useI18n()
const slotCount = SOUND_LIST_SLOT_COUNT
const slots = Array.from({ length: slotCount }, (_, slot) => slot)
const destSlot = ref(0)
const listEl = ref<HTMLElement | null>(null)
const open = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})
const clampSlot = (value: number) => Math.max(0, Math.min(slotCount - 1, Math.round(Number(value)) || 0))
const clampedDest = computed(() => clampSlot(destSlot.value))
const paddedDest = computed(() => String(clampedDest.value).padStart(2, '0'))
const sourceLabel = computed(() => t('library.backupLinkedProgram', {
  slot: String(props.sourceSlot).padStart(2, '0'),
  name: props.sourceName.trim() || t('library.backupEmptyProgram'),
}))
const destName = (slot: number) => props.destNames[slot]?.name.trim() || t('library.backupEmptyProgram')

watch(() => props.modelValue, async openDialog => {
  if (!openDialog) return
  destSlot.value = clampSlot(props.sourceSlot)
  await nextTick()
  listEl.value?.querySelector<HTMLElement>('.slot-option.selected')?.scrollIntoView({ block: 'nearest' })
})

watch(clampedDest, async () => {
  await nextTick()
  listEl.value?.querySelector<HTMLElement>('.slot-option.selected')?.scrollIntoView({ block: 'nearest' })
})
</script>

<style scoped>
.slot-copy { margin: 0 0 12px; }
.slot-source {
  display: grid; gap: 2px; margin: 0 0 14px;
  color: var(--volca-muted); font-size: var(--volca-type-label);
}
.slot-source strong { color: var(--volca-text); font-size: var(--volca-type-body); }
.start-slot { display: grid; grid-template-columns: minmax(0, 1fr) 88px; align-items: center; gap: 12px; margin-bottom: 10px; }
.slot-list { display: grid; gap: 6px; max-height: min(42vh, 360px); overflow-y: auto; padding: 2px; }
.slot-option {
  display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 8px 10px;
  border: 1px solid rgba(206,179,147,.18); border-radius: 8px; background: #2b2022; color: #d8ccc4;
  text-align: left; cursor: pointer;
}
.slot-option:hover { border-color: rgba(206,179,147,.48); background: #35282a; }
.slot-option.selected { border-color: #ceb393; background: rgba(206,179,147,.12); color: #f1e9e1; }
.slot-index { width: 2rem; color: var(--volca-muted); font-variant-numeric: tabular-nums; }
.slot-overwrite { margin: 10px 0 0; color: var(--volca-muted); font-size: var(--volca-type-label); }
</style>
