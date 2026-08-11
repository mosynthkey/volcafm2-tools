<template>
  <AppDialog :model-value="modelValue" :title="t('sequence.captureTitle')" max-width="520"
    :persistent="phase === 'capturing'" :closable="phase !== 'capturing'" @update:model-value="emit('update:modelValue', $event)">
    <template v-if="phase === 'ready'">
      <p class="capture-copy">{{ t('sequence.captureDescription') }}</p>
      <div class="capture-resolution">
        <div class="capture-resolution__label">{{ t('sequence.captureResolution') }}</div>
        <div class="resolution-options" role="group" :aria-label="t('sequence.captureResolution')">
          <button v-for="option in resolutions" :key="option" type="button" class="resolution-option"
            :class="{ selected: resolution === option }" :aria-pressed="resolution === option"
            @click="emit('update:resolution', option)"><Check v-if="resolution === option" :size="15" /><span>1/{{ option }}</span></button>
        </div>
      </div>
      <ol class="capture-steps"><li>{{ t('sequence.captureStep1') }}</li><li>{{ t('sequence.captureStep2') }}</li><li>{{ t('sequence.captureStep3') }}</li></ol>
    </template>
    <template v-else-if="phase === 'capturing'">
      <p>{{ t('sequence.captureRunning') }}</p><v-progress-linear :model-value="progress" height="8" rounded />
      <p class="capture-progress">{{ t('sequence.captureProgress', { count: stepCount }) }}</p>
    </template>
    <p v-else-if="phase === 'done'">{{ t('sequence.captureDone', { count: noteCount }) }}</p>
    <p v-else>{{ errorMessage }}</p>
    <template #actions>
      <template v-if="phase === 'ready'"><v-btn variant="text" @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</v-btn><v-btn @click="emit('start')">{{ t('sequence.captureStart') }}</v-btn></template>
      <v-btn v-else-if="phase === 'capturing'" variant="text" @click="emit('cancel')">{{ t('sequence.captureCancel') }}</v-btn>
      <v-btn v-else @click="emit('update:modelValue', false)">{{ t('common.ok') }}</v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { Check } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import type { CapturePhase } from '@/features/sequence/composables/useSequenceCapture'
import type { SequencePlaybackResolution } from '@/utils/midiSequenceCapture'

defineProps<{ modelValue: boolean; phase: CapturePhase; progress: number; stepCount: number; noteCount: number; errorMessage: string; resolution: SequencePlaybackResolution }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; 'update:resolution': [value: SequencePlaybackResolution]; start: []; cancel: [] }>()
const { t } = useI18n(); const resolutions: SequencePlaybackResolution[] = [1, 2, 4]
</script>

<style scoped>
.capture-copy { margin: 0; }.capture-resolution { display: grid; gap: 8px; margin-top: 16px; }.capture-resolution__label { color: var(--volca-muted); }
.resolution-options { height: 40px; display: grid; grid-template-columns: repeat(3,72px); padding: 3px; border: 1px solid var(--volca-line-strong); border-radius: 9px; background: #251c1e; }
.resolution-option { display:flex;align-items:center;justify-content:center;gap:4px;border:0;border-right:1px solid var(--volca-line);background:transparent;color:#b9aaa2;font:inherit;cursor:pointer; }.resolution-option:last-child{border:0}.resolution-option.selected{border-radius:6px;background:var(--volca-accent);color:#33282a;font-weight:800}
.capture-steps { display:grid;gap:6px;margin:16px 0 0;padding-left:1.4rem; }.capture-progress { margin:10px 0 0;text-align:right;font-variant-numeric:tabular-nums; }
</style>
