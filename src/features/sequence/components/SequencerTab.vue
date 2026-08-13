<template>
  <v-container class="sequencer-container">
    <AppDialog v-model="seqStore.showImportDialog" :title="t('sequence.importSettings')" max-width="400">
      <v-text-field v-model.number="seqStore.smfBarOffset" type="number" :label="t('sequence.importBar')" min="1" density="compact" hide-details autofocus />
      <template #actions>
        <v-btn variant="text" @click="seqStore.cancelSmfImport()">{{ t('common.cancel') }}</v-btn>
        <v-btn @click="seqStore.confirmSmfImport()">{{ t('sequence.import') }}</v-btn>
      </template>
    </AppDialog>

    <AppErrorDialog v-model="showSendErrorDialog" :title="t('sequence.sendFailedTitle')" :message="sendErrorMessage" />

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

    <AppProgressDialog :model-value="midiStore.isFetchingCurrentProgram" :title="t('sequence.programFetchTitle')"
      :description="programFetchStatusText"
      :value="midiStore.currentProgramFetchState === 'loading-programs' ? (midiStore.currentProgramFetchProgress / 64) * 100 : 0"
      :indeterminate="midiStore.currentProgramFetchState === 'requesting'" max-width="460">
      <template #status><span v-if="midiStore.currentProgramFetchState === 'loading-programs'">{{ midiStore.currentProgramFetchProgress }}/64</span></template>
    </AppProgressDialog>

    <SequenceCaptureDialog />

    <PresetLibraryDialog v-model="seqStore.showLibrary" kind="sequence" :title="t('sequence.library')"
      :suggested-name="t('sequence.libraryName', { count: seqStore.programNo + 1 })" :snapshot="sequenceSnapshot" @load="seqStore.loadPreset" />

    <v-card class="pa-4 sequencer-card">
      <SequenceToolbar />
      <v-alert v-if="seqStore.importError" type="error" density="compact" class="mt-3" variant="tonal">
        {{ t('sequence.importError') }}: {{ seqStore.importError }}
      </v-alert>
      <v-divider class="my-4" />
      <PianoRollEditor />
      <SequenceFuncPanel />
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSequencerStore } from '@/stores/sequencerStore';
import PresetLibraryDialog from '@/components/PresetLibraryDialog.vue';
import AppErrorDialog from '@/components/dialogs/AppErrorDialog.vue';
import AppProgressDialog from '@/components/dialogs/AppProgressDialog.vue';
import AppDialog from '@/components/dialogs/AppDialog.vue';
import { useMidiStore } from '@/stores/midiStore';
import { Dices } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { useStepInput } from '@/features/sequence/composables/useStepInput';
import SequenceCaptureDialog from '@/features/sequence/components/SequenceCaptureDialog.vue';
import SequenceToolbar from '@/features/sequence/components/SequenceToolbar.vue';
import PianoRollEditor from '@/features/sequence/components/PianoRollEditor.vue';
import SequenceFuncPanel from '@/features/sequence/components/SequenceFuncPanel.vue';

const seqStore = useSequencerStore();
const midiStore = useMidiStore();
const { t } = useI18n();
useStepInput();
const dontShowRandomizeAgain = ref(false);

watch(() => seqStore.showRandomizeDialog, open => {
  if (open) dontShowRandomizeAgain.value = false;
});

const programFetchStatusText = computed(() =>
  midiStore.currentProgramFetchState === 'loading-programs'
    ? t('sequence.receivingProgramsForMatch')
    : t('sequence.matchingCurrentProgram')
);

const sequenceSnapshot = () => JSON.parse(JSON.stringify(seqStore.toState()));
const showSendErrorDialog = ref(false);
const showProgramFetchErrorDialog = ref(false);
const sendErrorMessage = computed(() =>
  midiStore.sequenceWriteState === 'nak' ? t('sequence.sendNak') : t('sequence.sendError')
);

watch(() => midiStore.sequenceWriteState, state => {
  if (state === 'nak' || state === 'error') showSendErrorDialog.value = true;
});
watch(() => midiStore.currentProgramFetchState, state => {
  if (state === 'error') showProgramFetchErrorDialog.value = true;
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
</style>
