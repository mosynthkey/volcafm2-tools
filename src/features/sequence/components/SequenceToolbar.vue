<template>
  <v-row align="center" no-gutters class="sequencer-toolbar">
    <template v-if="stepInputActive">
      <v-col cols="auto"><v-btn icon :title="t('sequence.stepInputExit')" :aria-label="t('sequence.stepInputExit')" @click="emit('toggle-step-input')"><X :size="18" /></v-btn></v-col>
      <v-col cols="auto" class="ml-3 step-input-status">{{ t('sequence.stepIndicator', { count: stepCursor + 1 }) }}</v-col>
      <v-col cols="auto" class="ml-3"><v-btn :disabled="!canInsertTie" @click="emit('insert-tie')">Tie</v-btn></v-col>
      <v-col cols="auto" class="ml-2"><v-btn @click="emit('insert-rest')">Rest</v-btn></v-col>
    </template>
    <template v-else>
      <v-col cols="auto" class="mr-4 program-control">
        <span class="program-control__label">{{ t('sequence.program') }}</span>
        <v-text-field v-model.number="sequence.programNo" type="number" :aria-label="t('sequence.program')" min="0" max="63" density="compact" hide-details class="program-control__input" />
        <span class="program-control__name" :class="{ empty: !currentProgramName }" :title="currentProgramName || t('sequence.programNameUnknown')">{{ currentProgramName || '—' }}</span>
        <v-btn :disabled="!canSend" :loading="midi.currentProgramFetchState === 'loading-programs' || midi.currentProgramFetchState === 'requesting'" @click="midi.requestCurrentVoiceProgramNo">{{ t('sequence.getCurrentProgram') }}</v-btn>
      </v-col>
      <v-col cols="auto" class="mr-4"><v-text-field v-model.number="sequence.velocity" type="number" :label="t('sequence.velocity')" min="1" max="127" density="compact" hide-details style="width:110px" /></v-col>
      <v-col cols="auto" class="mr-4"><v-text-field v-model.number="sequence.gatePercent" type="number" :label="t('sequence.gate')" min="0" max="100" density="compact" hide-details style="width:110px" /></v-col>
      <v-col cols="auto" class="mr-2"><v-btn :disabled="!canSend" @click="emit('capture')"><AudioLines :size="16" class="mr-1" />{{ t('sequence.captureButton') }}</v-btn></v-col>
      <v-col cols="auto" class="mr-2"><v-btn @click="emit('toggle-step-input')"><Piano :size="16" class="mr-1" />{{ t('sequence.stepInput') }}</v-btn></v-col>
      <v-col cols="auto" class="mr-2"><v-btn @click="sequence.clearAll"><Trash2 :size="16" class="mr-1" />{{ t('sequence.clear') }}</v-btn></v-col>
      <v-col cols="auto" class="mr-2"><v-btn @click="emit('randomize')"><Dices :size="16" class="mr-1" />{{ t('sequence.randomize') }}</v-btn></v-col>
      <v-spacer />
      <v-col cols="auto" class="mr-2"><v-btn @click="fileInput?.click()"><FileUp :size="16" class="mr-1" />{{ t('sequence.importSmf') }}</v-btn><input ref="fileInput" type="file" accept=".mid,.midi" hidden @change="selectFile" /></v-col>
      <v-col cols="auto"><v-btn :disabled="!canSend" @click="emit('send')">{{ t('common.send') }}<Upload :size="16" class="ml-1" /></v-btn></v-col>
      <v-col cols="auto" class="ml-2"><v-btn icon variant="text" :title="t('sequence.library')" :aria-label="t('sequence.library')" @click="emit('library')"><Library :size="19" /></v-btn></v-col>
    </template>
  </v-row>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AudioLines, Dices, FileUp, Library, Piano, Trash2, Upload, X } from '@lucide/vue'
import { MIDIConnectionState, useMidiStore } from '@/stores/midiStore'
import { useSequencerStore } from '@/stores/sequencerStore'

defineProps<{ stepInputActive: boolean; stepCursor: number; canInsertTie: boolean }>()
const emit = defineEmits<{ 'toggle-step-input': []; 'insert-tie': []; 'insert-rest': []; capture: []; randomize: []; send: []; library: []; 'import-file': [file: File] }>()
const { t } = useI18n(); const midi = useMidiStore(); const sequence = useSequencerStore(); const fileInput = ref<HTMLInputElement | null>(null)
const canSend = computed(() => midi.connectionState === MIDIConnectionState.DETECTED || midi.connectionState === MIDIConnectionState.RECEIVED)
const currentProgramName = computed(() => midi.programNames[Number(sequence.programNo)]?.name.trim() ?? '')
const selectFile = (event: Event) => { const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (file) emit('import-file', file); input.value = '' }
</script>

<style scoped>
.sequencer-toolbar { display:flex;align-items:center;gap:0;min-height:40px;overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap;scrollbar-width:thin }.sequencer-toolbar>.v-col{flex-shrink:0}.step-input-status{color:var(--volca-accent-bright);font-weight:750;font-variant-numeric:tabular-nums}
.program-control{display:flex;align-items:center;gap:10px;min-width:0}.program-control__label{color:var(--volca-muted);white-space:nowrap}.program-control__input{width:72px;flex:0 0 72px}.program-control__name{max-width:140px;min-width:72px;overflow:hidden;color:var(--volca-accent-bright);font-weight:650;text-overflow:ellipsis;white-space:nowrap}.program-control__name.empty{color:#8f8180;font-weight:500}
</style>
