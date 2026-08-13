<template>
  <div class="volca-inline-panel motion-control">
    <div class="volca-groups">
      <section class="volca-group">
        <h4>{{ t('sequence.func.motionSequence') }}</h4>
        <div class="control-row">
          <div class="motion-toggle"><span>{{ t('sequence.func.onOff') }}</span><AppToggle v-model="sequence.func.motionOn" :aria-label="t('sequence.func.motionOn')" /></div>
          <div class="motion-toggle"><span>{{ t('sequence.func.smooth') }}</span><AppToggle v-model="sequence.func.motionSmooth" :aria-label="t('sequence.func.smooth')" /></div>
        </div>
      </section>
      <section class="volca-group auto-write-group">
        <h4>{{ t('sequence.autoMotion') }}</h4>
        <div class="pattern-panel" :aria-label="t('sequence.autoMotion')">
          <div class="pattern-settings">
            <label><span>{{ t('sequence.motionMin') }}</span><input v-model.number="patternMin" type="number" :min="motionRange.min" :max="motionRange.max" /></label>
            <label><span>{{ t('sequence.motionMax') }}</span><input v-model.number="patternMax" type="number" :min="motionRange.min" :max="motionRange.max" /></label>
            <label><span>{{ t('sequence.motionCycles') }}</span><select v-model.number="patternCycles"><option v-for="cycle in 8" :key="cycle" :value="cycle">{{ cycle }}</option></select></label>
          </div>
          <div class="pattern-options">
            <button v-for="pattern in motionPatterns" :key="pattern.key" type="button" class="pattern-option"
              @click="applyPattern(pattern.key)">
              <svg viewBox="0 0 160 58" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                <path d="M0 29H160" class="pattern-axis" />
                <path v-if="pattern.key === 'square'" :d="squarePatternPath()" class="pattern-wave" />
                <polyline v-else :points="patternPoints(pattern.key)" class="pattern-wave" />
              </svg>
              <span>{{ pattern.label }}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppToggle from '@/components/AppToggle.vue'
import { useSequencerStore } from '@/stores/sequencerStore'
import { createMotionPattern, MOTION_PATTERN_KEYS, previewMotionPattern, type MotionPatternKey } from '@/utils/motionPatterns'
import { displayToMidi, getMotionDisplayRange } from '@/utils/motionValue'

const { t } = useI18n()
const sequence = useSequencerStore()
const motionPatterns = MOTION_PATTERN_KEYS.map(key => ({ key, label: t(`sequence.motionPatterns.${key}`) }))
const patternMin = ref(0)
const patternMax = ref(127)
const patternCycles = ref(1)
const motionRange = computed(() => getMotionDisplayRange(sequence.motionIndex, sequence.func.transposeNote))
watch(motionRange, range => { patternMin.value = range.min; patternMax.value = range.max }, { immediate: true })
const patternRange = () => {
  const min = displayToMidi(sequence.motionIndex, Number(patternMin.value), sequence.func.transposeNote)
  const max = displayToMidi(sequence.motionIndex, Number(patternMax.value), sequence.func.transposeNote)
  return { min, max, cycles: patternCycles.value }
}
const patternPoints = (key: MotionPatternKey) => previewMotionPattern(key, patternRange().min, patternRange().max, patternRange().cycles).map((value, index) => `${index * (160 / 15)},${55 - value / 127 * 52}`).join(' ')
const squarePatternPath = () => {
  const values = previewMotionPattern('square', patternRange().min, patternRange().max, patternRange().cycles)
  const y = (value: number) => 55 - value / 127 * 52
  let path = `M0 ${y(values[0])}`
  for (let index = 1; index < values.length; index++) {
    const x = index * (160 / 15)
    path += `H${x}V${y(values[index])}`
  }
  return path
}
const applyPattern = (key: MotionPatternKey) => {
  createMotionPattern(key, patternRange()).forEach((value, step) => sequence.setMotionValue(sequence.motionIndex, step, value))
  sequence.motionEnabled[sequence.motionIndex] = true
  sequence.func.motionOn = true
  sequence.motionStepEnabled[sequence.motionIndex] = sequence.motionStepEnabled[sequence.motionIndex].map(() => true)
  sequence.sendToDevice()
}
</script>

<style scoped>
.control-row{display:flex;flex-wrap:nowrap;align-items:start;gap:8px 12px}.motion-toggle{display:grid;grid-template-rows:2.6em auto;justify-items:center;align-content:start;gap:4px;color:var(--volca-muted);font-size:var(--volca-type-label);text-align:center}.motion-toggle>span{display:flex;align-items:flex-end;justify-content:center;min-height:2.6em;line-height:1.2}.auto-write-group{flex:1 1 420px}.pattern-panel{display:grid;grid-template-columns:minmax(168px,210px) minmax(0,1fr);gap:8px;align-items:stretch;justify-content:start}.pattern-option:focus-visible{outline:2px solid var(--volca-accent);outline-offset:2px}.pattern-settings{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.pattern-settings label{display:grid;grid-template-rows:2.6em auto;justify-items:center;align-content:start;gap:4px;color:var(--volca-muted);font-size:var(--volca-type-label);text-align:center}.pattern-settings label>span{display:flex;align-items:flex-end;justify-content:center;min-height:2.6em;line-height:1.2}.pattern-settings input,.pattern-settings select{width:100%;height:34px;box-sizing:border-box;padding:0 8px;border:1px solid rgba(206,179,147,.3);border-radius:7px;background:#251c1e;color:var(--volca-text);font:inherit}.pattern-options{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px}.pattern-option{display:grid;grid-template-rows:1fr auto;justify-items:center;align-items:end;gap:4px;height:100%;min-width:0;padding:8px 8px 8px;border:1px solid rgba(206,179,147,.16);border-radius:6px;background:#251c1e;color:var(--volca-text);font:inherit;font-size:10px;cursor:pointer;text-align:center}.pattern-option:hover{border-color:rgba(206,179,147,.55);background:#35282a}.pattern-option svg{width:100%;height:100%;min-height:40px;display:block;border-radius:4px;background:#21191a}.pattern-option>span{justify-self:stretch;overflow:hidden;padding:2px 2px 0;line-height:1.2;text-align:center;text-overflow:ellipsis;white-space:nowrap}.pattern-option .pattern-wave{fill:none;stroke:var(--volca-accent);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.pattern-axis{fill:none;stroke:rgba(206,179,147,.12);stroke-width:1}@media (max-width:1280px){.pattern-panel{grid-template-columns:1fr}}
</style>
