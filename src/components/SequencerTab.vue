<template>
  <v-container class="sequencer-container">
    <v-dialog v-model="showImportDialog" max-width="400">
      <v-card class="pa-4">
        <v-card-title>{{ texts.importSettings }}</v-card-title>
        <v-card-text>
          <v-text-field v-model.number="smfBarOffset" type="number" :label="texts.importBar" min="1"
            density="compact" hide-details autofocus />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cancelImport">{{ texts.cancel }}</v-btn>
          <v-btn @click="confirmImport">{{ texts.import }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showSendErrorDialog" max-width="440">
      <v-card class="pa-4">
        <v-card-title>{{ texts.sendFailedTitle }}</v-card-title>
        <v-card-text>{{ sendErrorMessage }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showSendErrorDialog = false">OK</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showProgramFetchErrorDialog" max-width="440">
      <v-card class="pa-4">
        <v-card-title>{{ texts.programFetchFailedTitle }}</v-card-title>
        <v-card-text>{{ texts.programFetchFailed }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showProgramFetchErrorDialog = false">OK</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog :model-value="isFetchingCurrentProgram" max-width="460" persistent>
      <v-card class="pa-4" role="status" aria-live="polite">
        <v-card-title>{{ texts.programFetchTitle }}</v-card-title>
        <v-card-text>
          <div class="program-fetch-status__copy">
            <span>{{ programFetchStatusText }}</span>
            <span v-if="midiStore.currentProgramFetchState === 'loading-programs'" class="program-fetch-status__count">
              {{ midiStore.currentProgramFetchProgress }}/64
            </span>
          </div>
          <v-progress-linear
            :model-value="midiStore.currentProgramFetchState === 'loading-programs' ? (midiStore.currentProgramFetchProgress / 64) * 100 : undefined"
            :indeterminate="midiStore.currentProgramFetchState === 'requesting'"
            height="6"
            rounded
          />
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showCaptureDialog" max-width="520" :persistent="capturePhase === 'capturing'">
      <v-card class="pa-4">
        <v-card-title>{{ texts.captureTitle }}</v-card-title>
        <v-card-text>
          <template v-if="capturePhase === 'ready'">
            <p class="capture-copy">{{ texts.captureDescription }}</p>
            <div class="capture-resolution mt-4">
              <div class="capture-resolution__label">{{ texts.captureResolution }}</div>
              <v-btn-toggle v-model="captureResolution" mandatory divided>
                <v-btn :value="1">1/1</v-btn>
                <v-btn :value="2">1/2</v-btn>
                <v-btn :value="4">1/4</v-btn>
              </v-btn-toggle>
            </div>
            <ol class="capture-steps">
              <li>{{ texts.captureStep1 }}</li>
              <li>{{ texts.captureStep2 }}</li>
              <li>{{ texts.captureStep3 }}</li>
            </ol>
          </template>
          <template v-else-if="capturePhase === 'capturing'">
            <p class="capture-status">{{ texts.captureRunning }}</p>
            <v-progress-linear :model-value="captureProgress" height="8" rounded class="mt-4" />
            <p class="capture-progress">{{ texts.captureProgress(capturedStepCount) }}</p>
          </template>
          <template v-else-if="capturePhase === 'done'">
            <p class="capture-status">{{ texts.captureDone(capturedNoteCount) }}</p>
          </template>
          <template v-else>
            <p class="capture-status">{{ captureErrorMessage }}</p>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <template v-if="capturePhase === 'ready'">
            <v-btn variant="text" @click="showCaptureDialog = false">{{ texts.cancel }}</v-btn>
            <v-btn @click="startMidiCapture">{{ texts.captureStart }}</v-btn>
          </template>
          <v-btn v-else-if="capturePhase === 'capturing'" variant="text" @click="cancelMidiCapture">
            {{ texts.captureCancel }}
          </v-btn>
          <v-btn v-else @click="showCaptureDialog = false">OK</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <PresetLibraryDialog v-model="showLibrary" kind="sequence" title="Sequence Library"
      :suggested-name="`Sequence ${seqStore.programNo + 1}`" :snapshot="sequenceSnapshot" @load="loadSequencePreset" />

    <v-card class="pa-4 sequencer-card">
      <v-row align="center" no-gutters class="sequencer-toolbar">
        <template v-if="stepInputActive">
          <v-col cols="auto">
            <v-btn icon @click="toggleStepInput" :title="texts.stepInputExit" :aria-label="texts.stepInputExit">
              <X :size="18" />
            </v-btn>
          </v-col>
        </template>
        <template v-else>
          <v-col cols="auto" class="mr-4 program-control">
            <span class="program-control__label">{{ texts.program }}</span>
            <v-text-field type="number" v-model.number="seqStore.programNo" :aria-label="texts.program" min="0" max="63"
              density="compact" hide-details class="program-control__input" />
            <v-btn @click="midiStore.requestCurrentVoiceProgramNo" :disabled="!canSend"
              :loading="midiStore.currentProgramFetchState === 'loading-programs' || midiStore.currentProgramFetchState === 'requesting'"
              :class="{ dimmed: !canSend }">
              {{ texts.getCurrentProgram }}
            </v-btn>
          </v-col>
          <v-col cols="auto" class="mr-4">
            <v-text-field type="number" v-model.number="seqStore.velocity" :label="texts.velocity" min="1" max="127"
              density="compact" hide-details style="width: 110px" />
          </v-col>
          <v-col cols="auto" class="mr-4">
            <v-text-field type="number" v-model.number="seqStore.gatePercent" :label="texts.gate" min="0" max="100"
              density="compact" hide-details style="width: 110px" />
          </v-col>
          <v-col cols="auto" class="mr-2">
            <v-btn @click="openCaptureDialog" :disabled="!canSend" :class="{ dimmed: !canSend }">
              <AudioLines :size="16" class="mr-1" />
              {{ texts.captureButton }}
            </v-btn>
          </v-col>
          <v-col cols="auto" class="mr-2">
            <v-btn @click="toggleStepInput">
              <Piano :size="16" class="mr-1" />
              {{ texts.stepInputOff }}
            </v-btn>
          </v-col>
          <v-col cols="auto" class="mr-2">
            <v-btn @click="seqStore.clearAll">
              <Trash2 :size="16" class="mr-1" />
              {{ texts.clear }}
            </v-btn>
          </v-col>
          <v-spacer />
          <v-col cols="auto" class="mr-2">
            <v-btn @click="triggerImport">
              <FileUp :size="16" class="mr-1" />
              {{ texts.importSmf }}
            </v-btn>
            <input ref="fileInputRef" type="file" accept=".mid,.midi" style="display:none" @change="handleFileChange" />
          </v-col>
          <v-col cols="auto">
            <v-btn @click="handleSend" :disabled="!canSend" :class="{ dimmed: !canSend }">
              {{ texts.send }}
              <Upload :size="16" class="ml-1" />
            </v-btn>
          </v-col>
          <v-col cols="auto" class="ml-2">
            <v-btn icon variant="text" title="Sequence Library" aria-label="Sequence Library" @click="showLibrary = true">
              <Library :size="19" />
            </v-btn>
          </v-col>
        </template>
      </v-row>
      <v-alert v-if="importResult?.ok" type="success" density="compact" class="mt-3" variant="tonal">
        {{ texts.importOk(importResult.count, importResult.totalBars) }}
      </v-alert>
      <v-alert v-else-if="importResult && !importResult.ok" type="error" density="compact" class="mt-3" variant="tonal">
        {{ texts.importError }}: {{ importResult.message }}
      </v-alert>
      <v-divider class="my-4" />
      <!-- ピアノロールとモーションは同じ pitch-gutter/step-cell 幅を共有し、1つの枠(.roll)にまとめて
           太い境界線1本だけで区切る。ヘッダーの段数字はピアノロール側の1回だけで共通に使う。 -->
      <div class="roll">
        <div class="roll-header">
          <div class="pitch-gutter"></div>
          <div v-for="s in 16" :key="s" class="step-cell header-cell"
            :class="{ beat: (s - 1) % 4 === 0, cursor: stepInputActive && s - 1 === stepCursor, selectable: true }"
            role="button" tabindex="0" :aria-label="`Step ${s}`"
            @click="onStepHeaderClick(s - 1)" @keydown.enter.prevent="onStepHeaderClick(s - 1)"
            @keydown.space.prevent="onStepHeaderClick(s - 1)">
            {{ s }}
          </div>
        </div>
        <div class="roll-body">
          <div v-for="pitch in pitchRange" :key="pitch" class="roll-row" @pointerdown="onRowPointerDown(pitch, $event)"
            @pointermove="onRowPointerMove(pitch, $event)" @pointerup="onRowPointerUp(pitch, $event)">
            <div class="pitch-gutter" :class="{ 'black-key': isBlackKey(pitch) }">{{ noteLabel(pitch) }}</div>
            <div v-for="s in 16" :key="s" class="step-cell note-cell" :class="cellClass(s - 1, pitch)">
              <span v-if="cellNoteLabel(s - 1, pitch)" class="note-cell__label">
                {{ cellNoteLabel(s - 1, pitch) }}
              </span>
            </div>
          </div>
        </div>
        <div class="roll-row motion-row">
          <div class="pitch-gutter"></div>
          <div class="motion-bars large" :class="{ disabled: !seqStore.motionEnabled[selectedMotionIndex] }"
            @pointerdown="startDrag(selectedMotionIndex, $event)" @pointermove="dragMove(selectedMotionIndex, $event)"
            @pointerup="endDrag" @pointerleave="endDrag">
            <div v-for="s in 16" :key="s" class="step-cell motion-col"
              :class="{ beat: (s - 1) % 4 === 0, cursor: stepInputActive && s - 1 === stepCursor }">
              <div class="motion-fill"
                :style="{ height: (seqStore.motionValues[selectedMotionIndex][s - 1] / 127 * 100) + '%' }"></div>
              <input v-if="editingMotionStep === s - 1" v-model.number="motionEditValue" type="number" min="0"
                max="127" class="motion-value-input" :aria-label="`Motion step ${s}`"
                @pointerdown.stop @dblclick.stop @blur="commitMotionValue" @keydown.enter.prevent="commitMotionValue"
                @keydown.escape.prevent="cancelMotionValueEdit" />
              <span v-else class="motion-value" title="Double-click to edit" @pointerdown.stop
                @dblclick.stop="beginMotionValueEdit(s - 1)">
                {{ seqStore.motionValues[selectedMotionIndex][s - 1] }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="motion-control mt-2">
        <div class="select-control motion-control__select">
          <label>{{ texts.motionTarget }}</label>
          <v-select :items="motionSelectItems" item-title="label" item-value="value" v-model="selectedMotionIndex"
            aria-label="Motion parameter" density="compact" hide-details />
        </div>
        <div class="motion-toggle-control">
          <span class="motion-control__state-label">On/Off</span>
          <AppToggle v-model="seqStore.motionEnabled[selectedMotionIndex]" :aria-label="texts.motionEnable" />
        </div>
      </div>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useSequencerStore } from '@/stores/sequencerStore';
import AppToggle from '@/components/AppToggle.vue';
import PresetLibraryDialog from '@/components/PresetLibraryDialog.vue';
import { useMidiStore, MIDIConnectionState } from '@/stores/midiStore';
import { MOTION_PARAM_LABELS, type SequenceState } from '@/types/sequence';
import { countBarsInSmf, extractStepNotes, parseSmf } from '@/utils/smfImport';
import { AudioLines, FileUp, Library, Piano, Trash2, Upload, X } from '@lucide/vue';
import { MidiSequenceCapture, type SequencePlaybackResolution } from '@/utils/midiSequenceCapture';

const seqStore = useSequencerStore();
const midiStore = useMidiStore();

const userLanguage = navigator.language.startsWith('ja') ? 'ja' : 'en';

const TEXTS = {
  ja: {
    program: 'プログラム No.',
    getCurrentProgram: '取得',
    programFetchFailedTitle: 'プログラム番号を取得できませんでした',
    programFetchFailed: 'volca fm2とのMIDI IN/OUT接続を確認してください。',
    programFetchTitle: 'プログラム No. を取得',
    receivingProgramsForMatch: '照合用の音色データを受信中…',
    matchingCurrentProgram: '現在の音色からプログラム No. を照合中…',
    velocity: 'ベロシティ',
    gate: 'ゲート %',
    clear: 'クリア',
    captureButton: 'シーケンス取り込み',
    captureTitle: 'シーケンス取り込み',
    captureDescription: 'volca fm2の現在のシーケンスを1周再生し、MIDIノートと16ステップを取り込みます。',
    captureResolution: 'volca fm2のステップ解像度',
    captureStep1: 'volca fm2のMIDI OUTがインターフェースのMIDI INに接続されていることを確認します。',
    captureStep2: 'volca fm2のMIDI ClockとMIDI Noteの送信を有効にします。',
    captureStep3: '開始すると現在のノートは、取り込んだ演奏で置き換えられます。',
    captureStart: '開始',
    captureCancel: '取り込みを中止',
    captureRunning: 'MIDI Clockとノートを受信中です…',
    captureProgress: (n: number) => `ステップ ${n}/16`,
    captureDone: (n: number) => `${n}音をピアノロールに取り込みました。`,
    captureNoClock: 'MIDI Clockを受信できませんでした。MIDI OUTの配線とvolca fm2のClock送信設定を確認してください。',
    captureClockStopped: 'MIDI Clockが途中で止まりました。volca fm2の再生状態とMIDI OUTの接続を確認してください。',
    captureStartFailed: 'MIDI Startを送信できませんでした。MIDI IN/OUTの接続を確認してください。',
    importSmf: 'SMFインポート',
    importSettings: 'SMFインポート',
    importBar: '開始小節',
    cancel: 'キャンセル',
    import: 'インポート',
    importOk: (n: number, totalBars: number) => `SMFから${n}音をインポートしました。(全${totalBars}小節中の指定小節)`,
    importError: 'インポート失敗',
    send: '送信',
    sendFailedTitle: '送信できませんでした',
    sendNak: '送信しましたがvolca fm2がエラーを返しました(NAK)。',
    sendError: '送信できませんでした。接続を確認してください。',
    stepInputOn: 'ステップ入力',
    stepInputOff: 'ステップ入力',
    stepInputExit: 'ステップ入力を終了',
    stepIndicator: (n: number) => `ステップ ${n}/16`,
    stepPrev: '前のステップへ',
    stepNext: '次のステップへ (無音のまま進む)',
    stepReset: '先頭に戻す',
    motionParam: 'パラメーター',
    motionTarget: 'モーションの対象',
    motionEnable: 'このパラメーターのモーションを有効化',
  },
  en: {
    program: 'Program No.',
    getCurrentProgram: 'Get',
    programFetchFailedTitle: 'Could not get the program number',
    programFetchFailed: 'Please check both MIDI IN and MIDI OUT connections to the volca fm2.',
    programFetchTitle: 'Get program number',
    receivingProgramsForMatch: 'Receiving voice data for comparison…',
    matchingCurrentProgram: 'Matching the current voice to a program number…',
    velocity: 'Velocity',
    gate: 'Gate %',
    clear: 'Clear',
    captureButton: 'Capture sequence',
    captureTitle: 'Capture sequence',
    captureDescription: 'Play the current volca fm2 sequence once and capture its MIDI notes as 16 steps.',
    captureResolution: 'volca fm2 step resolution',
    captureStep1: 'Confirm that MIDI OUT on the volca fm2 is connected to MIDI IN on the interface.',
    captureStep2: 'Enable MIDI Clock and MIDI Note transmission on the volca fm2.',
    captureStep3: 'Starting capture will replace the current notes with the captured performance.',
    captureStart: 'Start',
    captureCancel: 'Cancel capture',
    captureRunning: 'Receiving MIDI Clock and notes…',
    captureProgress: (n: number) => `Step ${n}/16`,
    captureDone: (n: number) => `Captured ${n} note(s) into the piano roll.`,
    captureNoClock: 'No MIDI Clock was received. Check the MIDI OUT connection and the volca fm2 Clock transmit setting.',
    captureClockStopped: 'MIDI Clock stopped during capture. Check playback on the volca fm2 and the MIDI OUT connection.',
    captureStartFailed: 'Could not send MIDI Start. Check the MIDI IN and MIDI OUT connections.',
    importSmf: 'Import SMF',
    importSettings: 'Import SMF',
    importBar: 'Start bar',
    cancel: 'Cancel',
    import: 'Import',
    importOk: (n: number, totalBars: number) => `Imported ${n} note(s) from the SMF. (bar out of ${totalBars} total)`,
    importError: 'Import failed',
    send: 'Send',
    sendFailedTitle: 'Send failed',
    sendNak: 'Sent, but volca fm2 returned an error (NAK).',
    sendError: 'Failed to send. Please check your connection.',
    stepInputOn: 'Step Input',
    stepInputOff: 'Step Input',
    stepInputExit: 'Exit step input',
    stepIndicator: (n: number) => `Step ${n}/16`,
    stepPrev: 'Previous step',
    stepNext: 'Next step (leave silent)',
    stepReset: 'Reset to step 1',
    motionParam: 'Parameter',
    motionTarget: 'Motion target',
    motionEnable: 'Enable motion for this parameter',
  },
};

const texts = computed(() => TEXTS[userLanguage]);
const selectedMotionIndex = ref(0);
const showLibrary = ref(false);
const motionSelectItems = computed(() =>
  MOTION_PARAM_LABELS.map((p, i) => ({ label: p.en, value: i }))
);

const canSend = computed(() =>
  midiStore.connectionState === MIDIConnectionState.DETECTED ||
  midiStore.connectionState === MIDIConnectionState.RECEIVED
);
const isFetchingCurrentProgram = computed(() =>
  midiStore.currentProgramFetchState === 'loading-programs' ||
  midiStore.currentProgramFetchState === 'requesting'
);
const programFetchStatusText = computed(() =>
  midiStore.currentProgramFetchState === 'loading-programs'
    ? texts.value.receivingProgramsForMatch
    : texts.value.matchingCurrentProgram
);

type CapturePhase = 'ready' | 'capturing' | 'done' | 'error';
const showCaptureDialog = ref(false);
const capturePhase = ref<CapturePhase>('ready');
const captureProgress = ref(0);
const capturedStepCount = ref(0);
const capturedNoteCount = ref(0);
const captureErrorMessage = ref('');
const captureResolution = ref<SequencePlaybackResolution>(1);
let midiCapture: MidiSequenceCapture | null = null;
let unsubscribeMidiCapture: (() => void) | null = null;
let captureClockTimeout: ReturnType<typeof setTimeout> | null = null;
let captureStartDelay: ReturnType<typeof setTimeout> | null = null;
let captureStartedAt = 0;
let lastCaptureClockAt = 0;
let ignoredDuplicateMessages = 0;
const recentCaptureMessages = new Map<string, number>();
const CAPTURE_DUPLICATE_WINDOW_MS = 5;

const captureLog = (message: string) => midiStore.addLog(`[CAPTURE] ${message}`);
const midiHex = (data: Uint8Array) => Array.from(data)
  .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
  .join(' ');

const clearCaptureResources = () => {
  unsubscribeMidiCapture?.();
  unsubscribeMidiCapture = null;
  if (captureClockTimeout) clearTimeout(captureClockTimeout);
  captureClockTimeout = null;
  if (captureStartDelay) clearTimeout(captureStartDelay);
  captureStartDelay = null;
};

const openCaptureDialog = () => {
  capturePhase.value = 'ready';
  captureProgress.value = 0;
  capturedStepCount.value = 0;
  capturedNoteCount.value = 0;
  captureErrorMessage.value = '';
  showCaptureDialog.value = true;
};

const failMidiCapture = (message: string) => {
  captureLog(`FAILED: ${message} clocks=${midiCapture?.clockCount ?? 0} elapsed=${Math.round(performance.now() - captureStartedAt)}ms`);
  clearCaptureResources();
  midiStore.sendMidiMessage(new Uint8Array([0xfc]));
  captureErrorMessage.value = message;
  capturePhase.value = 'error';
};

const finishMidiCapture = () => {
  if (!midiCapture || midiCapture.clockCount === 0) {
    failMidiCapture(texts.value.captureNoClock);
    return;
  }
  const result = midiCapture.finish();
  captureLog(`Finishing capture: clocks=${result.clockCount}, rawNotes=${result.notes.length}, velocity=${result.velocity}, gate=${result.gatePercent}%, ignoredDuplicates=${ignoredDuplicateMessages}`);
  clearCaptureResources();
  midiStore.sendMidiMessage(new Uint8Array([0xfc]));

  seqStore.notes = [];
  let added = 0;
  for (const note of result.notes) {
    if (seqStore.addNote(note.pitch, note.startStep, note.length)) added++;
  }
  if (added > 0) {
    seqStore.velocity = result.velocity;
    seqStore.gatePercent = result.gatePercent;
  }
  capturedNoteCount.value = added;
  capturedStepCount.value = 16;
  captureProgress.value = 100;
  capturePhase.value = 'done';
  captureLog(`DONE: importedNotes=${added}, rejectedNotes=${result.notes.length - added}, elapsed=${Math.round(performance.now() - captureStartedAt)}ms`);
};

const beginMidiCaptureAfterStop = () => {
  captureStartDelay = null;
  if (capturePhase.value !== 'capturing') return;
  midiCapture = new MidiSequenceCapture(captureResolution.value);
  lastCaptureClockAt = 0;
  ignoredDuplicateMessages = 0;
  recentCaptureMessages.clear();
  captureLog(`Starting. resolution=1/${captureResolution.value}, clocksPerStep=${midiCapture.clocksPerStep}, expectedClocks=${midiCapture.clocksPerPattern}, MIDI IN="${midiStore.selectedMidiIn ?? 'none'}", MIDI OUT="${midiStore.selectedMidiOut ?? 'none'}"`);

  unsubscribeMidiCapture = midiStore.onMidiMessage((data, inputName) => {
    if (inputName !== midiStore.selectedMidiIn) return;
    const status = data[0];
    const now = performance.now();
    const signature = Array.from(data).join(',');
    const previousMessageAt = recentCaptureMessages.get(signature);
    recentCaptureMessages.set(signature, now);
    if (previousMessageAt !== undefined && now - previousMessageAt <= CAPTURE_DUPLICATE_WINDOW_MS) {
      ignoredDuplicateMessages++;
      if (ignoredDuplicateMessages === 1 || ignoredDuplicateMessages % 16 === 0) {
        captureLog(`Ignored duplicate MIDI message #${ignoredDuplicateMessages}: ${midiHex(data)} (${(now - previousMessageAt).toFixed(1)}ms after original)`);
      }
      return;
    }
    const messageType = status & 0xf0;
    if (status === 0xf8) {
      const interval = lastCaptureClockAt === 0 ? 0 : now - lastCaptureClockAt;
      lastCaptureClockAt = now;
      captureLog(`Clock ${Math.min((midiCapture?.clockCount ?? 0) + 1, midiCapture?.clocksPerPattern ?? 0)}/${midiCapture?.clocksPerPattern ?? 0}, interval=${interval.toFixed(1)}ms`);
    } else if (status === 0xfa) {
      captureLog(`RX Start (${midiHex(data)})`);
    } else if (status === 0xfb) {
      captureLog(`RX Continue (${midiHex(data)})`);
    } else if (status === 0xfc) {
      captureLog(`RX Stop at clock=${midiCapture?.clockCount ?? 0} (${midiHex(data)})`);
    } else if (messageType === 0x90 || messageType === 0x80) {
      const noteOn = messageType === 0x90 && (data[2] ?? 0) > 0;
      captureLog(`${noteOn ? 'Note On' : 'Note Off'} note=${data[1] ?? '-'} velocity=${data[2] ?? 0} clock=${midiCapture?.clockCount ?? 0} (${midiHex(data)})`);
    } else {
      captureLog(`RX MIDI (${midiHex(data)})`);
    }
    const result = midiCapture?.handleMessage(data);
    if (status === 0xf8 && midiCapture) {
      if (captureClockTimeout) clearTimeout(captureClockTimeout);
      captureClockTimeout = setTimeout(() => {
        captureLog(`Clock watchdog expired after clock=${midiCapture?.clockCount ?? 0}`);
        failMidiCapture(texts.value.captureClockStopped);
      }, 3000);
      capturedStepCount.value = midiCapture.stepCount;
      captureProgress.value = (capturedStepCount.value / 16) * 100;
    }
    if (result === 'complete') finishMidiCapture();
  });

  captureClockTimeout = setTimeout(() => {
    if (midiCapture?.clockCount === 0) {
      captureLog('Initial Clock timeout expired; no MIDI Clock received within 3000ms');
      failMidiCapture(texts.value.captureNoClock);
    }
  }, 3000);

  if (!midiStore.sendMidiMessage(new Uint8Array([0xfa]))) {
    failMidiCapture(texts.value.captureStartFailed);
  } else {
    captureLog('TX Start (FA) succeeded');
  }
};

const startMidiCapture = () => {
  capturePhase.value = 'capturing';
  captureProgress.value = 0;
  capturedStepCount.value = 0;
  captureStartedAt = performance.now();
  midiCapture = null;

  captureLog('Sending pre-capture Stop (FC)...');
  if (!midiStore.sendMidiMessage(new Uint8Array([0xfc]))) {
    failMidiCapture(texts.value.captureStartFailed);
    return;
  }
  captureLog('TX pre-capture Stop (FC) succeeded; waiting 100ms before Start');
  captureStartDelay = setTimeout(beginMidiCaptureAfterStop, 100);
};

const cancelMidiCapture = () => {
  captureLog(`Cancelled by user at clock=${midiCapture?.clockCount ?? 0}`);
  clearCaptureResources();
  midiStore.sendMidiMessage(new Uint8Array([0xfc]));
  capturePhase.value = 'ready';
  showCaptureDialog.value = false;
};

const handleSend = () => {
  const bytes = seqStore.buildSysEx();
  midiStore.sendCurrentSequenceDump(bytes);
};

const sequenceSnapshot = (): SequenceState => ({
  programNo: seqStore.programNo,
  velocity: seqStore.velocity,
  gatePercent: seqStore.gatePercent,
  notes: JSON.parse(JSON.stringify(seqStore.notes)),
  motionEnabled: [...seqStore.motionEnabled],
  motionValues: seqStore.motionValues.map(values => [...values]),
});
const loadSequencePreset = (data: unknown) => seqStore.loadFromDecoded(data as SequenceState);

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

const pitchRange = computed(() => {
  const arr: number[] = [];
  for (let p = 96; p >= 36; p--) arr.push(p);
  return arr;
});

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteLabel = (pitch: number) => `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
const isBlackKey = (pitch: number) => [1, 3, 6, 8, 10].includes(pitch % 12);

// --- SMFインポート ---
const fileInputRef = ref<HTMLInputElement | null>(null);
const smfBarOffset = ref(1);
const pendingSmfFile = ref<File | null>(null);
const showImportDialog = ref(false);
const importResult = ref<{ ok: true; count: number; totalBars: number } | { ok: false; message: string } | null>(null);

const triggerImport = () => fileInputRef.value?.click();

const handleFileChange = (ev: Event) => {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  pendingSmfFile.value = file;
  showImportDialog.value = true;
  input.value = '';
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
    const totalBars = countBarsInSmf(parsed, 4);
    const { notes, velocity } = extractStepNotes(parsed, 4, Math.max(0, smfBarOffset.value - 1));
    seqStore.notes = [];
    seqStore.velocity = velocity;
    let added = 0;
    for (const n of notes) {
      if (seqStore.addNote(n.pitch, n.startStep, n.length)) added++;
    }
    importResult.value = { ok: true, count: added, totalBars };
  } catch (e) {
    importResult.value = { ok: false, message: String(e instanceof Error ? e.message : e) };
  } finally {
    pendingSmfFile.value = null;
  }
};

// --- ピアノロール: クリック=単発ノート、ドラッグ=タイで繋いだ和音 ---
const GUTTER_WIDTH = 56;
const dragState = ref<{ pitch: number; startStep: number; endStep: number } | null>(null);
const auditionTimers = new Map<number, ReturnType<typeof setTimeout>>();

const stopAuditionNote = (pitch: number) => {
  const timer = auditionTimers.get(pitch);
  if (timer) clearTimeout(timer);
  auditionTimers.delete(pitch);
  midiStore.sendMidiMessage(new Uint8Array([0x80, pitch, 0]));
};

const auditionPitches = (pitches: number[], duration = 320) => {
  const velocity = Math.max(1, Math.min(127, Math.round(seqStore.velocity)));
  for (const pitch of [...new Set(pitches)]) {
    if (auditionTimers.has(pitch)) stopAuditionNote(pitch);
    midiStore.sendMidiMessage(new Uint8Array([0x90, pitch, velocity]));
    auditionTimers.set(pitch, setTimeout(() => stopAuditionNote(pitch), duration));
  }
};

const stepFromEvent = (ev: PointerEvent): number => {
  const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  const x = ev.clientX - rect.left - GUTTER_WIDTH;
  const colWidth = (rect.width - GUTTER_WIDTH) / 16;
  return Math.min(15, Math.max(0, Math.floor(x / colWidth)));
};

const onRowPointerDown = (pitch: number, ev: PointerEvent) => {
  const step = stepFromEvent(ev);
  const existing = seqStore.noteAt(step, pitch);
  if (existing) {
    seqStore.removeNote(existing);
    return;
  }
  dragState.value = { pitch, startStep: step, endStep: step };
  (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
};

const onRowPointerMove = (pitch: number, ev: PointerEvent) => {
  if (!dragState.value || dragState.value.pitch !== pitch) return;
  dragState.value.endStep = stepFromEvent(ev);
};

const onRowPointerUp = (pitch: number, ev: PointerEvent) => {
  if (!dragState.value || dragState.value.pitch !== pitch) return;
  const { startStep, endStep } = dragState.value;
  const start = Math.min(startStep, endStep);
  const end = Math.max(startStep, endStep);
  if (seqStore.addNote(pitch, start, end - start + 1)) auditionPitches([pitch]);
  dragState.value = null;
};

// --- MIDIキーボードでのステップ入力 ---
const stepInputActive = ref(false);
const stepCursor = ref(0);
const heldNotes = ref<Set<number>>(new Set());
const chordBuffer = ref<Set<number>>(new Set());
let unsubscribeNoteEvent: (() => void) | null = null;

const commitChord = () => {
  const step = stepCursor.value;
  for (const pitch of chordBuffer.value) {
    seqStore.addNote(pitch, step, 1);
  }
  chordBuffer.value.clear();
  if (step === 15) {
    stepInputActive.value = false;
    heldNotes.value.clear();
    return;
  }
  stepCursor.value++;
};

const handleNoteEvent = (note: number, on: boolean) => {
  if (!stepInputActive.value) return;
  if (on) {
    heldNotes.value.add(note);
    chordBuffer.value.add(note);
  } else {
    heldNotes.value.delete(note);
    if (heldNotes.value.size === 0 && chordBuffer.value.size > 0) {
      commitChord();
    }
  }
};

const toggleStepInput = () => {
  stepInputActive.value = !stepInputActive.value;
  heldNotes.value.clear();
  chordBuffer.value.clear();
};

const stepNext = () => {
  if (stepCursor.value === 15) {
    stepInputActive.value = false;
    heldNotes.value.clear();
    chordBuffer.value.clear();
    return;
  }
  stepCursor.value++;
};
const stepPrev = () => {
  stepCursor.value = Math.max(0, stepCursor.value - 1);
};
const selectStep = (step: number) => {
  if (!stepInputActive.value) return;
  heldNotes.value.clear();
  chordBuffer.value.clear();
  stepCursor.value = Math.max(0, Math.min(15, step));
};

const onStepHeaderClick = (step: number) => {
  if (stepInputActive.value) selectStep(step);
  const pitches = seqStore.notes
    .filter(note => note.startStep <= step && note.startStep + note.length > step)
    .map(note => note.pitch);
  auditionPitches(pitches);
};

onMounted(() => {
  unsubscribeNoteEvent = midiStore.onNoteEvent(handleNoteEvent);
});
onUnmounted(() => {
  unsubscribeNoteEvent?.();
  for (const pitch of [...auditionTimers.keys()]) stopAuditionNote(pitch);
  clearCaptureResources();
});

const cellClass = (step: number, pitch: number) => {
  const note = seqStore.noteAt(step, pitch);
  const drag = dragState.value;
  const inPreview = !!drag && drag.pitch === pitch &&
    step >= Math.min(drag.startStep, drag.endStep) && step <= Math.max(drag.startStep, drag.endStep);
  const stepInputPreview = stepInputActive.value && step === stepCursor.value && chordBuffer.value.has(pitch);

  return {
    beat: step % 4 === 0,
    active: !!note || inPreview || stepInputPreview,
    full: !note && !inPreview && seqStore.stepNoteCount(step) >= 6,
    cursor: stepInputActive.value && step === stepCursor.value,
  };
};

const cellNoteLabel = (step: number, pitch: number) => {
  const note = seqStore.noteAt(step, pitch);
  const drag = dragState.value;
  const previewStart = !!drag && drag.pitch === pitch && step === Math.min(drag.startStep, drag.endStep);
  const stepInputPreview = stepInputActive.value && step === stepCursor.value && chordBuffer.value.has(pitch);
  return (note?.startStep === step) || previewStart || stepInputPreview ? noteLabel(pitch) : '';
};

const isDragging = ref(false);
const editingMotionStep = ref<number | null>(null);
const motionEditValue = ref(0);

const beginMotionValueEdit = (step: number) => {
  editingMotionStep.value = step;
  motionEditValue.value = seqStore.motionValues[selectedMotionIndex.value][step];
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>('.motion-value-input');
    input?.focus();
    input?.select();
  });
};

const commitMotionValue = () => {
  if (editingMotionStep.value === null) return;
  const value = Number(motionEditValue.value);
  if (Number.isFinite(value)) {
    seqStore.setMotionValue(selectedMotionIndex.value, editingMotionStep.value, value);
  }
  editingMotionStep.value = null;
};

const cancelMotionValueEdit = () => {
  editingMotionStep.value = null;
};

const applyDrag = (paramIndex: number, ev: PointerEvent) => {
  if (!seqStore.motionEnabled[paramIndex]) return;
  const target = ev.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const col = Math.min(15, Math.max(0, Math.floor((ev.clientX - rect.left) / (rect.width / 16))));
  const ratio = 1 - Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
  seqStore.setMotionValue(paramIndex, col, ratio * 127);
};

const startDrag = (paramIndex: number, ev: PointerEvent) => {
  isDragging.value = true;
  applyDrag(paramIndex, ev);
};
const dragMove = (paramIndex: number, ev: PointerEvent) => {
  if (isDragging.value) applyDrag(paramIndex, ev);
};
const endDrag = () => {
  isDragging.value = false;
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

.sequencer-toolbar {
  flex: 0 0 auto;
  min-height: 40px;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
}

.sequencer-toolbar > .v-col {
  flex-shrink: 0;
}

.sequencer-card > .v-alert,
.sequencer-card > .v-divider {
  flex: 0 0 auto;
}

.program-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.program-control__label {
  color: #d8ccc4;
  font-size: var(--volca-type-body);
  white-space: nowrap;
}

.program-control__input {
  width: 82px;
  flex: 0 0 82px;
}

.program-fetch-status__copy {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
  color: #d8ccc4;
  font-size: var(--volca-type-body);
}

.program-fetch-status__count {
  color: #b9aaa2;
  font-variant-numeric: tabular-nums;
}

.capture-copy,
.capture-status {
  margin: 0;
  color: #d8ccc4;
  line-height: 1.65;
}

.capture-steps {
  margin: 16px 0 0;
  padding-left: 22px;
  color: #b9aaa2;
  line-height: 1.7;
}

.capture-resolution {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.capture-resolution__label {
  color: #d8ccc4;
  font-size: var(--volca-type-body);
}

.capture-resolution :deep(.v-btn) {
  min-width: 64px;
}

.capture-progress {
  margin: 10px 0 0;
  color: #b9aaa2;
  font-size: var(--volca-type-body);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.roll {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  border: 1px solid #55454780;
  border-radius: 4px;
  overflow: hidden;
}

.roll-header,
.roll-row {
  display: flex;
}

.roll-header {
  flex: 0 0 auto;
}

.roll-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.motion-row {
  flex: 0 0 auto;
  border-top: 4px solid #CEB393;
}

.pitch-gutter {
  flex: 0 0 56px;
  font-size: var(--volca-type-body);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  box-sizing: border-box;
  background: #382b2d;
  position: sticky;
  left: 0;
}

.pitch-gutter.black-key {
  background: #2a2021;
  color: #9d8570;
}

.step-cell {
  flex: 1 1 0;
  width: 0;
  min-width: 28px;
  box-sizing: border-box;
  border-left: 1px solid #55454740;
}

.header-cell {
  position: relative;
  text-align: center;
  font-size: var(--volca-type-body);
  padding: 4px 0;
  background: #4a3a3c;
}

.header-cell.cursor {
  color: #f1e9e1;
  font-weight: bold;
}

.header-cell.selectable {
  cursor: pointer;
}

.header-cell.selectable:focus-visible {
  z-index: 2;
  outline: 2px solid #CEB393;
  outline-offset: -2px;
}

.note-cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 20px;
  border-top: 1px solid #55454726;
  cursor: pointer;
  touch-action: none;
}

.note-cell__label {
  position: relative;
  z-index: 2;
  overflow: hidden;
  color: #382b2d;
  font-size: var(--volca-type-label);
  font-weight: 700;
  line-height: 1;
  padding-left: 4px;
  text-overflow: clip;
  white-space: nowrap;
  pointer-events: none;
}

.step-cell.cursor {
  position: relative;
}

.step-cell.cursor::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(206, 179, 147, 0.2);
  pointer-events: none;
}

.step-cell.beat {
  border-left: 1px solid #CEB39380;
}

.note-cell.active {
  background: #CEB393;
}

.note-cell.full {
  cursor: not-allowed;
}

.step-indicator {
  font-size: var(--volca-type-body);
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  padding: 0 4px;
}

.motion-control {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.motion-control__label {
  color: #d8ccc4;
  font-size: var(--volca-type-body);
  font-weight: 650;
}

.motion-control__state-label {
  color: #b9aaa2;
  font-size: var(--volca-type-label);
  white-space: nowrap;
}

.motion-toggle-control { display: grid; justify-items: center; align-content: start; gap: 5px; }


.motion-control__select {
  flex: 0 0 280px;
  width: 280px;
}

.select-control { display: grid; align-content: start; gap: 5px; min-width: 0; }
.select-control > label { color: #d8ccc4; font-size: var(--volca-type-label); line-height: 1.25; }
.select-control > :deep(.v-input) { margin-block: 12px; }

.motion-bars {
  flex: 1 1 auto;
  display: flex;
  height: 40px;
  box-sizing: border-box;
  touch-action: none;
  cursor: pointer;
}

.motion-bars.large {
  height: 160px;
}

.motion-bars.disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}

.motion-col {
  position: relative;
  display: flex;
  align-items: flex-end;
}

.motion-col.beat {
  border-left: 1px solid #CEB39380;
}

.motion-fill {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  background: #CEB393;
}

.motion-value,
.motion-value-input {
  position: absolute;
  top: 6px;
  right: 3px;
  left: 3px;
  z-index: 2;
  color: #f1e9e1;
  font-size: var(--volca-type-label);
  font-variant-numeric: tabular-nums;
  line-height: 22px;
  text-align: center;
}

.motion-value {
  cursor: text;
  user-select: none;
}

.motion-value-input {
  height: 24px;
  padding: 0 2px;
  border: 1px solid #CEB393;
  border-radius: 4px;
  outline: none;
  background: #382b2d;
  appearance: textfield;
}

.motion-value-input::-webkit-inner-spin-button,
.motion-value-input::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
}
</style>
