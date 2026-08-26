<template>
  <AppDialog v-model="showWriteConfirm" :title="t('sequence.writeTitle')" max-width="640">
    <p>{{ t('sequence.writeDescription') }}</p>
    <div class="write-slot-picker" role="radiogroup" :aria-label="t('sequence.writeSlot')">
      <button
        v-for="displaySlot in sequenceCount"
        :key="displaySlot"
        type="button"
        class="write-slot-btn"
        :class="{ selected: writeSlot === displaySlot - 1 }"
        role="radio"
        :aria-checked="writeSlot === displaySlot - 1"
        :aria-label="`${t('sequence.writeSlot')} ${displaySlot}`"
        @click="writeSlot = displaySlot - 1"
      >
        <span class="write-slot-btn__index">{{ displaySlot }}</span>
        <span class="write-slot-btn__led" aria-hidden="true" />
      </button>
    </div>
    <template #actions>
      <v-btn variant="text" @click="showWriteConfirm = false">{{ t('common.cancel') }}</v-btn>
      <v-btn @click="confirmWrite()">{{ t('common.write') }}</v-btn>
    </template>
  </AppDialog>
  <AppErrorDialog v-model="showWriteError" :title="t('sequence.writeTitle')" :message="writeError" />

  <v-row align="center" no-gutters class="editor-toolbar">
    <template v-if="sequence.stepInputActive">
      <v-col cols="auto"><v-btn icon :title="t('sequence.stepInputExit')" :aria-label="t('sequence.stepInputExit')" @click="sequence.toggleStepInput()"><X :size="18" /></v-btn></v-col>
      <v-col cols="auto" class="ml-3 step-input-status">{{ t('sequence.stepIndicator', { count: sequence.stepCursor + 1 }) }}</v-col>
      <v-col cols="auto" class="ml-3"><v-btn :disabled="!sequence.canInsertTie" @click="sequence.insertStepTie()">{{ t('sequence.tie') }}</v-btn></v-col>
      <v-col cols="auto" class="ml-2"><v-btn @click="sequence.insertStepRest()">{{ t('sequence.rest') }}</v-btn></v-col>
    </template>
    <template v-else>
      <v-col cols="auto" class="mr-4 editor-identity">
        <span class="editor-identity__label volca-section-title">{{ t('sequence.program') }}</span>
        <v-text-field v-model.number="sequence.programNo" type="number" :aria-label="t('sequence.program')" min="0" max="63" density="compact" hide-details class="program-no-input" />
        <span class="editor-identity__name" :class="{ 'is-empty': !currentProgramName }" :title="currentProgramName || t('sequence.programNameUnknown')">{{ currentProgramName || '—' }}</span>
      </v-col>
      <v-col cols="auto" class="editor-toolbar-section">
        <span class="editor-toolbar-section__label volca-section-title">{{ t('sequence.sectionLabel') }}</span>
        <ToolbarIconButton :label="t('sequence.captureButton')">
          <v-btn icon :disabled="!canSend" :loading="midi.sequenceReadState === 'requesting'"
            :title="t('sequence.captureButton')" :aria-label="t('sequence.captureButton')"
            @click="sequence.requestFromDevice()">
            <HardDriveUpload :size="16" />
          </v-btn>
        </ToolbarIconButton>
        <ToolbarIconButton :label="t('sequence.capturePerformanceButton')">
          <v-btn icon :disabled="!canSend" :title="t('sequence.capturePerformanceButton')"
            :aria-label="t('sequence.capturePerformanceButton')" @click="sequence.showCaptureDialog = true">
            <ListMusic :size="16" />
          </v-btn>
        </ToolbarIconButton>
        <div class="send-auto-split">
          <ToolbarIconButton :label="t('common.send')">
            <v-btn icon :disabled="!canSend" :title="t('common.send')" :aria-label="t('common.send')"
              @click="sequence.sendToDevice()">
              <HardDriveDownload :size="16" />
            </v-btn>
          </ToolbarIconButton>
          <ToolbarIconButton :label="t('common.autoSend')">
            <AutoSendToggle compact />
          </ToolbarIconButton>
        </div>
        <ToolbarIconButton :label="t('sequence.write')">
          <v-btn icon :disabled="!canWrite" :loading="midi.sequenceWriteState === 'sending'"
            :title="t('sequence.write')" :aria-label="t('sequence.write')" @click="requestWrite">
            <HardDrive :size="16" />
          </v-btn>
        </ToolbarIconButton>
        <ToolbarIconButton :label="t('sequence.clear')">
          <v-btn icon :title="t('sequence.clear')" :aria-label="t('sequence.clear')" @click="sequence.clearAll">
            <Trash2 :size="16" />
          </v-btn>
        </ToolbarIconButton>
        <ProgramPreviewButton toolbar preview-id="sequence-edit" :sequence="previewSequence" :voice="sound.program" />
        <ToolbarIconButton :label="t('sequence.stepInput')">
          <v-btn icon :title="t('sequence.stepInput')" :aria-label="t('sequence.stepInput')" @click="sequence.toggleStepInput()">
            <Piano :size="16" />
          </v-btn>
        </ToolbarIconButton>
        <ToolbarIconButton :label="t('sequence.randomize')">
          <div class="randomize-split">
            <v-btn icon class="randomize-main" :title="t('sequence.randomize')" :aria-label="t('sequence.randomize')"
              @click="sequence.requestRandomize()">
              <Dices :size="16" />
            </v-btn>
            <v-menu location="bottom end" offset="6">
              <template #activator="{ props: menuProps }">
                <v-btn v-bind="menuProps" class="randomize-menu-btn" icon :title="t('sequence.randomizeMore')"
                  :aria-label="t('sequence.randomizeMore')">
                  <ChevronDown :size="14" />
                </v-btn>
              </template>
              <v-list class="sequence-more-menu" density="compact">
                <v-list-item :title="t('sequence.randomizeNotes')" @click="sequence.randomizeSteps(Math.random, 'notes')" />
                <v-list-item :title="t('sequence.randomizeMotion')" @click="sequence.randomizeSteps(Math.random, 'motion')" />
                <v-list-item :title="t('sequence.reverseSequence')" @click="sequence.reverseSteps()" />
              </v-list>
            </v-menu>
          </div>
        </ToolbarIconButton>
        <ToolbarIconButton :label="t('common.more')">
          <v-menu location="bottom end" offset="6">
            <template #activator="{ props: menuProps }">
              <v-btn v-bind="menuProps" icon :title="t('common.more')" :aria-label="t('common.more')">
                <MoreHorizontal :size="18" />
              </v-btn>
            </template>
            <v-list class="sequence-more-menu" density="compact">
              <v-list-item :title="t('sequence.importSmf')" @click="fileInput?.click()">
                <template #prepend><FileUp :size="17" /></template>
              </v-list-item>
            </v-list>
          </v-menu>
        </ToolbarIconButton>
        <input ref="fileInput" type="file" accept=".mid,.midi" hidden @change="selectFile" />
      </v-col>
      <v-spacer />
      <v-col cols="auto">
        <LibrarySection kind="sequence" page="sequence" />
      </v-col>
    </template>
  </v-row>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, Dices, FileUp, HardDrive, HardDriveDownload, HardDriveUpload, ListMusic, MoreHorizontal, Piano, Trash2, X } from '@lucide/vue'
import AutoSendToggle from '@/components/AutoSendToggle.vue'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import AppErrorDialog from '@/components/dialogs/AppErrorDialog.vue'
import LibrarySection from '@/components/LibrarySection.vue'
import ProgramPreviewButton from '@/components/ProgramPreviewButton.vue'
import ToolbarIconButton from '@/components/ToolbarIconButton.vue'
import { useMidiStore } from '@/stores/midiStore'
import { useSequencerStore } from '@/stores/sequencerStore'
import { useSoundStore } from '@/stores/soundStore'
import { NUM_OF_SEQUENCES } from '@/types/sequence'
import { getPref, setPref } from '@/utils/appPrefs'
import { programDisplayName } from '@/utils/programDisplayName'

const SEQUENCE_WRITE_SLOT_PREF = 'lastSequenceWriteSlot'
const { t } = useI18n()
const midi = useMidiStore()
const sequence = useSequencerStore()
const sound = useSoundStore()
const fileInput = ref<HTMLInputElement | null>(null)
const sequenceCount = NUM_OF_SEQUENCES
const writeSlot = ref(0)
const showWriteConfirm = ref(false)
const showWriteError = ref(false)
const writeError = ref('')
const canSend = computed(() => midi.isIdleConnected)
const canWrite = computed(() => midi.isIdleConnected && midi.sequenceWriteState !== 'sending')
const currentProgramName = computed(() => {
  const slot = Number(sequence.programNo)
  return programDisplayName(slot, midi.matchedProgramNo, sound.program.name, midi.programNames[slot]?.name ?? '')
})
const previewSequence = computed(() => sequence.toState())

getPref<number>(SEQUENCE_WRITE_SLOT_PREF).then(value => {
  if (typeof value === 'number' && value >= 0 && value < NUM_OF_SEQUENCES) writeSlot.value = value
})

const clampedWriteSlot = () => Math.max(0, Math.min(NUM_OF_SEQUENCES - 1, Number(writeSlot.value) || 0))

const requestWrite = () => {
  if (!canWrite.value) return
  showWriteConfirm.value = true
}

const confirmWrite = () => {
  showWriteConfirm.value = false
  void runWrite()
}

const runWrite = async () => {
  const slot = clampedWriteSlot()
  writeSlot.value = slot
  setPref(SEQUENCE_WRITE_SLOT_PREF, slot).catch(() => undefined)
  const ok = await sequence.writeToSlot(slot)
  if (!ok) {
    writeError.value = t('sequence.writeError', { slot: String(slot + 1).padStart(2, '0') })
    showWriteError.value = true
  }
}

const selectFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) sequence.queueSmfImport(file)
  input.value = ''
}
</script>

<style scoped>
.step-input-status { color: var(--volca-accent-bright); font-weight: 750; font-variant-numeric: tabular-nums; }
.program-no-input { width: 72px; flex: 0 0 72px; }
.write-slot-picker {
  display: flex; gap: 4px; margin-top: 14px; padding: 10px 8px;
  border: 1px solid var(--volca-line-strong); border-radius: 10px; background: #1a1314;
}
.write-slot-btn {
  display: flex; flex: 1 1 0; flex-direction: column; align-items: center; justify-content: flex-start;
  gap: 0; min-width: 0; height: 56px; padding: 6px 2px 5px;
  border: 1px solid rgba(51, 40, 42, .35); border-radius: 5px;
  background: var(--volca-accent);
  box-shadow: inset 0 1px rgba(255, 255, 255, .28), 0 2px 4px rgba(0, 0, 0, .28);
  color: var(--volca-ink); cursor: pointer;
}
.write-slot-btn__index {
  font-size: 12px; font-weight: 750; font-variant-numeric: tabular-nums; line-height: 1;
}
.write-slot-btn__led {
  width: 7px; height: 7px; margin-top: auto; border-radius: 50%;
  background: rgba(51, 40, 42, .35); box-shadow: inset 0 1px 2px rgba(0, 0, 0, .35);
}
.write-slot-btn:hover { background: var(--volca-accent-bright); }
.write-slot-btn:focus-visible { outline: 2px solid var(--volca-accent-bright); outline-offset: 2px; }
.write-slot-btn.selected {
  border-color: rgba(80, 221, 213, .65);
  box-shadow:
    inset 0 1px rgba(255, 255, 255, .28),
    0 0 0 1px rgba(80, 221, 213, .22),
    0 2px 6px rgba(0, 0, 0, .35);
}
.write-slot-btn.selected .write-slot-btn__led {
  background: var(--volca-teal);
  box-shadow: 0 0 8px rgba(80, 221, 213, .75), inset 0 1px rgba(255, 255, 255, .35);
}
.sequence-more-menu { min-width: 220px; border: 1px solid rgba(206,179,147,.28); border-radius: 10px; background: #2b2022; color: var(--volca-text); }
.randomize-split { display: inline-flex; align-items: stretch; }
.randomize-split :deep(.randomize-main) { border-top-right-radius: 0 !important; border-bottom-right-radius: 0 !important; }
.randomize-split :deep(.randomize-menu-btn) {
  width: 22px; min-width: 22px;
  border-top-left-radius: 0 !important; border-bottom-left-radius: 0 !important;
  box-shadow: inset 1px 0 rgba(51,40,42,.22), inset 0 1px rgba(255,255,255,.28), 0 3px 10px rgba(0,0,0,.16) !important;
}
</style>
