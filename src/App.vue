<template>
  <v-app class="volca-app" @dragstart.prevent>
    <AppDialog v-model="ui.showInfo" :title="t('app.about')" max-width="440">
          <div class="about-identity">
            <img src="/app-icon.png" alt="" />
            <h2>{{ t('app.about') }}</h2>
            <span>{{ t('app.version', { version: '1.0.0' }) }}</span>
            <span>{{ t('app.license') }}</span>
            <small>{{ t('app.copyright') }}</small>
          </div>
          <div class="about-log-toggle">
            <span>{{ t('app.showLog') }}</span>
            <AppToggle v-model="ui.showLog" :aria-label="t('app.showLog')" />
          </div>
    </AppDialog>

    <AppProgressDialog :model-value="showProgramLoadModal" :title="t('app.loadingPrograms.title')"
      :description="t('app.loadingPrograms.description')" :value="programLoadProgress">
      <template #status>
        <div class="program-load-status">
          <span>{{ midiStore.currentProgramFetchProgress }}/64</span><strong>{{ currentProgramLoadName }}</strong>
        </div>
      </template>
    </AppProgressDialog>

    <AppDialog :model-value="showConnectionModal" :title="connectionTexts.title" max-width="560" persistent
      @update:model-value="onConnectionModalUpdate">
          <ol class="connection-steps">
            <li>{{ connectionTexts.step1 }}</li>
            <li>{{ connectionTexts.step2 }}</li>
            <li>{{ connectionTexts.step3 }}</li>
            <li>{{ connectionTexts.step4 }}</li>
          </ol>
          <p class="connection-note" :class="{ 'is-warn': connectionTexts.reloadWarn }">{{ connectionTexts.reloadHint }}</p>
        <template #actions>
          <v-btn
            variant="text"
            :disabled="midiStore.isSearching"
            @click="midiStore.reloadMidiDocument"
          >
            {{ connectionTexts.reloadMidi }}
          </v-btn>
          <v-btn
            :loading="midiStore.isSearching"
            @click="midiStore.reconnectMIDI"
          >
            {{ connectionTexts.reconnect }}
          </v-btn>
        </template>
    </AppDialog>

    <PageHintDialog />

    <v-main>
      <div class="app-layout">
        <AppSidebar />
        <main class="workspace">
          <v-window v-model="ui.activeTab" class="tool-window">
            <v-window-item value="sound-edit"><SoundEditTab /></v-window-item>
            <v-window-item value="dx7"><Dx7Tab /></v-window-item>
            <v-window-item value="sequencer"><SequencerTab /></v-window-item>
            <v-window-item value="library"><LibraryTab /></v-window-item>
          </v-window>
        </main>
      </div>
      <LogPanel v-if="ui.showLog" />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AppToggle from './components/AppToggle.vue';
import AppSidebar from './components/AppSidebar.vue';
import LibraryTab from './components/LibraryTab.vue';
import PageHintDialog from './components/PageHintDialog.vue';
import AppDialog from './components/dialogs/AppDialog.vue';
import AppProgressDialog from './components/dialogs/AppProgressDialog.vue';
import LogPanel from './components/LogPanel.vue';
import SequencerTab from './features/sequence/components/SequencerTab.vue';
import SoundEditTab from './features/sound/components/SoundEditTab.vue';
import Dx7Tab from './features/dx7/Dx7Tab.vue';
import { useAppShell } from './composables/useAppShell';

const { t } = useI18n();
const {
  ui, midiStore, connectionTexts, showConnectionModal, onConnectionModalUpdate,
  showProgramLoadModal, programLoadProgress, currentProgramLoadName,
} = useAppShell();
</script>
