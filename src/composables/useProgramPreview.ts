import { ref } from 'vue'
import { SKIP_SEQUENCE_PREVIEW_HINT_PREF, useSkipConfirm } from '@/composables/useSkipConfirm'
import { renderDexedPreview } from '@/utils/dexedEngine'
import { PREVIEW_SAMPLE_RATE } from '@/utils/previewConstants'
import { phrasePreviewEvents } from '@/utils/previewPhrase'
import {
  isSequencePreviewRequest,
  sequencePreviewEvents,
} from '@/utils/sequencePreview'
import { previewVoiceFromUnknown, isPreviewVoice, type PreviewVoice } from '@/utils/programPreviewVoice'
import { createInitialSoundProgram } from '@/utils/soundProgramCodec'

const sequencePreviewHint = useSkipConfirm(SKIP_SEQUENCE_PREVIEW_HINT_PREF)

const playingId = ref<string | null>(null)
const pendingId = ref<string | null>(null)
const previewBusy = ref(false)
const previewFailed = ref(false)

let audioContext: AudioContext | null = null
let playingSource: AudioBufferSourceNode | null = null
let unlockPromise: Promise<void> | null = null

const normalizePeak = (samples: Float32Array) => {
  let peak = 0
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
  if (peak < 0.0001) return samples
  const gain = 0.85 / peak
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
    samples[sampleIndex] *= gain
  }
  return samples
}

const stopPlayback = () => {
  playingSource?.stop()
  playingSource?.disconnect()
  playingSource = null
  playingId.value = null
}

// AudioContext.resume() must start in the click callback; awaiting WASM first drops the user gesture.
const unlockAudio = () => {
  audioContext ??= new AudioContext({ sampleRate: PREVIEW_SAMPLE_RATE })
  if (audioContext.state !== 'suspended') {
    unlockPromise = null
    return Promise.resolve()
  }
  unlockPromise ??= audioContext.resume().then(() => {
    unlockPromise = null
  }).catch(error => {
    unlockPromise = null
    throw error
  })
  return unlockPromise
}

const playSamples = async (id: string, samples: Float32Array) => {
  if (!audioContext) throw new Error('AudioContext is not ready')
  await unlockAudio()
  const buffer = audioContext.createBuffer(1, samples.length, PREVIEW_SAMPLE_RATE)
  buffer.copyToChannel(samples, 0)
  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.connect(audioContext.destination)
  source.onended = () => {
    if (playingSource === source) {
      playingSource = null
      playingId.value = null
    }
  }
  playingSource = source
  playingId.value = id
  source.start()
}

const resolveVoice = (source: unknown): PreviewVoice | null => {
  if (isPreviewVoice(source)) return source
  return previewVoiceFromUnknown(source) ?? previewVoiceFromUnknown(createInitialSoundProgram())
}

const renderSource = (source: PreviewVoice | unknown) => {
  if (isSequencePreviewRequest(source)) {
    const voice = resolveVoice(source.voice)
    if (!voice) return null
    const { events, frameCount } = sequencePreviewEvents(source.sequence, voice, source.voice)
    return { voice, events, frameCount }
  }
  const voice = isPreviewVoice(source) ? source : previewVoiceFromUnknown(source)
  if (!voice) return null
  const { events, frameCount } = phrasePreviewEvents()
  return { voice, events, frameCount }
}

export const useProgramPreview = () => {
  const isPlaying = (id: string) => playingId.value === id
  const isBusy = (id: string) => previewBusy.value && pendingId.value === id

  const stopPreview = () => {
    stopPlayback()
  }

  const startPreview = async (id: string, source: PreviewVoice | unknown) => {
    const rendered = renderSource(source)
    if (!rendered) {
      previewFailed.value = true
      return
    }
    pendingId.value = id
    previewBusy.value = true
    previewFailed.value = false
    try {
      const audioReady = unlockAudio()
      const samples = normalizePeak(await renderDexedPreview(
        rendered.voice.unpacked,
        rendered.voice.opSwitch,
        rendered.events,
        rendered.frameCount,
      ))
      if (pendingId.value !== id) return
      await audioReady
      await playSamples(id, samples)
    } catch (error) {
      console.error('Program preview failed', error)
      previewFailed.value = true
      playingId.value = null
    } finally {
      if (pendingId.value === id) {
        previewBusy.value = false
        pendingId.value = null
      }
    }
  }

  const playPreview = async (id: string, source: PreviewVoice | unknown) => {
    if (playingId.value === id) {
      stopPlayback()
      return
    }
    stopPlayback()
    if (isSequencePreviewRequest(source)) {
      sequencePreviewHint.request(() => { void startPreview(id, source) })
      return
    }
    await startPreview(id, source)
  }

  return {
    playingId,
    previewBusy,
    previewFailed,
    isPlaying,
    isBusy,
    playPreview,
    stopPreview,
    showSequenceHint: sequencePreviewHint.show,
    dontShowSequenceHintAgain: sequencePreviewHint.dontShowAgain,
    confirmSequenceHint: sequencePreviewHint.confirm,
    cancelSequenceHint: sequencePreviewHint.cancel,
  }
}
