<template>
  <v-container class="sound-list-container">
    <AppErrorDialog v-model="showError" :title="t('dx7.listTitle')" :message="errorMessage" />
    <AppDialog v-model="showWriteConfirm" :title="t('dx7.writeTitle')" max-width="480">
      <p>{{ t('dx7.writeDescription') }}</p>
      <label class="app-skip-confirm">
        <input v-model="dontShowWriteAgain" type="checkbox" />
        <span>{{ t('common.dontShowAgain') }}</span>
      </label>
      <template #actions>
        <v-btn variant="text" @click="cancelWrite()">{{ t('common.cancel') }}</v-btn>
        <v-btn @click="confirmWriteDialog()">{{ t('dx7.write') }}</v-btn>
      </template>
    </AppDialog>
    <AppDialog :model-value="showWriteProgress" :title="t('dx7.writeTitle')" max-width="480" persistent :closable="false">
      <p>{{ t('dx7.writeProgress', { count: midiStore.programWriteProgress, total: 64 }) }}</p>
      <v-progress-linear :model-value="writePercent" height="8" rounded />
    </AppDialog>
    <AppDialog v-model="showReorderSequences" :title="t('dx7.reorderSequencesTitle')" max-width="480" persistent
      :closable="false">
      <p>{{ t('dx7.reorderSequencesDescription') }}</p>
      <p v-if="pendingReorder?.sequenceLabels" class="reorder-seq-list">{{ pendingReorder.sequenceLabels }}</p>
      <p v-if="pendingReorder?.editorAffected">{{ t('dx7.reorderSequencesCurrent') }}</p>
      <template #actions>
        <v-btn variant="text" @click="cancelReorderSequences()">{{ t('common.cancel') }}</v-btn>
        <v-btn variant="text" @click="confirmReorderSequences(false)">{{ t('dx7.reorderSequencesKeep') }}</v-btn>
        <v-btn @click="confirmReorderSequences(true)">{{ t('dx7.reorderSequencesUpdate') }}</v-btn>
      </template>
    </AppDialog>
    <Dx7VoiceImportDialog v-model="showVoicePicker" :voices="parsedVoices" :initial-start-slot="firstEmptySlot"
      @import="applyDx7Import" />

    <v-card class="sound-list-card pa-4">
      <header class="editor-toolbar">
        <div class="editor-identity">
          <span class="editor-identity__label volca-section-title">{{ t('dx7.listTitle') }}</span>
          <ToolbarIconButton :label="t('dx7.reorder')">
            <v-btn icon class="reorder-btn" :class="{ 'is-on': reorderEnabled }" :aria-pressed="reorderEnabled"
              :title="t('dx7.reorder')" :aria-label="t('dx7.reorder')"
              @click="reorderEnabled = !reorderEnabled">
              <ArrowUpDown :size="16" />
            </v-btn>
          </ToolbarIconButton>
        </div>
        <div class="editor-toolbar-section">
          <ToolbarIconButton :label="t('dx7.receive')">
            <v-btn icon :disabled="!midiStore.isDeviceReady"
              :loading="midiStore.connectionState === MIDIConnectionState.RECEIVING"
              :title="t('dx7.reloadHint')" :aria-label="t('dx7.receive')"
              @click="midiStore.reloadAllProgramDumps()">
              <HardDriveUpload :size="16" />
            </v-btn>
          </ToolbarIconButton>
          <ToolbarIconButton :label="t('dx7.send')">
            <v-btn icon :disabled="!canWrite" :loading="midiStore.programWriteState === 'sending'"
              :title="t('dx7.send')" :aria-label="t('dx7.send')" @click="requestWrite">
              <HardDriveDownload :size="16" />
            </v-btn>
          </ToolbarIconButton>
        </div>
        <div class="editor-toolbar-section">
          <span class="editor-toolbar-section__label volca-section-title">{{ t('dx7.groupDx7') }}</span>
          <ToolbarIconButton :label="t('dx7.fileImport')">
            <v-btn icon :title="t('dx7.fileImport')" :aria-label="t('dx7.fileImport')" @click="dx7FileInput?.click()">
              <FileUp :size="16" />
            </v-btn>
          </ToolbarIconButton>
          <ToolbarIconButton :label="t('dx7.fileExport')">
            <v-menu location="bottom start" offset="6">
              <template #activator="{ props: menuProps }">
                <v-btn v-bind="menuProps" icon :title="t('dx7.fileExport')" :aria-label="t('dx7.fileExport')">
                  <Download :size="16" />
                </v-btn>
              </template>
              <v-list class="sound-list-menu" density="compact">
                <v-list-item :title="t('dx7.exportCartridge', { start: '00', end: '31' })" @click="downloadCartridge(0)" />
                <v-list-item :title="t('dx7.exportCartridge', { start: '32', end: '63' })" @click="downloadCartridge(1)" />
              </v-list>
            </v-menu>
          </ToolbarIconButton>
        </div>
        <div class="editor-toolbar-spacer"></div>
        <LibrarySection kind="sound-list" page="sound-list" />
        <input ref="dx7FileInput" type="file" accept=".syx,.SYX" hidden @change="selectDx7File" />
      </header>

      <div class="sound-list-columns">
        <div v-for="column in listColumns" :key="column" class="sound-list-column"
          :class="{ 'is-dragging': dragActive, 'is-reorder': reorderEnabled }">
          <template v-for="slot in columnSlots(column)" :key="slot.slot">
            <div class="slot-gap" :data-insert-before="slot.slot"
              :class="{ 'is-open': isOpenGap(slot.slot) }" />
            <div class="slot-row"
              :data-sound-slot="slot.slot"
              :class="{
                empty: !slot.name.trim(),
                dragging: dragActive && draggingSlot === slot.slot,
                active: midiStore.matchedProgramNo === slot.slot,
              }"
              :tabindex="reorderEnabled ? -1 : 0"
              :aria-label="slotAria(slot)"
              @click="onSlotClick(slot.slot)"
              @keydown.enter.prevent="onSlotClick(slot.slot)"
              @pointerdown="onRowPointerDown($event, slot.slot)"
              @pointermove="onHandlePointerMove"
              @pointerup="onHandlePointerUp"
              @pointercancel="onHandlePointerUp">
              <span v-if="reorderEnabled" class="slot-handle" :aria-hidden="true">
                <GripVertical :size="16" />
              </span>
              <span class="slot-number">{{ String(slot.slot).padStart(2, '0') }}</span>
              <span class="slot-name">{{ slot.name.trim() || '—' }}</span>
              <span v-if="slot.sequenceUsage" class="slot-seq" :title="slot.sequenceUsage">{{ slot.sequenceUsage }}</span>
              <ProgramPreviewButton
                v-if="!reorderEnabled"
                compact
                class="slot-preview"
                :preview-id="`program-list-${slot.slot}`"
                :voice="midiStore.programBytesAt(slot.slot)"
              />
              <div v-if="reorderEnabled" class="slot-move">
                <v-btn icon variant="text" size="small" :disabled="slot.slot === 0" :aria-label="t('dx7.moveUp')"
                  @click.stop="requestReorder(slot.slot, slot.slot - 1)">
                  <ChevronUp :size="16" />
                </v-btn>
                <v-btn icon variant="text" size="small" :disabled="slot.slot === 63" :aria-label="t('dx7.moveDown')"
                  @click.stop="requestReorder(slot.slot, slot.slot + 1)">
                  <ChevronDown :size="16" />
                </v-btn>
              </div>
            </div>
          </template>
          <div class="slot-gap" :data-insert-before="(column + 1) * LIST_COLUMN_SIZE"
            :class="{ 'is-open': isOpenGap((column + 1) * LIST_COLUMN_SIZE) }" />
        </div>
      </div>
      <Teleport to="body">
        <div v-if="dragActive && draggingMeta" class="slot-ghost"
          :style="{ left: `${ghostPos.x}px`, top: `${ghostPos.y}px` }">
          <span class="slot-number">{{ String(draggingMeta.slot).padStart(2, '0') }}</span>
          <span class="slot-name">{{ draggingMeta.name }}</span>
        </div>
      </Teleport>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowUpDown, ChevronDown, ChevronUp, Download, FileUp, GripVertical, HardDriveDownload, HardDriveUpload } from '@lucide/vue';
import AppDialog from '@/components/dialogs/AppDialog.vue';
import AppErrorDialog from '@/components/dialogs/AppErrorDialog.vue';
import LibrarySection from '@/components/LibrarySection.vue';
import ProgramPreviewButton from '@/components/ProgramPreviewButton.vue';
import ToolbarIconButton from '@/components/ToolbarIconButton.vue';
import Dx7VoiceImportDialog from '@/features/dx7/Dx7VoiceImportDialog.vue';
import { SKIP_DEVICE_WRITE_PREF, useSkipConfirm } from '@/composables/useSkipConfirm';
import { parseDx7Sysex, type Dx7PackedVoice } from '@/midi/dx7Cartridge';
import { MIDIConnectionState, useMidiStore } from '@/stores/midiStore';
import { useSequencerStore } from '@/stores/sequencerStore';
import { useSoundStore } from '@/stores/soundStore';
import { useUiStore } from '@/stores/uiStore';
import { downloadBinary } from '@/utils/downloadBinary';
import { programDisplayName } from '@/utils/programDisplayName';
import { remapSlotAfterReorder } from '@/utils/soundListBackup';
import { formatSequenceUsageList, formatSequenceUsagePill } from '@/utils/sequenceUsage';

const midiStore = useMidiStore();
const sequencerStore = useSequencerStore();
const soundStore = useSoundStore();
const ui = useUiStore();
const { t } = useI18n();

const LIST_COLUMN_COUNT = 4;
const LIST_COLUMN_SIZE = 16;
const listColumns = Array.from({ length: LIST_COLUMN_COUNT }, (_, index) => index);
const reorderEnabled = ref(false);
const remapSequencesChoice = ref<boolean | null>(null);
const showReorderSequences = ref(false);
const pendingReorder = ref<{ fromSlot: number; toSlot: number; sequenceLabels: string; editorAffected: boolean } | null>(null);
const draggingSlot = ref<number | null>(null);
const dropInsertBefore = ref<number | null>(null);
const dragActive = ref(false);
const ghostPos = ref({ x: 0, y: 0 });
const dragOrigin = { x: 0, y: 0 };
const dx7FileInput = ref<HTMLInputElement | null>(null);
const showError = ref(false);
const errorMessage = ref('');
const showVoicePicker = ref(false);
const parsedVoices = ref<Dx7PackedVoice[]>([]);
const showWriteProgress = ref(false);
const {
  show: showWriteConfirm,
  dontShowAgain: dontShowWriteAgain,
  request: requestWriteConfirm,
  confirm: confirmWriteDialog,
  cancel: cancelWrite,
} = useSkipConfirm(SKIP_DEVICE_WRITE_PREF);

watch([() => ui.activeTab, () => midiStore.isDeviceReady], ([tab, ready]) => {
  if (tab === 'dx7' && ready) {
    void midiStore.ensureAllProgramDumps().then(() => midiStore.ensureAllSequenceDumps());
  }
}, { immediate: true });

watch(reorderEnabled, enabled => {
  if (!enabled) remapSequencesChoice.value = null;
});

const listedPrograms = computed(() => midiStore.soundList.map(slot => ({
  ...slot,
  name: programDisplayName(slot.slot, midiStore.matchedProgramNo, soundStore.program.name, slot.name),
  sequenceUsage: midiStore.fetchingSequenceDumps
    ? ''
    : formatSequenceUsagePill(midiStore.sequenceUsageByProgram[slot.slot] ?? []),
})));

const firstEmptySlot = computed(() => {
  const emptySlot = listedPrograms.value.findIndex(slot => !slot.name.trim());
  return emptySlot === -1 ? 0 : emptySlot;
});

const canWrite = computed(() =>
  midiStore.isIdleConnected && midiStore.programWriteState !== 'sending');

const writePercent = computed(() => (midiStore.programWriteProgress / 64) * 100);

const columnSlots = (column: number) => listedPrograms.value.slice(column * LIST_COLUMN_SIZE, column * LIST_COLUMN_SIZE + LIST_COLUMN_SIZE);

const slotAria = (slot: { slot: number; name: string; sequenceUsage: string }) => {
  const name = slot.name.trim() || t('dx7.unnamedVoice');
  return slot.sequenceUsage
    ? `${String(slot.slot).padStart(2, '0')} ${name} ${slot.sequenceUsage}`
    : `${String(slot.slot).padStart(2, '0')} ${name}`;
};

const fail = (message: string) => {
  errorMessage.value = message;
  showError.value = true;
};

const downloadCartridge = (index: number) => {
  const bank = index === 0 ? 0 : 1;
  downloadBinary(midiStore.dx7CartridgeBytes(bank), `volca_fm2_dx7_cartridge_${index + 1}.syx`);
};

const selectDx7File = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const voices = parseDx7Sysex(new Uint8Array(await file.arrayBuffer()));
    if (voices.length === 0) {
      fail(t('dx7.parseError'));
      return;
    }
    parsedVoices.value = voices;
    showVoicePicker.value = true;
  } catch {
    fail(t('dx7.parseError'));
  }
};

const applyDx7Import = (payload: { selectedIndexes: number[]; startSlot: number }) => {
  const voices = payload.selectedIndexes
    .map(voiceIndex => parsedVoices.value[voiceIndex]?.packed)
    .filter((voice): voice is Uint8Array => Boolean(voice));
  midiStore.importPackedVoices(voices, payload.startSlot);
};

const requestWrite = () => {
  if (!canWrite.value) return;
  requestWriteConfirm(() => { void confirmWrite(); });
};

const confirmWrite = async () => {
  showWriteConfirm.value = false;
  showWriteProgress.value = true;
  const ok = await midiStore.writeSoundListToDevice();
  showWriteProgress.value = false;
  if (!ok) {
    const error = midiStore.soundListWriteError;
    if (error?.kind === 'sequence') {
      fail(t('dx7.writeSequenceError', { slot: String(error.slot + 1).padStart(2, '0') }));
      return;
    }
    if (error?.kind === 'program') {
      fail(t('dx7.writeError', { slot: String(error.slot).padStart(2, '0') }));
      return;
    }
    fail(t('dx7.writeErrorUnknown'));
  }
};

const draggingMeta = computed(() => {
  if (draggingSlot.value === null) return null;
  const slot = listedPrograms.value[draggingSlot.value];
  return slot ? { slot: slot.slot, name: slot.name.trim() || '—' } : null;
});

const onSlotClick = (slot: number) => {
  if (reorderEnabled.value) return;
  soundStore.loadLibrarianSlot(slot);
  ui.activeTab = 'sound-edit';
};

const applyReorder = (fromSlot: number, toSlot: number, remapSequences: boolean) => {
  midiStore.reorderSoundList(fromSlot, toSlot, { remapSequences });
  if (!remapSequences) return;
  const remappedProgramNo = remapSlotAfterReorder(sequencerStore.programNo, fromSlot, toSlot);
  if (remappedProgramNo !== null) sequencerStore.setProgramNo(remappedProgramNo);
};

const requestReorder = (fromSlot: number, toSlot: number) => {
  if (fromSlot === toSlot || showReorderSequences.value) return;
  const affectedSlots = midiStore.sequencesAffectedByReorder(fromSlot, toSlot);
  const editorAffected = remapSlotAfterReorder(sequencerStore.programNo, fromSlot, toSlot) !== sequencerStore.programNo;
  if (affectedSlots.length === 0 && !editorAffected) {
    applyReorder(fromSlot, toSlot, false);
    return;
  }
  if (remapSequencesChoice.value !== null) {
    applyReorder(fromSlot, toSlot, remapSequencesChoice.value);
    return;
  }
  pendingReorder.value = {
    fromSlot,
    toSlot,
    sequenceLabels: formatSequenceUsageList(affectedSlots.map(sequenceSlot => sequenceSlot + 1)),
    editorAffected,
  };
  showReorderSequences.value = true;
};

const confirmReorderSequences = (remapSequences: boolean) => {
  const pending = pendingReorder.value;
  showReorderSequences.value = false;
  pendingReorder.value = null;
  remapSequencesChoice.value = remapSequences;
  if (!pending) return;
  applyReorder(pending.fromSlot, pending.toSlot, remapSequences);
};

const cancelReorderSequences = () => {
  showReorderSequences.value = false;
  pendingReorder.value = null;
};

const destinationFromInsert = (fromSlot: number, insertBefore: number) =>
  fromSlot < insertBefore ? insertBefore - 1 : insertBefore;

const canDropAt = (insertBefore: number) => {
  if (draggingSlot.value === null) return false;
  return destinationFromInsert(draggingSlot.value, insertBefore) !== draggingSlot.value;
};

const isOpenGap = (insertBefore: number) =>
  dragActive.value && dropInsertBefore.value === insertBefore && canDropAt(insertBefore);

const insertBeforeFromPoint = (clientX: number, clientY: number) => {
  const element = document.elementFromPoint(clientX, clientY);
  const gap = element?.closest('[data-insert-before]') as HTMLElement | null;
  if (gap) return Number(gap.dataset.insertBefore);
  const row = element?.closest('[data-sound-slot]') as HTMLElement | null;
  if (row) {
    const slot = Number(row.dataset.soundSlot);
    const rect = row.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2 ? slot : slot + 1;
  }
  const column = element?.closest('.sound-list-column') as HTMLElement | null;
  if (!column) return dropInsertBefore.value;
  const rows = column.querySelectorAll<HTMLElement>('[data-sound-slot]');
  const last = rows[rows.length - 1];
  if (!last) return dropInsertBefore.value;
  const lastSlot = Number(last.dataset.soundSlot);
  return clientY >= last.getBoundingClientRect().bottom ? lastSlot + 1 : lastSlot;
};

const clearDrag = () => {
  draggingSlot.value = null;
  dropInsertBefore.value = null;
  dragActive.value = false;
};

const onRowPointerDown = (event: PointerEvent, slot: number) => {
  if (!reorderEnabled.value) return;
  if ((event.target as HTMLElement | null)?.closest('.slot-move')) return;
  draggingSlot.value = slot;
  dropInsertBefore.value = slot;
  dragActive.value = false;
  dragOrigin.x = event.clientX;
  dragOrigin.y = event.clientY;
  ghostPos.value = { x: event.clientX, y: event.clientY };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};

const onHandlePointerMove = (event: PointerEvent) => {
  if (draggingSlot.value === null) return;
  ghostPos.value = { x: event.clientX, y: event.clientY };
  if (!dragActive.value) {
    const dx = event.clientX - dragOrigin.x;
    const dy = event.clientY - dragOrigin.y;
    if (dx * dx + dy * dy < 36) return;
    dragActive.value = true;
  }
  dropInsertBefore.value = insertBeforeFromPoint(event.clientX, event.clientY);
};

const onHandlePointerUp = () => {
  if (dragActive.value && draggingSlot.value !== null && dropInsertBefore.value !== null) {
    requestReorder(
      draggingSlot.value,
      destinationFromInsert(draggingSlot.value, dropInsertBefore.value),
    );
  }
  clearDrag();
};
</script>

<style scoped>
.sound-list-container { height: 100%; box-sizing: border-box; }
.sound-list-card { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.sound-list-columns {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
}
.sound-list-column {
  overflow: auto;
  border: 1px solid rgba(206,179,147,.18);
  border-radius: 11px;
  background: rgba(48,36,38,.72);
}
.slot-gap {
  height: 1px;
  margin: 0 10px;
  background: rgba(206,179,147,.14);
  flex: 0 0 auto;
}
.slot-gap.is-open {
  height: 40px;
  margin: 4px 8px;
  border-radius: 8px;
  background: rgba(206,179,147,.22);
  box-shadow: inset 0 0 0 1px rgba(206,179,147,.45);
}
.slot-row {
  display: flex; align-items: center; gap: 8px; min-height: 44px; min-width: 0; padding: 6px 10px;
  border: 0; background: transparent; color: inherit; text-align: left; width: 100%;
  cursor: pointer;
}
.slot-row.empty .slot-name { color: #8f8180; }
.slot-row.dragging {
  height: 0; min-height: 0; padding: 0; overflow: hidden; opacity: 0; pointer-events: none;
}
.slot-row.active { background: rgba(206,179,147,.14); box-shadow: inset 3px 0 0 var(--volca-accent); }
.sound-list-column.is-reorder .slot-row { cursor: grab; touch-action: none; }
.sound-list-column.is-reorder .slot-row:active { cursor: grabbing; }
.slot-ghost {
  position: fixed; z-index: 40; display: flex; align-items: center; gap: 8px;
  width: min(240px, calc(25vw - 24px)); min-height: 44px; padding: 6px 10px;
  border: 1px solid rgba(206,179,147,.4); border-radius: 9px;
  background: #352628; color: var(--volca-text);
  box-shadow: 0 10px 24px rgba(0,0,0,.35);
  pointer-events: none; transform: translate(12px, 8px);
}
.slot-handle {
  display: grid; place-items: center; width: 28px; height: 28px; color: var(--volca-muted);
}
.slot-number {
  width: 2rem; color: var(--volca-muted); font-variant-numeric: tabular-nums; font-weight: 650;
}
.slot-name {
  min-width: 0; flex: 1; overflow: hidden; color: var(--volca-accent-bright);
  font-weight: 650; text-overflow: ellipsis; white-space: nowrap;
}
.slot-seq {
  flex: 0 1 auto; max-width: 46%; min-width: 0;
  padding: 2px 7px; border-radius: 999px;
  background: var(--volca-teal-soft); color: var(--volca-teal);
  font-size: 11px; font-weight: 700; letter-spacing: .02em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  pointer-events: none;
}
.reorder-seq-list { color: var(--volca-teal); font-weight: 650; }
:deep(.slot-preview.v-btn) {
  width: 28px; min-width: 28px; height: 28px; min-height: 28px; border: 0;
  background: transparent !important; color: var(--volca-muted) !important; box-shadow: none !important;
}
:deep(.slot-preview.v-btn:hover),
:deep(.slot-preview.v-btn.is-playing) {
  background: rgba(255,255,255,.07) !important; color: var(--volca-accent-bright) !important;
}
.slot-move { display: flex; align-items: center; }
.sound-list-menu { min-width: 200px; border: 1px solid rgba(206,179,147,.28); border-radius: 10px; background: #2b2022; color: var(--volca-text); }
:deep(.reorder-btn.is-on) { box-shadow: inset 0 0 0 1px #ceb393, 0 3px 10px rgba(0,0,0,.16) !important; }
:deep(.slot-move .v-btn) {
  width: 28px; min-width: 28px; height: 28px; min-height: 28px; border: 0;
  background: transparent !important; color: var(--volca-muted) !important; box-shadow: none !important;
}
:deep(.slot-move .v-btn:hover) { background: rgba(255,255,255,.07) !important; color: var(--volca-text) !important; }
</style>
