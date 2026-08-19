<template>
  <AppDialog v-model="open" :title="title" max-width="1100" card-class="backup-browser-card" :persistent="loading" :closable="!loading">
    <p v-if="errorMessage" class="dialog-error">{{ errorMessage }}</p>
    <div class="backup-browser">
      <section class="backup-pane">
        <h3>{{ t('library.backupSequences') }}</h3>
        <div class="backup-selected">
          <div class="backup-meta">
            <strong>{{ sequenceTitle(selectedSequenceSlot) }}</strong>
            <small>{{ linkedLabel(selectedSequence?.programNo ?? 0) }}</small>
          </div>
          <div class="backup-actions">
            <v-btn :disabled="loading || !selectedSequence" class="text-none" @click="emit('load-sequence', selectedSequenceSlot)">
              {{ t('common.load') }}
            </v-btn>
            <v-btn :disabled="loading || !selectedSequence" class="text-none" @click="emit('load-with-program', selectedSequenceSlot)">
              {{ t('library.backupLoadWithProgram') }}
            </v-btn>
          </div>
        </div>
        <div class="backup-list" role="listbox" :aria-label="t('library.backupSequences')">
          <button
            v-for="(sequence, slot) in sequences"
            :key="`seq-${slot}`"
            type="button"
            class="backup-row"
            :class="{ selected: slot === selectedSequenceSlot }"
            role="option"
            :aria-selected="slot === selectedSequenceSlot"
            :disabled="loading"
            @click="selectedSequenceSlot = slot"
          >
            <span class="backup-meta">
              <strong>{{ sequenceTitle(slot) }}</strong>
              <small>{{ linkedLabel(sequence.programNo) }}</small>
            </span>
          </button>
        </div>
      </section>
      <section class="backup-pane">
        <h3>{{ t('library.backupPrograms') }}</h3>
        <div class="backup-selected">
          <div class="backup-meta">
            <strong>{{ programTitle(selectedProgramSlot) }}</strong>
            <small>{{ programName(selectedProgramSlot) }}</small>
          </div>
          <div class="backup-actions">
            <v-btn :disabled="loading || !selectedProgram" class="text-none" @click="emit('load-program', selectedProgramSlot)">
              {{ t('common.load') }}
            </v-btn>
          </div>
        </div>
        <div class="backup-list backup-programs" role="listbox" :aria-label="t('library.backupPrograms')">
          <button
            v-for="(program, slot) in programs"
            :key="`prog-${slot}`"
            type="button"
            class="backup-row"
            :class="{ selected: slot === selectedProgramSlot }"
            role="option"
            :aria-selected="slot === selectedProgramSlot"
            :disabled="loading"
            @click="selectedProgramSlot = slot"
          >
            <span class="backup-meta">
              <strong>{{ programTitle(slot) }}</strong>
              <small>{{ program.name.trim() || t('library.backupEmptyProgram') }}</small>
            </span>
          </button>
        </div>
      </section>
    </div>
    <template #actions>
      <v-btn variant="text" :disabled="loading" @click="open = false">{{ t('common.close') }}</v-btn>
      <v-btn :disabled="loading" @click="emit('load-all')">{{ t('library.backupLoadAll') }}</v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import type { SequenceState } from '@/types/sequence'
import type { SoundListProgram } from '@/utils/soundListBackup'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  programs: SoundListProgram[]
  sequences: SequenceState[]
  loading?: boolean
  errorMessage?: string
}>(), {
  loading: false,
  errorMessage: '',
})
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'load-program': [slot: number]
  'load-sequence': [slot: number]
  'load-with-program': [slot: number]
  'load-all': []
}>()
const { t } = useI18n()
const selectedSequenceSlot = ref(0)
const selectedProgramSlot = ref(0)
const open = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})
const selectedSequence = computed(() => props.sequences[selectedSequenceSlot.value] ?? null)
const selectedProgram = computed(() => props.programs[selectedProgramSlot.value] ?? null)

const sequenceTitle = (slot: number) =>
  t('library.backupSequenceLabel', { count: String(slot + 1).padStart(2, '0') })
const programTitle = (slot: number) => String(slot).padStart(2, '0')
const programName = (slot: number) =>
  props.programs[slot]?.name.trim() || t('library.backupEmptyProgram')
const linkedLabel = (programNo: number) => {
  const name = props.programs[programNo]?.name.trim() || t('library.backupEmptyProgram')
  return t('library.backupLinkedProgram', { slot: String(programNo).padStart(2, '0'), name })
}

watch(() => props.modelValue, openDialog => {
  if (!openDialog) return
  selectedSequenceSlot.value = 0
  selectedProgramSlot.value = 0
})
</script>

<style scoped>
.backup-browser { display: grid; gap: 20px; min-height: min(68vh, 640px); }
@media (min-width: 800px) {
  .backup-browser { grid-template-columns: 1fr 1fr; align-items: stretch; }
}
.backup-pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.backup-browser h3 { margin: 0 0 10px; color: var(--volca-accent); font-size: var(--volca-type-heading); }
.backup-selected {
  display: flex; align-items: center; gap: 12px; min-height: 72px; margin-bottom: 10px;
  padding: 10px 12px; border: 1px solid var(--volca-line-strong); border-radius: 10px;
  background: rgba(206,179,147,.1);
}
.backup-selected .backup-meta { min-width: 0; flex: 1; display: grid; gap: 2px; }
.backup-selected .backup-meta strong { font-size: var(--volca-type-heading); }
.backup-actions { display: flex; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.backup-list {
  flex: 1 1 auto; min-height: 280px; max-height: min(58vh, 560px); overflow-y: auto;
  border: 1px solid var(--volca-line); border-radius: 8px;
}
.backup-row {
  width: 100%; min-height: 44px; display: flex; align-items: center; gap: 8px; padding: 4px 12px;
  border: 0; border-top: 1px solid var(--volca-line); border-radius: 0;
  background: transparent; color: inherit; text-align: left; cursor: pointer;
}
.backup-row:first-child { border-top: 0; }
.backup-row:hover { background: rgba(206,179,147,.08); }
.backup-row.selected { background: rgba(206,179,147,.16); }
.backup-row:focus-visible { outline: 2px solid var(--volca-accent); outline-offset: -2px; }
.backup-row:disabled { cursor: default; }
.backup-meta { min-width: 0; flex: 1; display: grid; gap: 2px; padding: 6px 0; }
.backup-meta strong { overflow: hidden; color: var(--volca-text); font-size: var(--volca-type-body); text-overflow: ellipsis; white-space: nowrap; }
.backup-meta small { overflow: hidden; color: var(--volca-muted); font-size: var(--volca-type-label); text-overflow: ellipsis; white-space: nowrap; }
</style>
