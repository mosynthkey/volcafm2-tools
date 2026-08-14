<template>
  <AppDialog :model-value="modelValue" :title="t('dx7.importVoicesTitle')" max-width="560"
    @update:model-value="emit('update:modelValue', $event)">
    <p class="import-copy">{{ t('dx7.importVoicesDescription') }}</p>
    <div class="import-toolbar">
      <v-btn size="small" @click="selected = voices.map(() => true)">{{ t('dx7.selectAll') }}</v-btn>
      <v-btn size="small" @click="selected = voices.map(() => false)">{{ t('dx7.selectNone') }}</v-btn>
      <span class="import-count">{{ t('dx7.selectedCount', { count: selectedCount }) }}</span>
    </div>
    <div class="voice-list" role="list">
      <button v-for="(voice, voiceIndex) in voices" :key="voiceIndex" type="button" class="voice-option"
        :class="{ selected: selected[voiceIndex] }" role="listitem" :aria-pressed="selected[voiceIndex]"
        @click="selected[voiceIndex] = !selected[voiceIndex]">
        <span class="voice-index">{{ voiceIndex + 1 }}</span>
        <strong>{{ voice.name.trim() || t('dx7.unnamedVoice') }}</strong>
      </button>
    </div>
    <label class="start-slot">
      <span>{{ t('dx7.startSlot') }}</span>
      <v-text-field v-model.number="startSlot" type="number" min="0" :max="slotCount - 1" density="compact"
        hide-details :aria-label="t('dx7.startSlot')" />
    </label>
    <p v-if="preview.length" class="import-preview">{{ t('dx7.importPreview', { preview: preview }) }}</p>
    <template #actions>
      <v-btn variant="text" @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</v-btn>
      <v-btn :disabled="selectedCount === 0" @click="confirm">{{ t('dx7.importSelected') }}</v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import { SOUND_LIST_SLOT_COUNT, mapImportedVoiceSlots } from '@/utils/soundListBackup'

const props = defineProps<{
  modelValue: boolean
  voices: { name: string }[]
  initialStartSlot: number
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  import: [payload: { selectedIndexes: number[]; startSlot: number }]
}>()
const { t } = useI18n()
const slotCount = SOUND_LIST_SLOT_COUNT
const selected = ref<boolean[]>([])
const startSlot = ref(0)

watch(() => props.modelValue, open => {
  if (!open) return
  selected.value = props.voices.map(() => true)
  startSlot.value = Math.max(0, Math.min(slotCount - 1, props.initialStartSlot))
})

const selectedCount = computed(() => selected.value.filter(Boolean).length)
const preview = computed(() => {
  const indexes = selected.value.flatMap((isSelected, voiceIndex) => isSelected ? [voiceIndex] : [])
  const destinations = mapImportedVoiceSlots(indexes.length, Number(startSlot.value) || 0)
  return indexes.slice(0, 4).map((voiceIndex, mappedIndex) => {
    const name = props.voices[voiceIndex]?.name.trim() || t('dx7.unnamedVoice')
    return `#${destinations[mappedIndex]} ${name}`
  }).join(', ') + (indexes.length > 4 ? '…' : '')
})

const confirm = () => {
  const selectedIndexes = selected.value.flatMap((isSelected, voiceIndex) => isSelected ? [voiceIndex] : [])
  if (selectedIndexes.length === 0) return
  const slot = Math.max(0, Math.min(slotCount - 1, Math.round(Number(startSlot.value)) || 0))
  emit('import', { selectedIndexes, startSlot: slot })
  emit('update:modelValue', false)
}
</script>

<style scoped>
.import-copy { margin: 0 0 12px; }
.import-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.import-count { margin-left: auto; color: var(--volca-muted); font-variant-numeric: tabular-nums; }
.voice-list { display: grid; gap: 6px; max-height: min(42vh, 360px); overflow-y: auto; padding: 2px; }
.voice-option {
  display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 8px 10px;
  border: 1px solid rgba(206,179,147,.18); border-radius: 8px; background: #2b2022; color: #d8ccc4;
  text-align: left; cursor: pointer;
}
.voice-option:hover { border-color: rgba(206,179,147,.48); background: #35282a; }
.voice-option.selected { border-color: #ceb393; background: rgba(206,179,147,.12); color: #f1e9e1; }
.voice-index { width: 2rem; color: var(--volca-muted); font-variant-numeric: tabular-nums; }
.start-slot { display: grid; grid-template-columns: minmax(0, 1fr) 88px; align-items: center; gap: 12px; margin-top: 14px; }
.import-preview { margin: 10px 0 0; color: var(--volca-muted); font-size: var(--volca-type-label); }
</style>
