<template>
  <v-container class="library-container">
    <AppDialog v-model="showReplaceConfirm" :title="t('library.replaceListTitle')" max-width="480">
      <p>{{ t('library.replaceListDescription') }}</p>
      <template #actions>
        <v-btn variant="text" @click="cancelReplace">{{ t('common.cancel') }}</v-btn>
        <v-btn @click="confirmReplace">{{ t('library.replaceList') }}</v-btn>
      </template>
    </AppDialog>
    <AppDialog v-model="showImportResult" :title="t('library.importResultTitle')" max-width="480">
      <p>{{ t('library.importSkipPolicy') }}</p>
      <p>{{ t('library.importResult', { added: importResult.added, skipped: importResult.skipped }) }}</p>
      <template #actions>
        <v-btn @click="showImportResult = false">{{ t('common.ok') }}</v-btn>
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

      <p v-if="errorMessage" class="dialog-error">{{ errorMessage }}</p>

      <div class="library-list" :aria-busy="busy === 'load-list'">
        <div v-if="busy === 'load-list'" class="library-empty">{{ t('common.loading') }}</div>
        <div v-else-if="records.length === 0" class="library-empty">{{ t('library.empty') }}</div>
        <div v-for="record in records" v-else :key="record.id" class="library-item">
          <div class="library-meta">
            <strong>{{ record.name }}</strong>
            <small>{{ formatDate(record.updatedAt) }}</small>
          </div>
          <v-btn @click="loadRecord(record)">
            <FolderOpen :size="16" class="mr-1" />{{ t('common.load') }}
          </v-btn>
          <v-btn @click="exportRecord(record)">
            <Download :size="16" class="mr-1" />{{ t('library.export') }}
          </v-btn>
          <template v-if="deleteTarget === record.id">
            <v-btn @click="deleteTarget = null">
              <Undo2 :size="16" class="mr-1" />{{ t('common.back') }}
            </v-btn>
            <v-btn class="dialog-danger-button" :loading="busy === record.id" @click="removeRecord(record.id)">
              <Trash2 :size="16" class="mr-1" />{{ t('common.delete') }}
            </v-btn>
          </template>
          <v-btn v-else :aria-label="t('library.deleteLabel', { name: record.name })" @click="deleteTarget = record.id">
            <Trash2 :size="16" class="mr-1" />{{ t('common.delete') }}
          </v-btn>
        </div>
      </div>

      <p v-if="activeKind === 'bundle'" class="library-bundle-note">
        <Info :size="16" aria-hidden="true" />
        <span>{{ t('library.bundleDescription') }}</span>
      </p>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download, FileUp, FolderOpen, Info, Save, Trash2, Undo2 } from '@lucide/vue';
import AppDialog from '@/components/dialogs/AppDialog.vue';
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
    libraryFilename,
    deserializeSoundList,
    type DecodedLibraryFile,
    type LibraryKind,
} from '@/utils/libraryFormat';
import { deleteLibrary, importLibraryRecords, listLibrary, type LibraryRecord } from '@/utils/presetLibrary';
import { downloadText } from '@/utils/downloadBinary';

const ui = useUiStore();
const soundStore = useSoundStore();
const seqStore = useSequencerStore();
const midiStore = useMidiStore();
const { t, locale } = useI18n();
const { suggestedNameFor, stampSoundName, saveCurrent: saveKind } = useLibraryCurrent();

const kindTabs = LIBRARY_KINDS;
const activeKind = ref<LibraryKind>('sound');
const records = ref<LibraryRecord[]>([]);
const saveName = ref('');
const busy = ref<string | null>(null);
const errorMessage = ref('');
const deleteTarget = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const showReplaceConfirm = ref(false);
const pendingLoad = ref<LibraryRecord | null>(null);
const showImportResult = ref(false);
const importResult = ref({ added: 0, skipped: 0 });

const kindLabel = (kind: LibraryKind) => t(
  kind === 'sound-list' ? 'library.kinds.soundList' : `library.kinds.${kind}`,
);

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

const applyRecord = (record: LibraryRecord) => {
  const payload = cloneJson(record.payload);
  if (record.kind === 'sound' && payload.sound) {
    stampSoundName(payload, record.name);
    soundStore.loadPreset(payload.sound as SoundProgram);
    soundStore.sendToDevice();
  }
  if (record.kind === 'sequence' && payload.sequence) {
    seqStore.loadPreset(payload.sequence);
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
    records.value = await listLibrary(activeKind.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('library.loadError');
  } finally {
    busy.value = null;
  }
};

const selectKind = (kind: LibraryKind) => {
  ui.libraryFocus = kind;
  activeKind.value = kind;
  saveName.value = suggestedNameFor(kind);
  deleteTarget.value = null;
  void refresh();
};

const openLibrary = () => {
  activeKind.value = ui.libraryFocus;
  saveName.value = suggestedNameFor(activeKind.value);
  deleteTarget.value = null;
  errorMessage.value = '';
  showReplaceConfirm.value = false;
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
    await saveKind(activeKind.value, name);
    await refresh();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('library.saveError');
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
    if (needsListConfirm(record.kind)) {
      pendingLoad.value = record;
      showReplaceConfirm.value = true;
      return;
    }
    applyRecord(record);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('library.loadError');
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
    errorMessage.value = error instanceof Error ? error.message : t('library.loadError');
  }
};

const cancelReplace = () => {
  pendingLoad.value = null;
  showReplaceConfirm.value = false;
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
      ),
      libraryFilename(record.name, record.kind),
    );
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('library.exportError');
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
    errorMessage.value = error instanceof Error ? error.message : t('library.importError');
  } finally {
    busy.value = null;
  }
};

const removeRecord = async (id: string) => {
  busy.value = id;
  errorMessage.value = '';
  try {
    await deleteLibrary(id);
    deleteTarget.value = null;
    await refresh();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('library.deleteError');
  } finally {
    busy.value = null;
  }
};

const formatDate = (timestamp: number) => new Intl.DateTimeFormat(locale.value, {
  dateStyle: 'medium', timeStyle: 'short',
}).format(timestamp);
</script>

<style scoped>
.library-container { height: 100%; box-sizing: border-box; }
.library-card { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.library-tabs { display: flex; flex: 0 0 auto; gap: 4px; margin: 4px 0 16px; border-bottom: 1px solid var(--volca-line); }
.library-tab {
  height: 40px; padding: 0 16px; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px;
  background: transparent; color: var(--volca-muted); font: inherit; font-size: var(--volca-type-body);
  font-weight: 700; cursor: pointer;
}
.library-tab:hover { color: var(--volca-text); }
.library-tab.is-on { color: var(--volca-accent-bright); border-bottom-color: var(--volca-accent); }
.library-tab:focus-visible { outline: 2px solid var(--volca-accent); outline-offset: 2px; }
.save-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; margin-bottom: 12px; }
.library-list { min-height: 0; flex: 1 1 auto; overflow-y: auto; }
.library-empty { display: grid; min-height: 180px; place-items: center; color: var(--volca-muted); font-size: var(--volca-type-body); }
.library-item { min-height: 64px; display: flex; align-items: center; gap: 8px; border-top: 1px solid var(--volca-line); }
.library-meta { min-width: 0; flex: 1; display: grid; gap: 2px; padding: 10px 0; }
.library-meta strong { overflow: hidden; color: var(--volca-text); font-size: var(--volca-type-body); text-overflow: ellipsis; white-space: nowrap; }
.library-meta small { color: var(--volca-muted); font-size: var(--volca-type-label); }
.library-bundle-note {
  display: flex; align-items: flex-start; gap: 8px; flex: 0 0 auto; margin: 14px 0 0; padding-top: 14px;
  border-top: 1px solid var(--volca-line); color: var(--volca-muted); font-size: var(--volca-type-body); line-height: 1.55;
}
.library-bundle-note svg { flex: 0 0 auto; margin-top: 2px; color: var(--volca-teal); }
</style>
