<template>
  <AppDialog
    :model-value="showSequenceHint"
    :title="t('preview.sequenceHintTitle')"
    max-width="480"
    @update:model-value="onHintUpdate"
  >
    <p>{{ t('preview.sequenceHintDescription') }}</p>
    <label class="app-skip-confirm">
      <input v-model="dontShowSequenceHintAgain" type="checkbox" />
      <span>{{ t('common.dontShowAgain') }}</span>
    </label>
    <template #actions>
      <v-btn @click="confirmSequenceHint()">{{ t('common.ok') }}</v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import { useProgramPreview } from '@/composables/useProgramPreview'

const { t } = useI18n()
const {
  showSequenceHint,
  dontShowSequenceHintAgain,
  confirmSequenceHint,
  cancelSequenceHint,
} = useProgramPreview()

const onHintUpdate = (open: boolean) => {
  if (!open) cancelSequenceHint()
}
</script>
