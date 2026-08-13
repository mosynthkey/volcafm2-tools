<template>
  <v-row align="center" no-gutters class="editor-toolbar">
    <v-col cols="auto" class="mr-4 editor-identity">
      <span class="editor-identity__label volca-section-title">{{ t('sound.voiceName') }}</span>
      <v-text-field v-model="program.name" :aria-label="t('sound.voiceName')" maxlength="10" counter="10"
        density="compact" hide-details class="voice-name-input" />
      <v-btn @click="midiStore.requestCurrentVoiceDump" :disabled="!midiStore.isDeviceReady"
        :loading="midiStore.soundEditState === 'requesting'">
        <HardDriveDownload :size="16" class="mr-1" />{{ t('sound.getCurrent') }}
      </v-btn>
    </v-col>
    <v-col cols="auto" class="editor-toolbar-section">
      <span class="editor-toolbar-section__label volca-section-title">{{ t('sound.sectionLabel') }}</span>
      <v-btn class="send-button" :class="{ 'needs-send': soundStore.hasUnsavedChanges }" @click="soundStore.sendToDevice"
        :disabled="!midiStore.isDeviceReady" :loading="midiStore.soundEditState === 'sending'">
        <HardDriveUpload :size="16" class="mr-1" />{{ t('common.send') }}
      </v-btn>
      <AutoSendToggle />
      <v-btn @click="soundStore.reset"><RotateCcw :size="16" class="mr-1" />{{ t('sound.initialize') }}</v-btn>
    </v-col>
    <v-spacer />
    <v-col cols="auto" class="editor-toolbar-section editor-library">
      <span class="editor-toolbar-section__label volca-section-title">{{ t('common.library') }}</span>
      <v-btn icon variant="text" :title="t('common.library')" :aria-label="t('common.library')" @click="soundStore.showLibrary = true">
        <Library :size="19" />
      </v-btn>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { HardDriveDownload, HardDriveUpload, Library, RotateCcw } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import AutoSendToggle from '@/components/AutoSendToggle.vue'
import { useMidiStore } from '@/stores/midiStore'
import { useSoundStore } from '@/stores/soundStore'

const { t } = useI18n()
const midiStore = useMidiStore()
const soundStore = useSoundStore()
const { program } = storeToRefs(soundStore)
</script>

<style scoped>
.voice-name-input { width: 210px; flex: 0 0 210px; }
.send-button.needs-send:not(:disabled) { animation: send-attention 2.8s cubic-bezier(.45, 0, .55, 1) infinite; }
@keyframes send-attention {
  0%, 100% { filter: brightness(1); box-shadow: 0 2px 8px rgba(206,179,147,.08); }
  50% { filter: brightness(1.14); box-shadow: 0 4px 18px rgba(225,202,176,.42); }
}
@media (prefers-reduced-motion: reduce) {
  .send-button.needs-send:not(:disabled) { animation: none; box-shadow: 0 3px 12px rgba(225,202,176,.3); filter: brightness(1.1); }
}
</style>
