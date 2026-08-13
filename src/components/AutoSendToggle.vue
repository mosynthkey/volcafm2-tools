<template>
  <button type="button" class="editor-auto-send" role="switch"
    :aria-checked="autoSend.enabled" :aria-label="t('common.autoSend')"
    :title="t('common.autoSendHint')" :class="{ on: autoSend.enabled }"
    @click="autoSend.enabled = !autoSend.enabled">
    <span class="editor-auto-send__label">{{ t('common.autoSend') }}</span>
    <span class="editor-auto-send__track" aria-hidden="true">
      <span class="editor-auto-send__thumb" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAutoSendStore } from '@/stores/autoSendStore'

const { t } = useI18n()
const autoSend = useAutoSendStore()
</script>
