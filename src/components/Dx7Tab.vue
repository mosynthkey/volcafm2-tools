<template>
  <v-container>
    <div
      v-if="midiStore.connectionState === MIDIConnectionState.DETECTED || midiStore.connectionState === MIDIConnectionState.RECEIVING || midiStore.connectionState === MIDIConnectionState.RECEIVED">
      <v-divider class="my-4" />

      <v-card v-for="(cartridge, index) in 2" :key="index" class="mb-4 pa-4" style="margin: 0 auto;">
        <v-row align="center">
          <v-col>
            <v-card-title>Cartridge {{ index + 1 }}</v-card-title>
          </v-col>
          <v-col class="text-right">
            <v-btn @click="midiStore.downloadSysEx(index === 0)"
              :disabled="midiStore.connectionState !== MIDIConnectionState.RECEIVED"
              :class="{ dimmed: midiStore.connectionState !== MIDIConnectionState.RECEIVED }">
              {{ buttonTexts.download }}
              <Download :size="16" class="ml-1" />
            </v-btn>
          </v-col>
        </v-row>
        <v-divider class="my-4" />
        <v-row v-for="row in 4" :key="row">
          <v-col v-for="col in 8" :key="col" class="text-left"
            :class="{ 'dimmed-text': !midiStore.programNames[(index * 32) + (row - 1) * 8 + (col - 1)]?.name }">
            {{ (index * 32) + (row - 1) * 8 + (col - 1) }}:<br>
            {{ midiStore.programNames[(index * 32) + (row - 1) * 8 + (col - 1)]?.name || '-' }}
          </v-col>
        </v-row>
      </v-card>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useMidiStore, MIDIConnectionState } from '@/stores/midiStore';
import { Download } from '@lucide/vue';

const midiStore = useMidiStore();

const userLanguage = navigator.language.startsWith('ja') ? 'ja' : 'en';

const BUTTON_TEXTS = {
  ja: {
    detect: 'volca fm2を検出',
    download: 'ダウンロード',
    close: '閉じる'
  },
  en: {
    detect: 'Detect volca fm2',
    download: 'Download',
    close: 'Close'
  }
};

const buttonTexts = computed(() => {
  return BUTTON_TEXTS[userLanguage];
});
</script>

<style scoped>
.v-btn.dimmed {
  opacity: 0.5;
  pointer-events: none;
}

.mb-4 {
  margin-bottom: 16px;
}

.pa-4 {
  padding: 16px;
}

.dimmed-text {
  opacity: 0.5;
}
</style>
