<template>
  <v-container class="sound-container">
    <AppErrorDialog v-model="soundStore.showSendErrorDialog" :title="t('common.sendFailedTitle')" :message="sendErrorMessage" />

    <AppDialog v-model="soundStore.showAlgorithmPicker" :title="t('sound.selectAlgorithm')" max-width="1040" card-class="algorithm-picker-card">
        <div class="algorithm-picker-grid">
          <button v-for="algorithm in 32" :key="algorithm" type="button" class="algorithm-option"
            :class="{ selected: program.algorithm === algorithm - 1 }" @click="soundStore.pickAlgorithm(algorithm - 1)">
            <strong>{{ t('sound.algorithmN', { count: algorithm }) }}</strong>
            <AlgorithmDiagram :algorithm="algorithm - 1" />
          </button>
        </div>
    </AppDialog>

    <v-card class="sound-card pa-4">
      <SoundToolbar />
      <div class="sound-workspace">
        <div class="sound-left">
          <SoundAlgorithmPanel />
          <SoundPitchEnvelope />
        </div>
        <div class="sound-operators">
          <SoundOperatorEditor />
          <SoundGlobalEditor />
        </div>
      </div>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import AppErrorDialog from '@/components/dialogs/AppErrorDialog.vue';
import AppDialog from '@/components/dialogs/AppDialog.vue';
import AlgorithmDiagram from '@/features/sound/components/AlgorithmDiagram.vue';
import SoundAlgorithmPanel from '@/features/sound/components/SoundAlgorithmPanel.vue';
import SoundGlobalEditor from '@/features/sound/components/SoundGlobalEditor.vue';
import SoundOperatorEditor from '@/features/sound/components/SoundOperatorEditor.vue';
import SoundPitchEnvelope from '@/features/sound/components/SoundPitchEnvelope.vue';
import SoundToolbar from '@/features/sound/components/SoundToolbar.vue';
import { useSoundSync } from '@/features/sound/composables/useSoundSync';
import { useSoundUndo } from '@/features/sound/composables/useSoundUndo';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useSoundStore } from '@/stores/soundStore';
import { useI18n } from 'vue-i18n';

const soundStore = useSoundStore();
const { program } = storeToRefs(soundStore);
const { t } = useI18n();
const sendErrorMessage = computed(() =>
  soundStore.lastSendFailure === 'nak' ? t('common.sendNak') : t('common.sendError'));
useSoundSync();
useSoundUndo();
</script>

<style scoped>
.sound-container { height: 100%; min-height: 0; overflow: hidden; box-sizing: border-box; }
.sound-card {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: 48px minmax(0, 1fr);
  gap: 12px;
  overflow: hidden;
}
.algorithm-picker-card { max-height: min(86vh, 900px); overflow: hidden; }
.algorithm-picker-grid { display: grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap: 10px; padding: 10px 20px 20px; overflow-y: auto; }
.algorithm-option { min-width: 0; padding: 10px; border: 1px solid rgba(206,179,147,.18); border-radius: 10px; background: #2b2022; color: #d8ccc4; cursor: pointer; text-align: left; }
.algorithm-option:hover { border-color: rgba(206,179,147,.48); background: #35282a; }
.algorithm-option.selected { border-color: #ceb393; background: rgba(206,179,147,.12); color: #f1e9e1; }
.algorithm-option strong { display: block; margin-bottom: 7px; font-size: var(--volca-type-body); }
.algorithm-option :deep(.algorithm-diagram) { height: 142px; pointer-events: none; }
.sound-workspace {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 10px;
  overflow: hidden;
}
.sound-left, .sound-operators { display: grid; min-height: 0; gap: 10px; overflow: hidden; }
.sound-left { grid-template-rows: auto auto; overflow: auto; align-content: start; }
.sound-operators { grid-template-rows: minmax(0, 1fr) auto; }
.sound-workspace :deep(.sound-panel) { min-height: 0; border: 1px solid rgba(206,179,147,.18); border-radius: 11px; background: rgba(48,36,38,.72); overflow: auto; }
.sound-workspace :deep(.sound-panel.operator-editor) { min-height: 0; overflow: hidden; }
.sound-workspace :deep(.sound-panel.lfo-editor) { overflow-x: auto; overflow-y: hidden; }
@media (max-width: 1100px) { .sound-workspace { grid-template-columns: minmax(280px, 320px) minmax(0, 1fr); } }
</style>
