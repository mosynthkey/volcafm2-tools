<template>
  <div class="roll">
    <div class="roll-header"><div class="pitch-gutter" /><div v-for="step in 16" :key="step" class="step-cell header-cell" :class="{ beat:(step-1)%4===0,cursor:stepInputActive&&step-1===stepCursor }" role="button" tabindex="0" :aria-label="`Step ${step}`" @click="selectHeader(step-1)" @keydown.enter.prevent="selectHeader(step-1)">{{ step }}</div></div>
    <div class="roll-body"><div v-for="pitch in pitches" :key="pitch" class="roll-row" @pointerdown="rowDown(pitch,$event)" @pointermove="rowMove(pitch,$event)" @pointerup="rowUp(pitch,$event)">
      <div class="pitch-gutter" :class="{ 'black-key':isBlackKey(pitch) }">{{ noteLabel(pitch) }}</div>
      <div v-for="step in 16" :key="step" class="step-cell note-cell" :class="cellClass(step-1,pitch)"><span v-if="cellLabel(step-1,pitch)" class="note-cell__label">{{ cellLabel(step-1,pitch) }}</span></div>
    </div></div>
    <div class="roll-row motion-row"><div class="pitch-gutter" /><div class="motion-bars" :class="{ disabled:!sequence.motionEnabled[motionIndex] }" @pointerdown="startMotion" @pointermove="moveMotion" @pointerup="draggingMotion=false" @pointerleave="draggingMotion=false">
      <div v-for="step in 16" :key="step" class="step-cell motion-col" :class="{ beat:(step-1)%4===0,cursor:stepInputActive&&step-1===stepCursor }"><div class="motion-fill" :style="{height:(sequence.motionValues[motionIndex][step-1]/127*100)+'%'}" />
        <input v-if="editingStep===step-1" v-model.number="editValue" class="motion-value-input" type="number" min="0" max="127" @pointerdown.stop @blur="commitMotion" @keydown.enter.prevent="commitMotion" @keydown.escape.prevent="editingStep=null" />
        <span v-else class="motion-value" @pointerdown.stop @dblclick.stop="beginMotionEdit(step-1)">{{ sequence.motionValues[motionIndex][step-1] }}</span>
      </div>
    </div></div>
  </div>
  <div class="motion-control">
    <div class="select-control"><label>{{ t('sequence.motionTarget') }}</label><v-select :model-value="motionIndex" :items="motionItems" item-title="label" item-value="value" density="compact" hide-details @update:model-value="emit('update:motionIndex',$event)" /></div>
    <div class="motion-toggle"><span>On/Off</span><AppToggle v-model="sequence.motionEnabled[motionIndex]" :aria-label="t('sequence.motionEnable')" /></div>
    <div class="motion-generator">
      <span>{{ t('sequence.autoMotion') }}</span>
      <v-menu v-model="generatorOpen" :close-on-content-click="false" location="top start" offset="8">
        <template #activator="{ props: activatorProps }">
          <button v-bind="activatorProps" type="button" class="generator-trigger" :aria-label="t('sequence.autoMotion')">
            <WandSparkles :size="18" />{{ t('sequence.writeMotion') }}
          </button>
        </template>
        <div class="pattern-menu" role="menu" :aria-label="t('sequence.autoMotion')">
          <button v-for="pattern in motionPatterns" :key="pattern.key" type="button" class="pattern-option"
            role="menuitem" @click="applyPattern(pattern.key)">
            <svg viewBox="0 0 128 42" aria-hidden="true">
              <path d="M0 21H128" class="pattern-axis" />
              <polyline :points="patternPoints(pattern.key)" />
            </svg>
            <span>{{ pattern.label }}</span>
          </button>
        </div>
      </v-menu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { WandSparkles } from '@lucide/vue'
import AppToggle from '@/components/AppToggle.vue'
import { useMidiStore } from '@/stores/midiStore'
import { useSequencerStore } from '@/stores/sequencerStore'
import { MOTION_PARAM_KEYS } from '@/types/sequence'
import { useNoteAudition } from '@/features/sequence/composables/useNoteAudition'
import { createMotionPattern, MOTION_PATTERN_KEYS, previewMotionPattern, type MotionPatternKey } from '@/utils/motionPatterns'

const props = defineProps<{ stepInputActive:boolean; stepCursor:number; chordBuffer:Set<number>; motionIndex:number }>()
const emit = defineEmits<{ 'select-step':[step:number]; 'update:motionIndex':[index:number] }>()
const { t }=useI18n(); const sequence=useSequencerStore(); const midi=useMidiStore(); const { audition }=useNoteAudition(midi,sequence)
const motionItems=MOTION_PARAM_KEYS.map((key,index)=>({label:t(`sequence.motionParams.${key}`),value:index})); const pitches=Array.from({length:61},(_,index)=>96-index)
const motionPatterns=MOTION_PATTERN_KEYS.map(key=>({key,label:t(`sequence.motionPatterns.${key}`)}));const generatorOpen=ref(false)
const drag=ref<{pitch:number;start:number;end:number}|null>(null); const draggingMotion=ref(false); const editingStep=ref<number|null>(null); const editValue=ref(0)
const noteNames=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; const noteLabel=(pitch:number)=>`${noteNames[pitch%12]}${Math.floor(pitch/12)-1}`; const isBlackKey=(pitch:number)=>[1,3,6,8,10].includes(pitch%12)
const stepAt=(event:PointerEvent)=>{const rect=(event.currentTarget as HTMLElement).getBoundingClientRect();return Math.min(15,Math.max(0,Math.floor((event.clientX-rect.left-56)/((rect.width-56)/16))))}
const rowDown=(pitch:number,event:PointerEvent)=>{const step=stepAt(event);const existing=sequence.noteAt(step,pitch);if(existing)return sequence.removeNote(existing);drag.value={pitch,start:step,end:step};(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)}
const rowMove=(pitch:number,event:PointerEvent)=>{if(drag.value?.pitch===pitch)drag.value.end=stepAt(event)}
const rowUp=(pitch:number,event:PointerEvent)=>{if(drag.value?.pitch!==pitch)return;const start=Math.min(drag.value.start,drag.value.end),end=Math.max(drag.value.start,drag.value.end);if(sequence.addNote(pitch,start,end-start+1))audition([pitch]);drag.value=null}
const selectHeader=(step:number)=>{if(props.stepInputActive)emit('select-step',step);audition(sequence.notes.filter(note=>note.startStep<=step&&note.startStep+note.length>step).map(note=>note.pitch))}
const cellClass=(step:number,pitch:number)=>{const note=sequence.noteAt(step,pitch),preview=drag.value?.pitch===pitch&&step>=Math.min(drag.value.start,drag.value.end)&&step<=Math.max(drag.value.start,drag.value.end),input=props.stepInputActive&&step===props.stepCursor&&props.chordBuffer.has(pitch);return{beat:step%4===0,active:!!note||preview||input,full:!note&&!preview&&sequence.stepNoteCount(step)>=6,cursor:props.stepInputActive&&step===props.stepCursor}}
const cellLabel=(step:number,pitch:number)=>{const note=sequence.noteAt(step,pitch),preview=drag.value?.pitch===pitch&&step===Math.min(drag.value.start,drag.value.end),input=props.stepInputActive&&step===props.stepCursor&&props.chordBuffer.has(pitch);return note?.startStep===step||preview||input?noteLabel(pitch):''}
const motionStep=(event:PointerEvent)=>{const rect=(event.currentTarget as HTMLElement).getBoundingClientRect(),step=Math.min(15,Math.max(0,Math.floor((event.clientX-rect.left)/(rect.width/16)))),ratio=1-Math.min(1,Math.max(0,(event.clientY-rect.top)/rect.height));sequence.setMotionValue(props.motionIndex,step,ratio*127)}
const startMotion=(event:PointerEvent)=>{if(!sequence.motionEnabled[props.motionIndex])return;draggingMotion.value=true;motionStep(event)};const moveMotion=(event:PointerEvent)=>{if(draggingMotion.value)motionStep(event)}
const beginMotionEdit=(step:number)=>{editingStep.value=step;editValue.value=sequence.motionValues[props.motionIndex][step];nextTick(()=>document.querySelector<HTMLInputElement>('.motion-value-input')?.select())};const commitMotion=()=>{if(editingStep.value!==null)sequence.setMotionValue(props.motionIndex,editingStep.value,editValue.value);editingStep.value=null}
const patternPoints=(key:MotionPatternKey)=>previewMotionPattern(key).map((value,index)=>`${index*(128/15)},${39-value/127*36}`).join(' ')
const applyPattern=(key:MotionPatternKey)=>{createMotionPattern(key).forEach((value,step)=>sequence.setMotionValue(props.motionIndex,step,value));sequence.motionEnabled[props.motionIndex]=true;generatorOpen.value=false}
</script>

<style scoped>
.roll{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;border:1px solid #55454780;border-radius:4px;overflow:hidden}.roll-header,.roll-row{display:flex}.roll-body{flex:1;min-height:0;overflow-y:auto}.motion-row{flex:0 0 auto;border-top:2px solid var(--volca-accent)}.pitch-gutter{position:sticky;left:0;display:flex;flex:0 0 56px;align-items:center;justify-content:flex-end;box-sizing:border-box;padding-right:6px;background:#382b2d}.pitch-gutter.black-key{background:#2a2021;color:#9d8570}.step-cell{flex:1 1 0;width:0;min-width:28px;box-sizing:border-box;border-left:1px solid #55454740}.header-cell{position:relative;padding:4px 0;background:#4a3a3c;text-align:center;cursor:pointer}.note-cell{position:relative;display:flex;align-items:center;height:20px;border-top:1px solid #55454726;cursor:pointer;touch-action:none}.note-cell__label{z-index:2;overflow:hidden;padding-left:4px;color:#382b2d;font-size:var(--volca-type-label);font-weight:700;white-space:nowrap}.step-cell.cursor::after{content:'';position:absolute;inset:0;z-index:1;background:rgba(206,179,147,.2);pointer-events:none}.step-cell{position:relative}.step-cell.beat{border-left-color:#ceb39380}.note-cell.active,.motion-fill{background:var(--volca-accent)}.note-cell.full{cursor:not-allowed}.motion-bars{display:flex;flex:1;height:160px;touch-action:none;cursor:pointer}.motion-bars.disabled{opacity:.35;pointer-events:none}.motion-col{display:flex;align-items:flex-end}.motion-fill{position:absolute;inset:auto 0 0}.motion-value,.motion-value-input{position:absolute;top:6px;right:3px;left:3px;z-index:2;color:var(--volca-text);font-size:var(--volca-type-label);line-height:22px;text-align:center}.motion-value-input{height:24px;border:1px solid var(--volca-accent);border-radius:4px;background:#382b2d}.motion-control{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:8px}.select-control{display:grid;flex:0 0 280px;gap:5px}.select-control label,.motion-toggle span,.motion-generator>span{color:var(--volca-muted);font-size:var(--volca-type-label)}.motion-toggle,.motion-generator{display:grid;justify-items:center;gap:5px}.generator-trigger{height:40px;display:flex;align-items:center;gap:7px;padding:0 12px;border:1px solid rgba(206,179,147,.32);border-radius:9px;background:#382b2d;color:var(--volca-text);font:inherit;font-size:var(--volca-type-body);font-weight:700;cursor:pointer}.generator-trigger:hover{border-color:rgba(206,179,147,.62);background:#443537}.generator-trigger:focus-visible,.pattern-option:focus-visible{outline:2px solid var(--volca-accent);outline-offset:2px}.pattern-menu{display:grid;grid-template-columns:repeat(2,150px);gap:7px;padding:8px;border:1px solid rgba(206,179,147,.32);border-radius:11px;background:#2b2022;box-shadow:0 12px 32px rgba(0,0,0,.38)}.pattern-option{display:grid;gap:4px;padding:7px;border:1px solid rgba(206,179,147,.16);border-radius:8px;background:#251c1e;color:var(--volca-text);font:inherit;font-size:var(--volca-type-label);cursor:pointer;text-align:left}.pattern-option:hover{border-color:rgba(206,179,147,.55);background:#35282a}.pattern-option svg{width:100%;height:42px;background:#21191a}.pattern-option polyline{fill:none;stroke:var(--volca-accent);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.pattern-axis{fill:none;stroke:rgba(206,179,147,.12);stroke-width:1}
</style>
