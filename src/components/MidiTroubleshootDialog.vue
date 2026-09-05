<template>
  <AppDialog v-model="open" :title="t('app.connection.troubleshootTitle')" max-width="520">
    <label class="troubleshoot-field">
      <span>{{ t('app.connection.os') }}</span>
      <v-select
        v-model="os"
        :items="osItems"
        item-title="title"
        item-value="value"
        density="compact"
        hide-details
      />
    </label>
    <div class="troubleshoot-advice" role="note">
      <p v-if="advice.windowsHelp">
        {{ t('app.connection.windowsHelp') }}
        <a :href="WINDOWS_MIDI_HELP_URL" target="_blank" rel="noopener noreferrer">
          {{ t('app.connection.windowsHelpLink') }}
        </a>
      </p>
      <p v-if="advice.restart">
        {{ isDesktopApp ? t('app.connection.restartDesktop') : t('app.connection.restartBrowser') }}
      </p>
      <p v-if="!isDesktopApp">{{ t('app.connection.desktopHint') }}</p>
      <a
        v-if="!isDesktopApp"
        :href="DESKTOP_APP_DOWNLOAD_URL"
        target="_blank"
        rel="noopener noreferrer"
      >{{ t('app.connection.desktopDownload') }}</a>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import {
  DESKTOP_APP_DOWNLOAD_URL,
  WINDOWS_MIDI_HELP_URL,
  detectClientOs,
  midiTroubleshootAdvice,
  type ClientOs,
} from '@/utils/clientEnvironment'
import { isDesktopApp } from '@/utils/runtime'

const OSES: ClientOs[] = ['windows', 'macos', 'other']

const open = defineModel<boolean>({ default: false })
const { t } = useI18n()
const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
const os = ref<ClientOs>(detectClientOs(ua))
const osItems = computed(() => OSES.map(value => ({
  value, title: t(`app.connection.oses.${value}`),
})))
const advice = computed(() => midiTroubleshootAdvice({ os: os.value }))

watch(open, isOpen => {
  if (!isOpen) return
  os.value = detectClientOs(ua)
})
</script>

<style scoped>
.troubleshoot-field { display: grid; gap: 6px; color: var(--volca-muted); font-size: var(--volca-type-label); }
.troubleshoot-advice { display: grid; gap: 10px; margin: 16px 0 0; color: var(--volca-text); font-size: var(--volca-type-body); line-height: 1.55; }
.troubleshoot-advice p { margin: 0; }
.troubleshoot-advice a { color: var(--volca-accent); text-underline-offset: 2px; }
.troubleshoot-advice a:hover { color: var(--volca-accent-bright); }
</style>
