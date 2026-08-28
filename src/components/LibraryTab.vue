<template>
  <v-container class="library-container">
    <AppDialog v-model="showReplaceConfirm" :title="t('library.replaceListTitle')" max-width="480">
      <p>{{ t('library.replaceListDescription') }}</p>
      <template #actions>
        <v-btn variant="text" @click="cancelReplace">{{ t('common.cancel') }}</v-btn>
        <v-btn @click="confirmReplace">{{ t('library.replaceList') }}</v-btn>
      </template>
    </AppDialog>
    <AppDialog
      v-model="showDeleteConfirm"
      :title="t('library.deleteTitle')"
      max-width="480"
      :persistent="busy === pendingDelete?.id"
      :closable="busy !== pendingDelete?.id"
    >
      <p>{{ t('library.deleteDescription', { name: pendingDelete?.name ?? '' }) }}</p>
      <template #actions>
        <v-btn variant="text" :disabled="busy === pendingDelete?.id" @click="showDeleteConfirm = false">{{ t('common.cancel') }}</v-btn>
        <v-btn class="dialog-danger-button" :loading="busy === pendingDelete?.id" @click="confirmDelete">
          <Trash2 :size="16" class="mr-1" />{{ t('common.delete') }}
        </v-btn>
      </template>
    </AppDialog>
    <AppDialog v-model="showSequenceLoad" :title="t('library.sequenceLoadTitle')" max-width="480">
      <p>{{ sequenceLoadCopy }}</p>
      <div class="sequence-load-choices">
        <button type="button" class="sequence-load-choice" @click="confirmSequenceLoad(false)">
          <strong>{{ t('library.sequenceLoadSequenceOnly') }}</strong>
        </button>
        <button type="button" class="sequence-load-choice" @click="confirmSequenceLoad(true)">
          <strong>{{ t('library.sequenceLoadWithProgram') }}</strong>
        </button>
      </div>
      <template #actions>
        <v-btn variant="text" @click="cancelSequenceLoad">{{ t('common.cancel') }}</v-btn>
      </template>
    </AppDialog>
    <LibrarySequenceProgramMismatchDialog
      v-model="showSequenceProgramMismatch"
      :program-slot="sequenceProgramMismatch?.slot ?? 0"
      :program-name="sequenceProgramMismatch?.name ?? ''"
      @keep="keepSequenceProgramMismatch"
      @load="loadSequenceProgramMismatch"
    />
    <AppProgressDialog
      :model-value="midiStore.backupFetching"
      :title="t('library.backupFetchTitle')"
      :description="backupProgressCopy"
      :value="backupProgressPercent"
    />
    <AppProgressDialog
      :model-value="backupRestoreProgress !== null"
      :title="t('library.backupLoadAllTitle')"
      :description="backupRestoreCopy"
      :value="backupRestorePercent"
    />
    <AppDialog v-model="showBackupRestoreConfirm" :title="t('library.backupLoadAllTitle')" max-width="480">
      <p>{{ t('library.backupLoadAllDescription') }}</p>
      <template #actions>
        <v-btn variant="text" @click="showBackupRestoreConfirm = false">{{ t('common.cancel') }}</v-btn>
        <v-btn variant="flat" @click="confirmBackupRestoreAll">{{ t('library.backupLoadAll') }}</v-btn>
      </template>
    </AppDialog>
    <AppDialog :model-value="backupWritePhase !== null" :title="t('library.backupLoadWriteTitle')" max-width="480" :persistent="true" :closable="false">
      <p>{{ backupWriteCopy }}</p>
    </AppDialog>
    <AppDialog v-model="showBackupRestoreFailed" :title="t('library.backupRestoreFailedTitle')" max-width="480">
      <p>{{ backupRestoreFailedCopy }}</p>
      <template #actions>
        <v-btn variant="text" @click="showBackupRestoreFailed = false">{{ t('common.close') }}</v-btn>
        <v-btn :disabled="backupBusy" @click="retryBackupRestore">{{ t('app.connection.retry') }}</v-btn>
      </template>
    </AppDialog>
    <LibraryBackupDialog
      v-model="showBackupBrowser"
      :title="backupBrowserTitle"
      :programs="backupPrograms"
      :sequences="backupSequences"
      :loading="backupBusy"
      :can-retry="backupRestoreResume !== null"
      :error-message="backupBrowserError"
      @load-program="loadBackupProgram"
      @load-sequence="loadBackupSequence"
      @load-with-program="openBackupSlotPicker"
      @load-all="openBackupRestoreConfirm"
      @retry="retryBackupRestore"
    />
    <LibraryBackupProgramSlotDialog
      v-model="showBackupSlotPicker"
      :source-slot="backupSourceSlot"
      :source-name="backupSourceName"
      :dest-names="midiStore.programNames"
      :loading="backupSlotBusy"
      :error-message="backupSlotError"
      @confirm="confirmBackupSlot"
    />
    <AppDialog v-model="showImportResult" :title="t('library.importResultTitle')" max-width="480">
      <p>{{ t('library.importSkipPolicy') }}</p>
      <p>{{ t('library.importResult', { added: importResult.added, skipped: importResult.skipped }) }}</p>
      <template #actions>
        <v-btn @click="showImportResult = false">{{ t('common.ok') }}</v-btn>
      </template>
    </AppDialog>
    <AppDialog v-model="showMemoEditor" :title="t('library.memoEditTitle')" max-width="520">
      <p class="memo-editor-label">{{ t('library.memoEditLabel', { name: memoTargetName }) }}</p>
      <v-textarea
        v-model="memoDraft"
        :label="t('library.memo')"
        rows="5"
        auto-grow
        density="compact"
        hide-details
        autofocus
      />
      <p v-if="memoErrorMessage" class="dialog-error memo-editor-error">{{ memoErrorMessage }}</p>
      <template #actions>
        <v-btn variant="text" @click="closeMemoEditor">{{ t('common.cancel') }}</v-btn>
        <v-btn :loading="busy === 'memo'" @click="saveMemoEdit">
          <StickyNote :size="16" class="mr-1" />{{ t('library.memoSave') }}
        </v-btn>
      </template>
    </AppDialog>

    <v-card class="library-card pa-4">
      <header class="editor-toolbar">
        <div class="editor-identity">
          <span class="editor-identity__label volca-section-title">{{ t('library.title') }}</span>
        </div>
      </header>

      <div class="library-tabs" role="tablist" :aria-label="t('library.title')">
        <button v-for="kind in kindTabs" :key="kind" class="library-tab" type="button" role="tab"
          :aria-selected="activeKind === kind" :class="{ 'is-on': activeKind === kind }"
          @click="selectKind(kind)">
          {{ kindLabel(kind) }}
        </button>
      </div>

      <p class="library-kind-label">{{ kindDescription }}</p>

      <div class="save-block">
        <div class="save-row">
          <v-text-field v-model="saveName" :label="t('library.name')" maxlength="40" density="compact" hide-details
            @keydown.enter.prevent="saveCurrent" />
          <v-btn :disabled="!saveName.trim()" :loading="busy === 'save'" @click="saveCurrent">
            <Save :size="16" class="mr-1" />{{ t('common.save') }}
          </v-btn>
          <v-btn :loading="busy === 'import'" @click="fileInput?.click()">
            <FileUp :size="16" class="mr-1" />{{ t('library.import') }}
          </v-btn>
          <input ref="fileInput" type="file" :accept="LIBRARY_FILE_ACCEPT" hidden @change="importFile" />
        </div>
        <v-textarea
          v-model="saveMemo"
          :label="t('library.memo')"
          rows="2"
          auto-grow
          density="compact"
          hide-details
        />
      </div>

      <p v-if="errorMessage" class="dialog-error">{{ errorMessage }}</p>

      <div class="library-list" :aria-busy="busy === 'load-list'">
        <div v-if="busy === 'load-list'" class="library-empty">{{ t('common.loading') }}</div>
        <div v-else-if="records.length === 0" class="library-empty">{{ t('library.empty') }}</div>
        <div v-for="record in records" v-else :key="record.id" class="library-item">
          <div class="library-meta">
            <strong>{{ record.name }}</strong>
            <small>{{ formatDate(record.updatedAt) }}</small>
            <small v-if="linkedSound(record)">{{ t('library.linkedProgram', { name: linkedSoundName(record) }) }}</small>
            <p v-if="record.memo" class="library-memo">{{ record.memo }}</p>
          </div>
          <ProgramPreviewButton
            v-if="record.kind === 'sound'"
            :preview-id="`library-${record.id}`"
            :voice="record.payload.sound"
          />
          <ProgramPreviewButton
            v-else-if="record.kind === 'sequence'"
            :preview-id="`library-${record.id}`"
            :sequence="normalizeSequenceState(record.payload.sequence as SequenceState)"
            :voice="linkedSound(record) ?? soundStore.program"
          />
          <v-btn :aria-label="t('library.memoEditLabel', { name: record.name })" @click="openMemoEditor(record)">
            <StickyNote :size="16" class="mr-1" />{{ t('library.memo') }}
          </v-btn>
          <v-btn @click="loadRecord(record)">
            <FileInput :size="16" class="mr-1" />{{ t('common.load') }}
          </v-btn>
          <v-btn @click="exportRecord(record)">
            <Download :size="16" class="mr-1" />{{ t('library.export') }}
          </v-btn>
          <v-btn :aria-label="t('library.deleteLabel', { name: record.name })" @click="openDelete(record)">
            <Trash2 :size="16" class="mr-1" />{{ t('common.delete') }}
          </v-btn>
        </div>
      </div>

      <div v-if="!isDesktopApp" class="library-notes">
        <p class="library-storage-notice" role="note">
          <Info :size="16" aria-hidden="true" />
          <span>
            {{ t('library.storageNotice') }}<br />
            <button
              class="library-storage-notice__link"
              type="button"
              :disabled="!hasDownloadableLibrary || busy === 'export-all'"
              :title="t('library.storageNoticeLinkTitle')"
              @click="downloadAllLibrary"
            >{{ t('library.storageNoticeLink') }}</button>{{ t('library.storageNoticeAfter') }}
          </span>
        </p>
      </div>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download, FileInput, FileUp, Info, Save, StickyNote, Trash2 } from '@lucide/vue';
import AppDialog from '@/components/dialogs/AppDialog.vue';
import AppProgressDialog from '@/components/dialogs/AppProgressDialog.vue';
import LibraryBackupDialog from '@/components/LibraryBackupDialog.vue';
import LibraryBackupProgramSlotDialog from '@/components/LibraryBackupProgramSlotDialog.vue'
import LibrarySequenceProgramMismatchDialog from '@/components/LibrarySequenceProgramMismatchDialog.vue'
import ProgramPreviewButton from '@/components/ProgramPreviewButton.vue';
import { useLibraryCurrent } from '@/composables/useLibraryCurrent';
import { useMidiStore } from '@/stores/midiStore';
import { useSequencerStore } from '@/stores/sequencerStore';
import { useSoundStore } from '@/stores/soundStore';
import { useUiStore } from '@/stores/uiStore';
import type { SoundProgram } from '@/types/soundProgram';
import {
    LIBRARY_FILE_ACCEPT,
    LIBRARY_KINDS,
    catalogItemsFromPayload,
    decodeLibraryFile,
    encodeLibraryFile,
    isCatalogKind,
    libraryFilename,
    deserializeSoundList,
    type DecodedLibraryFile,
    type LibraryKind,
} from '@/utils/libraryFormat';
import { deleteLibrary, importLibraryRecords, listLibrary, saveLibrary, updateLibraryMemo, type LibraryRecord } from '@/utils/presetLibrary';
import {
    buildDeviceBackupPayload,
    parseDeviceBackupPrograms,
    parseDeviceBackupSequences,
    type DeviceBackupProgress,
} from '@/utils/deviceBackup';
import { NUM_OF_SEQUENCES, normalizeSequenceState, type SequenceState } from '@/types/sequence';
import { SOUND_LIST_SLOT_COUNT, type SoundListProgram } from '@/utils/soundListBackup';
import { formatThrownError } from '@/utils/appError';
import { downloadText } from '@/utils/downloadBinary';
import { isSoundProgram } from '@/utils/programPreviewVoice';
import { isDesktopApp } from '@/utils/runtime';
import { buildSequenceDataBytes } from '@/utils/sequenceCodec';

const ui = useUiStore();
const soundStore = useSoundStore();
const seqStore = useSequencerStore();
const midiStore = useMidiStore();
const { t, locale } = useI18n();
const thrown = (error: unknown, fallback: string) => formatThrownError(error, fallback, key => String(t(key)));
const { suggestedNameFor, stampSoundName, saveCurrent: saveKind, currentPayload, showSequenceProgramMismatch, sequenceProgramMismatch, keepSequenceProgramMismatch, loadSequenceProgramMismatch } = useLibraryCurrent();

const kindTabs = LIBRARY_KINDS;
const activeKind = ref<LibraryKind>('sound');
const records = ref<LibraryRecord[]>([]);
const saveName = ref('');
const saveMemo = ref('');
const busy = ref<string | null>(null);
const errorMessage = ref('');
const pendingDelete = ref<LibraryRecord | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const showMemoEditor = ref(false);
const memoTargetId = ref<string | null>(null);
const memoTargetName = ref('');
const memoDraft = ref('');
const memoErrorMessage = ref('');
const showReplaceConfirm = ref(false);
const showSequenceLoad = ref(false);
const pendingLoad = ref<LibraryRecord | null>(null);
const showDeleteConfirm = computed({
  get: () => pendingDelete.value !== null,
  set: open => { if (!open) pendingDelete.value = null },
});
const showImportResult = ref(false);
const importResult = ref({ added: 0, skipped: 0 });
const hasDownloadableLibrary = ref(false);
const showBackupBrowser = ref(false);
const backupBrowserTitle = ref('');
const backupPrograms = ref<SoundListProgram[]>([]);
const backupSequences = ref<SequenceState[]>([]);
const showBackupSlotPicker = ref(false);
const pendingSequenceSlot = ref(0);
const backupSlotBusy = ref(false);
const backupSlotError = ref('');
const backupBrowserError = ref('');
const backupWritePhase = ref<'program' | 'sequence' | null>(null);
const showBackupRestoreConfirm = ref(false);
const showBackupRestoreFailed = ref(false);
const backupRestoreProgress = ref<DeviceBackupProgress | null>(null);
const backupRestoreResume = ref<{ phase: 'program' | 'sequence'; slot: number } | null>(null);

const backupBusy = computed(() => backupWritePhase.value !== null || backupRestoreProgress.value !== null);

const backupWriteCopy = computed(() => {
  if (backupWritePhase.value === 'program') return t('library.backupWritingProgram');
  if (backupWritePhase.value === 'sequence') return t('library.backupWritingSequence');
  return '';
});

const backupProgressCopy = computed(() => {
  const progress = midiStore.backupProgress;
  if (!progress) return '';
  const key = progress.phase === 'program' ? 'library.backupFetchPrograms' : 'library.backupFetchSequences';
  return t(key, { current: progress.current, total: progress.total });
});

const backupProgressPercent = computed(() => {
  const progress = midiStore.backupProgress;
  if (!progress) return 0;
  const completed = progress.phase === 'program'
    ? progress.current
    : SOUND_LIST_SLOT_COUNT + progress.current;
  return (completed / (SOUND_LIST_SLOT_COUNT + NUM_OF_SEQUENCES)) * 100;
});

const backupRestoreCopy = computed(() => {
  const progress = backupRestoreProgress.value;
  if (!progress) return '';
  const key = progress.phase === 'program' ? 'library.backupFetchPrograms' : 'library.backupFetchSequences';
  return t(key, { current: progress.current, total: progress.total });
});

const backupRestorePercent = computed(() => {
  const progress = backupRestoreProgress.value;
  if (!progress) return 0;
  const completed = progress.phase === 'program'
    ? progress.current
    : SOUND_LIST_SLOT_COUNT + progress.current;
  return (completed / (SOUND_LIST_SLOT_COUNT + NUM_OF_SEQUENCES)) * 100;
});

const backupRestoreFailedCopy = computed(() => {
  const resume = backupRestoreResume.value;
  if (!resume) return '';
  if (resume.phase === 'program') {
    return t('library.backupRestoreFailedProgram', { slot: String(resume.slot).padStart(2, '0') });
  }
  return t('library.backupRestoreFailedSequence', {
    slot: String(resume.slot + 1).padStart(2, '0'),
  });
});

const kindI18nKey = (kind: LibraryKind) => (kind === 'sound-list' ? 'soundList' : kind)

const kindLabel = (kind: LibraryKind) => t(`library.kinds.${kindI18nKey(kind)}`)

const kindDescription = computed(() => t(`library.kindDescription.${kindI18nKey(activeKind.value)}`))

const linkedSound = (record: LibraryRecord) =>
  isSoundProgram(record.payload.sound) ? record.payload.sound : null

const linkedSoundName = (record: LibraryRecord) => {
  const sound = linkedSound(record)
  if (!sound) return ''
  return sound.name.trim() || t('sound.untitled')
}

const sequenceLoadCopy = computed(() => t('library.sequenceLoadDescription', {
  name: pendingLoad.value ? linkedSoundName(pendingLoad.value) : '',
}))

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const needsListConfirm = (kind: LibraryKind) => kind === 'sound-list';

const destinationTab = (kind: LibraryKind) => {
  if (kind === 'sequence') return 'sequencer';
  if (kind === 'sound-list') return 'dx7';
  return 'sound-edit';
};

const recordsFromDecoded = (decoded: DecodedLibraryFile): LibraryRecord[] => {
  if (decoded.kind === 'bundle') {
    return catalogItemsFromPayload(decoded.payload).map(item => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      memo: item.memo ?? '',
      payload: item.payload,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }
  const now = Date.now();
  return [{
    id: decoded.id ?? crypto.randomUUID(),
    kind: decoded.kind,
    name: decoded.name,
    memo: decoded.memo ?? '',
    payload: decoded.payload,
    createdAt: now,
    updatedAt: decoded.savedAt || now,
  }];
};

const mergeRecords = async (incoming: LibraryRecord[]) => {
  const result = await importLibraryRecords(incoming);
  importResult.value = result;
  showImportResult.value = true;
  return result;
};

const applyRecord = (record: LibraryRecord, options: { withProgram?: boolean } = {}) => {
  const payload = cloneJson(record.payload);
  if (record.kind === 'sound' && payload.sound) {
    stampSoundName(payload, record.name);
    soundStore.loadPreset(payload.sound as SoundProgram);
    soundStore.sendToDevice();
  }
  if (record.kind === 'sequence' && payload.sequence) {
    seqStore.loadPreset(payload.sequence);
    if (options.withProgram && isSoundProgram(payload.sound)) {
      soundStore.loadPreset(payload.sound);
      soundStore.sendToDevice();
    }
  }
  if (record.kind === 'sound-list' && payload.soundList) {
    midiStore.replaceSoundList(deserializeSoundList(payload.soundList));
  }
  ui.activeTab = destinationTab(record.kind);
};

const refresh = async () => {
  busy.value = 'load-list';
  errorMessage.value = '';
  try {
    const [kindRecords, allRecords] = await Promise.all([
      listLibrary(activeKind.value),
      isDesktopApp ? Promise.resolve([]) : listLibrary(),
    ]);
    records.value = kindRecords;
    hasDownloadableLibrary.value = allRecords.some(record => isCatalogKind(record.kind));
  } catch (error) {
    errorMessage.value = thrown(error, 'library.loadError');
  } finally {
    busy.value = null;
  }
};

const selectKind = (kind: LibraryKind) => {
  ui.libraryFocus = kind;
  activeKind.value = kind;
  saveName.value = suggestedNameFor(kind);
  saveMemo.value = '';
  pendingDelete.value = null;
  void refresh();
};

const openLibrary = () => {
  activeKind.value = ui.libraryFocus;
  saveName.value = suggestedNameFor(activeKind.value);
  saveMemo.value = '';
  pendingDelete.value = null;
  errorMessage.value = '';
  showReplaceConfirm.value = false;
  showSequenceLoad.value = false;
  pendingLoad.value = null;
  void refresh();
};

watch(() => ui.activeTab, tab => {
  if (tab === 'library') openLibrary();
}, { immediate: true });

watch(() => ui.libraryFocus, kind => {
  if (ui.activeTab !== 'library' || activeKind.value === kind) return;
  selectKind(kind);
});

const saveCurrent = async () => {
  const name = saveName.value.trim();
  if (!name) return;
  busy.value = 'save';
  errorMessage.value = '';
  try {
    if (activeKind.value === 'backup') {
      if (!midiStore.isIdleConnected) {
        errorMessage.value = t('library.backupNotConnected');
        return;
      }
      const captured = await midiStore.captureDeviceBackup();
      if (!captured) {
        errorMessage.value = t('library.backupFetchFailed');
        return;
      }
      await saveLibrary(
        'backup',
        name,
        buildDeviceBackupPayload(captured.programs, captured.sequences),
        saveMemo.value,
      );
    } else {
      const saved = await saveKind(activeKind.value, name, saveMemo.value);
      if (!saved) return;
    }
    saveMemo.value = '';
    await refresh();
  } catch (error) {
    errorMessage.value = thrown(error, 'library.saveError');
  } finally {
    busy.value = null;
  }
};

const openMemoEditor = (record: LibraryRecord) => {
  memoTargetId.value = record.id;
  memoTargetName.value = record.name;
  memoDraft.value = record.memo;
  memoErrorMessage.value = '';
  showMemoEditor.value = true;
};

const closeMemoEditor = () => {
  showMemoEditor.value = false;
  memoTargetId.value = null;
  memoTargetName.value = '';
  memoDraft.value = '';
  memoErrorMessage.value = '';
};

const saveMemoEdit = async () => {
  const id = memoTargetId.value;
  if (!id) return;
  busy.value = 'memo';
  memoErrorMessage.value = '';
  try {
    const updated = await updateLibraryMemo(id, memoDraft.value);
    if (!updated) {
      memoErrorMessage.value = t('library.memoSaveError');
      return;
    }
    closeMemoEditor();
    await refresh();
  } catch (error) {
    memoErrorMessage.value = thrown(error, 'library.memoSaveError');
  } finally {
    busy.value = null;
  }
};

const loadRecord = async (record: LibraryRecord) => {
  errorMessage.value = '';
  try {
    if (record.kind === 'bundle') {
      busy.value = 'import';
      await mergeRecords(recordsFromDecoded({
        kind: 'bundle',
        name: record.name,
        savedAt: record.updatedAt,
        payload: record.payload,
      }));
      await refresh();
      return;
    }
    if (record.kind === 'backup') {
      backupBrowserTitle.value = record.name;
      backupPrograms.value = parseDeviceBackupPrograms(record.payload);
      backupSequences.value = parseDeviceBackupSequences(record.payload);
      backupBrowserError.value = '';
      backupRestoreResume.value = null;
      showBackupRestoreFailed.value = false;
      showBackupBrowser.value = true;
      return;
    }
    if (needsListConfirm(record.kind)) {
      pendingLoad.value = record;
      showReplaceConfirm.value = true;
      return;
    }
    if (record.kind === 'sequence' && linkedSound(record)) {
      pendingLoad.value = record;
      showSequenceLoad.value = true;
      return;
    }
    applyRecord(record);
  } catch (error) {
    errorMessage.value = thrown(error, 'library.loadError');
  } finally {
    if (busy.value === 'import') busy.value = null;
  }
};

const confirmReplace = () => {
  const record = pendingLoad.value;
  pendingLoad.value = null;
  showReplaceConfirm.value = false;
  if (!record) return;
  try {
    applyRecord(record);
  } catch (error) {
    errorMessage.value = thrown(error, 'library.loadError');
  }
};

const cancelReplace = () => {
  pendingLoad.value = null;
  showReplaceConfirm.value = false;
};

const confirmSequenceLoad = (withProgram: boolean) => {
  const record = pendingLoad.value;
  pendingLoad.value = null;
  showSequenceLoad.value = false;
  if (!record) return;
  try {
    applyRecord(record, { withProgram });
  } catch (error) {
    errorMessage.value = thrown(error, 'library.loadError');
  }
};

const cancelSequenceLoad = () => {
  pendingLoad.value = null;
  showSequenceLoad.value = false;
};

const downloadAllLibrary = async () => {
  if (isDesktopApp || !hasDownloadableLibrary.value || busy.value) return;
  busy.value = 'export-all';
  errorMessage.value = '';
  try {
    const payload = await currentPayload('bundle');
    if (!payload.items?.length) {
      hasDownloadableLibrary.value = false;
      return;
    }
    downloadText(
      encodeLibraryFile('bundle', t('library.suggestedBundle'), payload),
      libraryFilename(t('library.suggestedBundle'), 'bundle'),
    );
  } catch (error) {
    errorMessage.value = thrown(error, 'library.exportError');
  } finally {
    busy.value = null;
  }
};

const exportRecord = (record: LibraryRecord) => {
  errorMessage.value = '';
  try {
    downloadText(
      encodeLibraryFile(
        record.kind,
        record.name,
        record.payload,
        record.updatedAt,
        record.kind === 'bundle' ? undefined : record.id,
        record.memo,
      ),
      libraryFilename(record.name, record.kind),
    );
  } catch (error) {
    errorMessage.value = thrown(error, 'library.exportError');
  }
};

const importFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  busy.value = 'import';
  errorMessage.value = '';
  try {
    const decoded = decodeLibraryFile(await file.text(), file.name);
    await mergeRecords(recordsFromDecoded(decoded));
    if (decoded.kind === 'bundle') {
      await refresh();
    } else {
      selectKind(decoded.kind);
    }
  } catch (error) {
    errorMessage.value = thrown(error, 'library.importError');
  } finally {
    busy.value = null;
  }
};

const removeRecord = async (id: string) => {
  busy.value = id;
  errorMessage.value = '';
  try {
    await deleteLibrary(id);
    pendingDelete.value = null;
    await refresh();
  } catch (error) {
    errorMessage.value = thrown(error, 'library.deleteError');
    pendingDelete.value = null;
  } finally {
    busy.value = null;
  }
};

const confirmDelete = () => {
  const record = pendingDelete.value;
  if (!record) return;
  void removeRecord(record.id);
};

const openDelete = (record: LibraryRecord) => {
  errorMessage.value = '';
  pendingDelete.value = record;
};

const formatDate = (timestamp: number) => new Intl.DateTimeFormat(locale.value, {
  dateStyle: 'medium', timeStyle: 'short',
}).format(timestamp);

const loadBackupProgram = async (slot: number) => {
  const program = backupPrograms.value[slot];
  if (!program) return;
  if (!midiStore.isIdleConnected) {
    backupBrowserError.value = t('library.backupNotConnected');
    return;
  }
  backupBrowserError.value = '';
  backupWritePhase.value = 'program';
  try {
    midiStore.updateSoundListSlot(slot, program.data);
    const ok = await midiStore.writeProgramSlot(slot);
    if (!ok) {
      backupBrowserError.value = t('library.backupLoadProgramSlotWriteFailed');
      return;
    }
    midiStore.matchedProgramNo = slot;
    soundStore.loadFromVoiceData(program.data);
    soundStore.sendToDevice();
    showBackupBrowser.value = false;
    ui.activeTab = 'sound-edit';
  } finally {
    backupWritePhase.value = null;
  }
};

const backupSourceSlot = computed(() => backupSequences.value[pendingSequenceSlot.value]?.programNo ?? 0);
const backupSourceName = computed(() => backupPrograms.value[backupSourceSlot.value]?.name ?? '');

const openBackupSlotPicker = (slot: number) => {
  pendingSequenceSlot.value = slot;
  backupSlotError.value = '';
  showBackupSlotPicker.value = true;
};

const applyBackupSequence = (slot: number, programNo?: number) => {
  const sequence = backupSequences.value[slot];
  if (!sequence) return;
  seqStore.loadPreset(programNo === undefined ? sequence : { ...sequence, programNo });
  showBackupSlotPicker.value = false;
  showBackupBrowser.value = false;
  ui.activeTab = 'sequencer';
};

const writeBackupSequenceSlot = async (slot: number, programNo?: number) => {
  const sequence = backupSequences.value[slot];
  if (!sequence) return false;
  const state = programNo === undefined ? sequence : { ...sequence, programNo };
  return midiStore.writeSequenceSlot(slot, buildSequenceDataBytes(state));
};

const loadBackupSequence = async (slot: number) => {
  if (!midiStore.isIdleConnected) {
    backupBrowserError.value = t('library.backupNotConnected');
    return;
  }
  backupBrowserError.value = '';
  backupWritePhase.value = 'sequence';
  try {
    const ok = await writeBackupSequenceSlot(slot);
    if (!ok) {
      backupBrowserError.value = t('library.backupLoadSequenceSlotWriteFailed');
      return;
    }
    applyBackupSequence(slot);
  } finally {
    backupWritePhase.value = null;
  }
};

const openBackupRestoreConfirm = () => {
  if (!midiStore.isIdleConnected) {
    backupBrowserError.value = t('library.backupNotConnected');
    return;
  }
  backupBrowserError.value = '';
  showBackupRestoreConfirm.value = true;
};

const restoreBackupFrom = async (start: { phase: 'program' | 'sequence'; slot: number }) => {
  if (backupBusy.value) return;
  if (!midiStore.isIdleConnected) {
    backupBrowserError.value = t('library.backupNotConnected');
    backupRestoreResume.value = start;
    showBackupRestoreFailed.value = true;
    return;
  }
  showBackupRestoreFailed.value = false;
  backupRestoreResume.value = null;
  backupBrowserError.value = '';
  midiStore.backupRestoring = true;
  backupRestoreProgress.value = {
    phase: start.phase,
    current: start.slot + 1,
    total: start.phase === 'program' ? SOUND_LIST_SLOT_COUNT : NUM_OF_SEQUENCES,
  };
  try {
    let slot = start.slot;
    if (start.phase === 'program') {
      for (; slot < SOUND_LIST_SLOT_COUNT; slot++) {
        backupRestoreProgress.value = { phase: 'program', current: slot + 1, total: SOUND_LIST_SLOT_COUNT };
        const ok = await midiStore.writeProgramSlot(slot);
        if (!ok) {
          backupRestoreResume.value = { phase: 'program', slot };
          backupBrowserError.value = t('library.backupLoadProgramSlotWriteFailed');
          showBackupRestoreFailed.value = true;
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      slot = 0;
    }
    for (; slot < NUM_OF_SEQUENCES; slot++) {
      backupRestoreProgress.value = { phase: 'sequence', current: slot + 1, total: NUM_OF_SEQUENCES };
      const ok = await writeBackupSequenceSlot(slot);
      if (!ok) {
        backupRestoreResume.value = { phase: 'sequence', slot };
        backupBrowserError.value = t('library.backupLoadSequenceSlotWriteFailed');
        showBackupRestoreFailed.value = true;
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    showBackupBrowser.value = false;
  } finally {
    backupRestoreProgress.value = null;
    midiStore.backupRestoring = false;
  }
};

const retryBackupRestore = () => {
  if (!backupRestoreResume.value) return;
  void restoreBackupFrom(backupRestoreResume.value);
};

const confirmBackupRestoreAll = async () => {
  if (backupBusy.value) return;
  if (!midiStore.isIdleConnected) {
    backupBrowserError.value = t('library.backupNotConnected');
    return;
  }
  showBackupRestoreConfirm.value = false;
  midiStore.replaceSoundList(backupPrograms.value);
  await restoreBackupFrom({ phase: 'program', slot: 0 });
};

const confirmBackupSlot = async (destSlot: number) => {
  const sequence = backupSequences.value[pendingSequenceSlot.value];
  if (!sequence) return;
  const dest = Math.max(0, Math.min(63, destSlot));
  const program = backupPrograms.value[sequence.programNo];
  if (!midiStore.isIdleConnected) {
    backupSlotError.value = t('library.backupNotConnected');
    return;
  }
  backupSlotBusy.value = true;
  backupSlotError.value = '';
  try {
    if (program) {
      backupWritePhase.value = 'program';
      midiStore.updateSoundListSlot(dest, program.data);
      const programOk = await midiStore.writeProgramSlot(dest);
      if (!programOk) {
        backupSlotError.value = t('library.backupLoadProgramSlotWriteFailed');
        return;
      }
    }
    backupWritePhase.value = 'sequence';
    const sequenceOk = await writeBackupSequenceSlot(pendingSequenceSlot.value, dest);
    if (!sequenceOk) {
      backupSlotError.value = t('library.backupLoadSequenceSlotWriteFailed');
      return;
    }
    if (program) {
      midiStore.matchedProgramNo = dest;
      soundStore.loadFromVoiceData(program.data);
      soundStore.sendToDevice();
    }
    applyBackupSequence(pendingSequenceSlot.value, dest);
  } finally {
    backupSlotBusy.value = false;
    backupWritePhase.value = null;
  }
};
</script>

<style scoped>
.library-container { height: 100%; box-sizing: border-box; }
.library-card { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.library-tabs { display: flex; flex: 0 0 auto; flex-wrap: wrap; gap: 4px; margin: 4px 0 12px; border-bottom: 1px solid var(--volca-line); }
.library-tab {
  height: 40px; padding: 0 16px; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px;
  background: transparent; color: var(--volca-muted); font: inherit; font-size: var(--volca-type-body);
  font-weight: 700; cursor: pointer;
}
.library-tab:hover { color: var(--volca-text); }
.library-tab.is-on { color: var(--volca-accent-bright); border-bottom-color: var(--volca-accent); }
.library-tab:focus-visible { outline: 2px solid var(--volca-accent); outline-offset: 2px; }
.library-kind-label {
  flex: 0 0 auto; margin: 0 0 12px;
  color: var(--volca-muted); font-size: var(--volca-type-body); line-height: 1.55;
}
.sequence-load-choices { display: grid; gap: 8px; margin: 14px 0 0; }
.sequence-load-choice {
  display: grid; min-height: 48px; padding: 12px 14px; place-items: start;
  border: 1px solid rgba(206,179,147,.18); border-radius: 8px; background: #2b2022; color: #d8ccc4;
  text-align: left; cursor: pointer;
}
.sequence-load-choice:hover { border-color: rgba(206,179,147,.48); background: #35282a; }
.sequence-load-choice strong { color: var(--volca-text); font-size: var(--volca-type-body); }
.save-block { display: grid; gap: 10px; margin-bottom: 12px; }
.save-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; }
.library-list { min-height: 0; flex: 1 1 auto; overflow-y: auto; }
.library-empty { display: grid; min-height: 180px; place-items: center; color: var(--volca-muted); font-size: var(--volca-type-body); }
.library-item { min-height: 64px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; border-top: 1px solid var(--volca-line); }
.library-meta { min-width: 0; flex: 1; display: grid; gap: 2px; padding: 10px 0; }
.library-meta strong { overflow: hidden; color: var(--volca-text); font-size: var(--volca-type-body); text-overflow: ellipsis; white-space: nowrap; }
.library-meta small { color: var(--volca-muted); font-size: var(--volca-type-label); }
.library-memo {
  margin: 2px 0 0; color: var(--volca-muted); font-size: var(--volca-type-label); line-height: 1.45;
  white-space: pre-wrap; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
}
.memo-editor-label { margin: 0 0 10px; color: var(--volca-muted); font-size: var(--volca-type-body); }
.memo-editor-error { margin-top: 12px; }
.library-notes {
  display: grid; gap: 12px; flex: 0 0 auto; margin: 14px 0 0; padding-top: 14px;
  border-top: 1px solid var(--volca-line);
}
.library-storage-notice {
  display: flex; align-items: flex-start; gap: 8px; margin: 0;
  color: var(--volca-muted); font-size: var(--volca-type-body); line-height: 1.55;
}
.library-storage-notice svg { flex: 0 0 auto; margin-top: 2px; color: var(--volca-teal); }
.library-storage-notice__link {
  display: inline; padding: 0; border: 0; background: none; color: var(--volca-accent);
  font: inherit; text-decoration: underline; text-underline-offset: 2px; cursor: pointer;
}
.library-storage-notice__link:hover:not(:disabled) { color: var(--volca-accent-bright); }
.library-storage-notice__link:disabled { opacity: 0.45; cursor: default; text-decoration: none; }
</style>
