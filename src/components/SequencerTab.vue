<template>
  <v-container class="sequencer-container">
    <AppDialog v-model="showImportDialog" :title="texts.importSettings" max-width="400">
      <v-text-field v-model.number="smfBarOffset" type="number" :label="texts.importBar" min="1" density="compact" hide-details autofocus />
      <template #actions><v-btn variant="text" @click="cancelImport">{{ texts.cancel }}</v-btn><v-btn @click="confirmImport">{{ texts.import }}</v-btn></template>
    </AppDialog>

    <AppErrorDialog v-model="showSendErrorDialog" :title="texts.sendFailedTitle" :message="sendErrorMessage" />

    <AppDialog v-model="showRandomizeDialog" :title="texts.randomizeTitle">
      {{ texts.randomizeDescription }}
      <template #actions><v-btn variant="text" @click="showRandomizeDialog = false">{{ texts.cancel }}</v-btn><v-btn @click="confirmRandomize"><Dices :size="16" class="mr-1" />{{ texts.randomizeRun }}</v-btn></template>
    </AppDialog>

    <AppErrorDialog v-model="showProgramFetchErrorDialog" :title="texts.programFetchFailedTitle"
      :message="texts.programFetchFailed" />

    <AppProgressDialog :model-value="isFetchingCurrentProgram" :title="texts.programFetchTitle"
      :description="programFetchStatusText"
      :value="midiStore.currentProgramFetchState === 'loading-programs' ? (midiStore.currentProgramFetchProgress / 64) * 100 : 0"
      :indeterminate="midiStore.currentProgramFetchState === 'requesting'" max-width="460">
      <template #status><span v-if="midiStore.currentProgramFetchState === 'loading-programs'">{{ midiStore.currentProgramFetchProgress }}/64</span></template>
    </AppProgressDialog>

    <SequenceCaptureDialog v-model="showCaptureDialog" v-model:resolution="captureResolution"
      :phase="capturePhase" :progress="captureProgress" :step-count="capturedStepCount"
      :note-count="capturedNoteCount" :error-message="captureErrorMessage"
      @start="startMidiCapture" @cancel="cancelMidiCapture" />

    <PresetLibraryDialog v-model="showLibrary" kind="sequence" :title="t('sequence.library')"
      :suggested-name="`Sequence ${seqStore.programNo + 1}`" :snapshot="sequenceSnapshot" @load="loadSequencePreset" />

    <v-card class="pa-4 sequencer-card">
      <SequenceToolbar :step-input-active="stepInputActive" :step-cursor="stepCursor" :can-insert-tie="canInsertTie"
        @toggle-step-input="toggleStepInput" @insert-tie="insertTie" @insert-rest="insertRest"
        @capture="openCaptureDialog" @randomize="showRandomizeDialog = true" @send="handleSend"
        @library="showLibrary = true" @import-file="handleImportFile" />

      <v-alert v-if="importError" type="error" density="compact" class="mt-3" variant="tonal">
        {{ texts.importError }}: {{ importError }}
      </v-alert>
      <v-divider class="my-4" />
      <PianoRollEditor v-model:motion-index="selectedMotionIndex" :step-input-active="stepInputActive"
        :step-cursor="stepCursor" :chord-buffer="chordBuffer" @select-step="selectStep" />

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
import type { SequenceState } from '@/types/sequence';
import { extractStepNotes, parseSmf } from '@/utils/smfImport';
import { Dices } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { useStepInput } from '@/features/sequence/composables/useStepInput';
import { useSequenceCapture } from '@/features/sequence/composables/useSequenceCapture';
import SequenceCaptureDialog from '@/features/sequence/components/SequenceCaptureDialog.vue';
import SequenceToolbar from '@/features/sequence/components/SequenceToolbar.vue';
import PianoRollEditor from '@/features/sequence/components/PianoRollEditor.vue';

const seqStore = useSequencerStore();
const midiStore = useMidiStore();
const { t } = useI18n();
const {
  open: showCaptureDialog, phase: capturePhase, progress: captureProgress,
  stepCount: capturedStepCount, noteCount: capturedNoteCount, errorMessage: captureErrorMessage,
  resolution: captureResolution, show: openCaptureDialog, start: startMidiCapture, cancel: cancelMidiCapture,
} = useSequenceCapture(midiStore, seqStore, t);

const texts = computed(() => ({
  program: t('sequence.program'), programNameUnknown: t('sequence.programNameUnknown'), getCurrentProgram: t('sequence.getCurrentProgram'),
  programFetchFailedTitle: t('sequence.programFetchFailedTitle'), programFetchFailed: t('sequence.programFetchFailed'), programFetchTitle: t('sequence.programFetchTitle'),
  receivingProgramsForMatch: t('sequence.receivingProgramsForMatch'), matchingCurrentProgram: t('sequence.matchingCurrentProgram'), velocity: t('sequence.velocity'), gate: t('sequence.gate'), clear: t('sequence.clear'),
  randomize: t('sequence.randomize'), randomizeTitle: t('sequence.randomizeTitle'), randomizeDescription: t('sequence.randomizeDescription'), randomizeRun: t('sequence.randomizeRun'),
  captureButton: t('sequence.captureButton'), captureTitle: t('sequence.captureTitle'), captureDescription: t('sequence.captureDescription'), captureResolution: t('sequence.captureResolution'),
  captureStep1: t('sequence.captureStep1'), captureStep2: t('sequence.captureStep2'), captureStep3: t('sequence.captureStep3'), captureStart: t('sequence.captureStart'), captureCancel: t('sequence.captureCancel'), captureRunning: t('sequence.captureRunning'),
  captureProgress: (n: number) => t('sequence.captureProgress', { count: n }), captureDone: (n: number) => t('sequence.captureDone', { count: n }),
  importSmf: t('sequence.importSmf'), importSettings: t('sequence.importSettings'), importBar: t('sequence.importBar'), cancel: t('common.cancel'), import: t('sequence.import'),
  importError: t('sequence.importError'), send: t('common.send'),
  sendFailedTitle: t('sequence.sendFailedTitle'), sendNak: t('sequence.sendNak'), sendError: t('sequence.sendError'), stepInputOn: t('sequence.stepInput'), stepInputOff: t('sequence.stepInput'),
  stepInputExit: t('sequence.stepInputExit'), stepIndicator: (n: number) => t('sequence.stepIndicator', { count: n }), motionTarget: t('sequence.motionTarget'), motionEnable: t('sequence.motionEnable'),
}));

const selectedMotionIndex = ref(0);
const showLibrary = ref(false);
const showRandomizeDialog = ref(false);

const isFetchingCurrentProgram = computed(() =>
  midiStore.currentProgramFetchState === 'loading-programs' ||
  midiStore.currentProgramFetchState === 'requesting'
);
const programFetchStatusText = computed(() =>
  midiStore.currentProgramFetchState === 'loading-programs'
    ? texts.value.receivingProgramsForMatch
    : texts.value.matchingCurrentProgram
);

const handleSend = () => {
  const bytes = seqStore.buildSysEx();
  midiStore.sendCurrentSequenceDump(bytes);
};

const {
  active: stepInputActive, cursor: stepCursor, chordBuffer, canInsertTie,
  toggle: toggleStepInput, insertRest, insertTie, select: selectStep,
} = useStepInput(midiStore, seqStore, handleSend);

const confirmRandomize = () => {
  seqStore.randomizeSteps();
  showRandomizeDialog.value = false;
};

const sequenceSnapshot = (): SequenceState => ({
  programNo: seqStore.programNo,
  velocity: seqStore.velocity,
  gatePercent: seqStore.gatePercent,
  notes: JSON.parse(JSON.stringify(seqStore.notes)),
  motionEnabled: [...seqStore.motionEnabled],
  motionValues: seqStore.motionValues.map(values => [...values]),
});
const loadSequencePreset = (data: unknown) => {
  seqStore.loadFromDecoded(data as SequenceState);
  handleSend();
};

const showSendErrorDialog = ref(false);
const showProgramFetchErrorDialog = ref(false);
const sendErrorMessage = computed(() =>
  midiStore.sequenceWriteState === 'nak' ? texts.value.sendNak : texts.value.sendError
);

watch(() => midiStore.sequenceWriteState, (state) => {
  if (state === 'nak' || state === 'error') showSendErrorDialog.value = true;
});

watch(() => midiStore.currentProgramFetchState, (state) => {
  if (state === 'error') showProgramFetchErrorDialog.value = true;
});

// --- SMFインポート ---
const smfBarOffset = ref(1);
const pendingSmfFile = ref<File | null>(null);
const showImportDialog = ref(false);
const importError = ref<string | null>(null);

const handleImportFile = (file: File) => {
  importError.value = null;
  pendingSmfFile.value = file;
  showImportDialog.value = true;
};

const cancelImport = () => {
  showImportDialog.value = false;
  pendingSmfFile.value = null;
};

const confirmImport = async () => {
  const file = pendingSmfFile.value;
  if (!file) return;
  showImportDialog.value = false;
  try {
    const buffer = await file.arrayBuffer();
    const parsed = parseSmf(buffer);
    const { notes, velocity } = extractStepNotes(parsed, 4, Math.max(0, smfBarOffset.value - 1));
    seqStore.notes = [];
    seqStore.velocity = velocity;
    for (const n of notes) {
      seqStore.addNote(n.pitch, n.startStep, n.length);
    }
    importError.value = null;
  } catch (e) {
    importError.value = String(e instanceof Error ? e.message : e);
  } finally {
    pendingSmfFile.value = null;
  }
};

</script>

<style scoped>
.v-btn.dimmed {
  opacity: 0.5;
  pointer-events: none;
}

.pa-4 {
  padding: 16px;
}

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

</style>
