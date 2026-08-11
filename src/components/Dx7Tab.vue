<template>
  <v-container>
    <v-card v-if="hasDevice" class="mb-4 pa-4" style="margin: 0 auto;">
      <div class="text-center mb-4">
        <v-card-title v-html="currentStatusAsText"></v-card-title>
      </div>
      <v-row justify="center" align="center">
        <v-col cols="auto">
          <v-btn
            v-if="midiStore.connectionState === MIDIConnectionState.DETECTED || midiStore.connectionState === MIDIConnectionState.RECEIVED"
            @click="midiStore.requestProgramDump"> {{ buttonTexts.receive }}
          </v-btn>
        </v-col>
        <v-col cols="auto">
          <v-progress-circular
            v-if="midiStore.connectionState === MIDIConnectionState.RECEIVING || midiStore.connectionState === MIDIConnectionState.SEARCHING"
            indeterminate color="#CEB393" class="ml-2"></v-progress-circular>
        </v-col>
      </v-row>
    </v-card>

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

const hasDevice = computed(() =>
  midiStore.connectionState === MIDIConnectionState.DETECTED ||
  midiStore.connectionState === MIDIConnectionState.RECEIVING ||
  midiStore.connectionState === MIDIConnectionState.RECEIVED
);

const userLanguage = navigator.language.startsWith('ja') ? 'ja' : 'en';

const CONNECTION_MESSAGES = {
  ja: {
    [MIDIConnectionState.INITIALIZING]: 'MIDIを初期化中...',
    [MIDIConnectionState.SEARCHING]: 'volca fm2を検索中...',
    [MIDIConnectionState.NOT_FOUND]: 'volca fm2が見つかりません。<br>1. mac/PCと繋がっているMIDIインターフェースにvolca fm2のMIDI IN/OUTを両方接続してください。<br>2. Chromeブラウザから本アプリにアクセスしてください。<br>3. MIDI接続の許可ダイアログが表示されますので、許可を選択してください。',
    [MIDIConnectionState.DETECTED]: 'volca fm2が検出されました。',
    [MIDIConnectionState.RECEIVING]: 'プログラムを受信中...',
    [MIDIConnectionState.RECEIVED]: 'すべてのプログラムを受信しました！',
    [MIDIConnectionState.ERROR]: 'MIDIエラーが発生しました。接続を確認してください。',
  },
  en: {
    [MIDIConnectionState.INITIALIZING]: 'Initializing MIDI...',
    [MIDIConnectionState.SEARCHING]: 'Searching for volca fm2...',
    [MIDIConnectionState.NOT_FOUND]: 'volca fm2 not found.<br>1. Connect both MIDI IN/OUT of volca fm2 to the MIDI interface connected to your mac/PC.<br>2. Access this app from the Chrome browser.<br>3. A MIDI connection permission dialog will appear, please select allow.',
    [MIDIConnectionState.DETECTED]: 'volca fm2 detected.',
    [MIDIConnectionState.RECEIVING]: 'Receiving programs...',
    [MIDIConnectionState.RECEIVED]: 'All programs received!',
    [MIDIConnectionState.ERROR]: 'MIDI error occurred. Please check your connection.',
  }
};

const BUTTON_TEXTS = {
  ja: {
    detect: 'volca fm2を検出',
    receive: 'プログラムを受信',
    download: 'ダウンロード',
    close: '閉じる'
  },
  en: {
    detect: 'Detect volca fm2',
    receive: 'Receive all programs',
    download: 'Download',
    close: 'Close'
  }
};

const currentStatusAsText = computed(() => {
  return CONNECTION_MESSAGES[userLanguage][midiStore.connectionState];
});

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
