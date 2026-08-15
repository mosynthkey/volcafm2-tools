<template>
  <AppDialog v-model="open" :title="phase === 'fetching-program' ? t('sequence.programFetchTitle') : t('sequence.captureTitle')" max-width="520"
    :persistent="phase === 'capturing' || phase === 'fetching-program'" :closable="phase !== 'capturing' && phase !== 'fetching-program'">
    <template v-if="phase === 'ready'">
      <p class="capture-copy">{{ t('sequence.captureDescription') }}</p>
      <p class="capture-note">{{ t('sequence.captureNotesOnly') }}</p>
      <div class="capture-resolution">
        <div class="capture-resolution__label">{{ t('sequence.captureResolution') }}</div>
        <div class="resolution-options" role="group" :aria-label="t('sequence.captureResolution')">
          <button v-for="option in resolutions" :key="option" type="button" class="resolution-option"
            :class="{ selected: resolution === option }" :aria-pressed="resolution === option"
            @click="resolution = option"><Check v-if="resolution === option" :size="15" /><span>1/{{ option }}</span></button>
        </div>
      </div>
      <ol class="capture-steps"><li>{{ t('sequence.captureStep1') }}</li><li>{{ t('sequence.captureStep2') }}</li><li>{{ t('sequence.captureStep3') }}</li></ol>
    </template>
    <template v-else-if="phase === 'fetching-program'">
      <p>{{ programFetchStatusText }}</p>
      <v-progress-linear
        :model-value="midi.currentProgramFetchState === 'loading-programs' ? (midi.currentProgramFetchProgress / 64) * 100 : 0"
        :indeterminate="midi.currentProgramFetchState === 'requesting'" height="8" rounded />
      <p v-if="midi.currentProgramFetchState === 'loading-programs'" class="capture-progress">{{ midi.currentProgramFetchProgress }}/64</p>
    </template>
    <template v-else-if="phase === 'capturing'">
      <p>{{ t('sequence.captureRunning') }}</p><v-progress-linear :model-value="progress" height="8" rounded />
      <p class="capture-progress">{{ t('sequence.captureProgress', { count: stepCount }) }}</p>
    </template>
    <p v-else-if="phase === 'done'">{{ t('sequence.captureDone', { count: noteCount }) }}</p>
    <p v-else class="dialog-error">{{ errorMessage }}</p>
    <template #actions>
      <template v-if="phase === 'ready'"><v-btn variant="text" @click="open = false">{{ t('common.cancel') }}</v-btn><v-btn @click="start()">{{ t('sequence.captureStart') }}</v-btn></template>
      <v-btn v-else-if="phase === 'capturing' || phase === 'fetching-program'" variant="text" @click="cancel()">{{ t('sequence.captureCancel') }}</v-btn>
      <v-btn v-else @click="open = false">{{ t('common.ok') }}</v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import { useMidiStore } from '@/stores/midiStore'
import { useSequenceCapture } from '@/features/sequence/composables/useSequenceCapture'
import type { SequencePlaybackResolution } from '@/utils/midiSequenceCapture'

const { open, phase, progress, stepCount, noteCount, errorMessage, resolution, start, cancel } = useSequenceCapture()
const { t } = useI18n(); const midi = useMidiStore(); const resolutions: SequencePlaybackResolution[] = [1, 2, 4]
const programFetchStatusText = computed(() =>
  midi.currentProgramFetchState === 'loading-programs'
    ? t('sequence.receivingProgramsForMatch')
    : t('sequence.matchingCurrentProgram')
)
</script>

<style scoped>
.capture-copy { margin: 0; }
.capture-note { margin: 10px 0 0; color: var(--volca-muted); }
.capture-resolution { display: grid; justify-items: start; gap: 8px; margin-top: 16px; }
.capture-resolution__label { color: var(--volca-muted); }
.resolution-options { width: max-content; height: 40px; display: grid; grid-template-columns: repeat(3, 72px); padding: 3px; border: 1px solid var(--volca-line-strong); border-radius: 9px; background: #251c1e; }
.resolution-option { display:flex;align-items:center;justify-content:center;gap:4px;border:0;border-right:1px solid var(--volca-line);background:transparent;color:#b9aaa2;font:inherit;cursor:pointer; }
.resolution-option:last-child{border:0}
.resolution-option.selected{border-radius:6px;background:var(--volca-accent);color:#33282a;font-weight:800}
.capture-steps { display:grid;gap:6px;margin:16px 0 0;padding-left:1.4rem; }
.capture-progress { margin:10px 0 0;text-align:right;font-variant-numeric:tabular-nums; }
</style>
