<template>
  <section class="volca-inline-panel" :class="{ collapsed }" @click="collapsed && (collapsed = false)">
    <button type="button" class="panel-fold" :class="{ 'is-folded': collapsed }"
      :aria-expanded="!collapsed" :aria-label="collapsed ? t('sequence.expandPanel') : t('sequence.collapsePanel')"
      @click.stop="collapsed = !collapsed">
      <ChevronDown :size="16" />
    </button>
    <div class="volca-groups">
      <section class="volca-group">
        <h4>{{ focusedNote ? t('sequence.selectedNote') : t('sequence.noteDefaults') }}</h4>
        <div v-show="!collapsed" class="func-row">
          <label class="value-field"><span>{{ t('sequence.velocity') }}</span><input v-model.number="noteVelocity" type="number" min="1" max="127" /></label>
          <label class="value-field"><span>{{ t('sequence.gate') }}</span><input v-model.number="noteGate" type="number" min="0" max="100" /></label>
        </div>
      </section>

      <section class="volca-group">
        <h4>{{ t('sequence.func.voiceMode') }}</h4>
        <div v-show="!collapsed" class="func-row">
          <div class="func-toggle"><span>{{ t('sequence.func.mono') }}</span><AppToggle v-model="sequence.func.voiceMono" :aria-label="t('sequence.func.mono')" /></div>
          <div class="func-toggle"><span>{{ t('sequence.func.unison') }}</span><AppToggle v-model="sequence.func.voiceUnison" :aria-label="t('sequence.func.unison')" /></div>
          <div class="func-toggle"><span>{{ t('sequence.func.chorus') }}</span><AppToggle v-model="sequence.func.chorus" :aria-label="t('sequence.func.chorus')" /></div>
          <KnobControl v-model="sequence.func.chorusDepth" :label="t('sequence.func.chorusDepth')" :min="0" :max="127" compact />
          <div class="func-toggle"><span>{{ t('sequence.func.reverb') }}</span><AppToggle v-model="sequence.func.reverb" :aria-label="t('sequence.func.reverb')" /></div>
          <KnobControl v-model="sequence.func.reverbDepth" :label="t('sequence.func.reverbDepth')" :min="0" :max="127" compact />
        </div>
      </section>

      <section class="volca-group">
        <h4>{{ t('sequence.func.arpGroup') }}</h4>
        <div v-show="!collapsed" class="func-row">
          <div class="func-toggle"><span>{{ t('sequence.func.onOff') }}</span><AppToggle v-model="sequence.func.arp" :aria-label="t('sequence.func.arp')" /></div>
          <div class="func-select">
            <label>{{ t('sequence.func.arpType') }}</label>
            <v-select v-model="sequence.func.arpType" :items="arpTypeItems" item-title="title" item-value="value" density="compact" hide-details />
          </div>
          <div class="func-select">
            <label>{{ t('sequence.func.arpDiv') }}</label>
            <v-select v-model="sequence.func.arpDiv" :items="arpDivItems" item-title="title" item-value="value" density="compact" hide-details />
          </div>
        </div>
      </section>

      <section class="volca-group">
        <h4>{{ t('sequence.func.tempo') }}</h4>
        <div v-show="!collapsed" class="func-row">
          <div class="func-segment">
            <span>{{ t('sequence.func.tempo') }}</span>
            <div class="segment" role="group" :aria-label="t('sequence.func.tempo')">
              <button v-for="(label, value) in tempoLabels" :key="label" type="button"
                :class="{ active: sequence.func.tempo === value }" :aria-pressed="sequence.func.tempo === value"
                @click="sequence.func.tempo = value">{{ label }}</button>
            </div>
          </div>
          <div class="func-toggle"><span>{{ t('sequence.func.warp') }}</span><AppToggle v-model="sequence.func.warpActiveStep" :aria-label="t('sequence.func.warp')" /></div>
          <div class="func-toggle"><span>{{ t('sequence.func.transposeNote') }}</span><AppToggle v-model="sequence.func.transposeNote" :aria-label="t('sequence.func.transposeNote')" /></div>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown } from '@lucide/vue'
import AppToggle from '@/components/AppToggle.vue'
import KnobControl from '@/components/KnobControl.vue'
import { usePersistedFlag } from '@/composables/usePersistedFlag'
import { useSequencerStore } from '@/stores/sequencerStore'

const TEMPO_LABELS = ['1/1', '1/2', '1/4']
const ARP_TYPE_KEYS = ['off', 'rise1', 'rise2', 'rise3', 'fall1', 'fall2', 'fall3', 'rand1', 'rand2', 'rand3'] as const
const ARP_DIV_KEYS = ['d12', 'd8', 'd4', 'd3', 'd2', 'd23', 'd1', 'd32', 'd21', 'd31', 'd41'] as const

const { t } = useI18n()
const sequence = useSequencerStore()
const collapsed = usePersistedFlag('volca-fm2-collapse-func-panel')
const tempoLabels = TEMPO_LABELS
const arpTypeItems = computed(() => ARP_TYPE_KEYS.map((key, value) => ({ title: t(`sequence.arpTypes.${key}`), value })))
const arpDivItems = computed(() => ARP_DIV_KEYS.map((key, value) => ({ title: t(`sequence.arpDivs.${key}`), value })))
const focusedNote = computed(() => sequence.selectedNote())
const noteVelocity = computed({
  get: () => focusedNote.value?.velocity ?? sequence.velocity,
  set: value => {
    const note = sequence.selectedNote()
    const next = Math.max(1, Math.min(127, Math.round(Number(value) || 1)))
    if (note) note.velocity = next
    else sequence.velocity = next
  },
})
const noteGate = computed({
  get: () => focusedNote.value?.gatePercent ?? sequence.gatePercent,
  set: value => {
    const note = sequence.selectedNote()
    const next = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
    if (note) note.gatePercent = next
    else sequence.gatePercent = next
  },
})
</script>

<style scoped>
.func-row { display: flex; flex-wrap: nowrap; align-items: start; gap: 8px 12px; }
.func-toggle, .func-segment, .func-select, .value-field { display: grid; grid-template-rows: 2.6em auto; justify-items: center; align-content: start; gap: 4px; color: var(--volca-muted); font-size: var(--volca-type-label); text-align: center; }
.func-toggle > span, .func-segment > span, .func-select > label, .value-field > span { display: flex; align-items: flex-end; justify-content: center; min-height: 2.6em; line-height: 1.2; }
.value-field input { width: 72px; height: 34px; box-sizing: border-box; padding: 0 8px; border: 1px solid rgba(206,179,147,.3); border-radius: 7px; background: #251c1e; color: var(--volca-text); font: inherit; text-align: center; }
.volca-inline-panel :deep(.knob-control) { display: grid; grid-template-rows: 2.6em auto; }
.volca-inline-panel :deep(.knob-label) { display: flex; align-items: flex-end; justify-content: center; min-height: 2.6em; }
.func-select { min-width: 140px; }
.func-select :deep(.v-input) { width: 100%; }
.segment { display: grid; grid-template-columns: repeat(3, 1fr); overflow: hidden; border: 1px solid rgba(206,179,147,.3); border-radius: 8px; background: #251c1e; }
.segment button { height: 32px; padding: 0 8px; border: 0; background: transparent; color: #ad9e96; font: inherit; font-size: var(--volca-type-label); font-weight: 700; cursor: pointer; }
.segment button + button { border-left: 1px solid rgba(206,179,147,.28); }
.segment button.active { background: #ceb393; color: #33282a; }
.segment button:focus-visible { outline: 2px solid #e1cab0; outline-offset: -2px; }
</style>
