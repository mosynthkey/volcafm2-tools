<template>
  <v-app class="volca-app" @dragstart.prevent>
    <AppDialog v-model="ui.showInfo" :title="t('app.about')" max-width="640">
          <div class="about-identity">
            <img src="/app-icon.png" alt="" />
            <h2>{{ t('app.about') }}</h2>
            <span>{{ t('app.version', { version: '2.3.0' }) }}</span>
            <span>{{ t('app.license') }}</span>
            <small>{{ t('app.copyright') }}</small>
            <small>{{ t('app.dexedPreview') }}</small>
            <a class="about-changelog" href="https://github.com/mosynthkey/volcafm2-tools/releases"
              target="_blank" rel="noopener noreferrer">{{ t('app.changelogLink') }}</a>
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

    <AppProgressDialog :model-value="showSequenceLoadModal" :title="t('app.loadingSequences.title')"
      :description="t('app.loadingSequences.description')" :value="sequenceLoadProgress">
      <template #status>
        <div class="program-load-status">
          <span>{{ sequenceLoadStatus }}</span>
        </div>
      </template>
    </AppProgressDialog>

    <AppDialog :model-value="showConnectionModal" :title="connectionTexts.title" max-width="560" persistent
      @update:model-value="onConnectionModalUpdate">
          <section v-if="showDesktopDownload" class="connection-issue">
            <h3>{{ t('hint.knownIssue') }}</h3>
            <p>{{ connectionTexts.desktopHint }}</p>
            <a class="connection-desktop-link" :href="desktopAppDownloadUrl"
              target="_blank" rel="noopener noreferrer">{{ connectionTexts.desktopDownload }}</a>
          </section>
          <ol class="connection-steps">
            <li>{{ connectionTexts.step1 }}</li>
            <li>{{ connectionTexts.step2 }}</li>
            <li>{{ connectionTexts.step3 }}</li>
          </ol>
        <template #actions>
          <v-btn variant="text" @click="showTroubleshoot = true">
            {{ connectionTexts.troubleshoot }}
          </v-btn>
          <v-btn
            :loading="midiStore.isSearching"
            @click="midiStore.reconnectMIDI"
          >
            {{ connectionTexts.retry }}
          </v-btn>
        </template>
    </AppDialog>

    <MidiTroubleshootDialog v-model="showTroubleshoot" />

    <PageHintDialog />
    <SequencePreviewHintDialog />

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
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AppToggle from './components/AppToggle.vue';
import AppSidebar from './components/AppSidebar.vue';
import LibraryTab from './components/LibraryTab.vue';
import PageHintDialog from './components/PageHintDialog.vue';
import SequencePreviewHintDialog from './components/SequencePreviewHintDialog.vue';
import AppDialog from './components/dialogs/AppDialog.vue';
import AppProgressDialog from './components/dialogs/AppProgressDialog.vue';
import LogPanel from './components/LogPanel.vue';
import SequencerTab from './features/sequence/components/SequencerTab.vue';
import SoundEditTab from './features/sound/components/SoundEditTab.vue';
import Dx7Tab from './features/dx7/Dx7Tab.vue';
import { useAppShell } from './composables/useAppShell';
import MidiTroubleshootDialog from './components/MidiTroubleshootDialog.vue';

const { t } = useI18n();
const showTroubleshoot = ref(false);
const {
  ui, midiStore, connectionTexts, showConnectionModal, onConnectionModalUpdate,
  showDesktopDownload, desktopAppDownloadUrl,
  showProgramLoadModal, programLoadProgress, currentProgramLoadName,
  showSequenceLoadModal, sequenceLoadProgress, sequenceLoadStatus,
} = useAppShell();
</script>
