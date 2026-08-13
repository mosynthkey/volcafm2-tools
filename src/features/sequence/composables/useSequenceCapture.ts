import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMidiStore } from '@/stores/midiStore'
import { useSequencerStore } from '@/stores/sequencerStore'
import { MidiSequenceCapture, type SequencePlaybackResolution } from '@/utils/midiSequenceCapture'

export type CapturePhase = 'ready' | 'fetching-program' | 'capturing' | 'done' | 'error'

export function useSequenceCapture() {
  const midi = useMidiStore()
  const sequence = useSequencerStore()
  const { t } = useI18n()
  const open = computed({
    get: () => sequence.showCaptureDialog,
    set: value => { sequence.showCaptureDialog = value },
  })
  const phase = ref<CapturePhase>('ready'); const progress = ref(0)
  const stepCount = ref(0); const noteCount = ref(0); const errorMessage = ref('')
  const resolution = ref<SequencePlaybackResolution>(1)
  let capture: MidiSequenceCapture | null = null; let unsubscribe: (() => void) | null = null
  let clockTimeout: ReturnType<typeof setTimeout> | null = null; let startDelay: ReturnType<typeof setTimeout> | null = null
  let startedAt = 0; let lastClockAt = 0; let ignoredDuplicates = 0
  let cancelled = false
  const recentMessages = new Map<string, number>(); const duplicateWindow = 5
  const log = (message: string) => midi.addLog(`[CAPTURE] ${message}`)
  const hex = (data: Uint8Array) => [...data].map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')

  const clearResources = () => {
    unsubscribe?.(); unsubscribe = null
    if (clockTimeout) clearTimeout(clockTimeout); clockTimeout = null
    if (startDelay) clearTimeout(startDelay); startDelay = null
  }
  const resetView = () => {
    phase.value = 'ready'; progress.value = 0; stepCount.value = 0; noteCount.value = 0; errorMessage.value = ''
  }
  watch(open, isOpen => { if (isOpen) resetView() })
  const fail = (message: string) => {
    log(`FAILED: ${message} clocks=${capture?.clockCount ?? 0} elapsed=${Math.round(performance.now() - startedAt)}ms`)
    clearResources(); midi.sendMidiMessage(new Uint8Array([0xfc])); errorMessage.value = message; phase.value = 'error'
  }
  const finish = () => {
    if (!capture || capture.clockCount === 0) return fail(t('sequence.captureNoClock'))
    const result = capture.finish(); clearResources(); midi.sendMidiMessage(new Uint8Array([0xfc])); sequence.notes = []
    let added = 0
    for (const note of result.notes) if (sequence.addNote(note.pitch, note.startStep, note.length, note.velocity, note.gatePercent)) added++
    if (added > 0) { sequence.velocity = result.velocity; sequence.gatePercent = result.gatePercent }
    noteCount.value = added; stepCount.value = 16; progress.value = 100; phase.value = 'done'
    log(`DONE: clocks=${result.clockCount}, importedNotes=${added}, ignoredDuplicates=${ignoredDuplicates}`)
  }
  const beginAfterStop = () => {
    startDelay = null; if (phase.value !== 'capturing') return
    capture = new MidiSequenceCapture(resolution.value); lastClockAt = 0; ignoredDuplicates = 0; recentMessages.clear()
    log(`Starting. resolution=1/${resolution.value}, clocksPerStep=${capture.clocksPerStep}, expectedClocks=${capture.clocksPerPattern}`)
    unsubscribe = midi.onMidiMessage((data, inputName) => {
      if (inputName !== midi.selectedMidiIn) return
      const status = data[0]; const now = performance.now(); const signature = [...data].join(','); const previous = recentMessages.get(signature)
      recentMessages.set(signature, now)
      if (previous !== undefined && now - previous <= duplicateWindow) { ignoredDuplicates++; return }
      const type = status & 0xf0
      if (status === 0xf8) { const interval = lastClockAt ? now - lastClockAt : 0; lastClockAt = now; log(`Clock ${(capture?.clockCount ?? 0) + 1}/${capture?.clocksPerPattern ?? 0}, interval=${interval.toFixed(1)}ms`) }
      else if (type === 0x90 || type === 0x80) log(`${type === 0x90 && (data[2] ?? 0) > 0 ? 'Note On' : 'Note Off'} ${hex(data)}`)
      const result = capture?.handleMessage(data)
      if (status === 0xf8 && capture) {
        if (clockTimeout) clearTimeout(clockTimeout)
        clockTimeout = setTimeout(() => fail(t('sequence.captureClockStopped')), 3000)
        stepCount.value = capture.stepCount; progress.value = (stepCount.value / 16) * 100
      }
      if (result === 'complete') finish()
    })
    clockTimeout = setTimeout(() => { if (capture?.clockCount === 0) fail(t('sequence.captureNoClock')) }, 3000)
    if (!midi.sendMidiMessage(new Uint8Array([0xfa]))) fail(t('sequence.captureStartFailed'))
  }
  const startCapture = () => {
    phase.value = 'capturing'; progress.value = 0; stepCount.value = 0; startedAt = performance.now(); capture = null
    log('Sending pre-capture Stop (FC)...')
    if (!midi.sendMidiMessage(new Uint8Array([0xfc]))) return fail(t('sequence.captureStartFailed'))
    startDelay = setTimeout(beginAfterStop, 100)
  }
  const start = async () => {
    cancelled = false
    phase.value = 'fetching-program'
    log('Fetching current program number before capture...')
    const matched = await midi.requestCurrentVoiceProgramNo()
    if (cancelled || !open.value) return
    if (!matched) {
      errorMessage.value = t('sequence.programFetchFailed')
      phase.value = 'error'
      return
    }
    startCapture()
  }
  const cancel = () => { cancelled = true; clearResources(); midi.sendMidiMessage(new Uint8Array([0xfc])); phase.value = 'ready'; open.value = false }
  onUnmounted(clearResources)
  return { open, phase, progress, stepCount, noteCount, errorMessage, resolution, start, cancel }
}
