<template>
  <div class="roll">
    <div class="roll-header">
      <div class="pitch-gutter" />
      <div v-for="step in 16" :key="step" class="step-cell header-cell"
        :class="{ beat:(step-1)%4===0, cursor:sequence.stepInputActive&&step-1===sequence.stepCursor, muted:!sequence.stepOn[step-1], skipped:!sequence.activeStep[step-1] }"
        role="button" tabindex="0" :aria-label="t('sequence.stepAria', { count: step })" @click="selectHeader(step-1)" @keydown.enter.prevent="selectHeader(step-1)">{{ step }}</div>
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
    <div class="roll-body"><div v-for="pitch in pitches" :key="pitch" class="roll-row" @pointerdown="rowDown(pitch,$event)" @pointermove="rowMove(pitch,$event)" @pointerup="rowUp(pitch,$event)">
      <div class="pitch-gutter" :class="{ 'black-key':isBlackKey(pitch) }">{{ noteLabel(pitch) }}</div>
      <div v-for="step in 16" :key="step" class="step-cell note-cell" :class="cellClass(step-1,pitch)"><span v-if="cellLabel(step-1,pitch)" class="note-cell__label">{{ cellLabel(step-1,pitch) }}</span></div>
    </div></div>
    <div class="roll-row motion-row">
      <div class="pitch-gutter motion-gutter" @pointerdown.stop>
        <span class="motion-gutter__label">{{ t('sequence.motion') }}</span>
        <v-select v-model="sequence.motionIndex" :items="motionItems" item-title="label" item-value="value"
          variant="underlined" density="compact" hide-details class="motion-target-select"
          :aria-label="t('sequence.motionTarget')" :menu-props="{ minWidth: 200 }" />
        <div class="motion-gutter__toggle">
          <span>{{ t('sequence.func.onOff') }}</span>
          <AppToggle v-model="sequence.motionEnabled[sequence.motionIndex]" :aria-label="t('sequence.motionEnable')" />
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
    <div class="roll-row motion-step-row">
      <div class="pitch-gutter">{{ t('sequence.motionStep') }}</div>
      <button v-for="step in 16" :key="step" type="button" class="step-cell motion-step-cell"
        :class="{ beat:(step-1)%4===0, on: sequence.motionStepEnabled[sequence.motionIndex][step-1] }"
        :aria-pressed="sequence.motionStepEnabled[sequence.motionIndex][step-1]" :aria-label="`${t('sequence.motionStep')} ${step}`"
        @click="sequence.toggleMotionStep(sequence.motionIndex, step-1)" />
    </div>
  </div>
  <MotionControlPanel />
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppToggle from '@/components/AppToggle.vue'
import { useSequencerStore } from '@/stores/sequencerStore'
import { useNoteAudition } from '@/features/sequence/composables/useNoteAudition'
import MotionControlPanel from '@/features/sequence/components/MotionControlPanel.vue'
import { MOTION_PARAM_KEYS } from '@/types/sequence'
import { displayToMidi, formatMotionValue, getMotionDisplayRange, midiToDisplay } from '@/utils/motionValue'

const { t }=useI18n(); const sequence=useSequencerStore(); const { audition }=useNoteAudition()
const motionItems = computed(() => MOTION_PARAM_KEYS.map((key, index) => ({ label: t(`sequence.motionParams.${key}`), value: index })))
const pitches=Array.from({length:61},(_,index)=>96-index)
const motionRange=computed(()=>getMotionDisplayRange(sequence.motionIndex, sequence.func.transposeNote))
const formatStepValue=(step:number)=>formatMotionValue(sequence.motionIndex, sequence.motionValues[sequence.motionIndex][step][0], sequence.func.transposeNote)
const drag=ref<{pitch:number;start:number;end:number}|null>(null); const draggingMotion=ref(false); const editingStep=ref<number|null>(null); const editValue=ref(0)
type FlagKind = 'stepOn' | 'activeStep' | 'transpose'
const flagDrag=ref<{ kind: FlagKind; value: boolean; origin: number; snapshot: boolean[] }|null>(null)
const noteNames=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; const noteLabel=(pitch:number)=>`${noteNames[pitch%12]}${Math.floor(pitch/12)-1}`; const isBlackKey=(pitch:number)=>[1,3,6,8,10].includes(pitch%12)
const GUTTER_WIDTH = 180
const stepAt=(event:PointerEvent)=>{const rect=(event.currentTarget as HTMLElement).getBoundingClientRect();return Math.min(15,Math.max(0,Math.floor((event.clientX-rect.left-GUTTER_WIDTH)/((rect.width-GUTTER_WIDTH)/16))))}
const rowDown=(pitch:number,event:PointerEvent)=>{
  const step=stepAt(event); const existing=sequence.noteAt(step,pitch)
  if (existing) {
    if (event.shiftKey) {
      const selected = sequence.selectedNoteKey?.pitch === existing.pitch && sequence.selectedNoteKey?.startStep === existing.startStep
      sequence.selectNote(selected ? null : existing)
      return
    }
    return sequence.removeNote(existing)
  }
  drag.value={pitch,start:step,end:step};(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
const rowMove=(pitch:number,event:PointerEvent)=>{if(drag.value?.pitch===pitch)drag.value.end=stepAt(event)}
const rowUp=(pitch:number,event:PointerEvent)=>{if(drag.value?.pitch!==pitch)return;const start=Math.min(drag.value.start,drag.value.end),end=Math.max(drag.value.start,drag.value.end);if(sequence.addNote(pitch,start,end-start+1))audition([pitch]);drag.value=null}
const selectHeader=(step:number)=>{if(sequence.stepInputActive)sequence.selectStepInput(step);audition(sequence.notes.filter(note=>note.startStep<=step&&note.startStep+note.length>step).map(note=>note.pitch))}
const cellClass=(step:number,pitch:number)=>{
  const note=sequence.noteAt(step,pitch)
  const preview=drag.value?.pitch===pitch&&step>=Math.min(drag.value.start,drag.value.end)&&step<=Math.max(drag.value.start,drag.value.end)
  const input=sequence.stepInputActive&&step===sequence.stepCursor&&sequence.chordBuffer.has(pitch)
  const selected=!!note && sequence.selectedNoteKey?.pitch===note.pitch && sequence.selectedNoteKey?.startStep===note.startStep
  return{beat:step%4===0,active:!!note||preview||input,selected,full:!note&&!preview&&sequence.stepNoteCount(step)>=6,cursor:sequence.stepInputActive&&step===sequence.stepCursor,muted:!sequence.stepOn[step],skipped:!sequence.activeStep[step]}
}
const cellLabel=(step:number,pitch:number)=>{const note=sequence.noteAt(step,pitch),preview=drag.value?.pitch===pitch&&step===Math.min(drag.value.start,drag.value.end),input=sequence.stepInputActive&&step===sequence.stepCursor&&sequence.chordBuffer.has(pitch);return note?.startStep===step||preview||input?noteLabel(pitch):''}
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
const flagSnapshot=(kind:FlagKind)=>kind==='stepOn'?[...sequence.stepOn]:kind==='activeStep'?[...sequence.activeStep]:[...sequence.transposeFuncOn]
const writeFlag=(kind:FlagKind,step:number,value:boolean)=>{
  if(kind==='stepOn')sequence.setStepOn(step,value)
  else if(kind==='activeStep')sequence.setActiveStep(step,value)
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
.roll{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;border:1px solid #55454780;border-radius:4px;overflow:hidden}.roll-header,.roll-row{display:flex}.roll-body{flex:1;min-height:0;overflow-y:auto}.motion-row{flex:0 0 auto;border-top:2px solid var(--volca-accent)}.pitch-gutter{position:sticky;left:0;display:flex;flex:0 0 180px;align-items:center;justify-content:flex-end;box-sizing:border-box;padding:0 10px;background:#382b2d;color:var(--volca-text);font-size:var(--volca-type-label);font-weight:700;letter-spacing:.02em;line-height:1.2;white-space:nowrap}.flag-gutter,.step-flags .pitch-gutter,.motion-step-row .pitch-gutter{justify-content:center;color:var(--volca-accent);text-align:center}.motion-gutter{flex-direction:column;justify-content:center;align-items:stretch;gap:6px;padding:8px 6px;white-space:normal;color:var(--volca-accent);text-align:center}.motion-gutter__label{flex:0 0 auto;font-weight:700}.motion-target-select{flex:0 0 auto;min-width:0;width:100%;font-size:11px}.motion-gutter :deep(.v-field){border-radius:0!important;background:transparent!important;font-size:11px;min-height:32px!important}.motion-gutter :deep(.v-field__input){min-height:28px;padding-top:2px;padding-bottom:2px;padding-inline:0;line-height:1.2}.motion-gutter :deep(.v-select__selection-text){white-space:nowrap;text-align:center}.motion-gutter__toggle{display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--volca-muted);font-size:var(--volca-type-label);font-weight:400}.pitch-gutter.black-key{background:#2a2021;color:#9d8570}.step-cell{flex:1 1 0;width:0;min-width:28px;box-sizing:border-box;border-left:1px solid #55454740}.header-cell{position:relative;padding:4px 0;background:#4a3a3c;text-align:center;cursor:pointer}.header-cell.muted{opacity:.38}.header-cell.skipped{color:#8f8170;text-decoration:line-through}.note-cell{position:relative;display:flex;align-items:center;height:20px;border-top:1px solid #55454726;cursor:pointer;touch-action:none}.note-cell.muted,.note-cell.skipped{opacity:.42}.note-cell__label{z-index:2;overflow:hidden;padding-left:4px;color:#382b2d;font-size:var(--volca-type-label);font-weight:700;white-space:nowrap}.step-cell.cursor::after{content:'';position:absolute;inset:0;z-index:1;background:rgba(206,179,147,.2);pointer-events:none}.step-cell{position:relative}.step-cell.beat{border-left-color:#ceb39380}.note-cell.active,.motion-fill{background:var(--volca-accent)}.note-cell.selected{box-shadow:inset 0 0 0 2px #f8eee4}.note-cell.full{cursor:not-allowed}.step-flags{flex:0 0 auto;border-top:1px solid rgba(206,179,147,.28);background:#2f2426;touch-action:none}.step-flags .step-cell{border-left-color:transparent}.step-flags .step-cell.beat{border-left-color:transparent}.flag-cell{display:grid;min-height:22px;padding:0;cursor:pointer}.flag{min-height:0;margin:3px;padding:0;border:1px solid rgba(206,179,147,.28);border-radius:7px;background:#251c1e;cursor:pointer;touch-action:none;pointer-events:none}.flag.on{background:#ceb393;border-color:#e7bd76}.flag.sound.on{background:#9dce91;border-color:#b7e0ad}.flag:focus-visible{outline:2px solid var(--volca-accent);outline-offset:1px}.motion-bars{display:flex;flex:1;height:160px;touch-action:none;cursor:pointer}.motion-bars.disabled{opacity:.55}.motion-col{display:flex;align-items:flex-end}.motion-col.off{opacity:.35}.motion-fill{position:absolute;inset:auto 0 0}.motion-fill.point{right:auto}.motion-value,.motion-value-input{position:absolute;top:6px;right:2px;left:2px;z-index:2;color:var(--volca-text);font-size:11px;font-weight:700;line-height:22px;text-align:center}.motion-value-input{height:24px;border:1px solid var(--volca-accent);border-radius:4px;background:#382b2d}.motion-step-row{flex:0 0 auto;border-top:1px solid rgba(206,179,147,.28);background:#2f2426}.motion-step-cell{height:18px;margin:3px;border:1px solid rgba(206,179,147,.28);border-radius:7px;background:#251c1e;cursor:pointer}.motion-step-cell.on{background:#ceb393;border-color:#e7bd76}
</style>
