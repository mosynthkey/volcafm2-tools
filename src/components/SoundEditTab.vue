<template>
  <v-container class="sound-container">
    <v-dialog v-model="showError" max-width="440">
      <v-card class="pa-4">
        <v-card-title>Sound Edit</v-card-title>
        <v-card-text>volca fm2とのMIDI IN/OUT接続を確認してください。</v-card-text>
        <v-card-actions><v-spacer /><v-btn @click="showError = false">OK</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showAlgorithmPicker" max-width="1040">
      <v-card class="algorithm-picker-card pa-4">
        <div class="algorithm-picker-header">
          <v-card-title>Algorithmを選択</v-card-title>
          <DialogCloseButton @click="showAlgorithmPicker = false" />
        </div>
        <div class="algorithm-picker-grid">
          <button v-for="algorithm in 32" :key="algorithm" type="button" class="algorithm-option"
            :class="{ selected: program.algorithm === algorithm - 1 }" @click="selectAlgorithm(algorithm - 1)">
            <strong>Algorithm {{ algorithm }}</strong>
            <AlgorithmDiagram :algorithm="algorithm - 1" :enabled="program.operators.map(operator => operator.enabled)"
              :selected-operator="-1" />
          </button>
        </div>
      </v-card>
    </v-dialog>

    <PresetLibraryDialog v-model="showLibrary" kind="sound" title="Sound Library"
      :suggested-name="program.name.trim() || 'Untitled Sound'" :snapshot="soundSnapshot" @load="loadSoundPreset" />

    <v-card class="sound-card pa-4">
      <div class="sound-toolbar">
        <div>
          <h2>Sound Edit</h2>
        </div>
        <v-text-field v-model="program.name" label="Voice Name" maxlength="10" counter="10"
          density="compact" hide-details class="voice-name" />
        <v-btn @click="midiStore.requestCurrentVoiceDump" :disabled="!canSend"
          :loading="midiStore.soundEditState === 'requesting'">
          現在の音色を取得
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="resetProgram">初期化</v-btn>
        <v-btn class="send-button" :class="{ 'needs-send': hasUnsavedChanges }" @click="sendProgram"
          :disabled="!canSend" :loading="midiStore.soundEditState === 'sending'">
          送信
          <Upload :size="16" class="ml-1" />
        </v-btn>
        <v-btn icon variant="text" title="Sound Library" aria-label="Sound Library" @click="showLibrary = true">
          <Library :size="19" />
        </v-btn>
      </div>

      <v-divider class="my-4" />

      <div class="sound-workspace">
        <aside class="sound-panel operator-nav">
          <div class="algorithm-control">
            <AlgorithmDiagram :algorithm="program.algorithm" :enabled="program.operators.map(operator => operator.enabled)"
              :selected-operator="selectedOperator" @select="selectedOperator = $event" />
            <div class="algorithm-legend" aria-label="Algorithm diagram legend">
              <span><i class="route"></i>Modulation</span>
              <span><i class="feedback"></i>Feedback</span>
              <span><i class="output"></i>Carrier / Output</span>
            </div>
          </div>
          <div class="global-mini-grid">
            <button type="button" class="algorithm-picker-trigger" @click="showAlgorithmPicker = true">
              <span>Algorithm</span><strong>{{ program.algorithm + 1 }}</strong>
            </button>
            <NumberControl v-model="program.feedback" label="Feedback" :min="0" :max="7" />
            <div class="toggle-row stacked-control"><span>OSC Key Sync</span><AppToggle v-model="program.oscillatorSync" aria-label="OSC Key Sync" /></div>
          </div>

          <div class="left-utility-grid">
            <section class="global-section volca-macros">
              <h4>volca fm2 Macros</h4>
              <div class="control-grid two">
                <NumberControl v-model="program.modulatorAttack" label="Mod Attack" :min="-63" :max="63" />
                <NumberControl v-model="program.modulatorDecay" label="Mod Decay" :min="-63" :max="63" />
                <NumberControl v-model="program.carrierAttack" label="Carrier Attack" :min="-63" :max="63" />
                <NumberControl v-model="program.carrierDecay" label="Carrier Decay" :min="-63" :max="63" />
              </div>
            </section>
            <section class="global-section transpose-section">
              <h4>Transpose</h4>
              <div class="transpose-controls">
                <NumberControl v-model="program.transpose" label="Semitone" :min="0" :max="48" :display-offset="-24" />
                <NumberControl v-model="program.octave" label="volca Octave" :min="-2" :max="2" />
              </div>
            </section>
          </div>

        </aside>

        <main class="sound-panel operator-editor">
          <div class="panel-title operator-heading">
            <h3>Operator {{ selectedOperator + 1 }}</h3>
            <AppToggle v-model="selected.enabled" :aria-label="`Operator ${selectedOperator + 1}`" />
          </div>

          <section class="edit-section">
            <div class="section-heading"><h4>Frequency &amp; Output</h4><span>{{ frequencyLabel(selected) }}</span></div>
            <div class="control-grid four">
              <div class="mode-control">
                <label>Mode</label>
                <div class="mode-segment" role="group" aria-label="Oscillator mode">
                  <button type="button" :class="{ active: selected.oscillatorMode === 0 }"
                    :aria-pressed="selected.oscillatorMode === 0" @click="selected.oscillatorMode = 0">Ratio</button>
                  <button type="button" :class="{ active: selected.oscillatorMode === 1 }"
                    :aria-pressed="selected.oscillatorMode === 1" @click="selected.oscillatorMode = 1">Fixed</button>
                </div>
              </div>
              <NumberControl v-model="selected.coarse" label="Coarse" :min="0" :max="31" />
              <NumberControl v-model="selected.fine" label="Fine" :min="0" :max="99" />
              <NumberControl v-model="selected.detune" label="Detune" :min="0" :max="14" :display-offset="-7" />
              <NumberControl v-model="selected.outputLevel" label="Output Level" :min="0" :max="99" />
              <NumberControl v-model="selected.ampModSensitivity" label="Amp Mod Sens" :min="0" :max="3" />
              <NumberControl v-model="selected.keyVelocitySensitivity" label="Key Velocity" :min="0" :max="7" />
              <NumberControl v-model="selected.rateScaling" label="Rate Scaling" :min="0" :max="7" />
            </div>
          </section>

          <section class="edit-section">
            <div class="section-heading"><h4>Amplitude Envelope</h4><span>Rate / Level</span></div>
            <div class="envelope-layout">
              <svg class="envelope-graph" viewBox="0 0 420 170" role="img" aria-label="Amplitude envelope">
                <path class="envelope-grid" d="M0 35H420M0 85H420M0 135H420M105 0V170M210 0V170M315 0V170" />
                <polyline class="envelope-line" :points="envelopePoints(selected.egRates, selected.egLevels)" />
                <circle v-for="(point, index) in envelopeCircles(selected.egRates, selected.egLevels)" :key="index" :cx="point.x" :cy="point.y" r="5" />
              </svg>
              <div class="envelope-values">
                <NumberControl v-for="index in 4" :key="`r${index}`" v-model="selected.egRates[index - 1]"
                  :label="`Rate ${index}`" :min="0" :max="99" compact />
                <NumberControl v-for="index in 4" :key="`l${index}`" v-model="selected.egLevels[index - 1]"
                  :label="`Level ${index}`" :min="0" :max="99" compact />
              </div>
            </div>
          </section>

          <section class="edit-section keyboard-scaling">
            <div class="section-heading"><h4>Keyboard Scaling</h4><span>Level response across keys</span></div>
            <div class="control-grid five">
              <NumberControl v-model="selected.breakPoint" label="Break Point" :min="0" :max="99" />
              <NumberControl v-model="selected.leftDepth" label="Left Depth" :min="0" :max="99" />
              <NumberControl v-model="selected.rightDepth" label="Right Depth" :min="0" :max="99" />
              <div class="select-control"><label>Left Curve</label><v-select v-model="selected.leftCurve" :items="curveItems" aria-label="Left Curve" density="compact" hide-details /></div>
              <div class="select-control"><label>Right Curve</label><v-select v-model="selected.rightCurve" :items="curveItems" aria-label="Right Curve" density="compact" hide-details /></div>
            </div>
          </section>
        </main>

        <aside class="sound-panel global-editor">
          <section class="global-section">
            <h4>LFO</h4>
            <div class="select-control"><label>Waveform</label><v-select v-model="program.lfoWave" :items="lfoWaveItems" aria-label="Waveform" density="compact" hide-details /></div>
            <div class="control-grid three mt-2">
              <NumberControl v-model="program.lfoSpeed" label="Speed" :min="0" :max="99" />
              <NumberControl v-model="program.lfoDelay" label="Delay" :min="0" :max="99" />
              <NumberControl v-model="program.pitchModDepth" label="Pitch Mod Depth" :min="0" :max="99" />
              <NumberControl v-model="program.ampModDepth" label="Amp Mod Depth" :min="0" :max="99" />
              <NumberControl v-model="program.pitchModSensitivity" label="Pitch Mod Sens" :min="0" :max="7" />
              <div class="toggle-row stacked-control"><span>LFO Key Sync</span><AppToggle v-model="program.lfoSync" aria-label="LFO Key Sync" /></div>
            </div>
          </section>

          <section class="global-section">
            <h4>Pitch Envelope</h4>
            <svg class="pitch-envelope" viewBox="0 0 320 90" aria-label="Pitch envelope">
              <path class="envelope-grid" d="M0 45H320M80 0V90M160 0V90M240 0V90" />
              <polyline class="envelope-line" :points="pitchEnvelopePoints" />
            </svg>
            <div class="pitch-values">
              <NumberControl v-for="index in 4" :key="`pr${index}`" v-model="program.pitchEgRates[index - 1]"
                :label="`R${index}`" :min="0" :max="99" compact />
              <NumberControl v-for="index in 4" :key="`pl${index}`" v-model="program.pitchEgLevels[index - 1]"
                :label="`L${index}`" :min="0" :max="99" compact />
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
import DialogCloseButton from '@/components/DialogCloseButton.vue';
import KnobControl from '@/components/KnobControl.vue';
import PresetLibraryDialog from '@/components/PresetLibraryDialog.vue';
import { useMidiStore, MIDIConnectionState } from '@/stores/midiStore';
import type { SoundOperator, SoundProgram } from '@/types/soundProgram';
import { createInitialSoundProgram, decodeSoundProgram, encodeSoundProgram } from '@/utils/soundProgramCodec';

const midiStore = useMidiStore();
const program = ref(createInitialSoundProgram());
const selectedOperator = ref(0);
const showError = ref(false);
const showAlgorithmPicker = ref(false);
const showLibrary = ref(false);
const currentVoiceRequestPending = ref(true);
const loadedProgramSignature = ref<string | null>(null);
let unsubscribeProgramChange: (() => void) | null = null;
const selected = computed(() => program.value.operators[selectedOperator.value]);
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
const sendProgram = () => midiStore.sendCurrentVoiceDump(encodeSoundProgram(program.value));
const soundSnapshot = () => JSON.parse(JSON.stringify(program.value)) as SoundProgram;
const loadSoundPreset = (data: unknown) => {
  program.value = data as SoundProgram;
};
const curveItems = [
  { title: '− Linear', value: 0 }, { title: '− Exponential', value: 1 },
  { title: '+ Exponential', value: 2 }, { title: '+ Linear', value: 3 },
];
const lfoWaveItems = ['Triangle', 'Saw Down', 'Saw Up', 'Square', 'Sine', 'Sample & Hold']
  .map((title, value) => ({ title, value }));

const frequencyLabel = (operator: SoundOperator) => operator.oscillatorMode === 0
  ? `Ratio ${Math.max(.5, operator.coarse) + operator.fine / 100}`
  : `Fixed C${operator.coarse} F${operator.fine}`;
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
const envelopeCircles = (rates: number[], levels: number[]) => envelopeGeometry(rates, levels, 420, 170).slice(1, 5);
const envelopePoints = (rates: number[], levels: number[]) => envelopeGeometry(rates, levels, 420, 170).map(point => `${point.x},${point.y}`).join(' ');
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
.algorithm-picker-header { display: flex; align-items: center; justify-content: space-between; padding-right: 20px; }
.algorithm-picker-grid { display: grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap: 10px; padding: 10px 20px 20px; overflow-y: auto; }
.algorithm-option { min-width: 0; padding: 10px; border: 1px solid rgba(206,179,147,.18); border-radius: 10px; background: #2b2022; color: #d8ccc4; cursor: pointer; text-align: left; }
.algorithm-option:hover { border-color: rgba(206,179,147,.48); background: #35282a; }
.algorithm-option.selected { border-color: #ceb393; background: rgba(206,179,147,.12); color: #f1e9e1; }
.algorithm-option strong { display: block; margin-bottom: 7px; font-size: var(--volca-type-body); }
.algorithm-option :deep(.algorithm-diagram) { height: 142px; pointer-events: none; }
.algorithm-picker-trigger { min-width: 82px; display: grid; justify-items: center; gap: 5px; padding: 6px 10px; border: 1px solid rgba(206,179,147,.24); border-radius: 8px; background: #251c1e; color: #ad9e96; cursor: pointer; }
.algorithm-picker-trigger:hover { border-color: #ceb393; color: #f1e9e1; }
.algorithm-picker-trigger:focus-visible { outline: 2px solid #ceb393; outline-offset: 2px; }
.algorithm-picker-trigger span { font-size: var(--volca-type-label); }
.algorithm-picker-trigger strong { color: #ceb393; font-size: var(--volca-type-body); }
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
.global-mini-grid { display: grid; grid-template-columns: 1fr 1fr minmax(118px, 1.25fr); align-items: start; gap: 10px; padding: 2px 12px 14px; border-bottom: 1px solid rgba(206,179,147,.16); }
.operator-heading { position: sticky; top: 0; z-index: 3; background: #302426; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: #ad9e96; font-size: var(--volca-type-label); }
.toggle-row.stacked-control { flex-direction: column; align-items: center; justify-content: flex-start; gap: 5px; }
.toggle-row.stacked-control > span { min-height: 15px; line-height: 1.25; text-align: center; }
.control-grid.three .toggle-row { flex-direction: column; justify-content: flex-start; }
.edit-section, .global-section { padding: 13px; border-bottom: 1px solid rgba(206,179,147,.15); }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }.section-heading h4, .global-section h4 { margin: 0; font-size: var(--volca-type-heading); }.section-heading span { color: #ad9e96; font-size: var(--volca-type-label); }
.control-grid { display: grid; gap: 8px; }.control-grid.five { grid-template-columns: repeat(3, minmax(72px,.8fr)) repeat(2, minmax(120px,1.3fr)); }.control-grid.four { grid-template-columns: repeat(4, minmax(92px,1fr)); }.control-grid.three { grid-template-columns: repeat(3, minmax(84px,1fr)); align-items: start; }.control-grid.two { grid-template-columns: 1fr 1fr; }
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
