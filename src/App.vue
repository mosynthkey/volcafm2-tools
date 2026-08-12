<template>
  <v-app class="volca-app">
    <AppDialog v-model="showInfo" title="volca fm2 tools" max-width="440">
          {{ t('app.description') }}<br><br>
          Version 1.0.0<br>
          Copyright (c) 2025, Masaki Ono.
          <div class="about-log-toggle">
            <span>{{ t('app.showLog') }}</span>
            <AppToggle v-model="showLog" :aria-label="t('app.showLog')" />
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

    <AppDialog :model-value="showConnectionModal" :title="connectionTexts.title" max-width="560" persistent :closable="false">
        <div class="connection-card__icon" aria-hidden="true">
          <Piano :size="22" />
        </div>
          <ol class="connection-steps">
            <li>{{ connectionTexts.step1 }}</li>
            <li>{{ connectionTexts.step2 }}</li>
            <li>{{ connectionTexts.step3 }}</li>
          </ol>
        <template #actions>
          <v-btn
            :loading="midiStore.connectionState === MIDIConnectionState.SEARCHING || midiStore.connectionState === MIDIConnectionState.INITIALIZING"
            @click="midiStore.detectVolcaFM2"
          >
            {{ connectionTexts.retry }}
          </v-btn>
        </template>
    </AppDialog>

    <v-main>
      <div class="app-layout">
        <aside class="sidebar" :class="{ 'is-collapsed': sidebarCollapsed }">
          <div class="sidebar-heading">
            <div class="sidebar-label">{{ t('app.tools') }}</div>
            <button class="sidebar-toggle" type="button" :aria-label="sidebarToggleLabel"
              :title="sidebarToggleLabel" @click="sidebarCollapsed = !sidebarCollapsed">
              <PanelLeftOpen v-if="sidebarCollapsed" :size="18" />
              <PanelLeftClose v-else :size="18" />
            </button>
          </div>
          <div class="sidebar-rule" />
          <button class="nav-item" :class="{ active: activeTab === 'sound-edit' }" type="button" @click="activeTab = 'sound-edit'">
            <span class="nav-icon"><SlidersHorizontal :size="18" /></span>
            <span><b>Sound</b><small>{{ t('app.nav.sound') }}</small></span>
          </button>
          <button class="nav-item" :class="{ active: activeTab === 'sequencer' }" type="button" @click="activeTab = 'sequencer'">
            <span class="nav-icon"><Piano :size="18" /></span>
            <span><b>Sequence</b><small>{{ t('app.nav.sequence') }}</small></span>
          </button>
          <button class="nav-item" :class="{ active: activeTab === 'dx7' }" type="button" @click="activeTab = 'dx7'">
            <span class="nav-icon"><Download :size="18" /></span>
            <span><b>DX7</b><small>{{ t('app.nav.dx7') }}</small></span>
          </button>
          <div class="sidebar-fill" />
          <div class="sidebar-footer">
            <div class="midi-state" :class="`is-${connectionTone}`">
              <span class="status-light" />
              <span>{{ connectionLabel }}</span>
            </div>
            <div class="sidebar-meta">
              <img class="brand-mark" src="/app-icon.png" alt="volca fm2 tools" />
              <button class="about-button" type="button" @click="showInfo = true">
                <Info :size="17" />
                <span>{{ t('app.about') }}</span>
              </button>
            </div>
          </div>
        </aside>

        <main class="workspace">
          <v-window v-model="activeTab" class="tool-window">
            <v-window-item value="dx7"><Dx7Tab /></v-window-item>
            <v-window-item value="sequencer"><SequencerTab /></v-window-item>
            <v-window-item value="sound-edit"><SoundEditTab /></v-window-item>
          </v-window>
        </main>
      </div>
      <LogPanel v-if="showLog" />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download, Info, PanelLeftClose, PanelLeftOpen, Piano, SlidersHorizontal } from '@lucide/vue';
import Dx7Tab from './components/Dx7Tab.vue';
import AppToggle from './components/AppToggle.vue';
import AppDialog from './components/dialogs/AppDialog.vue';
import AppProgressDialog from './components/dialogs/AppProgressDialog.vue';
import LogPanel from './components/LogPanel.vue';
import SequencerTab from './components/SequencerTab.vue';
import SoundEditTab from './components/SoundEditTab.vue';
import { MIDIConnectionState, useMidiStore } from './stores/midiStore';
import { useSequencerStore } from './stores/sequencerStore';

const midiStore = useMidiStore();
const sequencerStore = useSequencerStore();
const { t } = useI18n();
const showInfo = ref(false);
const showLog = ref(false);
const activeTab = ref('sound-edit');
const sidebarCollapsed = ref(false);
const sidebarToggleLabel = computed(() => sidebarCollapsed.value
  ? t('app.expandSidebar')
  : t('app.collapseSidebar'));

let unsubscribeProgramChange: (() => void) | null = null;
onMounted(() => {
  unsubscribeProgramChange = midiStore.onProgramChange(programNo => { sequencerStore.programNo = Math.min(63, programNo); });
  void midiStore.initMIDI();
});
onUnmounted(() => unsubscribeProgramChange?.());

watch([activeTab, () => midiStore.connectionState], ([tab, connectionState]) => {
  if (tab === 'sequencer' && connectionState === MIDIConnectionState.RECEIVED) {
    void midiStore.requestCurrentVoiceProgramNo();
  }
});
watch(() => midiStore.matchedProgramNo, programNo => {
  if (programNo !== null) sequencerStore.programNo = programNo;
});

const connectionTexts = computed(() => ({
  title: t('app.connection.title'), step1: t('app.connection.step1'), step2: t('app.connection.step2'),
  step3: t('app.connection.step3'), retry: t('app.connection.retry'),
}));
const showConnectionModal = computed(() => !(
  midiStore.connectionState === MIDIConnectionState.DETECTED ||
  midiStore.connectionState === MIDIConnectionState.RECEIVING ||
  midiStore.connectionState === MIDIConnectionState.RECEIVED
));
const showProgramLoadModal = computed(() => midiStore.connectionState === MIDIConnectionState.RECEIVING
  && midiStore.currentProgramFetchProgress < 64);
const programLoadProgress = computed(() => (midiStore.currentProgramFetchProgress / 64) * 100);
const currentProgramLoadName = computed(() => midiStore.lastReceivedProgram
  ? `#${String(midiStore.lastReceivedProgram.programNo).padStart(2, '0')}  ${midiStore.lastReceivedProgram.name || '---'}`
  : t('app.loadingPrograms.waiting'));

const connectionLabel = computed(() => t({
  [MIDIConnectionState.INITIALIZING]: 'app.connection.initializing', [MIDIConnectionState.SEARCHING]: 'app.connection.searching',
  [MIDIConnectionState.NOT_FOUND]: 'app.connection.disconnected', [MIDIConnectionState.DETECTED]: 'app.connection.connected',
  [MIDIConnectionState.RECEIVING]: 'app.connection.receiving', [MIDIConnectionState.RECEIVED]: 'app.connection.connected',
  [MIDIConnectionState.ERROR]: 'app.connection.error',
}[midiStore.connectionState]));
const connectionTone = computed(() => {
  if (midiStore.connectionState === MIDIConnectionState.DETECTED || midiStore.connectionState === MIDIConnectionState.RECEIVED) return 'connected';
  if (midiStore.connectionState === MIDIConnectionState.SEARCHING || midiStore.connectionState === MIDIConnectionState.RECEIVING) return 'busy';
  if (midiStore.connectionState === MIDIConnectionState.ERROR) return 'error';
  return 'idle';
});
</script>

<style>
:root {
  color-scheme: dark;
  --volca-bg: #211a1b;
  --volca-panel: rgba(56, 43, 45, 0.78);
  --volca-panel-solid: #382b2d;
  --volca-raised: #463638;
  --volca-line: rgba(206, 179, 147, 0.15);
  --volca-line-strong: rgba(206, 179, 147, 0.3);
  --volca-accent: #ceb393;
  --volca-accent-bright: #e1cab0;
  --volca-accent-soft: rgba(206, 179, 147, 0.12);
  --volca-text: #f1e9e1;
  --volca-muted: #a99a91;
  --volca-type-label: 14px;
  --volca-type-body: 14px;
  --volca-type-heading: 18px;
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: var(--volca-type-body);
  font-optical-sizing: auto;
}

html, body, #app { margin: 0; min-width: 760px; min-height: 100%; background: var(--volca-bg); }
body { overflow: hidden; }
.volca-app { background: radial-gradient(circle at 72% -20%, #594447 0, transparent 38%), var(--volca-bg) !important; color: var(--volca-text); }
.brand-mark { width: 40px; height: 40px; display: block; flex: 0 0 40px; object-fit: contain; }
.sidebar-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 42px; padding: 0 5px 8px 10px; }
.sidebar-toggle { width: 34px; height: 34px; display: grid; flex: 0 0 34px; place-items: center; padding: 0; border: 1px solid var(--volca-line); border-radius: 8px; background: transparent; color: var(--volca-muted); cursor: pointer; transition: color .18s ease, background .18s ease, transform .1s ease; }
.sidebar-toggle:hover { color: var(--volca-text); background: rgba(255,255,255,.055); }
.sidebar-toggle:active { transform: scale(.96); }
.sidebar-toggle:focus-visible { outline: 2px solid var(--volca-accent); outline-offset: 2px; }
.sidebar-rule { height: 1px; margin: 0 5px 13px; background: var(--volca-line); }
.midi-state { display: flex; align-items: center; gap: 9px; min-height: 38px; padding: 7px 10px; border: 1px solid var(--volca-line); border-radius: 9px; color: var(--volca-muted); background: rgba(255,255,255,.025); font-size: var(--volca-type-body); font-weight: 600; }
.status-light, .device-dot { width: 7px; height: 7px; border-radius: 50%; background: #746769; box-shadow: 0 0 0 3px rgba(116,103,105,.12); }
.midi-state.is-connected .status-light { background: #9fc592; box-shadow: 0 0 0 3px rgba(159,197,146,.12); }
.midi-state.is-busy .status-light { background: var(--volca-accent); animation: status-pulse 1.2s ease-in-out infinite; }
.midi-state.is-error .status-light { background: #d7786f; }
.nav-item:active, .about-button:active { transform: scale(.97); }
.volca-app .v-main { height: 100vh; display: flex; flex-direction: column; padding: 0 !important; }
.app-layout { display: flex; min-height: 0; flex: 1 1 auto; }
.sidebar { width: 256px; flex: 0 0 256px; display: flex; flex-direction: column; gap: 5px; padding: 14px 11px 12px; border-right: 1px solid var(--volca-line); background: rgba(42,32,33,.68); backdrop-filter: blur(24px) saturate(135%); transition: width .2s ease, flex-basis .2s ease; }
.sidebar.is-collapsed { width: 76px; flex-basis: 76px; }
.sidebar.is-collapsed .sidebar-heading { justify-content: center; padding-inline: 0; }
.sidebar.is-collapsed .sidebar-label,
.sidebar.is-collapsed .nav-item > span:last-child,
.sidebar.is-collapsed .midi-state > span:last-child,
.sidebar.is-collapsed .about-button span { display: none; }
.sidebar.is-collapsed .sidebar-meta { flex-direction: column; }
.sidebar.is-collapsed .nav-item,
.sidebar.is-collapsed .about-button,
.sidebar.is-collapsed .midi-state { justify-content: center; padding: 8px; }
.sidebar-label { color: #9b8d8d; font-size: var(--volca-type-label); font-weight: 750; letter-spacing: .12em; }
.nav-item { width: 100%; display: flex; align-items: center; gap: 11px; min-height: 62px; padding: 9px 11px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--volca-muted); text-align: left; cursor: pointer; transition: background .18s ease, border-color .18s ease, color .18s ease, transform .1s ease; }
.nav-item:hover { color: var(--volca-text); background: rgba(255,255,255,.045); }
.nav-item:focus-visible, .about-button:focus-visible { outline: 2px solid var(--volca-accent); outline-offset: 2px; }
.nav-item.active { color: var(--volca-text); border-color: var(--volca-accent); background: rgba(206,179,147,.11); box-shadow: none; }
.nav-icon { width: 31px; height: 31px; display: grid; place-items: center; border-radius: 8px; background: rgba(255,255,255,.05); color: var(--volca-accent); }
.nav-item > span:last-child { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.nav-item b { font-size: var(--volca-type-body); font-weight: 650; }
.nav-item small { overflow: hidden; color: #aa9b9b; font-size: var(--volca-type-label); line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-fill { flex: 1; }
.sidebar-footer { display: grid; gap: 5px; margin: 4px; padding-top: 12px; border-top: 1px solid var(--volca-line); }
.sidebar-meta { display: flex; align-items: center; gap: 7px; padding: 3px 2px 0; }
.sidebar-meta .about-button { min-width: 0; flex: 1; }
.about-button { display: flex; align-items: center; gap: 9px; min-height: 38px; padding: 7px 10px; border: 0; border-radius: 9px; background: transparent; color: var(--volca-muted); font: inherit; font-size: var(--volca-type-body); font-weight: 600; text-align: left; cursor: pointer; transition: background .16s ease, color .16s ease, transform .1s ease; }
.about-button:hover { color: var(--volca-text); background: rgba(255,255,255,.055); }
.workspace { min-width: 0; flex: 1; overflow: hidden; }
.tool-window, .tool-window > .v-window__container, .tool-window .v-window-item { height: 100%; }
.tool-window .v-window-item { overflow: auto; }
.workspace .v-container { width: 100%; max-width: none; padding: 10px 12px 12px; box-sizing: border-box; }
.workspace .v-card { border: 1px solid var(--volca-line) !important; border-radius: 13px !important; background: var(--volca-panel) !important; box-shadow: 0 14px 35px rgba(9,5,6,.16) !important; backdrop-filter: blur(18px); color: var(--volca-text) !important; }
.volca-app .v-btn { height: 40px; min-height: 40px; }
.workspace .v-btn { border: 1px solid rgba(255,255,255,.08); border-radius: 8px; background: var(--volca-accent) !important; color: #33282a !important; box-shadow: inset 0 1px rgba(255,255,255,.28), 0 3px 10px rgba(0,0,0,.16) !important; font-size: var(--volca-type-body); font-weight: 700; letter-spacing: .005em; text-transform: none; }
.workspace .v-btn:hover { background: var(--volca-accent-bright) !important; }
.workspace .v-btn:active { transform: scale(.98); }
.workspace .v-field { border-radius: 8px !important; background: rgba(20,15,16,.38); font-size: var(--volca-type-body); }
.workspace .v-label { font-size: var(--volca-type-label); }
.workspace .v-divider { border-color: var(--volca-line); opacity: 1; }
.workspace .v-card-title { font-size: var(--volca-type-heading); font-weight: 650; letter-spacing: -.01em; }
.v-overlay__content > .v-card { padding: 0 !important; overflow: hidden; border: 1px solid var(--volca-line-strong) !important; border-radius: 16px !important; background: #382b2d !important; color: var(--volca-text) !important; box-shadow: 0 24px 70px rgba(10,5,6,.5) !important; }
.v-overlay__content > .v-card .v-card-title { padding: 20px 20px 10px; font-size: var(--volca-type-heading); font-weight: 680; letter-spacing: -.02em; }
.dialog-title-row { display: flex; align-items: center; justify-content: space-between; }
.v-overlay__content > .v-card > .v-card-text { padding: 10px 20px 20px; color: #d8ccc4; font-size: var(--volca-type-body); line-height: 1.65; }
.v-overlay__content > .v-card > .v-card-actions { gap: 8px; padding: 0 20px 18px; }
.v-overlay__content > .v-card .v-btn { height: 40px; min-height: 40px; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; background: var(--volca-accent) !important; color: #33282a !important; box-shadow: inset 0 1px rgba(255,255,255,.28) !important; font-size: var(--volca-type-body); font-weight: 700; letter-spacing: 0; text-transform: none; }
.v-overlay__content > .v-card .dialog-close-button { width: 40px; min-width: 40px; margin: 12px 12px 0 0; border: 0; background: transparent !important; color: var(--volca-muted) !important; box-shadow: none !important; }
.v-overlay__content > .v-card .dialog-close-button:hover { background: rgba(255,255,255,.07) !important; color: var(--volca-text) !important; }
.v-overlay__content > .v-card .library-delete-button { width: 40px; min-width: 40px; border: 0; background: transparent !important; color: var(--volca-muted) !important; box-shadow: none !important; }
.v-overlay__content > .v-card .library-delete-button:hover { background: rgba(255,255,255,.07) !important; color: var(--volca-text) !important; }
.about-card, .program-load-card, .connection-card { background: #382b2d !important; }
.connection-card__icon { width: 44px; height: 44px; display: grid; place-items: center; margin: 20px 20px 8px; border: 1px solid var(--volca-line-strong); border-radius: 12px; background: var(--volca-accent-soft); color: var(--volca-accent-bright); }
.connection-card .v-card-text { line-height: 1.75; }
.connection-steps { display: grid; gap: 8px; margin: 0; padding-left: 1.4rem; }
.connection-steps li { padding-left: 4px; }
.connection-card .v-card-actions { padding-top: 12px; }
.program-load-copy { margin: 0 0 16px; color: #d8ccc4; }
.program-load-status { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 12px; color: var(--volca-muted); font-variant-numeric: tabular-nums; }
.program-load-status strong { overflow: hidden; color: var(--volca-text); text-overflow: ellipsis; white-space: nowrap; }
.about-log-toggle { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--volca-line); }
@keyframes status-pulse { 50% { opacity: .45; transform: scale(.82); } }
@media (max-width: 900px) { .sidebar { width: 76px; flex-basis: 76px; } .sidebar-heading { justify-content: center; padding-inline: 0; } .sidebar-label, .nav-item > span:last-child, .midi-state > span:last-child, .about-button span { display: none; } .sidebar-meta { flex-direction: column; } .nav-item, .about-button, .midi-state { justify-content: center; padding: 8px; } .workspace .v-container { padding: 8px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation: none !important; transition-duration: .01ms !important; } }
@media (prefers-reduced-transparency: reduce) { .sidebar, .workspace .v-card { backdrop-filter: none; background: var(--volca-panel-solid) !important; } }
</style>
