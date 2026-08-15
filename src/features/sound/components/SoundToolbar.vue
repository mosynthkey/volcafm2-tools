<template>
  <header class="editor-toolbar">
    <div class="editor-identity">
      <span class="editor-identity__label volca-section-title">{{ t('sound.voiceName') }}</span>
      <v-text-field v-model="program.name" :aria-label="t('sound.voiceName')" maxlength="10"
        density="compact" hide-details class="voice-name-input" />
      <span class="program-slot" :class="{ 'is-empty': midiStore.matchedProgramNo === null }"
        :title="t('sound.programNo')">{{ programSlotLabel }}</span>
      <v-btn @click="midiStore.requestCurrentVoiceDump" :disabled="!midiStore.isDeviceReady"
        :loading="midiStore.soundEditState === 'requesting'">
        <HardDriveUpload :size="16" class="mr-1" />{{ t('sound.getCurrent') }}
      </v-btn>
    </div>
    <div class="editor-toolbar-section">
      <span class="editor-toolbar-section__label volca-section-title">{{ t('sound.sectionLabel') }}</span>
      <v-btn class="send-button" :class="{ 'needs-send': soundStore.hasUnsavedChanges }" @click="soundStore.sendToDevice"
        :disabled="!midiStore.isDeviceReady" :loading="midiStore.soundEditState === 'sending'">
        <HardDriveDownload :size="16" class="mr-1" />{{ t('common.send') }}
      </v-btn>
      <AutoSendToggle />
      <v-btn @click="soundStore.reset"><RotateCcw :size="16" class="mr-1" />{{ t('sound.initialize') }}</v-btn>
    </div>
    <div class="editor-toolbar-spacer"></div>
    <LibrarySection kind="sound" page="sound" />
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { HardDriveDownload, HardDriveUpload, RotateCcw } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import AutoSendToggle from '@/components/AutoSendToggle.vue'
import LibrarySection from '@/components/LibrarySection.vue'
import { useMidiStore } from '@/stores/midiStore'
import { useSoundStore } from '@/stores/soundStore'

const { t } = useI18n()
const midiStore = useMidiStore()
const soundStore = useSoundStore()
const { program } = storeToRefs(soundStore)
const programSlotLabel = computed(() =>
  midiStore.matchedProgramNo === null ? '—' : String(midiStore.matchedProgramNo).padStart(2, '0'))
</script>

<style scoped>
.voice-name-input { width: 210px; flex: 0 0 210px; }
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
