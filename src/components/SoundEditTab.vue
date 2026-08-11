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
          <v-btn variant="text" @click="showAlgorithmPicker = false">閉じる</v-btn>
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
        <v-btn @click="sendProgram" :disabled="!canSend" :loading="midiStore.soundEditState === 'sending'">
          送信
          <Upload :size="16" class="ml-1" />
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
            <div class="toggle-row"><span>OSC Key Sync</span><AppToggle v-model="program.oscillatorSync" aria-label="OSC Key Sync" /></div>
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
                <NumberControl v-model="program.transpose" label="Semitone (−24…+24)" :min="0" :max="48" :display-offset="-24" />
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
                <v-btn-toggle v-model="selected.oscillatorMode" mandatory divided density="compact">
                  <v-btn :value="0">Ratio</v-btn><v-btn :value="1">Fixed</v-btn>
                </v-btn-toggle>
              </div>
              <NumberControl v-model="selected.coarse" label="Coarse" :min="0" :max="31" />
              <NumberControl v-model="selected.fine" label="Fine" :min="0" :max="99" />
              <NumberControl v-model="selected.detune" label="Detune (−7…+7)" :min="0" :max="14" :display-offset="-7" />
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
            <div class="control-grid four">
              <NumberControl v-model="selected.breakPoint" label="Break Point" :min="0" :max="99" />
              <NumberControl v-model="selected.leftDepth" label="Left Depth" :min="0" :max="99" />
              <NumberControl v-model="selected.rightDepth" label="Right Depth" :min="0" :max="99" />
              <div class="empty-control"></div>
              <v-select v-model="selected.leftCurve" :items="curveItems" label="Left Curve" density="compact" hide-details />
              <v-select v-model="selected.rightCurve" :items="curveItems" label="Right Curve" density="compact" hide-details />
            </div>
          </section>
        </main>

        <aside class="sound-panel global-editor">
          <section class="global-section">
            <h4>LFO</h4>
            <v-select v-model="program.lfoWave" :items="lfoWaveItems" label="Waveform" density="compact" hide-details />
            <div class="control-grid three mt-2">
              <NumberControl v-model="program.lfoSpeed" label="Speed" :min="0" :max="99" />
              <NumberControl v-model="program.lfoDelay" label="Delay" :min="0" :max="99" />
              <NumberControl v-model="program.pitchModDepth" label="Pitch Mod Depth" :min="0" :max="99" />
              <NumberControl v-model="program.ampModDepth" label="Amp Mod Depth" :min="0" :max="99" />
              <NumberControl v-model="program.pitchModSensitivity" label="Pitch Mod Sens" :min="0" :max="7" />
              <div class="toggle-row"><span>LFO Key Sync</span><AppToggle v-model="program.lfoSync" aria-label="LFO Key Sync" /></div>
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
import { computed, ref, watch } from 'vue';
import { Upload } from '@lucide/vue';
import AlgorithmDiagram from '@/components/AlgorithmDiagram.vue';
import AppToggle from '@/components/AppToggle.vue';
import KnobControl from '@/components/KnobControl.vue';
import { useMidiStore, MIDIConnectionState } from '@/stores/midiStore';
import type { SoundOperator } from '@/types/soundProgram';
import { createInitialSoundProgram, decodeSoundProgram, encodeSoundProgram } from '@/utils/soundProgramCodec';

const midiStore = useMidiStore();
const program = ref(createInitialSoundProgram());
const selectedOperator = ref(0);
const showError = ref(false);
const showAlgorithmPicker = ref(false);
const selected = computed(() => program.value.operators[selectedOperator.value]);
const canSend = computed(() => [MIDIConnectionState.DETECTED, MIDIConnectionState.RECEIVING, MIDIConnectionState.RECEIVED]
  .includes(midiStore.connectionState));

watch(() => midiStore.currentVoiceData, data => {
  if (data) program.value = decodeSoundProgram(data);
});
watch(() => midiStore.soundEditState, state => {
  if (state === 'error') showError.value = true;
});

const resetProgram = () => { program.value = createInitialSoundProgram(); };
const selectAlgorithm = (algorithm: number) => {
  program.value.algorithm = algorithm;
  showAlgorithmPicker.value = false;
};
const sendProgram = () => midiStore.sendCurrentVoiceDump(encodeSoundProgram(program.value));
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
.algorithm-picker-card { max-height: min(86vh, 900px); overflow: hidden; }
.algorithm-picker-header { display: flex; align-items: center; justify-content: space-between; }
.algorithm-picker-grid { display: grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap: 10px; padding: 4px; overflow-y: auto; }
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
.global-mini-grid { display: grid; grid-template-columns: 1fr 1fr minmax(118px, 1.25fr); align-items: center; gap: 10px; padding: 2px 12px 14px; border-bottom: 1px solid rgba(206,179,147,.16); }
.operator-heading { position: sticky; top: 0; z-index: 3; background: #302426; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: #ad9e96; font-size: var(--volca-type-label); }
.control-grid.three .toggle-row { flex-direction: column; justify-content: flex-start; }
.edit-section, .global-section { padding: 13px; border-bottom: 1px solid rgba(206,179,147,.15); }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }.section-heading h4, .global-section h4 { margin: 0; font-size: var(--volca-type-heading); }.section-heading span { color: #ad9e96; font-size: var(--volca-type-label); }
.control-grid { display: grid; gap: 8px; }.control-grid.four { grid-template-columns: repeat(4, minmax(92px,1fr)); }.control-grid.three { grid-template-columns: repeat(3, minmax(84px,1fr)); }.control-grid.two { grid-template-columns: 1fr 1fr; }
.mode-control { display: grid; align-content: start; gap: 5px; }
.mode-control > label { color: #ad9e96; font-size: var(--volca-type-label); }
.mode-control :deep(.v-btn-toggle) { width: fit-content; padding: 3px; border: 1px solid rgba(206,179,147,.24); border-radius: 9px; background: #251c1e; }
.mode-control :deep(.v-btn) { min-width: 68px; height: 34px; min-height: 34px; padding-inline: 12px; border: 0 !important; border-radius: 6px !important; background: transparent !important; color: #ad9e96 !important; box-shadow: none !important; }
.mode-control :deep(.v-btn + .v-btn) { border-left: 1px solid rgba(206,179,147,.38) !important; border-top-left-radius: 0 !important; border-bottom-left-radius: 0 !important; }
.mode-control :deep(.v-btn:first-child) { border-top-right-radius: 0 !important; border-bottom-right-radius: 0 !important; }
.mode-control :deep(.v-btn:hover) { background: rgba(206,179,147,.1) !important; color: #f1e9e1 !important; }
.mode-control :deep(.v-btn.v-btn--active) { background: #ceb393 !important; color: #33282a !important; box-shadow: inset 0 1px rgba(255,255,255,.24) !important; }
.envelope-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; }.envelope-graph, .pitch-envelope { width: 100%; border: 1px solid rgba(206,179,147,.15); border-radius: 8px; background: #251c1e; }.envelope-grid { fill: none; stroke: rgba(206,179,147,.1); }.envelope-line { fill: none; stroke: #ceb393; stroke-width: 2.5; }.envelope-graph circle { fill: #302426; stroke: #ceb393; stroke-width: 2; }.envelope-values, .pitch-values { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; align-content: start; }
.keyboard-scaling { border-bottom: 0; }.global-editor { padding-bottom: 8px; }
.left-utility-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(110px, 1fr); border-bottom: 1px solid rgba(206,179,147,.15); }
.left-utility-grid .global-section { border-bottom: 0; }
.transpose-section { border-left: 1px solid rgba(206,179,147,.15); }
.transpose-controls { display: grid; justify-items: center; gap: 12px; }
.global-section:last-child { border-bottom: 0; }.global-section > h4 { margin-bottom: 9px; }.pitch-envelope { height: 90px; margin-bottom: 8px; }
@media (max-width: 1300px) { .sound-workspace { grid-template-columns: 320px minmax(500px,1fr) 300px; } }
</style>
