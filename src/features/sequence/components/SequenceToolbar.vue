<template>
  <v-row align="center" no-gutters class="editor-toolbar">
    <template v-if="sequence.stepInputActive">
      <v-col cols="auto"><v-btn icon :title="t('sequence.stepInputExit')" :aria-label="t('sequence.stepInputExit')" @click="sequence.toggleStepInput()"><X :size="18" /></v-btn></v-col>
      <v-col cols="auto" class="ml-3 step-input-status">{{ t('sequence.stepIndicator', { count: sequence.stepCursor + 1 }) }}</v-col>
      <v-col cols="auto" class="ml-3"><v-btn :disabled="!sequence.canInsertTie" @click="sequence.insertStepTie()">{{ t('sequence.tie') }}</v-btn></v-col>
      <v-col cols="auto" class="ml-2"><v-btn @click="sequence.insertStepRest()">{{ t('sequence.rest') }}</v-btn></v-col>
    </template>
    <template v-else>
      <v-col cols="auto" class="mr-4 editor-identity">
        <span class="editor-identity__label volca-section-title">{{ t('sequence.program') }}</span>
        <v-text-field v-model.number="sequence.programNo" type="number" :aria-label="t('sequence.program')" min="0" max="63" density="compact" hide-details class="program-no-input" />
        <span class="editor-identity__name" :class="{ 'is-empty': !currentProgramName }" :title="currentProgramName || t('sequence.programNameUnknown')">{{ currentProgramName || '—' }}</span>
      </v-col>
      <v-col cols="auto" class="editor-toolbar-section">
        <span class="editor-toolbar-section__label volca-section-title">{{ t('sequence.sectionLabel') }}</span>
        <v-btn :disabled="!canSend" :loading="midi.sequenceReadState === 'requesting'" @click="sequence.requestFromDevice()">
          <HardDriveUpload :size="16" class="mr-1" />{{ t('sequence.captureButton') }}
        </v-btn>
        <v-btn :disabled="!canSend" @click="sequence.showCaptureDialog = true">
          <Play :size="16" class="mr-1" />{{ t('sequence.capturePerformanceButton') }}
        </v-btn>
        <div class="send-auto-split">
          <v-btn :disabled="!canSend" @click="sequence.sendToDevice()"><HardDriveDownload :size="16" class="mr-1" />{{ t('common.send') }}</v-btn>
          <AutoSendToggle />
        </div>
        <v-btn @click="sequence.clearAll"><Trash2 :size="16" class="mr-1" />{{ t('sequence.clear') }}</v-btn>
        <v-btn @click="sequence.toggleStepInput()"><Piano :size="16" class="mr-1" />{{ t('sequence.stepInput') }}</v-btn>
        <div class="randomize-split">
          <v-btn class="randomize-main" @click="sequence.requestRandomize()"><Dices :size="16" class="mr-1" />{{ t('sequence.randomize') }}</v-btn>
          <v-menu location="bottom end" offset="6">
            <template #activator="{ props: menuProps }">
              <v-btn v-bind="menuProps" class="randomize-menu-btn" icon :title="t('sequence.randomizeMore')"
                :aria-label="t('sequence.randomizeMore')">
                <ChevronDown :size="16" />
              </v-btn>
            </template>
            <v-list class="sequence-more-menu" density="compact">
              <v-list-item :title="t('sequence.randomizeNotes')" @click="sequence.randomizeSteps(Math.random, 'notes')" />
              <v-list-item :title="t('sequence.randomizeMotion')" @click="sequence.randomizeSteps(Math.random, 'motion')" />
              <v-list-item :title="t('sequence.reverseSequence')" @click="sequence.reverseSteps()" />
            </v-list>
          </v-menu>
        </div>
        <v-menu location="bottom end" offset="6">
          <template #activator="{ props: menuProps }">
            <v-btn v-bind="menuProps" icon variant="text" :title="t('common.more')" :aria-label="t('common.more')"><MoreHorizontal :size="21" /></v-btn>
          </template>
          <v-list class="sequence-more-menu" density="compact">
            <v-list-item :title="t('sequence.importSmf')" @click="fileInput?.click()">
              <template #prepend><FileUp :size="17" /></template>
            </v-list-item>
          </v-list>
        </v-menu>
        <input ref="fileInput" type="file" accept=".mid,.midi" hidden @change="selectFile" />
      </v-col>
      <v-spacer />
      <v-col cols="auto">
        <LibrarySection kind="sequence" page="sequence" />
      </v-col>
    </template>
  </v-row>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, Dices, FileUp, HardDriveDownload, HardDriveUpload, MoreHorizontal, Piano, Play, Trash2, X } from '@lucide/vue'
import AutoSendToggle from '@/components/AutoSendToggle.vue'
import LibrarySection from '@/components/LibrarySection.vue'
import { useMidiStore } from '@/stores/midiStore'
import { useSequencerStore } from '@/stores/sequencerStore'
import { useSoundStore } from '@/stores/soundStore'
import { programDisplayName } from '@/utils/programDisplayName'

const { t } = useI18n(); const midi = useMidiStore(); const sequence = useSequencerStore(); const sound = useSoundStore(); const fileInput = ref<HTMLInputElement | null>(null)
const canSend = computed(() => midi.isIdleConnected)
const currentProgramName = computed(() => {
  const slot = Number(sequence.programNo)
  return programDisplayName(slot, midi.matchedProgramNo, sound.program.name, midi.programNames[slot]?.name ?? '')
})
const selectFile = (event: Event) => { const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (file) sequence.queueSmfImport(file); input.value = '' }
</script>

<style scoped>
.step-input-status { color: var(--volca-accent-bright); font-weight: 750; font-variant-numeric: tabular-nums; }
.program-no-input { width: 72px; flex: 0 0 72px; }
.sequence-more-menu { min-width: 220px; border: 1px solid rgba(206,179,147,.28); border-radius: 10px; background: #2b2022; color: var(--volca-text); }
.randomize-split { display: inline-flex; align-items: stretch; }
.randomize-split :deep(.randomize-main) { border-top-right-radius: 0 !important; border-bottom-right-radius: 0 !important; }
.randomize-split :deep(.randomize-menu-btn) { width: 28px; min-width: 28px; border-top-left-radius: 0 !important; border-bottom-left-radius: 0 !important; box-shadow: inset 1px 0 rgba(51,40,42,.22), inset 0 1px rgba(255,255,255,.28), 0 3px 10px rgba(0,0,0,.16) !important; }
</style>
