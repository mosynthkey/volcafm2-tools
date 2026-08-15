<template>
  <aside class="sound-panel lfo-editor">
    <h4>{{ t('sound.lfo') }}</h4>
    <LfoSpeedUtilityDialog v-model="showSpeedUtility" :current-speed="program.lfoSpeed"
      @apply="setProgramNumber('lfoSpeed', $event)" />
    <div class="lfo-row">
      <LfoWaveformPicker v-model="program.lfoWave" compact />
      <div class="lfo-speed">
        <NumberControl :model-value="program.lfoSpeed" :label="t('sound.speed')" :min="0" :max="99"
          compact @update:model-value="setProgramNumber('lfoSpeed', $event)" />
        <button type="button" class="lfo-speed-utility" :aria-label="t('sound.lfoSpeedUtility')"
          :title="t('sound.lfoSpeedUtility')" @click="showSpeedUtility = true">BPM</button>
      </div>
      <NumberControl v-for="control in otherLfoControls" :key="control.key"
        :model-value="programNumber(control.key)" :label="t(control.label)" :min="control.min" :max="control.max"
        compact @update:model-value="setProgramNumber(control.key, $event)" />
      <div class="toggle-row stacked-control">
        <span>{{ t('sound.lfoKeySync') }}</span>
        <AppToggle v-model="program.lfoSync" :aria-label="t('sound.lfoKeySync')" />
      </div>
      <div class="toggle-row stacked-control">
        <span>{{ t('sound.oscKeySync') }}</span>
        <AppToggle v-model="program.oscillatorSync" :aria-label="t('sound.oscKeySync')" />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import AppToggle from '@/components/AppToggle.vue';
import KnobControl from '@/components/KnobControl.vue';
import LfoSpeedUtilityDialog from '@/features/sound/components/LfoSpeedUtilityDialog.vue';
import LfoWaveformPicker from '@/features/sound/components/LfoWaveformPicker.vue';
import { lfoControls, type ProgramNumberKey } from '@/features/sound/soundControlDefinitions';
import { useSoundStore } from '@/stores/soundStore';

const { t } = useI18n();
const soundStore = useSoundStore();
const { program } = storeToRefs(soundStore);
const showSpeedUtility = ref(false);
const otherLfoControls = lfoControls.filter(control => control.key !== 'lfoSpeed');
const programNumber = (key: ProgramNumberKey) => program.value[key] as number;
const setProgramNumber = (key: ProgramNumberKey, value: number) => { (program.value[key] as number) = value; };
const NumberControl = KnobControl;
</script>

<style scoped>
.lfo-editor { display: flex; align-items: center; gap: 14px; padding: 10px 14px; overflow-x: auto; }
.lfo-editor > h4 { flex: 0 0 auto; margin: 0; font-size: var(--volca-type-heading); }
.lfo-row { display: flex; flex: 1 1 auto; align-items: start; gap: 10px; min-width: min-content; }
.lfo-row > :deep(.knob-control), .lfo-speed { flex: 0 0 auto; }
.lfo-speed { display: grid; justify-items: center; gap: 5px; }
.lfo-speed-utility {
  min-width: 44px; height: 22px; padding: 0 7px; border: 1px solid rgba(206, 179, 147, 0.28);
  border-radius: 6px; background: transparent; color: #c7b9b0; font: inherit;
  font-size: 11px; font-weight: 700; letter-spacing: .04em; cursor: pointer;
}
.lfo-speed-utility:hover { border-color: rgba(206, 179, 147, 0.6); background: rgba(206, 179, 147, 0.12); color: #f1e9e1; }
.lfo-speed-utility:focus-visible { outline: 2px solid #e1cab0; outline-offset: 1px; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: #ad9e96; font-size: var(--volca-type-label); }
.toggle-row.stacked-control { flex: 0 0 auto; flex-direction: column; align-items: center; justify-content: flex-start; gap: 5px; min-width: 72px; }
.toggle-row.stacked-control > span { width: 100%; min-height: 18px; line-height: 1.25; text-align: center; }
</style>
