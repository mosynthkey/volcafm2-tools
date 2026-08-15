<template>
  <v-container class="sequencer-container">
    <AppDialog v-model="seqStore.showImportDialog" :title="t('sequence.importSettings')" max-width="400">
      <v-text-field v-model.number="seqStore.smfBarOffset" type="number" :label="t('sequence.importBar')" min="1" density="compact" hide-details autofocus />
      <template #actions>
        <v-btn variant="text" @click="seqStore.cancelSmfImport()">{{ t('common.cancel') }}</v-btn>
        <v-btn @click="seqStore.confirmSmfImport()">{{ t('sequence.import') }}</v-btn>
      </template>
    </AppDialog>

    <AppErrorDialog v-model="seqStore.showSendErrorDialog" :title="t('sequence.sendFailedTitle')" :message="sendErrorMessage" />
    <v-snackbar v-model="seqStore.showSendRetrySnackbar" :timeout="-1" location="bottom" color="#463638"
      class="send-retry-snackbar">
      {{ t('sequence.sendRetrying') }}
    </v-snackbar>

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

    <AppErrorDialog v-model="showProgramFetchErrorDialog" :title="t('sequence.programFetchFailedTitle')"
      :message="t('sequence.programFetchFailed')" />

    <AppProgressDialog :model-value="midiStore.isFetchingCurrentProgram && !seqStore.showCaptureDialog" :title="t('sequence.programFetchTitle')"
      :description="programFetchStatusText"
      :value="midiStore.currentProgramFetchState === 'loading-programs' ? (midiStore.currentProgramFetchProgress / 64) * 100 : 0"
      :indeterminate="midiStore.currentProgramFetchState === 'requesting'" max-width="460">
      <template #status><span v-if="midiStore.currentProgramFetchState === 'loading-programs'">{{ midiStore.currentProgramFetchProgress }}/64</span></template>
    </AppProgressDialog>

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
import AppProgressDialog from '@/components/dialogs/AppProgressDialog.vue';
import AppDialog from '@/components/dialogs/AppDialog.vue';
import { useMidiStore } from '@/stores/midiStore';
import { Dices } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { useStepInput } from '@/features/sequence/composables/useStepInput';
import { useSequenceUndo } from '@/features/sequence/composables/useSequenceUndo';
import SequenceCaptureDialog from '@/features/sequence/components/SequenceCaptureDialog.vue';
import SequenceToolbar from '@/features/sequence/components/SequenceToolbar.vue';
import PianoRollEditor from '@/features/sequence/components/PianoRollEditor.vue';
import SequenceFuncPanel from '@/features/sequence/components/SequenceFuncPanel.vue';

const seqStore = useSequencerStore();
const midiStore = useMidiStore();
const { t } = useI18n();
useStepInput();
useSequenceUndo();
const dontShowRandomizeAgain = ref(false);

watch(() => seqStore.showRandomizeDialog, open => {
  if (open) dontShowRandomizeAgain.value = false;
});

const programFetchStatusText = computed(() =>
  midiStore.currentProgramFetchState === 'loading-programs'
    ? t('sequence.receivingProgramsForMatch')
    : t('sequence.matchingCurrentProgram')
);

const showProgramFetchErrorDialog = ref(false);
const sendErrorMessage = computed(() =>
  seqStore.lastSendFailure === 'nak' ? t('sequence.sendNak') : t('sequence.sendError')
);

watch(() => midiStore.currentProgramFetchState, state => {
  if (state === 'error' && !seqStore.showCaptureDialog) showProgramFetchErrorDialog.value = true;
});
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

:deep(.send-retry-snackbar .v-snackbar__wrapper) {
  min-width: 280px;
  border: 1px solid rgba(206, 179, 147, 0.28);
  color: var(--volca-text);
  font-weight: 650;
}
</style>
