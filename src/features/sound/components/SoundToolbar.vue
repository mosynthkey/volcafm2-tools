<template>
  <header class="editor-toolbar">
    <AppDialog v-model="showWriteConfirm" :title="t('sound.writeTitle')" max-width="480">
      <p>{{ writeDescription }}</p>
      <label class="app-skip-confirm">
        <input v-model="dontShowWriteAgain" type="checkbox" />
        <span>{{ t('common.dontShowAgain') }}</span>
      </label>
      <template #actions>
        <v-btn variant="text" @click="cancelWrite()">{{ t('common.cancel') }}</v-btn>
        <v-btn @click="confirmWrite()">{{ t('common.write') }}</v-btn>
      </template>
    </AppDialog>
    <AppDialog v-model="showNameHint" :title="t('sound.nameHintTitle')" max-width="480">
      <p class="name-hint-copy">{{ t('sound.nameHintDescription') }}</p>
      <label class="app-skip-confirm">
        <input v-model="dontShowNameHintAgain" type="checkbox" />
        <span>{{ t('common.dontShowAgain') }}</span>
      </label>
      <template #actions>
        <v-btn @click="confirmNameHint()">{{ t('common.ok') }}</v-btn>
      </template>
    </AppDialog>
    <AppErrorDialog v-model="showWriteError" :title="t('sound.writeTitle')" :message="writeError" />

    <div class="editor-identity">
      <span class="editor-identity__label volca-section-title">{{ t('sound.voiceName') }}</span>
      <v-text-field v-model="program.name" :aria-label="t('sound.voiceName')" maxlength="10"
        density="compact" hide-details class="voice-name-input"
        @focus="onNameFocus" @blur="onNameCommit" />
      <span class="program-slot" :class="{ 'is-empty': midiStore.matchedProgramNo === null }"
        :title="t('sound.programNo')">{{ programSlotLabel }}</span>
    </div>
    <div class="editor-toolbar-section">
      <span class="editor-toolbar-section__label volca-section-title">{{ t('sound.sectionLabel') }}</span>
      <ToolbarIconButton :label="t('sound.getCurrent')">
        <v-btn icon :disabled="!midiStore.isDeviceReady" :loading="midiStore.soundEditState === 'requesting'"
          :title="t('sound.getCurrent')" :aria-label="t('sound.getCurrent')"
          @click="midiStore.requestCurrentVoiceDump">
          <HardDriveUpload :size="16" />
        </v-btn>
      </ToolbarIconButton>
      <div class="send-auto-split">
        <ToolbarIconButton :label="t('common.send')">
          <v-btn icon class="send-button" :class="{ 'needs-send': soundStore.hasUnsavedChanges }"
            :disabled="!midiStore.isDeviceReady" :loading="midiStore.soundEditState === 'sending'"
            :title="t('common.send')" :aria-label="t('common.send')" @click="soundStore.sendToDevice">
            <HardDriveDownload :size="16" />
          </v-btn>
        </ToolbarIconButton>
        <ToolbarIconButton :label="t('common.autoSend')">
          <AutoSendToggle compact />
        </ToolbarIconButton>
      </div>
      <ToolbarIconButton :label="t('sound.write')">
        <v-btn icon :disabled="!canWrite" :loading="midiStore.programWriteState === 'sending'"
          :title="canWrite ? t('sound.write') : t('sound.writeNoSlot')" :aria-label="t('sound.write')"
          @click="requestWrite">
          <HardDrive :size="16" />
        </v-btn>
      </ToolbarIconButton>
      <ToolbarIconButton :label="t('sound.initialize')">
        <v-btn icon :title="t('sound.initialize')" :aria-label="t('sound.initialize')" @click="soundStore.reset">
          <RotateCcw :size="16" />
        </v-btn>
      </ToolbarIconButton>
    </div>
    <div class="editor-toolbar-spacer"></div>
    <LibrarySection kind="sound" page="sound" />
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { HardDrive, HardDriveDownload, HardDriveUpload, RotateCcw } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import AutoSendToggle from '@/components/AutoSendToggle.vue'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import AppErrorDialog from '@/components/dialogs/AppErrorDialog.vue'
import LibrarySection from '@/components/LibrarySection.vue'
import ToolbarIconButton from '@/components/ToolbarIconButton.vue'
import { SKIP_DEVICE_WRITE_PREF, SKIP_PROGRAM_NAME_HINT_PREF, useSkipConfirm } from '@/composables/useSkipConfirm'
import { useMidiStore } from '@/stores/midiStore'
import { useSoundStore } from '@/stores/soundStore'

const { t } = useI18n()
const midiStore = useMidiStore()
const soundStore = useSoundStore()
const { program } = storeToRefs(soundStore)
const {
  show: showWriteConfirm,
  dontShowAgain: dontShowWriteAgain,
  request: requestWriteConfirm,
  confirm: confirmWrite,
  cancel: cancelWrite,
} = useSkipConfirm(SKIP_DEVICE_WRITE_PREF)
const {
  show: showNameHint,
  dontShowAgain: dontShowNameHintAgain,
  notify: notifyNameHint,
  confirm: confirmNameHint,
} = useSkipConfirm(SKIP_PROGRAM_NAME_HINT_PREF)
const nameOnFocus = ref('')
const showWriteError = ref(false)
const writeError = ref('')
const programSlotLabel = computed(() =>
  midiStore.matchedProgramNo === null ? '—' : String(midiStore.matchedProgramNo).padStart(2, '0'))
const canWrite = computed(() =>
  midiStore.isIdleConnected
  && midiStore.matchedProgramNo !== null
  && midiStore.programWriteState !== 'sending')
const writeDescription = computed(() => t('sound.writeDescription', {
  slot: programSlotLabel.value,
  name: program.value.name.trim() || '—',
}))

const onNameFocus = () => {
  nameOnFocus.value = program.value.name
}

const onNameCommit = () => {
  if (program.value.name === nameOnFocus.value) return
  nameOnFocus.value = program.value.name
  notifyNameHint()
}

const requestWrite = () => {
  if (!canWrite.value) return
  requestWriteConfirm(() => { void runWrite() })
}

const runWrite = async () => {
  const slot = midiStore.matchedProgramNo
  const ok = await soundStore.writeToMatchedSlot()
  if (!ok) {
    writeError.value = t('sound.writeError', { slot: slot === null ? '—' : String(slot).padStart(2, '0') })
    showWriteError.value = true
  }
}
</script>

<style scoped>
.voice-name-input { width: 210px; flex: 0 0 210px; }
.name-hint-copy { margin: 0; white-space: pre-line; }
.program-slot {
  min-width: 2.4rem; color: var(--volca-accent-bright); font-variant-numeric: tabular-nums; font-weight: 700;
}
.program-slot.is-empty { color: #8f8180; font-weight: 500; }
.send-button.needs-send:not(:disabled) { animation: send-attention 2.8s cubic-bezier(.45, 0, .55, 1) infinite; }
@keyframes send-attention {
  0%, 100% { filter: brightness(1); box-shadow: 0 2px 8px rgba(206,179,147,.08); }
  50% { filter: brightness(1.14); box-shadow: 0 4px 18px rgba(225,202,176,.42); }
}
@media (prefers-reduced-motion: reduce) {
  .send-button.needs-send:not(:disabled) { animation: none; box-shadow: 0 3px 12px rgba(225,202,176,.3); filter: brightness(1.1); }
}
</style>
