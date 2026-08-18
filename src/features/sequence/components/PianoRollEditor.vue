<template>
  <AppDialog v-model="showFoldHelp" :title="t('sequence.foldTitle')">
    <p class="fold-help-copy">{{ t('sequence.foldDescription') }}</p>
    <label class="fold-help-skip">
      <input v-model="dontShowFoldHelpAgain" type="checkbox" />
      <span>{{ t('sequence.randomizeDontShowAgain') }}</span>
    </label>
    <template #actions>
      <v-btn variant="text" @click="showFoldHelp = false">{{ t('common.cancel') }}</v-btn>
      <v-btn @click="confirmFoldHelp">{{ t('common.ok') }}</v-btn>
    </template>
  </AppDialog>

  <EuclidCopyDialog v-model="showEuclidCopy" :source-step="euclidSourceStep" :source-note="euclidSourceNote" />

  <Teleport to="body">
    <div v-if="euclidMenu" class="euclid-menu-layer" @pointerdown="closeEuclidMenu">
      <div class="euclid-menu" :style="{ left: `${euclidMenu.x}px`, top: `${euclidMenu.y}px` }"
        role="menu" @pointerdown.stop>
        <button type="button" role="menuitem" @click="openEuclidCopy">{{ t('sequence.euclidCopy') }}</button>
      </div>
    </div>
  </Teleport>

  <div class="roll">
    <div class="roll-header" :class="{ 'is-copying': stepCopy?.dragging }"
      @pointerdown="startStepCopy" @pointermove="moveStepCopy" @pointerup="endStepCopy" @pointercancel="cancelStepCopy">
      <div class="pitch-gutter header-gutter" @pointerdown.stop>
        <button type="button" class="header-tool" :title="t('sequence.shiftStepsLeft')"
          :aria-label="t('sequence.shiftStepsLeft')" @click="sequence.shiftSteps(-1)">
          <ChevronLeft :size="16" />
        </button>
        <button type="button" class="header-tool" :title="t('sequence.shiftStepsRight')"
          :aria-label="t('sequence.shiftStepsRight')" @click="sequence.shiftSteps(1)">
          <ChevronRight :size="16" />
        </button>
        <button type="button" class="header-tool" :class="{ on: foldUsedPitches }"
          :aria-pressed="foldUsedPitches" :title="t('sequence.fold')"
          :aria-label="t('sequence.fold')" @click="requestFoldUsedPitches">
          <ChevronsDownUp v-if="foldUsedPitches" :size="16" />
          <ChevronsUpDown v-else :size="16" />
        </button>
      </div>
      <div v-for="step in 16" :key="step" class="step-cell header-cell"
        :class="{ beat:(step-1)%4===0, cursor:sequence.stepInputActive&&step-1===sequence.stepCursor, muted:!sequence.stepOn[step-1], skipped:!sequence.activeStep[step-1], 'copy-source': stepCopy && step-1===stepCopy.from, 'drop-target': stepCopy?.dragging && step-1===stepCopy.to && step-1!==stepCopy.from }"
        role="button" tabindex="0" :aria-label="t('sequence.stepAria', { count: step })" :title="t('sequence.stepCopyHint')"
        @contextmenu.prevent="openStepEuclidMenu(step-1, $event)"
        @keydown.enter.prevent="selectHeader(step-1)">{{ step }}</div>
    </div>
    <div class="roll-row step-flags" @pointerdown="startFlag('stepOn', $event)" @pointermove="moveFlag" @pointerup="endFlag" @pointercancel="endFlag">
      <div class="pitch-gutter">{{ t('sequence.stepOn') }}</div>
      <div v-for="step in 16" :key="step" class="step-cell flag-cell" :class="{ beat:(step-1)%4===0 }">
        <button type="button" class="flag sound" :class="{ on: sequence.stepOn[step-1] }"
          :aria-pressed="sequence.stepOn[step-1]" :aria-label="`${t('sequence.stepOn')} ${step}`"
          @keydown.enter.prevent="sequence.toggleStepOn(step-1)" />
      </div>
    </div>
    <div class="roll-row step-flags" @pointerdown="startFlag('activeStep', $event)" @pointermove="moveFlag" @pointerup="endFlag" @pointercancel="endFlag">
      <div class="pitch-gutter">{{ t('sequence.activeStep') }}</div>
      <div v-for="step in 16" :key="step" class="step-cell flag-cell" :class="{ beat:(step-1)%4===0 }">
        <button type="button" class="flag" :class="{ on: sequence.activeStep[step-1] }"
          :aria-pressed="sequence.activeStep[step-1]" :aria-label="`${t('sequence.activeStep')} ${step}`"
          @keydown.enter.prevent="sequence.toggleActiveStep(step-1)" />
      </div>
    </div>
    <div class="roll-row step-flags" @pointerdown="startFlag('transpose', $event)" @pointermove="moveFlag" @pointerup="endFlag" @pointercancel="endFlag">
      <div class="pitch-gutter">{{ t('sequence.funcTranspose') }}</div>
      <div v-for="step in 16" :key="step" class="step-cell flag-cell" :class="{ beat:(step-1)%4===0 }">
        <button type="button" class="flag"
          :class="{ on: sequence.transposeFuncOn[step-1] }"
          :aria-pressed="sequence.transposeFuncOn[step-1]" :aria-label="`${t('sequence.funcTranspose')} ${step}`"
          @keydown.enter.prevent="sequence.toggleTransposeFunc(step-1)" />
      </div>
    </div>
    <div ref="rollBody" class="roll-body" :class="{ 'is-moving': drag?.kind === 'move', 'is-resizing': drag?.kind === 'resize', 'is-marquee': drag?.kind === 'marquee' }"
      @pointerdown="rollDown" @pointermove="rollMove" @pointerup="rollUp" @pointercancel="rollUp">
      <div class="roll-pitches">
      <div v-if="marqueeStyle" class="note-marquee" :style="marqueeStyle"></div>
      <div v-for="pitch in pitches" :key="pitch" class="roll-row" @contextmenu.prevent="onNoteContextMenu(pitch,$event)">
      <div class="pitch-gutter" :class="{ 'black-key':isBlackKey(pitch) }">{{ noteLabel(pitch) }}</div>
      <div v-for="step in 16" :key="step" class="step-cell note-cell" :class="cellClass(step-1,pitch)">
        <span v-if="cellLabel(step-1,pitch)" class="note-cell__label">{{ cellLabel(step-1,pitch) }}</span>
        <span v-if="isNoteEnd(step-1,pitch)" class="note-resize-handle"></span>
      </div>
    </div></div></div>
    <div class="roll-row motion-row">
      <div class="pitch-gutter motion-gutter" @pointerdown.stop>
        <span class="motion-gutter__label">{{ t('sequence.motion') }}</span>
        <v-select v-model="sequence.motionIndex" :items="motionItems" item-title="label" item-value="value"
          variant="underlined" density="compact" hide-details class="motion-target-select"
          :aria-label="t('sequence.motionTarget')" :menu-props="{ minWidth: 200 }" />
        <div class="motion-gutter__actions">
          <AppToggle v-model="sequence.motionEnabled[sequence.motionIndex]" :aria-label="t('sequence.motionEnable')" />
          <button type="button" class="motion-gutter__clear" :title="t('sequence.motionClear')"
            :aria-label="t('sequence.motionClear')" @click="sequence.clearMotionParam(sequence.motionIndex)">
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
      <div class="motion-bars" :class="{ disabled:!sequence.motionEnabled[sequence.motionIndex] }" @pointerdown="startMotion" @pointermove="moveMotion" @pointerup="draggingMotion=false" @pointerleave="draggingMotion=false">
        <div v-for="step in 16" :key="step" class="step-cell motion-col"
          :class="{ beat:(step-1)%4===0, cursor:sequence.stepInputActive&&step-1===sequence.stepCursor, off:!sequence.motionStepEnabled[sequence.motionIndex][step-1] }">
          <template v-if="sequence.func.motionSmooth">
            <div v-for="point in 5" :key="point" class="motion-fill point"
              :style="{ height: (sequence.motionValues[sequence.motionIndex][step-1][point-1]/127*100)+'%', left: ((point-1)*20)+'%', width: '20%' }" />
          </template>
          <div v-else class="motion-fill" :style="{ height:(sequence.motionValues[sequence.motionIndex][step-1][0]/127*100)+'%' }" />
          <input v-if="editingStep===step-1" v-model.number="editValue" class="motion-value-input" type="number"
            :min="motionRange.min" :max="motionRange.max" @pointerdown.stop @blur="commitMotion"
            @keydown.enter.prevent="commitMotion" @keydown.escape.prevent="editingStep=null" />
          <span v-else class="motion-value" @pointerdown.stop @dblclick.stop="beginMotionEdit(step-1)">{{ formatStepValue(step-1) }}</span>
        </div>
      </div>
    </div>
    <div class="roll-row step-flags motion-step-row" @pointerdown="startFlag('motionStep', $event)" @pointermove="moveFlag" @pointerup="endFlag" @pointercancel="endFlag">
      <div class="pitch-gutter">{{ t('sequence.motionStep') }}</div>
      <div v-for="step in 16" :key="step" class="step-cell flag-cell" :class="{ beat:(step-1)%4===0 }">
        <button type="button" class="flag"
          :class="{ on: sequence.motionStepEnabled[sequence.motionIndex][step-1] }"
          :aria-pressed="sequence.motionStepEnabled[sequence.motionIndex][step-1]" :aria-label="`${t('sequence.motionStep')} ${step}`"
          @keydown.enter.prevent="sequence.toggleMotionStep(sequence.motionIndex, step-1)" />
      </div>
    </div>
  </div>
  <MotionControlPanel />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2, ChevronsDownUp, ChevronsUpDown, ChevronLeft, ChevronRight } from '@lucide/vue'
import AppToggle from '@/components/AppToggle.vue'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import { usePersistedFlag } from '@/composables/usePersistedFlag'
import { useSequencerStore } from '@/stores/sequencerStore'
import { useUiStore } from '@/stores/uiStore'
import { useNoteAudition } from '@/features/sequence/composables/useNoteAudition'
import EuclidCopyDialog from '@/features/sequence/components/EuclidCopyDialog.vue'
import MotionControlPanel from '@/features/sequence/components/MotionControlPanel.vue'
import { MOTION_PARAM_KEYS, type SequenceNote } from '@/types/sequence'
import { notesIntersectingRect, previewMovedNotes, previewResizedNotes, type NoteKey } from '@/utils/sequenceNoteEditing'
import { getPref, setPref } from '@/utils/appPrefs'
import { displayToMidi, formatMotionValue, getMotionDisplayRange, midiToDisplay } from '@/utils/motionValue'

const SKIP_FOLD_PREF = 'skipFocusUsedPitchesDialog'
const { t }=useI18n(); const sequence=useSequencerStore(); const ui=useUiStore(); const { audition }=useNoteAudition()
const motionItems = computed(() => MOTION_PARAM_KEYS.map((key, index) => ({ label: t(`sequence.motionParams.${key}`), value: index })))
const ALL_PITCHES = Array.from({ length: 61 }, (_, index) => 96 - index)
const PITCH_MIN = 36
const PITCH_MAX = 96
const foldUsedPitches = usePersistedFlag('volca-fm2-show-used-notes', false)
const skipFoldHelp = ref(false)
const showFoldHelp = ref(false)
const dontShowFoldHelpAgain = ref(false)
getPref<boolean>(SKIP_FOLD_PREF).then(value => { if (value === true) skipFoldHelp.value = true })
const requestFoldUsedPitches = () => {
  if (foldUsedPitches.value) {
    foldUsedPitches.value = false
    return
  }
  if (skipFoldHelp.value) {
    foldUsedPitches.value = true
    return
  }
  dontShowFoldHelpAgain.value = false
  showFoldHelp.value = true
}
const confirmFoldHelp = () => {
  if (dontShowFoldHelpAgain.value) {
    skipFoldHelp.value = true
    setPref(SKIP_FOLD_PREF, true).catch(() => { skipFoldHelp.value = false })
  }
  showFoldHelp.value = false
  foldUsedPitches.value = true
}
const pitches = computed(() => {
  if (!foldUsedPitches.value || sequence.notes.length === 0) return ALL_PITCHES
  const visible = new Set<number>()
  for (const note of sequence.notes) {
    for (const octaves of [-2, -1, 0, 1, 2]) {
      const pitch = note.pitch + octaves * 12
      if (pitch >= PITCH_MIN && pitch <= PITCH_MAX) visible.add(pitch)
    }
  }
  return ALL_PITCHES.filter(pitch => visible.has(pitch))
})
const A4_MIDI = 69
const NOTE_ROW_HEIGHT = 20
const rollBody = ref<HTMLElement | null>(null)
const scrollToA4 = () => {
  const el = rollBody.value
  const list = pitches.value
  if (!el || el.clientHeight < 40 || !list.length) return false
  const target = list.includes(A4_MIDI) ? A4_MIDI : list[Math.floor(list.length / 2)]
  const index = list.indexOf(target)
  el.scrollTop = Math.max(0, index * NOTE_ROW_HEIGHT - el.clientHeight / 2 + NOTE_ROW_HEIGHT / 2)
  return true
}
onMounted(() => {
  const el = rollBody.value
  if (!el) return
  let userScrolled = false
  let ignoreScroll = false
  el.addEventListener('scroll', () => { if (!ignoreScroll) userScrolled = true }, { passive: true })
  const tryCenter = () => {
    if (userScrolled || el.clientHeight < 40) return
    ignoreScroll = true
    scrollToA4()
    requestAnimationFrame(() => { ignoreScroll = false })
  }
  nextTick(tryCenter)
  const observer = new ResizeObserver(tryCenter)
  observer.observe(el)
  onUnmounted(() => observer.disconnect())
})
const motionRange=computed(()=>getMotionDisplayRange(sequence.motionIndex, sequence.func.transposeNote))
const formatStepValue=(step:number)=>formatMotionValue(sequence.motionIndex, sequence.motionValues[sequence.motionIndex][step][0], sequence.func.transposeNote)
type NoteKeySnap = { pitch: number; startStep: number }
type RollDrag =
  | { kind: 'resize'; key: NoteKey; end: number; originX: number; originY: number; dragged: boolean }
  | { kind: 'move'; originPitch: number; originStep: number; dPitch: number; dStep: number; originX: number; originY: number; dragged: boolean }
  | { kind: 'marquee'; startStep: number; startPitch: number; endStep: number; endPitch: number; additive: boolean; base: NoteKeySnap[] }
const drag=ref<RollDrag|null>(null)
const CLICK_SLOP = 4
const markDragged = (state: RollDrag, event: PointerEvent) => {
  if (state.kind === 'marquee' || state.dragged) return
  if (Math.hypot(event.clientX - state.originX, event.clientY - state.originY) >= CLICK_SLOP) state.dragged = true
}
const deleteClickedNote = (note: SequenceNote) => {
  sequence.removeNote(note)
}
const draggingMotion=ref(false); const editingStep=ref<number|null>(null); const editValue=ref(0)
type FlagKind = 'stepOn' | 'activeStep' | 'transpose' | 'motionStep'
const flagDrag=ref<{ kind: FlagKind; value: boolean; origin: number; snapshot: boolean[] }|null>(null)
const noteNames=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; const noteLabel=(pitch:number)=>`${noteNames[pitch%12]}${Math.floor(pitch/12)-1}`; const isBlackKey=(pitch:number)=>[1,3,6,8,10].includes(pitch%12)
const GUTTER_WIDTH = 180
const stepAt=(event:PointerEvent | MouseEvent)=>{const rect=(event.currentTarget as HTMLElement).getBoundingClientRect();return Math.min(15,Math.max(0,Math.floor((event.clientX-rect.left-GUTTER_WIDTH)/((rect.width-GUTTER_WIDTH)/16))))}
type EuclidMenu = { x: number; y: number; step: number; note: SequenceNote | null }
const euclidMenu = ref<EuclidMenu | null>(null)
const showEuclidCopy = ref(false)
const euclidSourceStep = ref(0)
const euclidSourceNote = ref<SequenceNote | null>(null)
const placeEuclidMenu = (event: MouseEvent, step: number, note: SequenceNote | null): EuclidMenu => {
  const menuWidth = 220
  const menuHeight = 44
  return {
    x: Math.min(Math.max(8, event.clientX), window.innerWidth - menuWidth - 8),
    y: Math.min(Math.max(8, event.clientY), window.innerHeight - menuHeight - 8),
    step,
    note,
  }
}
const closeEuclidMenu = () => { euclidMenu.value = null }
const openStepEuclidMenu = (step: number, event: MouseEvent) => {
  euclidMenu.value = placeEuclidMenu(event, step, null)
}
const onNoteContextMenu = (pitch: number, event: MouseEvent) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (event.clientX - rect.left < GUTTER_WIDTH) return
  const step = stepAt(event)
  const note = sequence.noteAt(step, pitch)
  if (!note) return
  euclidMenu.value = placeEuclidMenu(event, note.startStep, { ...note })
}
const openEuclidCopy = () => {
  const menu = euclidMenu.value
  if (!menu) return
  euclidSourceStep.value = menu.step
  euclidSourceNote.value = menu.note
  euclidMenu.value = null
  showEuclidCopy.value = true
}
onMounted(() => window.addEventListener('keydown', onRollKeydown))
onUnmounted(() => window.removeEventListener('keydown', onRollKeydown))
const onRollKeydown = (event: KeyboardEvent) => {
  if (ui.activeTab !== 'sequencer') return
  if (event.key === 'Escape') {
    closeEuclidMenu()
    sequence.clearNoteSelection()
    return
  }
  const target = event.target
  if (target instanceof HTMLElement) {
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
  }
  if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
    if (!sequence.selectedNoteKeys.length) return
    event.preventDefault()
    const delta = event.key === 'ArrowUp' ? 12 : -12
    if (sequence.moveSelectedNotes(delta, 0, PITCH_MIN, PITCH_MAX)) {
      audition(sequence.selectedNoteKeys.map(key => key.pitch))
    }
    return
  }
  if (event.key !== 'Backspace' && event.key !== 'Delete') return
  if (!sequence.selectedNoteKeys.length) return
  event.preventDefault()
  sequence.removeSelectedNotes()
}
const hitRoll = (event: PointerEvent | MouseEvent) => {
  const body = rollBody.value
  if (!body) return null
  const rect = body.getBoundingClientRect()
  const x = event.clientX - rect.left
  if (x < GUTTER_WIDTH) return null
  const y = event.clientY - rect.top + body.scrollTop
  const pitch = pitches.value[Math.floor(y / NOTE_ROW_HEIGHT)]
  if (pitch === undefined) return null
  const cellWidth = (rect.width - GUTTER_WIDTH) / 16
  const step = Math.min(15, Math.max(0, Math.floor((x - GUTTER_WIDTH) / cellWidth)))
  const localX = (x - GUTTER_WIDTH) - step * cellWidth
  return { pitch, step, localX, cellWidth }
}
const RESIZE_HANDLE = 10
const isNoteEnd = (step: number, pitch: number) => {
  const note = sequence.noteAt(step, pitch)
  return !!note && step === note.startStep + note.length - 1
}
const sameKey = (left: NoteKeySnap, right: NoteKeySnap) =>
  left.pitch === right.pitch && left.startStep === right.startStep
const applyMarqueeSelection = (state: Extract<RollDrag, { kind: 'marquee' }>) => {
  const picked = notesIntersectingRect(
    sequence.notes, state.startStep, state.startPitch, state.endStep, state.endPitch,
  ).map(note => ({ pitch: note.pitch, startStep: note.startStep }))
  if (!state.additive) {
    sequence.setNoteSelection(picked)
    return
  }
  const extra = picked.filter(key => !state.base.some(item => sameKey(item, key)))
  sequence.setNoteSelection([...state.base, ...extra])
}
const rollDown = (event: PointerEvent) => {
  if (event.button !== 0) return
  const hit = hitRoll(event)
  if (!hit) return
  event.preventDefault()
  const existing = sequence.noteAt(hit.step, hit.pitch)
  if (existing) {
    if (event.shiftKey) {
      sequence.selectNote(existing, true)
      return
    }
    const lastStep = existing.startStep + existing.length - 1
    const onHandle = !!(event.target as HTMLElement).closest('.note-resize-handle')
    const resize = hit.step === lastStep && (onHandle || hit.localX >= hit.cellWidth - RESIZE_HANDLE)
    if (!sequence.isNoteSelected(existing)) sequence.selectNote(existing)
    drag.value = resize
      ? { kind: 'resize', key: { pitch: existing.pitch, startStep: existing.startStep }, end: lastStep, originX: event.clientX, originY: event.clientY, dragged: false }
      : { kind: 'move', originPitch: hit.pitch, originStep: hit.step, dPitch: 0, dStep: 0, originX: event.clientX, originY: event.clientY, dragged: false }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    return
  }
  const additive = event.shiftKey
  drag.value = {
    kind: 'marquee',
    startStep: hit.step,
    startPitch: hit.pitch,
    endStep: hit.step,
    endPitch: hit.pitch,
    additive,
    base: additive ? sequence.selectedNoteKeys.map(key => ({ pitch: key.pitch, startStep: key.startStep })) : [],
  }
  applyMarqueeSelection(drag.value)
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
const rollMove = (event: PointerEvent) => {
  const state = drag.value
  if (!state) return
  markDragged(state, event)
  const hit = hitRoll(event)
  if (!hit) return
  if (state.kind === 'resize') state.end = Math.max(state.key.startStep, hit.step)
  else if (state.kind === 'move') {
    state.dPitch = hit.pitch - state.originPitch
    state.dStep = hit.step - state.originStep
  } else {
    state.endStep = hit.step
    state.endPitch = hit.pitch
    applyMarqueeSelection(state)
  }
}
const rollUp = (event: PointerEvent) => {
  const state = drag.value
  drag.value = null
  if (!state) return
  markDragged(state, event)
  if (state.kind === 'resize') {
    const note = sequence.notes.find(item => item.pitch === state.key.pitch && item.startStep === state.key.startStep)
    const nextLength = state.end - state.key.startStep + 1
    if (note && nextLength !== note.length) {
      sequence.resizeNote(state.key, nextLength)
      return
    }
    if (note && !state.dragged && event.type === 'pointerup') deleteClickedNote(note)
    return
  }
  if (state.kind === 'move') {
    if (state.dPitch || state.dStep) {
      sequence.moveSelectedNotes(state.dPitch, state.dStep, PITCH_MIN, PITCH_MAX)
      return
    }
    const note = sequence.noteAt(state.originStep, state.originPitch)
    if (note && !state.dragged && event.type === 'pointerup') deleteClickedNote(note)
    return
  }
  const sameCell = state.startStep === state.endStep && state.startPitch === state.endPitch
  if (sameCell && !state.additive && event.type === 'pointerup') {
    if (sequence.addNote(state.startPitch, state.startStep, 1)) {
      sequence.selectNote(sequence.noteAt(state.startStep, state.startPitch) ?? null)
      audition([state.startPitch])
    }
  }
}
const movePreview = computed(() => {
  const state = drag.value
  if (state?.kind !== 'move' || (!state.dPitch && !state.dStep)) return []
  return previewMovedNotes(sequence.notes, sequence.selectedNoteKeys, state.dPitch, state.dStep, PITCH_MIN, PITCH_MAX)
})
const resizePreview = computed(() => {
  const state = drag.value
  if (state?.kind !== 'resize') return []
  const origin = sequence.notes.find(item => item.pitch === state.key.pitch && item.startStep === state.key.startStep)
  if (!origin) return []
  const delta = state.end - state.key.startStep + 1 - origin.length
  if (!delta) return []
  const keys = sequence.selectedNoteKeys.some(item => item.pitch === state.key.pitch && item.startStep === state.key.startStep)
    ? sequence.selectedNoteKeys
    : [state.key]
  return previewResizedNotes(sequence.notes, keys, delta)
})
const notePreview = computed(() => movePreview.value.length ? movePreview.value : resizePreview.value)
const hidingNote = (note: SequenceNote | null | undefined) => {
  if (!note || !sequence.isNoteSelected(note)) return false
  const state = drag.value
  if (state?.kind === 'move') return !!(state.dPitch || state.dStep)
  return state?.kind === 'resize' && resizePreview.value.length > 0
}
const marqueeStyle = computed(() => {
  const state = drag.value
  const body = rollBody.value
  if (state?.kind !== 'marquee' || !body) return null
  if (state.startStep === state.endStep && state.startPitch === state.endPitch) return null
  const list = pitches.value
  const a = list.indexOf(state.startPitch)
  const b = list.indexOf(state.endPitch)
  if (a < 0 || b < 0) return null
  const cellWidth = (body.clientWidth - GUTTER_WIDTH) / 16
  const stepMin = Math.min(state.startStep, state.endStep)
  const stepMax = Math.max(state.startStep, state.endStep)
  const pitchMin = Math.min(a, b)
  const pitchMax = Math.max(a, b)
  return {
    left: `${GUTTER_WIDTH + stepMin * cellWidth}px`,
    top: `${pitchMin * NOTE_ROW_HEIGHT}px`,
    width: `${(stepMax - stepMin + 1) * cellWidth}px`,
    height: `${(pitchMax - pitchMin + 1) * NOTE_ROW_HEIGHT}px`,
  }
})
const selectHeader=(step:number)=>{if(sequence.stepInputActive)sequence.selectStepInput(step);audition(sequence.notes.filter(note=>note.startStep<=step&&note.startStep+note.length>step).map(note=>note.pitch))}
const stepCopy=ref<{from:number;to:number;dragging:boolean}|null>(null)
const startStepCopy=(event:PointerEvent)=>{
  if(event.button!==0) return
  if((event.target as HTMLElement).closest('.pitch-gutter')) return
  event.preventDefault()
  const step=stepAt(event)
  stepCopy.value={from:step,to:step,dragging:false}
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
const moveStepCopy=(event:PointerEvent)=>{
  if(!stepCopy.value) return
  const step=stepAt(event)
  if(step!==stepCopy.value.from) stepCopy.value.dragging=true
  stepCopy.value.to=step
}
const cancelStepCopy=()=>{ stepCopy.value=null }
const endStepCopy=()=>{
  const drag=stepCopy.value
  stepCopy.value=null
  if(!drag) return
  if(drag.dragging && drag.to!==drag.from){
    sequence.copyStep(drag.from, drag.to)
    audition(sequence.notes.filter(note=>note.startStep<=drag.to&&note.startStep+note.length>drag.to).map(note=>note.pitch))
    return
  }
  selectHeader(drag.from)
}
const cellClass=(step:number,pitch:number)=>{
  const note=sequence.noteAt(step,pitch)
  const hiding=hidingNote(note)
  const preview=notePreview.value.find(item=>item.pitch===pitch&&item.startStep<=step&&item.startStep+item.length>step)
  const shown=preview ?? (note && !hiding ? note : undefined)
  const input=sequence.stepInputActive&&step===sequence.stepCursor&&sequence.chordBuffer.has(pitch)
  return{
    beat:step%4===0,
    active:!!shown||input,
    selected:!!preview||(!!note&&!hiding&&sequence.isNoteSelected(note)),
    'note-start':!!shown&&step===shown.startStep,
    'note-end':!!shown&&step===shown.startStep+shown.length-1,
    full:!shown&&sequence.stepNoteCount(step)>=6,
    cursor:sequence.stepInputActive&&step===sequence.stepCursor,
    muted:!sequence.stepOn[step],
    skipped:!sequence.activeStep[step],
  }
}
const cellLabel=(step:number,pitch:number)=>{
  const note=sequence.noteAt(step,pitch)
  const hiding=hidingNote(note)
  const preview=notePreview.value.find(item=>item.pitch===pitch&&item.startStep===step)
  const input=sequence.stepInputActive&&step===sequence.stepCursor&&sequence.chordBuffer.has(pitch)
  return (!hiding && note?.startStep===step)||preview||input?noteLabel(pitch):''
}
const motionHit=(event:PointerEvent)=>{
  const rect=(event.currentTarget as HTMLElement).getBoundingClientRect()
  const step=Math.min(15,Math.max(0,Math.floor((event.clientX-rect.left)/(rect.width/16))))
  const local=((event.clientX-rect.left)/(rect.width/16))-step
  const point=sequence.func.motionSmooth ? Math.min(4, Math.max(0, Math.floor(local*5))) : undefined
  const ratio=1-Math.min(1,Math.max(0,(event.clientY-rect.top)/rect.height))
  return { step, point, value: ratio*127 }
}
const motionStep=(event:PointerEvent)=>{const hit=motionHit(event);sequence.motionEnabled[sequence.motionIndex]=true;if(!sequence.motionStepEnabled[sequence.motionIndex][hit.step])sequence.motionStepEnabled[sequence.motionIndex][hit.step]=true;sequence.setMotionValue(sequence.motionIndex,hit.step,hit.value,hit.point)}
const startMotion=(event:PointerEvent)=>{draggingMotion.value=true;motionStep(event)};const moveMotion=(event:PointerEvent)=>{if(draggingMotion.value)motionStep(event)}
const beginMotionEdit=(step:number)=>{editingStep.value=step;editValue.value=midiToDisplay(sequence.motionIndex,sequence.motionValues[sequence.motionIndex][step][0],sequence.func.transposeNote);nextTick(()=>document.querySelector<HTMLInputElement>('.motion-value-input')?.select())};const commitMotion=()=>{if(editingStep.value!==null)sequence.setMotionValue(sequence.motionIndex,editingStep.value,displayToMidi(sequence.motionIndex,editValue.value,sequence.func.transposeNote));editingStep.value=null}
const flagSnapshot=(kind:FlagKind)=>{
  if(kind==='stepOn') return [...sequence.stepOn]
  if(kind==='activeStep') return [...sequence.activeStep]
  if(kind==='motionStep') return [...sequence.motionStepEnabled[sequence.motionIndex]]
  return [...sequence.transposeFuncOn]
}
const writeFlag=(kind:FlagKind,step:number,value:boolean)=>{
  if(kind==='stepOn')sequence.setStepOn(step,value)
  else if(kind==='activeStep')sequence.setActiveStep(step,value)
  else if(kind==='motionStep')sequence.setMotionStep(sequence.motionIndex,step,value)
  else sequence.setTransposeFunc(step,value)
}
const applyFlagRange=(current:number)=>{
  const paint=flagDrag.value; if(!paint)return
  const from=Math.min(paint.origin,current), to=Math.max(paint.origin,current)
  for(let step=0; step<16; step++) writeFlag(paint.kind, step, step>=from && step<=to ? paint.value : paint.snapshot[step])
  if(paint.kind==='activeStep' && !sequence.activeStep.some(Boolean)) sequence.setActiveStep(paint.origin, true)
}
const startFlag=(kind:FlagKind,event:PointerEvent)=>{
  if((event.target as HTMLElement).closest('.pitch-gutter')) return
  const step=stepAt(event)
  const snapshot=flagSnapshot(kind)
  flagDrag.value={ kind, value:!snapshot[step], origin:step, snapshot }
  applyFlagRange(step)
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
const moveFlag=(event:PointerEvent)=>{ if(flagDrag.value) applyFlagRange(stepAt(event)) }
const endFlag=()=>{ flagDrag.value=null }
</script>

<style scoped>
.roll{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;border:1px solid #55454780;border-radius:4px;overflow:hidden}.roll-header,.roll-row{display:flex}.roll-body{flex:1;min-height:0;overflow-y:auto;touch-action:none;user-select:none}.roll-pitches{position:relative;min-height:100%}.motion-row{flex:0 0 auto;border-top:2px solid var(--volca-accent)}.pitch-gutter{position:sticky;left:0;display:flex;flex:0 0 180px;align-items:center;justify-content:flex-end;box-sizing:border-box;padding:0 10px;background:#382b2d;color:var(--volca-text);font-size:var(--volca-type-label);font-weight:700;letter-spacing:.02em;line-height:1.2;white-space:nowrap}.flag-gutter,.step-flags .pitch-gutter,.motion-step-row .pitch-gutter{justify-content:center;color:var(--volca-accent);text-align:center}.header-gutter{justify-content:center;gap:4px;padding:4px 4px}.header-tool{display:grid;place-items:center;width:32px;height:32px;flex:0 0 32px;margin:0;padding:0;border:1px solid rgba(206,179,147,.28);border-radius:7px;background:#251c1e;color:var(--volca-muted);cursor:pointer}.header-tool:hover{border-color:rgba(206,179,147,.65);color:var(--volca-text)}.header-tool:focus-visible{outline:2px solid var(--volca-accent);outline-offset:2px}.header-tool.on{border-color:var(--volca-accent);background:rgba(206,179,147,.18);color:var(--volca-text)}.header-cell{min-height:40px;display:flex;align-items:center;justify-content:center}.motion-gutter{flex-direction:column;justify-content:center;align-items:stretch;gap:6px;padding:8px 6px;white-space:normal;color:var(--volca-accent);text-align:center}.motion-gutter__label{flex:0 0 auto;font-weight:700}.motion-target-select{flex:0 0 auto;min-width:0;width:100%;font-size:var(--volca-type-label)}.motion-gutter :deep(.v-field){border-radius:0!important;background:transparent!important;font-size:var(--volca-type-label);min-height:32px!important}.motion-gutter :deep(.v-field__input){min-height:28px;padding-top:2px;padding-bottom:2px;padding-inline:0;line-height:1.2}.motion-gutter :deep(.v-select__selection-text){white-space:nowrap;text-align:center}.motion-gutter__actions{display:flex;align-items:center;justify-content:center;gap:6px}.motion-gutter__clear{display:grid;place-items:center;width:50px;height:50px;min-width:50px;min-height:50px;margin:0;padding:0;border:1px solid rgba(206,179,147,.28);border-radius:9px;background:#251c1e;color:var(--volca-muted);cursor:pointer}.motion-gutter__clear:hover{border-color:rgba(206,179,147,.65);color:var(--volca-text)}.motion-gutter__clear:focus-visible{outline:2px solid var(--volca-accent);outline-offset:2px}.pitch-gutter.black-key{background:#2a2021;color:#9d8570}.step-cell{flex:1 1 0;width:0;min-width:28px;box-sizing:border-box;border-left:1px solid #55454740}.header-cell{position:relative;padding:4px 0;background:#4a3a3c;text-align:center;cursor:pointer}.header-cell.muted{opacity:.38}.header-cell.skipped{color:#8f8170;text-decoration:line-through}.note-cell{position:relative;display:flex;align-items:center;height:20px;border-top:1px solid #55454726;cursor:pointer;touch-action:none}.note-cell.muted,.note-cell.skipped{opacity:.42}.note-cell__label{z-index:2;overflow:hidden;padding-left:4px;color:#382b2d;font-size:var(--volca-type-label);font-weight:700;white-space:nowrap}.step-cell.cursor::after{content:'';position:absolute;inset:0;z-index:1;background:rgba(206,179,147,.2);pointer-events:none}.step-cell{position:relative}.step-cell.beat{border-left-color:#ceb39380}.note-cell.active,.motion-fill{background:var(--volca-accent)}.note-cell.active{cursor:grab}.note-cell.selected{box-shadow:none}.note-cell.full{cursor:not-allowed}.note-resize-handle{position:absolute;top:0;right:0;z-index:3;width:10px;height:100%;cursor:ew-resize}.roll-body.is-moving,.roll-body.is-moving .note-cell{cursor:grabbing}.roll-body.is-resizing,.roll-body.is-resizing .note-cell{cursor:ew-resize}.roll-body.is-marquee,.roll-body.is-marquee .note-cell,.roll-body.is-marquee .note-resize-handle{cursor:crosshair}.note-marquee{position:absolute;z-index:5;border:1px solid var(--volca-accent);background:rgba(206,179,147,.16);pointer-events:none}.step-flags{flex:0 0 auto;border-top:1px solid rgba(206,179,147,.28);background:#2f2426;touch-action:none}.step-flags .step-cell{border-left-color:transparent}.step-flags .step-cell.beat{border-left-color:transparent}.flag-cell{display:grid;min-height:22px;padding:0;cursor:pointer}.flag{min-height:0;margin:3px;padding:0;border:1px solid rgba(206,179,147,.28);border-radius:7px;background:#251c1e;cursor:pointer;touch-action:none;pointer-events:none}.flag.on{background:#ceb393;border-color:var(--volca-accent-bright)}.flag.sound.on{background:var(--volca-teal);border-color:var(--volca-teal)}.flag:focus-visible{outline:2px solid var(--volca-accent);outline-offset:1px}.motion-bars{display:flex;flex:1;height:160px;touch-action:none;cursor:pointer}.motion-bars.disabled{opacity:.55}.motion-col{display:flex;align-items:flex-end}.motion-col.off{opacity:.35}.motion-fill{position:absolute;inset:auto 0 0}.motion-fill.point{right:auto}.motion-value,.motion-value-input{position:absolute;top:6px;right:2px;left:2px;z-index:2;color:var(--volca-text);font-size:11px;font-weight:700;line-height:22px;text-align:center}.motion-value-input{height:24px;border:1px solid var(--volca-accent);border-radius:4px;background:#382b2d}.motion-step-row{flex:0 0 auto;border-top:1px solid rgba(206,179,147,.28);background:#2f2426}.motion-step-cell{height:18px;margin:3px;border:1px solid rgba(206,179,147,.28);border-radius:7px;background:#251c1e;cursor:pointer}.motion-step-cell.on{background:#ceb393;border-color:var(--volca-accent-bright)}.roll-header{touch-action:none}.header-cell{cursor:grab;user-select:none}.roll-header.is-copying,.roll-header.is-copying .header-cell{cursor:grabbing}.header-cell.copy-source{background:#6a5348;color:#f1e9e1}.header-cell.drop-target{background:var(--volca-accent);color:#33282a}
.fold-help-copy { margin: 0; }
.note-cell.active:not(.note-start) { border-left-color: var(--volca-accent); }
.note-cell.selected:not(.note-start):not(.note-end) { box-shadow: inset 0 2px 0 0 #f8eee4, inset 0 -2px 0 0 #f8eee4; }
.note-cell.selected.note-start:not(.note-end) { box-shadow: inset 2px 2px 0 0 #f8eee4, inset 0 -2px 0 0 #f8eee4; }
.note-cell.selected.note-end:not(.note-start) { box-shadow: inset -2px 2px 0 0 #f8eee4, inset 0 -2px 0 0 #f8eee4; }
.note-cell.selected.note-start.note-end { box-shadow: inset 0 0 0 2px #f8eee4; }
.fold-help-skip { display: flex; align-items: flex-start; gap: 8px; margin: 16px 0 0; color: var(--volca-muted); font-size: var(--volca-type-body); line-height: 1.4; cursor: pointer; }
.fold-help-skip input { width: 16px; height: 16px; margin-top: 2px; flex: 0 0 auto; accent-color: var(--volca-accent); }
</style>

<style>
.euclid-menu-layer { position: fixed; inset: 0; z-index: 4000; }
.euclid-menu {
  position: fixed;
  min-width: 200px;
  padding: 4px;
  border: 1px solid rgba(206, 179, 147, 0.28);
  border-radius: 10px;
  background: #2b2022;
  box-shadow: 0 16px 40px rgba(10, 5, 6, 0.45);
}
.euclid-menu button {
  display: block;
  width: 100%;
  margin: 0;
  padding: 10px 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--volca-text);
  font: inherit;
  font-size: var(--volca-type-body);
  font-weight: 650;
  text-align: left;
  cursor: pointer;
}
.euclid-menu button:hover { background: rgba(206, 179, 147, 0.14); }
.euclid-menu button:focus-visible { outline: 2px solid var(--volca-accent); outline-offset: 1px; }
</style>
