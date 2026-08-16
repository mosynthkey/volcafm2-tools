<template>
  <aside class="sidebar" :class="{ 'is-collapsed': ui.sidebarCollapsed }">
    <div class="sidebar-heading">
      <div class="sidebar-label">{{ t('app.tools') }}</div>
      <button class="sidebar-toggle" type="button" :aria-label="sidebarToggleLabel"
        :title="sidebarToggleLabel" @click="ui.sidebarCollapsed = !ui.sidebarCollapsed">
        <PanelLeftOpen v-if="ui.sidebarCollapsed" :size="18" />
        <PanelLeftClose v-else :size="18" />
      </button>
    </div>
    <div class="sidebar-rule" />
    <button class="nav-item" :class="{ active: ui.activeTab === 'sound-edit' }" type="button" @click="ui.activeTab = 'sound-edit'">
      <span class="nav-icon"><ProgramEditIcon /></span>
      <span><b>{{ t('app.nav.soundLabel') }}</b><small>{{ t('app.nav.sound') }}</small></span>
    </button>
    <button class="nav-item" :class="{ active: ui.activeTab === 'dx7' }" type="button" @click="ui.activeTab = 'dx7'">
      <span class="nav-icon"><ProgramListIcon /></span>
      <span><b>{{ t('app.nav.dx7Label') }}</b><small>{{ t('app.nav.dx7') }}</small></span>
    </button>
    <button class="nav-item" :class="{ active: ui.activeTab === 'sequencer' }" type="button" @click="ui.activeTab = 'sequencer'">
      <span class="nav-icon"><SequenceIcon /></span>
      <span><b>{{ t('app.nav.sequenceLabel') }}</b><small>{{ t('app.nav.sequence') }}</small></span>
    </button>
    <button class="nav-item" :class="{ active: ui.activeTab === 'library' }" type="button" @click="ui.openLibrary(ui.libraryFocus)">
      <span class="nav-icon"><Library :size="18" /></span>
      <span><b>{{ t('app.nav.libraryLabel') }}</b><small>{{ t('app.nav.library') }}</small></span>
    </button>
    <div class="sidebar-fill" />
    <div class="sidebar-footer">
      <LanguageSwitch />
      <button class="midi-state" type="button" :class="`is-${connectionTone}`"
        :disabled="midiStore.isDeviceReady" :title="midiStore.isDeviceReady ? connectionLabel : connectionTexts.reconnect"
        @click="openConnectionRecovery">
        <span class="status-light" />
        <span>{{ connectionLabel }}</span>
      </button>
      <button class="about-button" type="button" @click="ui.showInfo = true">
        <img class="brand-mark" src="/app-icon.png" alt="" />
        <span>{{ t('app.about') }}</span>
      </button>
      <a class="sidebar-home-link" href="https://mosynthkey.github.io/"
        :aria-label="t('app.backToMelissaAudio')" :title="t('app.backToMelissaAudio')">
        <span class="nav-icon"><ArrowLeft :size="18" /></span>
        <span>{{ t('app.backToMelissaAudio') }}</span>
      </a>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ArrowLeft, Library, PanelLeftClose, PanelLeftOpen } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import LanguageSwitch from '@/components/LanguageSwitch.vue';
import ProgramEditIcon from '@/components/icons/ProgramEditIcon.vue';
import ProgramListIcon from '@/components/icons/ProgramListIcon.vue';
import SequenceIcon from '@/components/icons/SequenceIcon.vue';
import { useMidiConnectionView } from '@/composables/useMidiConnectionView';
import { useUiStore } from '@/stores/uiStore';

const { t } = useI18n();
const ui = useUiStore();
const { midiStore, sidebarToggleLabel, connectionTone, connectionLabel, connectionTexts, openConnectionRecovery } = useMidiConnectionView();
</script>
