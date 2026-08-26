<template>
  <ToolbarIconButton v-if="toolbar" :label="label">
    <v-btn
      icon
      :loading="busy"
      :disabled="disabled"
      :title="label"
      :aria-label="label"
      :class="{ 'is-playing': playing }"
      @click.stop="toggle"
      @pointerdown.stop
    >
      <Square v-if="playing" :size="16" />
      <Play v-else :size="16" />
    </v-btn>
  </ToolbarIconButton>
  <v-btn
    v-else-if="compact"
    icon
    variant="text"
    size="small"
    :loading="busy"
    :disabled="disabled"
    :title="label"
    :aria-label="label"
    :class="{ 'is-playing': playing }"
    @click.stop="toggle"
    @pointerdown.stop
    @keydown.enter.stop
  >
    <Square v-if="playing" :size="16" />
    <Play v-else :size="16" />
  </v-btn>
  <v-btn
    v-else
    class="text-none"
    :loading="busy"
    :disabled="disabled"
    :title="label"
    :aria-label="label"
    :class="{ 'is-playing': playing }"
    @click.stop="toggle"
    @pointerdown.stop
    @keydown.enter.stop
  >
    <Square v-if="playing" :size="16" class="mr-1" />
    <Play v-else :size="16" class="mr-1" />
    {{ label }}
  </v-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Play, Square } from '@lucide/vue'
import ToolbarIconButton from '@/components/ToolbarIconButton.vue'
import { useProgramPreview } from '@/composables/useProgramPreview'
import type { PreviewVoice } from '@/utils/programPreviewVoice'
import type { SequenceState } from '@/types/sequence'

const props = defineProps<{
  previewId: string
  voice?: PreviewVoice | unknown
  sequence?: SequenceState | null
  toolbar?: boolean
  compact?: boolean
}>()

const { t } = useI18n()
const { isPlaying, isBusy, previewFailed, playPreview } = useProgramPreview()
const playing = computed(() => isPlaying(props.previewId))
const busy = computed(() => isBusy(props.previewId) && !playing.value)
const disabled = computed(() => props.sequence == null && props.voice == null)
const label = computed(() => {
  if (previewFailed.value && !playing.value && !busy.value) return t('preview.failed')
  return playing.value ? t('preview.stop') : t('preview.play')
})

const toggle = () => {
  if (props.sequence) {
    void playPreview(props.previewId, { sequence: props.sequence, voice: props.voice })
    return
  }
  void playPreview(props.previewId, props.voice)
}
</script>

<style scoped>
.v-btn.is-playing {
  color: var(--volca-accent-bright) !important;
}
</style>
