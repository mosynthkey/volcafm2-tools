<template>
  <v-app class="volca-app">
    <v-dialog v-model="showInfo" max-width="440">
      <v-card class="about-card">
        <v-card-title>volca fm2 tool</v-card-title>
        <v-card-text>
          DX7 SysEx conversion and volca fm2 sequence editing in one workspace.<br><br>
          Version 1.0.0<br>
          Copyright (c) 2025, Masaki Ono.
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="showInfo = false">Close</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      :model-value="showConnectionModal"
      max-width="560"
      persistent
      no-click-animation
    >
      <v-card class="connection-card">
        <div class="connection-card__icon" aria-hidden="true">
          <Piano :size="22" />
        </div>
        <v-card-title>{{ connectionTexts.title }}</v-card-title>
        <v-card-text>
          <ol class="connection-steps">
            <li>{{ connectionTexts.step1 }}</li>
            <li>{{ connectionTexts.step2 }}</li>
            <li>{{ connectionTexts.step3 }}</li>
          </ol>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            :loading="midiStore.connectionState === MIDIConnectionState.SEARCHING || midiStore.connectionState === MIDIConnectionState.INITIALIZING"
            @click="midiStore.detectVolcaFM2"
          >
            {{ connectionTexts.retry }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-main>
      <div class="app-layout">
        <aside class="sidebar" :class="{ 'is-collapsed': sidebarCollapsed }">
          <div class="sidebar-brand">
            <div class="brand-mark" aria-hidden="true"><span>FM</span><b>2</b></div>
            <div class="brand-copy">
              <h1>volca fm2 tool</h1>
            </div>
            <button class="sidebar-toggle" type="button" :aria-label="sidebarToggleLabel"
              :title="sidebarToggleLabel" @click="sidebarCollapsed = !sidebarCollapsed">
              <PanelLeftOpen v-if="sidebarCollapsed" :size="18" />
              <PanelLeftClose v-else :size="18" />
            </button>
          </div>
          <div class="sidebar-rule" />
          <div class="sidebar-label">TOOLS</div>
          <button class="nav-item" :class="{ active: activeTab === 'dx7' }" type="button" @click="activeTab = 'dx7'">
            <span class="nav-icon"><Download :size="18" /></span>
            <span><b>DX7 SysEx</b><small>{{ navTexts.dx7 }}</small></span>
          </button>
          <button class="nav-item" :class="{ active: activeTab === 'sequencer' }" type="button" @click="activeTab = 'sequencer'">
            <span class="nav-icon"><Piano :size="18" /></span>
            <span><b>Sequencer</b><small>{{ navTexts.sequencer }}</small></span>
          </button>
          <button class="nav-item" :class="{ active: activeTab === 'sound-edit' }" type="button" @click="activeTab = 'sound-edit'">
            <span class="nav-icon"><SlidersHorizontal :size="18" /></span>
            <span><b>Sound Edit</b><small>{{ navTexts.soundEdit }}</small></span>
          </button>
          <div class="sidebar-fill" />
          <div class="sidebar-footer">
            <div class="midi-state" :class="`is-${connectionTone}`">
              <span class="status-light" />
              <span>{{ connectionLabel }}</span>
            </div>
            <button class="about-button" type="button" @click="showInfo = true">
              <Info :size="17" />
              <span>About</span>
            </button>
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
      <LogPanel />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Download, Info, PanelLeftClose, PanelLeftOpen, Piano, SlidersHorizontal } from '@lucide/vue';
import Dx7Tab from './components/Dx7Tab.vue';
import LogPanel from './components/LogPanel.vue';
import SequencerTab from './components/SequencerTab.vue';
import SoundEditTab from './components/SoundEditTab.vue';
import { MIDIConnectionState, useMidiStore } from './stores/midiStore';

const midiStore = useMidiStore();
const showInfo = ref(false);
const activeTab = ref('dx7');
const sidebarCollapsed = ref(false);
const userLanguage = navigator.language.startsWith('ja') ? 'ja' : 'en';
const sidebarToggleLabel = computed(() => sidebarCollapsed.value
  ? (userLanguage === 'ja' ? '左ペインを広げる' : 'Expand sidebar')
  : (userLanguage === 'ja' ? '左ペインを小さくする' : 'Collapse sidebar'));

onMounted(() => midiStore.initMIDI());

const NAV_TEXTS = {
  ja: { dx7: '音色をDX7 SysExに変換', sequencer: 'シーケンスを編集', soundEdit: '音色を編集' },
  en: { dx7: 'Receive & convert patches', sequencer: 'Edit the 16-step pattern', soundEdit: 'Edit the current voice' },
};
const navTexts = computed(() => NAV_TEXTS[userLanguage]);

const CONNECTION_TEXTS = {
  ja: {
    title: 'volca fm2が見つかりません。',
    step1: 'mac/PCと繋がっているMIDIインターフェースにvolca fm2のMIDI IN/OUTを両方接続してください。',
    step2: 'Chromeブラウザから本アプリにアクセスしてください。',
    step3: 'MIDI接続の許可ダイアログが表示されますので、許可を選択してください。',
    retry: 'volca fm2を再検出',
  },
  en: {
    title: 'volca fm2 was not found.',
    step1: 'Connect both MIDI IN and MIDI OUT on the volca fm2 to the MIDI interface connected to your Mac or PC.',
    step2: 'Open this app in Google Chrome.',
    step3: 'When the MIDI permission dialog appears, choose Allow.',
    retry: 'Detect volca fm2 again',
  },
};
const connectionTexts = computed(() => CONNECTION_TEXTS[userLanguage]);
const showConnectionModal = computed(() => !(
  midiStore.connectionState === MIDIConnectionState.DETECTED ||
  midiStore.connectionState === MIDIConnectionState.RECEIVING ||
  midiStore.connectionState === MIDIConnectionState.RECEIVED
));

const CONNECTION_LABELS = {
  ja: {
    [MIDIConnectionState.INITIALIZING]: 'MIDI 初期化中', [MIDIConnectionState.SEARCHING]: '検索中',
    [MIDIConnectionState.NOT_FOUND]: '未接続', [MIDIConnectionState.DETECTED]: '接続済み',
    [MIDIConnectionState.RECEIVING]: '受信中', [MIDIConnectionState.RECEIVED]: '接続済み', [MIDIConnectionState.ERROR]: '接続エラー',
  },
  en: {
    [MIDIConnectionState.INITIALIZING]: 'Initializing MIDI', [MIDIConnectionState.SEARCHING]: 'Searching',
    [MIDIConnectionState.NOT_FOUND]: 'Not connected', [MIDIConnectionState.DETECTED]: 'Connected',
    [MIDIConnectionState.RECEIVING]: 'Receiving', [MIDIConnectionState.RECEIVED]: 'Connected', [MIDIConnectionState.ERROR]: 'Connection error',
  },
};
const connectionLabel = computed(() => CONNECTION_LABELS[userLanguage][midiStore.connectionState]);
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
  --volca-type-label: 12px;
  --volca-type-body: 14px;
  --volca-type-heading: 18px;
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: var(--volca-type-body);
  font-optical-sizing: auto;
}

html, body, #app { margin: 0; min-width: 760px; min-height: 100%; background: var(--volca-bg); }
body { overflow: hidden; }
.volca-app { background: radial-gradient(circle at 72% -20%, #594447 0, transparent 38%), var(--volca-bg) !important; color: var(--volca-text); }
.brand-mark { width: 38px; height: 38px; display: grid; place-items: center; position: relative; border: 1px solid var(--volca-line-strong); border-radius: 10px; background: linear-gradient(145deg, #e0c5a5, #a8896c); color: #332729; box-shadow: inset 0 1px rgba(255,255,255,.35), 0 5px 18px rgba(0,0,0,.22); font-size: var(--volca-type-label); font-weight: 900; letter-spacing: -.05em; }
.brand-mark b { position: absolute; right: 3px; bottom: 0; font-size: var(--volca-type-label); }
.brand-copy h1 { margin: 0; font-size: var(--volca-type-heading); line-height: 1.15; letter-spacing: -.015em; font-weight: 680; }
.sidebar-brand { display: flex; align-items: center; gap: 11px; min-height: 48px; padding: 4px 8px 16px; }
.brand-copy { min-width: 0; flex: 1; }
.sidebar-toggle { width: 34px; height: 34px; display: grid; flex: 0 0 34px; place-items: center; padding: 0; border: 1px solid var(--volca-line); border-radius: 8px; background: transparent; color: var(--volca-muted); cursor: pointer; transition: color .18s ease, background .18s ease, transform .1s ease; }
.sidebar-toggle:hover { color: var(--volca-text); background: rgba(255,255,255,.055); }
.sidebar-toggle:active { transform: scale(.96); }
.sidebar-toggle:focus-visible { outline: 2px solid var(--volca-accent); outline-offset: 2px; }
.sidebar-rule { height: 1px; margin: 0 5px 18px; background: var(--volca-line); }
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
.sidebar.is-collapsed .sidebar-brand { justify-content: center; padding-inline: 0; }
.sidebar.is-collapsed .brand-mark,
.sidebar.is-collapsed .brand-copy,
.sidebar.is-collapsed .sidebar-label,
.sidebar.is-collapsed .nav-item > span:last-child,
.sidebar.is-collapsed .midi-state > span:last-child,
.sidebar.is-collapsed .about-button span { display: none; }
.sidebar.is-collapsed .nav-item,
.sidebar.is-collapsed .about-button,
.sidebar.is-collapsed .midi-state { justify-content: center; padding: 8px; }
.sidebar-label { padding: 0 10px 8px; color: #9b8d8d; font-size: var(--volca-type-label); font-weight: 750; letter-spacing: .12em; }
.nav-item { width: 100%; display: flex; align-items: center; gap: 11px; min-height: 62px; padding: 9px 11px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--volca-muted); text-align: left; cursor: pointer; transition: background .18s ease, border-color .18s ease, color .18s ease, transform .1s ease; }
.nav-item:hover { color: var(--volca-text); background: rgba(255,255,255,.045); }
.nav-item:focus-visible, .about-button:focus-visible { outline: 2px solid var(--volca-accent); outline-offset: 2px; }
.nav-item.active { color: var(--volca-text); border-color: var(--volca-line); background: linear-gradient(90deg, rgba(206,179,147,.16), rgba(206,179,147,.07)); box-shadow: inset 2px 0 var(--volca-accent); }
.nav-icon { width: 31px; height: 31px; display: grid; place-items: center; border-radius: 8px; background: rgba(255,255,255,.05); color: var(--volca-accent); }
.nav-item > span:last-child { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.nav-item b { font-size: var(--volca-type-body); font-weight: 650; }
.nav-item small { overflow: hidden; color: #aa9b9b; font-size: var(--volca-type-label); line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-fill { flex: 1; }
.sidebar-footer { display: grid; gap: 5px; margin: 4px; padding-top: 12px; border-top: 1px solid var(--volca-line); }
.about-button { display: flex; align-items: center; gap: 9px; min-height: 38px; padding: 7px 10px; border: 0; border-radius: 9px; background: transparent; color: var(--volca-muted); font: inherit; font-size: var(--volca-type-body); font-weight: 600; text-align: left; cursor: pointer; transition: background .16s ease, color .16s ease, transform .1s ease; }
.about-button:hover { color: var(--volca-text); background: rgba(255,255,255,.055); }
.workspace { min-width: 0; flex: 1; overflow: hidden; }
.tool-window, .tool-window > .v-window__container, .tool-window .v-window-item { height: 100%; }
.tool-window .v-window-item { overflow: auto; }
.workspace .v-container { max-width: 1440px; padding: 22px 26px 30px; }
.workspace .v-card { border: 1px solid var(--volca-line) !important; border-radius: 13px !important; background: var(--volca-panel) !important; box-shadow: 0 14px 35px rgba(9,5,6,.16) !important; backdrop-filter: blur(18px); color: var(--volca-text) !important; }
.volca-app .v-btn { height: 40px; min-height: 40px; }
.workspace .v-btn { border: 1px solid rgba(255,255,255,.08); border-radius: 8px; background: var(--volca-accent) !important; color: #33282a !important; box-shadow: inset 0 1px rgba(255,255,255,.28), 0 3px 10px rgba(0,0,0,.16) !important; font-size: var(--volca-type-body); font-weight: 700; letter-spacing: .005em; text-transform: none; }
.workspace .v-btn:hover { background: var(--volca-accent-bright) !important; }
.workspace .v-btn:active { transform: scale(.98); }
.workspace .v-field { border-radius: 8px !important; background: rgba(20,15,16,.38); font-size: var(--volca-type-body); }
.workspace .v-label { font-size: var(--volca-type-label); }
.workspace .v-divider { border-color: var(--volca-line); opacity: 1; }
.workspace .v-card-title { font-size: var(--volca-type-heading); font-weight: 650; letter-spacing: -.01em; }
.about-card { border: 1px solid var(--volca-line-strong) !important; border-radius: 14px !important; background: #382b2d !important; color: var(--volca-text) !important; }
.connection-card { padding: 24px 26px 20px; border: 1px solid var(--volca-line-strong) !important; border-radius: 16px !important; background: linear-gradient(145deg, #403133, #322628) !important; color: var(--volca-text) !important; box-shadow: 0 28px 80px rgba(10,5,6,.48) !important; }
.connection-card__icon { width: 44px; height: 44px; display: grid; place-items: center; margin: 0 16px 8px; border: 1px solid var(--volca-line-strong); border-radius: 12px; background: var(--volca-accent-soft); color: var(--volca-accent-bright); }
.connection-card .v-card-title { padding-bottom: 8px; font-size: var(--volca-type-heading); font-weight: 680; letter-spacing: -.02em; }
.connection-card .v-card-text { color: #d8ccc4; font-size: var(--volca-type-body); line-height: 1.75; }
.connection-steps { display: grid; gap: 8px; margin: 0; padding-left: 1.4rem; }
.connection-steps li { padding-left: 4px; }
.connection-card .v-card-actions { padding-top: 12px; }
.connection-card .v-btn { border-radius: 9px; background: var(--volca-accent) !important; color: #33282a !important; font-size: var(--volca-type-body); font-weight: 700; letter-spacing: 0; text-transform: none; }
@keyframes status-pulse { 50% { opacity: .45; transform: scale(.82); } }
@media (max-width: 900px) { .sidebar { width: 76px; flex-basis: 76px; } .sidebar-brand { justify-content: center; padding-inline: 0; } .sidebar-toggle, .brand-copy, .sidebar-label, .nav-item > span:last-child, .midi-state > span:last-child, .about-button span { display: none; } .nav-item, .about-button, .midi-state { justify-content: center; padding: 8px; } .workspace .v-container { padding: 16px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation: none !important; transition-duration: .01ms !important; } }
@media (prefers-reduced-transparency: reduce) { .sidebar, .workspace .v-card { backdrop-filter: none; background: var(--volca-panel-solid) !important; } }
</style>
