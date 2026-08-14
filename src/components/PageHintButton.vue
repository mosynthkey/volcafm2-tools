<template>
  <v-btn icon variant="text" :title="t('hint.title')" :aria-label="t('hint.title')" @click="ui.openPageHint(page)">
    <CircleHelp :size="18" />
  </v-btn>
</template>

<script setup lang="ts">
import { CircleHelp } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/uiStore'
import type { PageHintId } from '@/utils/pageHint'

defineProps<{ page: PageHintId }>()
const { t } = useI18n()
const ui = useUiStore()
</script>
