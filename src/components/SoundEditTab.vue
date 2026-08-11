<template>
  <v-container class="sound-container">
    <AppErrorDialog v-model="showError" :title="t('sound.title')" :message="t('sound.connectionError')" />

    <AppDialog v-model="showAlgorithmPicker" :title="t('sound.selectAlgorithm')" max-width="1040" card-class="algorithm-picker-card">
        <div class="algorithm-picker-grid">
          <button v-for="algorithm in 32" :key="algorithm" type="button" class="algorithm-option"
            :class="{ selected: program.algorithm === algorithm - 1 }" @click="selectAlgorithm(algorithm - 1)">
            <strong>{{ t('sound.algorithm') }} {{ algorithm }}</strong>
            <AlgorithmDiagram :algorithm="algorithm - 1" :enabled="program.operators.map(operator => operator.enabled)"
              :selected-operator="-1" />
          </button>
        </div>
    </AppDialog>

    <PresetLibraryDialog v-model="showLibrary" kind="sound" :title="t('sound.library')"
      :suggested-name="program.name.trim() || t('sound.untitled')" :snapshot="soundSnapshot" @load="loadSoundPreset" />

    <v-card class="sound-card pa-4">
      <div class="sound-toolbar">
        <div>
          <h2>{{ t('sound.title') }}</h2>
        </div>
        <v-text-field v-model="program.name" :label="t('sound.voiceName')" maxlength="10" counter="10"
          density="compact" hide-details class="voice-name" />
        <v-btn @click="midiStore.requestCurrentVoiceDump" :disabled="!canSend"
          :loading="midiStore.soundEditState === 'requesting'">
          {{ t('sound.getCurrent') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="resetProgram">{{ t('sound.initialize') }}</v-btn>
        <v-btn class="send-button" :class="{ 'needs-send': hasUnsavedChanges }" @click="sendProgram"
          :disabled="!canSend" :loading="midiStore.soundEditState === 'sending'">
          {{ t('common.send') }}
          <Upload :size="16" class="ml-1" />
        </v-btn>
        <v-btn icon variant="text" :title="t('sound.library')" :aria-label="t('sound.library')" @click="showLibrary = true">
          <Library :size="19" />
        </v-btn>
      </div>

      <v-divider class="my-4" />

      <div class="sound-workspace">
        <aside class="sound-panel operator-nav">
          <div class="algorithm-control">
            <AlgorithmDiagram :algorithm="program.algorithm" :enabled="program.operators.map(operator => operator.enabled)"
              :selected-operator="selectedOperator" pickable large-nodes @select="selectOperator" @open="showAlgorithmPicker = true" />
            <div class="algorithm-legend" aria-label="Algorithm diagram legend">
              <span><i class="route"></i>{{ t('sound.modulation') }}</span>
              <span><i class="feedback"></i>{{ t('sound.feedback') }}</span>
              <span><i class="output"></i>{{ t('sound.carrierOutput') }}</span>
            </div>
          </div>
          <div class="global-mini-grid">
            <NumberControl :model-value="program.algorithm + 1" :label="t('sound.algorithm')" :min="1" :max="32"
              @update:model-value="program.algorithm = $event - 1" />
            <NumberControl v-model="program.feedback" :label="t('sound.feedback')" :min="0" :max="7" />
          </div>

          <div class="left-utility-grid">
            <section class="global-section volca-macros">
              <h4>{{ t('sound.macros') }}</h4>
              <div class="control-grid two">
                <NumberControl v-for="control in macroControls" :key="control.key"
                  :model-value="programNumber(control.key)" :label="t(control.label)" :min="control.min" :max="control.max"
                  @update:model-value="setProgramNumber(control.key, $event)" />
              </div>
            </section>
            <section class="global-section transpose-section">
              <h4>{{ t('sound.transpose') }}</h4>
              <div class="transpose-controls">
                <NumberControl v-model="program.transpose" :label="t('sound.semitone')" :min="0" :max="48" :display-offset="-24" />
                <NumberControl v-model="program.octave" :label="t('sound.octave')" :min="-2" :max="2" />
              </div>
            </section>
          </div>

        </aside>

        <main class="sound-panel operator-editor">
          <div class="panel-title operator-heading">
            <h3>{{ selectedOperator < 0 ? t('sound.allOperators') : t('sound.operator', { count: selectedOperator + 1 }) }}</h3>
            <button v-if="selectedOperator >= 0" type="button" class="show-all-operators" @click="selectedOperator = -1">
              {{ t('sound.showAllOperators') }}
            </button>
          </div>

          <OperatorOverview v-if="selectedOperator < 0" :operators="program.operators" @select="selectedOperator = $event"
            @update="updateOverviewOperator" />

          <template v-else>
          <section class="edit-section">
            <div class="section-heading frequency-heading">
              <h4>{{ t('sound.frequencyOutput') }}</h4>
              <div class="frequency-heading-controls">
                <span>{{ frequencyLabel(selected) }}</span>
                <AppToggle v-model="selected.enabled" :aria-label="t('sound.operator', { count: selectedOperator + 1 })" />
              </div>
            </div>
            <div class="control-grid four">
              <div class="mode-control">
                <label>{{ t('sound.mode') }}</label>
                <div class="mode-segment" role="group" :aria-label="t('sound.oscillatorMode')">
                  <button type="button" :class="{ active: selected.oscillatorMode === 0 }"
                    :aria-pressed="selected.oscillatorMode === 0" @click="selected.oscillatorMode = 0">{{ t('sound.ratio') }}</button>
                  <button type="button" :class="{ active: selected.oscillatorMode === 1 }"
                    :aria-pressed="selected.oscillatorMode === 1" @click="selected.oscillatorMode = 1">{{ t('sound.fixed') }}</button>
                </div>
              </div>
              <NumberControl v-for="control in operatorFrequencyControls" :key="control.key"
                :model-value="operatorNumber(control.key)" :label="t(control.label)" :min="control.min" :max="control.max"
                :display-offset="control.displayOffset" @update:model-value="setOperatorNumber(control.key, $event)" />
            </div>
          </section>

          <section class="edit-section">
            <div class="section-heading"><h4>{{ t('sound.amplitudeEnvelope') }}</h4><span>{{ t('sound.rateLevel') }}</span></div>
            <div class="envelope-layout">
              <svg class="envelope-graph" viewBox="0 0 420 170" role="img" aria-label="Amplitude envelope">
                <path class="envelope-grid" d="M0 35H420M0 85H420M0 135H420M105 0V170M210 0V170M315 0V170" />
                <polyline class="envelope-line" :points="envelopePoints(selected.egRates, selected.egLevels)" />
                <circle v-for="(point, index) in envelopeCircles(selected.egRates, selected.egLevels)" :key="index" :cx="point.x" :cy="point.y" r="5" />
              </svg>
              <div class="envelope-values">
                <NumberControl v-for="index in 4" :key="`l${index}`" v-model="selected.egLevels[index - 1]"
                  :label="t('sound.level', { count: index })" :min="0" :max="99" compact />
                <NumberControl v-for="index in 4" :key="`r${index}`" v-model="selected.egRates[index - 1]"
                  :label="t('sound.rate', { count: index })" :min="0" :max="99" compact />
              </div>
            </div>
          </section>

          <section class="edit-section keyboard-scaling">
            <div class="section-heading"><h4>{{ t('sound.keyboardScaling') }}</h4><span>{{ t('sound.keyResponse') }}</span></div>
            <div class="control-grid scaling-grid">
              <NumberControl v-model="selected.leftDepth" :label="t('sound.leftDepth')" :min="0" :max="99" />
              <NumberControl v-model="selected.breakPoint" :label="t('sound.breakPoint')" :min="0" :max="99" />
              <NumberControl v-model="selected.rightDepth" :label="t('sound.rightDepth')" :min="0" :max="99" />
              <CurveSelector v-model="selected.leftCurve" :label="t('sound.leftCurve')" direction="right" />
              <NumberControl v-model="selected.rateScaling" :label="t('sound.rateScaling')" :min="0" :max="7" />
              <CurveSelector v-model="selected.rightCurve" :label="t('sound.rightCurve')" direction="left" />
            </div>
          </section>
          </template>
        </main>

        <aside class="sound-panel global-editor">
          <section class="global-section">
            <h4>LFO</h4>
            <div class="select-control"><label>{{ t('sound.waveform') }}</label><v-select v-model="program.lfoWave" :items="lfoWaveItems" :aria-label="t('sound.waveform')" density="compact" hide-details /></div>
            <div class="control-grid three mt-2">
              <NumberControl v-for="control in lfoControls" :key="control.key"
                :model-value="programNumber(control.key)" :label="t(control.label)" :min="control.min" :max="control.max"
                @update:model-value="setProgramNumber(control.key, $event)" />
              <div class="toggle-row stacked-control"><span>{{ t('sound.lfoKeySync') }}</span><AppToggle v-model="program.lfoSync" :aria-label="t('sound.lfoKeySync')" /></div>
              <div class="toggle-row stacked-control"><span>{{ t('sound.oscKeySync') }}</span><AppToggle v-model="program.oscillatorSync" :aria-label="t('sound.oscKeySync')" /></div>
            </div>
          </section>

          <section class="global-section">
            <h4>{{ t('sound.pitchEnvelope') }}</h4>
            <svg class="pitch-envelope" viewBox="0 0 320 90" aria-label="Pitch envelope">
              <path class="envelope-grid" d="M0 45H320M80 0V90M160 0V90M240 0V90" />
              <polyline class="envelope-line" :points="pitchEnvelopePoints" />
            </svg>
            <div class="pitch-values">
              <NumberControl v-for="index in 4" :key="`pl${index}`" v-model="program.pitchEgLevels[index - 1]"
                :label="`L${index}`" :min="0" :max="99" compact />
              <NumberControl v-for="index in 4" :key="`pr${index}`" v-model="program.pitchEgRates[index - 1]"
                :label="`R${index}`" :min="0" :max="99" compact />
            </div>
          </section>

        </aside>
      </div>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Library, Upload } from '@lucide/vue';
import AlgorithmDiagram from '@/components/AlgorithmDiagram.vue';
import AppToggle from '@/components/AppToggle.vue';
import CurveSelector from '@/components/CurveSelector.vue';
import KnobControl from '@/components/KnobControl.vue';
import OperatorOverview from '@/components/OperatorOverview.vue';
import PresetLibraryDialog from '@/components/PresetLibraryDialog.vue';
import AppErrorDialog from '@/components/dialogs/AppErrorDialog.vue';
import AppDialog from '@/components/dialogs/AppDialog.vue';
import { useMidiStore, MIDIConnectionState } from '@/stores/midiStore';
import type { SoundOperator, SoundProgram } from '@/types/soundProgram';
import { createInitialSoundProgram, decodeSoundProgram, encodeSoundProgram, normalizeSoundProgramName } from '@/utils/soundProgramCodec';
import { dx7EnvelopeGeometry, dx7EnvelopePoints } from '@/utils/dx7Envelope';
import { formatOperatorFrequency } from '@/utils/operatorFrequency';
import { useI18n } from 'vue-i18n';
import { lfoControls, macroControls, operatorFrequencyControls, type OperatorNumberKey, type ProgramNumberKey } from '@/features/sound/soundControlDefinitions';

const midiStore = useMidiStore();
const { t } = useI18n();
const program = ref(createInitialSoundProgram());
const selectedOperator = ref(-1);
const showError = ref(false);
const showAlgorithmPicker = ref(false);
const showLibrary = ref(false);
const currentVoiceRequestPending = ref(true);
const loadedProgramSignature = ref<string | null>(null);
let unsubscribeProgramChange: (() => void) | null = null;
const selected = computed(() => program.value.operators[Math.max(0, selectedOperator.value)]);
const operatorNumber = (key: OperatorNumberKey) => selected.value[key] as number;
const setOperatorNumber = (key: OperatorNumberKey, value: number) => { (selected.value[key] as number) = value; };
const programNumber = (key: ProgramNumberKey) => program.value[key] as number;
const setProgramNumber = (key: ProgramNumberKey, value: number) => { (program.value[key] as number) = value; };
const canSend = computed(() => [MIDIConnectionState.DETECTED, MIDIConnectionState.RECEIVING, MIDIConnectionState.RECEIVED]
  .includes(midiStore.connectionState));
const programSignature = () => Array.from(encodeSoundProgram(program.value)).join(',');
const hasUnsavedChanges = computed(() => loadedProgramSignature.value !== null
  && programSignature() !== loadedProgramSignature.value);

watch(() => midiStore.currentVoiceData, data => {
  if (data) {
    program.value = decodeSoundProgram(data);
    loadedProgramSignature.value = programSignature();
  }
});
watch(() => midiStore.soundEditState, state => {
  if (state === 'error') showError.value = true;
  if (state === 'ok') loadedProgramSignature.value = programSignature();
});
watch(() => midiStore.connectionState, state => {
  if (state === MIDIConnectionState.RECEIVED && currentVoiceRequestPending.value) {
    currentVoiceRequestPending.value = false;
    midiStore.requestCurrentVoiceDump();
  }
}, { immediate: true });

onMounted(() => {
  unsubscribeProgramChange = midiStore.onProgramChange(() => {
    if (midiStore.connectionState === MIDIConnectionState.RECEIVED) {
      currentVoiceRequestPending.value = false;
      midiStore.requestCurrentVoiceDump();
    } else {
      currentVoiceRequestPending.value = true;
    }
  });
});
onUnmounted(() => unsubscribeProgramChange?.());

const resetProgram = () => { program.value = createInitialSoundProgram(); };
const selectAlgorithm = (algorithm: number) => {
  program.value.algorithm = algorithm;
  showAlgorithmPicker.value = false;
};
const selectOperator = (operatorIndex: number) => {
  selectedOperator.value = selectedOperator.value === operatorIndex ? -1 : operatorIndex;
};
const updateOverviewOperator = (payload: { operatorIndex: number; field: keyof SoundOperator; value: number; arrayIndex?: number }) => {
  const operator = program.value.operators[payload.operatorIndex];
  if (payload.arrayIndex !== undefined) {
    (operator[payload.field] as number[])[payload.arrayIndex] = payload.value;
  } else {
    (operator[payload.field] as number) = payload.value;
  }
};
const sendProgram = () => {
  // Commit the current Voice Name input to the KORG current-voice payload before sending.
  program.value.name = normalizeSoundProgramName(program.value.name);
  midiStore.sendCurrentVoiceDump(encodeSoundProgram(program.value));
};
const soundSnapshot = () => JSON.parse(JSON.stringify(program.value)) as SoundProgram;
const loadSoundPreset = (data: unknown) => {
  program.value = data as SoundProgram;
  sendProgram();
};
const lfoWaveItems = ['Triangle', 'Saw Down', 'Saw Up', 'Square', 'Sine', 'Sample & Hold']
  .map((title, value) => ({ title, value }));

const frequencyLabel = formatOperatorFrequency;
const levelPercent = (level: number) => Math.pow(Math.max(0, level - 31) / 68, 1.12);
const segmentDuration = (rate: number, from: number, to: number) => {
  const rising = to > from;
  const duration = Math.max(rising ? .003 : .008, (rising ? 38 : 318) * Math.exp(-(rising ? .087 : .098) * rate));
  return Math.max(.0001, duration * Math.abs(levelPercent(to) - levelPercent(from)));
};
const envelopeGeometry = (rates: number[], levels: number[], width: number, height: number) => {
  const durations = [segmentDuration(rates[0], levels[3], levels[0]), segmentDuration(rates[1], levels[0], levels[1]), segmentDuration(rates[2], levels[1], levels[2]), segmentDuration(rates[3], levels[2], levels[3])];
  const hold = Math.max(1, durations[0] + durations[1] + durations[2]) * .16;
  const scale = (width - 16) / (durations.reduce((sum, value) => sum + value, hold));
  const xs = [8, 8 + durations[0] * scale];
  xs.push(xs[1] + durations[1] * scale, xs[1] + (durations[1] + durations[2]) * scale);
  xs.push(xs[3] + hold * scale, width - 8);
  const y = (level: number) => height - 12 - level * ((height - 24) / 99);
  return [levels[3], levels[0], levels[1], levels[2], levels[2], levels[3]].map((level, index) => ({ x: xs[index], y: y(level) }));
};
const envelopeCircles = (rates: number[], levels: number[]) => dx7EnvelopeGeometry(rates, levels, 420, 170).slice(1, 5);
const envelopePoints = (rates: number[], levels: number[]) => dx7EnvelopePoints(rates, levels, 420, 170);
const pitchEnvelopePoints = computed(() => envelopeGeometry(program.value.pitchEgRates, program.value.pitchEgLevels, 320, 90).map(point => `${point.x},${point.y}`).join(' '));
const NumberControl = KnobControl;
</script>

<style scoped>
.sound-container { height: 100%; box-sizing: border-box; }
.sound-card { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.sound-toolbar { display: flex; flex: 0 0 auto; align-items: center; gap: 12px; }
.sound-toolbar h2 { margin: 0; font-size: var(--volca-type-heading); }
.voice-name { width: 210px; flex: 0 0 210px; }
.send-button.needs-send:not(:disabled) { animation: send-attention 2.8s cubic-bezier(.45, 0, .55, 1) infinite; }
@keyframes send-attention {
  0%, 100% { filter: brightness(1); box-shadow: 0 2px 8px rgba(206,179,147,.08); }
  50% { filter: brightness(1.14); box-shadow: 0 4px 18px rgba(225,202,176,.42); }
}
@media (prefers-reduced-motion: reduce) {
  .send-button.needs-send:not(:disabled) { animation: none; box-shadow: 0 3px 12px rgba(225,202,176,.3); filter: brightness(1.1); }
}
.algorithm-picker-card { max-height: min(86vh, 900px); overflow: hidden; }
.algorithm-picker-header { display: flex; align-items: center; justify-content: space-between; }
.algorithm-picker-grid { display: grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap: 10px; padding: 10px 20px 20px; overflow-y: auto; }
.algorithm-option { min-width: 0; padding: 10px; border: 1px solid rgba(206,179,147,.18); border-radius: 10px; background: #2b2022; color: #d8ccc4; cursor: pointer; text-align: left; }
.algorithm-option:hover { border-color: rgba(206,179,147,.48); background: #35282a; }
.algorithm-option.selected { border-color: #ceb393; background: rgba(206,179,147,.12); color: #f1e9e1; }
.algorithm-option strong { display: block; margin-bottom: 7px; font-size: var(--volca-type-body); }
.algorithm-option :deep(.algorithm-diagram) { height: 142px; pointer-events: none; }
.sound-workspace { display: grid; flex: 1 1 auto; min-height: 0; grid-template-columns: 380px minmax(520px, 1fr) 330px; gap: 10px; overflow: auto; }
.sound-panel { min-height: 0; border: 1px solid rgba(206,179,147,.18); border-radius: 11px; background: rgba(48,36,38,.72); overflow: auto; }
.panel-title { display: flex; align-items: center; justify-content: space-between; min-height: 52px; padding: 10px 12px; border-bottom: 1px solid rgba(206,179,147,.16); }
.panel-title span { color: #ad9e96; font-size: var(--volca-type-label); font-weight: 750; letter-spacing: .08em; }
.panel-title h3 { margin: 2px 0 0; font-size: var(--volca-type-heading); }
.panel-title strong { color: #ceb393; font-size: var(--volca-type-body); }
.operator-nav { padding-bottom: 10px; }
.algorithm-control { display: grid; grid-template-columns: 1fr; justify-items: center; gap: 8px; margin: 8px 12px 10px; }
.algorithm-control > :deep(.algorithm-diagram) { justify-self: stretch; }
.algorithm-legend { display: flex; grid-column: 1 / -1; justify-content: center; gap: 10px; color: #ad9e96; font-size: var(--volca-type-label); }
.algorithm-legend span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.algorithm-legend i { width: 13px; height: 2px; display: inline-block; background: #f1e9e1; }
.algorithm-legend i.feedback { background: #72d5ca; }.algorithm-legend i.output { background: #e7bd76; }
.global-mini-grid { display: grid; grid-template-columns: 1fr 1fr; align-items: start; gap: 10px; padding: 2px 12px 14px; border-bottom: 1px solid rgba(206,179,147,.16); }
.operator-heading { position: sticky; top: 0; z-index: 3; background: #302426; }
.show-all-operators { padding: 5px 8px; border: 1px solid rgba(206,179,147,.28); border-radius: 7px; background: transparent; color: #c7b9b0; font: inherit; font-size: var(--volca-type-label); cursor: pointer; }
.show-all-operators:hover { border-color: rgba(206,179,147,.58); background: rgba(206,179,147,.08); color: #f1e9e1; }
.show-all-operators:focus-visible { outline: 2px solid #e1cab0; outline-offset: 2px; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: #ad9e96; font-size: var(--volca-type-label); }
.toggle-row.stacked-control { flex-direction: column; align-items: center; justify-content: flex-start; gap: 5px; }
.toggle-row.stacked-control > span { width: 100%; min-height: 18px; line-height: 1.25; text-align: center; }
.control-grid.three .toggle-row { flex-direction: column; justify-content: flex-start; }
.edit-section, .global-section { padding: 13px; border-bottom: 1px solid rgba(206,179,147,.15); }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }.section-heading h4, .global-section h4 { margin: 0; font-size: var(--volca-type-heading); }.section-heading span { color: #ad9e96; font-size: var(--volca-type-label); }
.frequency-heading { align-items: center; }
.frequency-heading-controls { display: flex; align-items: center; gap: 12px; }
.control-grid { display: grid; gap: 8px; }.control-grid.scaling-grid { grid-template-columns: repeat(3, minmax(120px,1fr)); }.control-grid.four { grid-template-columns: repeat(4, minmax(92px,1fr)); }.control-grid.three { grid-template-columns: repeat(3, minmax(84px,1fr)); align-items: start; }.control-grid.two { grid-template-columns: 1fr 1fr; }
.select-control { display: grid; align-content: start; gap: 5px; min-width: 0; }
.select-control > label { color: #ad9e96; font-size: var(--volca-type-label); line-height: 1.25; }
.select-control > :deep(.v-input) { margin-block: 12px; }
.mode-control { display: grid; align-content: start; gap: 5px; }
.mode-control > label { color: #ad9e96; font-size: var(--volca-type-label); }
.mode-segment { width: fit-content; height: 40px; display: grid; grid-template-columns: 1fr 1fr; padding: 3px; box-sizing: border-box; border: 1px solid rgba(206,179,147,.3); border-radius: 9px; background: #251c1e; }
.mode-segment button { width: 72px; height: 32px; padding: 0 12px; border: 0; background: transparent; color: #ad9e96; font: inherit; font-size: var(--volca-type-body); font-weight: 700; cursor: pointer; }
.mode-segment button + button { border-left: 1px solid rgba(206,179,147,.32); }
.mode-segment button:first-child { border-radius: 5px 0 0 5px; }
.mode-segment button:last-child { border-radius: 0 5px 5px 0; }
.mode-segment button:hover { background: rgba(206,179,147,.1); color: #f1e9e1; }
.mode-segment button.active { background: #ceb393; color: #33282a; }
.mode-segment button:focus-visible { position: relative; z-index: 1; outline: 2px solid #e1cab0; outline-offset: -2px; }
.envelope-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; }.envelope-graph, .pitch-envelope { width: 100%; border: 1px solid rgba(206,179,147,.15); border-radius: 8px; background: #251c1e; }.envelope-grid { fill: none; stroke: rgba(206,179,147,.1); }.envelope-line { fill: none; stroke: #ceb393; stroke-width: 2.5; }.envelope-graph circle { fill: #302426; stroke: #ceb393; stroke-width: 2; }.envelope-values, .pitch-values { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; align-content: start; }
.keyboard-scaling { border-bottom: 0; }.global-editor { padding-bottom: 8px; }
.left-utility-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(110px, 1fr); border-bottom: 1px solid rgba(206,179,147,.15); }
.left-utility-grid .global-section { border-bottom: 0; }
.transpose-section { border-left: 1px solid rgba(206,179,147,.15); }
.transpose-controls { display: grid; justify-items: center; gap: 12px; }
.global-section:last-child { border-bottom: 0; }.global-section > h4 { margin-bottom: 9px; }.pitch-envelope { height: 90px; margin-bottom: 8px; }
@media (max-width: 1300px) { .sound-workspace { grid-template-columns: 320px minmax(500px,1fr) 300px; } }
</style>
