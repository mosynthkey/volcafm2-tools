<template>
  <v-container class="sequencer-container">
    <AppDialog v-model="seqStore.showImportDialog" :title="t('sequence.importSettings')" max-width="400">
      <v-text-field v-model.number="seqStore.smfBarOffset" type="number" :label="t('sequence.importBar')" min="1" density="compact" hide-details autofocus />
      <template #actions>
        <v-btn variant="text" @click="seqStore.cancelSmfImport()">{{ t('common.cancel') }}</v-btn>
        <v-btn @click="seqStore.confirmSmfImport()">{{ t('sequence.import') }}</v-btn>
      </template>
    </AppDialog>

    <AppErrorDialog v-model="seqStore.showSendErrorDialog" :title="t('common.sendFailedTitle')" :message="sendErrorMessage" />
    <AppErrorDialog v-model="seqStore.showReceiveErrorDialog" :title="t('sequence.receiveFailedTitle')" :message="t('sequence.receiveFailed')" />

    <AppDialog v-model="seqStore.showRandomizeDialog" :title="t('sequence.randomizeTitle')">
      <p class="randomize-copy">{{ t('sequence.randomizeDescription') }}</p>
      <label class="randomize-skip">
        <input v-model="dontShowRandomizeAgain" type="checkbox" />
        <span>{{ t('sequence.randomizeDontShowAgain') }}</span>
      </label>
      <template #actions>
        <v-btn variant="text" @click="seqStore.showRandomizeDialog = false">{{ t('common.cancel') }}</v-btn>
        <v-btn @click="seqStore.confirmRandomize(dontShowRandomizeAgain)"><Dices :size="16" class="mr-1" />{{ t('sequence.randomizeRun') }}</v-btn>
      </template>
    </AppDialog>

    <SequenceCaptureDialog />

    <v-card class="pa-4 sequencer-card">
      <SequenceToolbar />
      <p v-if="seqStore.importError" class="dialog-error">
        {{ t('sequence.importError') }}: {{ seqStore.importError }}
      </p>
      <v-divider class="my-4" />
      <PianoRollEditor />
      <SequenceFuncPanel />
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSequencerStore } from '@/stores/sequencerStore';
import AppErrorDialog from '@/components/dialogs/AppErrorDialog.vue';
import AppDialog from '@/components/dialogs/AppDialog.vue';
import { Dices } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { useStepInput } from '@/features/sequence/composables/useStepInput';
import { useSequenceSync } from '@/features/sequence/composables/useSequenceSync';
import { useSequenceUndo } from '@/features/sequence/composables/useSequenceUndo';
import SequenceCaptureDialog from '@/features/sequence/components/SequenceCaptureDialog.vue';
import SequenceToolbar from '@/features/sequence/components/SequenceToolbar.vue';
import PianoRollEditor from '@/features/sequence/components/PianoRollEditor.vue';
import SequenceFuncPanel from '@/features/sequence/components/SequenceFuncPanel.vue';

const seqStore = useSequencerStore();
const { t } = useI18n();
useStepInput();
useSequenceUndo();
useSequenceSync();
const dontShowRandomizeAgain = ref(false);

watch(() => seqStore.showRandomizeDialog, open => {
  if (open) dontShowRandomizeAgain.value = false;
});

const sendErrorMessage = computed(() =>
  seqStore.lastSendFailure === 'nak' ? t('common.sendNak') : t('common.sendError')
);
</script>

<style scoped>
.sequencer-container {
  height: 100%;
  box-sizing: border-box;
}

.sequencer-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.randomize-copy {
  margin: 0;
}

.randomize-skip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 16px 0 0;
  color: var(--volca-muted);
  font-size: var(--volca-type-body);
  line-height: 1.4;
  cursor: pointer;
}

.randomize-skip input {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  flex: 0 0 auto;
  accent-color: var(--volca-accent);
}
</style>
