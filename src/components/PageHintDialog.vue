<template>
  <AppDialog :model-value="ui.showPageHint" :title="t('hint.title')" max-width="520" persistent
    @update:model-value="onUpdate">
    <p class="page-hint-copy">{{ body }}</p>
    <section v-if="ui.pageHintId === 'sequence'" class="page-hint-issue">
      <h3>{{ t('hint.knownIssue') }}</h3>
      <p>{{ t('hint.sequenceKnownIssue') }}</p>
    </section>
    <template #actions>
      <v-btn @click="ui.dismissPageHint()">{{ t('common.ok') }}</v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import { useMidiStore } from '@/stores/midiStore'
import { useUiStore } from '@/stores/uiStore'
import { isPageHintSeen, PAGE_HINT_BY_TAB } from '@/utils/pageHint'

const { t } = useI18n()
const ui = useUiStore()
const midiStore = useMidiStore()

const body = computed(() => ui.pageHintId === 'sound-list'
  ? t('dx7.listDescription')
  : t(ui.pageHintId === 'sequence' ? 'hint.sequence' : 'hint.sound'))

const connectionBlocking = computed(() => !ui.connectionModalDismissed && !midiStore.isDeviceReady)

const tryShow = () => {
  if (connectionBlocking.value) {
    ui.showPageHint = false
    return
  }
  const id = PAGE_HINT_BY_TAB[ui.activeTab]
  if (!id || isPageHintSeen(id)) {
    ui.showPageHint = false
    return
  }
  ui.openPageHint(id)
}

const onUpdate = (open: boolean) => {
  if (open) ui.showPageHint = true
  else if (ui.showPageHint) ui.dismissPageHint()
}

watch([() => ui.activeTab, connectionBlocking], tryShow, { immediate: true })
</script>

<style scoped>
.page-hint-copy {
  margin: 0;
  color: var(--volca-text);
  line-height: 1.65;
  white-space: pre-line;
}
.page-hint-issue {
  margin: 18px 0 0;
  padding: 12px 14px;
  border: 1px solid rgba(206, 179, 147, 0.28);
  border-radius: 10px;
  background: rgba(48, 36, 38, 0.55);
}
.page-hint-issue h3 {
  margin: 0 0 6px;
  color: var(--volca-accent-bright);
  font-size: var(--volca-type-body);
  font-weight: 750;
  letter-spacing: 0.02em;
}
.page-hint-issue p {
  margin: 0;
  color: var(--volca-text);
  line-height: 1.65;
}
</style>
