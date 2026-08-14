<template>
  <v-dialog :model-value="ui.showLibrary" max-width="720" @update:model-value="ui.showLibrary = $event">
    <v-card class="unified-library pa-4">
      <div class="library-header">
        <v-card-title>{{ t('library.title') }}</v-card-title>
        <DialogCloseButton @click="ui.showLibrary = false" />
      </div>

      <div class="kind-tabs">
        <v-btn v-for="kind in kindTabs" :key="kind" class="kind-tab" :class="{ 'is-on': activeKind === kind }"
          @click="selectKind(kind)">
          {{ kindLabel(kind) }}
        </v-btn>
      </div>

      <div class="save-row">
        <v-text-field v-model="saveName" :label="t('library.name')" maxlength="40" density="compact" hide-details
          @keydown.enter.prevent="saveCurrent" />
        <v-btn :disabled="!saveName.trim()" :loading="busy === 'save'" @click="saveCurrent">
          <Save :size="17" class="mr-1" />{{ t('common.save') }}
        </v-btn>
        <v-btn :loading="busy === 'import'" @click="fileInput?.click()">
          <FileUp :size="17" class="mr-1" />{{ t('library.import') }}
        </v-btn>
        <input ref="fileInput" type="file" :accept="LIBRARY_FILE_ACCEPT" hidden @change="importFile" />
      </div>

      <v-alert v-if="errorMessage" type="error" density="compact" variant="tonal" class="mt-3">
        {{ errorMessage }}
      </v-alert>

      <div class="library-list" :aria-busy="busy === 'load-list'">
        <div v-if="busy === 'load-list'" class="library-empty">{{ t('common.loading') }}</div>
        <div v-else-if="records.length === 0" class="library-empty">{{ t('library.empty') }}</div>
        <div v-for="record in records" v-else :key="record.id" class="library-item">
          <div class="library-meta">
            <strong>{{ record.name }}</strong>
            <small>{{ formatDate(record.updatedAt) }}</small>
          </div>
          <v-btn size="small" @click="loadRecord(record)">{{ t('common.load') }}</v-btn>
          <v-btn size="small" @click="exportRecord(record)">
            <Download :size="15" class="mr-1" />{{ t('library.export') }}
          </v-btn>
          <template v-if="deleteTarget === record.id">
            <v-btn size="small" variant="text" @click="deleteTarget = null">{{ t('common.back') }}</v-btn>
            <v-btn size="small" color="error" :loading="busy === record.id" @click="removeRecord(record.id)">{{ t('common.delete') }}</v-btn>
          </template>
          <v-btn v-else class="library-delete-button" icon variant="text" size="small"
            :aria-label="t('library.deleteLabel', { name: record.name })" @click="deleteTarget = record.id">
            <Trash2 :size="17" />
          </v-btn>
        </div>
      </div>
    </v-card>
  </v-dialog>

  <AppDialog v-model="showReplaceConfirm" :title="t('library.replaceListTitle')" max-width="480">
    <p>{{ t('library.replaceListDescription') }}</p>
    <template #actions>
      <v-btn variant="text" @click="cancelReplace">{{ t('common.cancel') }}</v-btn>
      <v-btn @click="confirmReplace">{{ t('library.replaceList') }}</v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download, FileUp, Save, Trash2 } from '@lucide/vue';
import AppDialog from '@/components/dialogs/AppDialog.vue';
import DialogCloseButton from '@/components/DialogCloseButton.vue';
import { useMidiStore } from '@/stores/midiStore';
import { useSequencerStore } from '@/stores/sequencerStore';
import { useSoundStore } from '@/stores/soundStore';
import { useUiStore } from '@/stores/uiStore';
import type { SoundProgram } from '@/types/soundProgram';
import {
    LIBRARY_FILE_ACCEPT,
    LIBRARY_KINDS,
    decodeLibraryFile,
    encodeLibraryFile,
    libraryFilename,
    serializeSoundList,
    deserializeSoundList,
    type LibraryKind,
    type LibraryPayload,
} from '@/utils/libraryFormat';
import { deleteLibrary, listLibrary, saveLibrary, type LibraryRecord } from '@/utils/presetLibrary';
import { downloadText } from '@/utils/downloadBinary';

const ui = useUiStore();
const soundStore = useSoundStore();
const seqStore = useSequencerStore();
const midiStore = useMidiStore();
const { t, locale } = useI18n();

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

const kindLabel = (kind: LibraryKind) => t(
  kind === 'sound-list' ? 'library.kinds.soundList' : `library.kinds.${kind}`,
);

const suggestedNameFor = (kind: LibraryKind) => {
  if (kind === 'sound') return soundStore.program.name.trim() || t('sound.untitled');
  if (kind === 'sequence') return t('sequence.libraryName', { count: seqStore.programNo + 1 });
  if (kind === 'sound-list') return t('library.suggestedSoundList');
  return t('library.suggestedBundle');
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const currentPayload = (kind: LibraryKind): LibraryPayload => {
  if (kind === 'sound') return { sound: soundStore.snapshot() };
  if (kind === 'sequence') return { sequence: cloneJson(seqStore.toState()) };
  if (kind === 'sound-list') return { soundList: serializeSoundList(midiStore.cloneSoundList()) };
  return {
    sound: soundStore.snapshot(),
    sequence: cloneJson(seqStore.toState()),
    soundList: serializeSoundList(midiStore.cloneSoundList()),
  };
};

const stampSoundName = (payload: LibraryPayload, name: string) => {
  if (payload.sound && typeof payload.sound === 'object' && payload.sound !== null && 'name' in payload.sound) {
    (payload.sound as { name: string }).name = name.slice(0, 10);
  }
};

const needsListConfirm = (kind: LibraryKind, payload: LibraryPayload) =>
  kind === 'sound-list' || (kind === 'bundle' && Boolean(payload.soundList));

const applyRecord = (record: LibraryRecord) => {
  const payload = cloneJson(record.payload);
  if ((record.kind === 'sound' || record.kind === 'bundle') && payload.sound) {
    if (record.kind === 'sound') stampSoundName(payload, record.name);
    soundStore.loadPreset(payload.sound as SoundProgram);
    soundStore.sendToDevice();
  }
  if ((record.kind === 'sequence' || record.kind === 'bundle') && payload.sequence) {
    seqStore.loadPreset(payload.sequence);
  }
  if ((record.kind === 'sound-list' || record.kind === 'bundle') && payload.soundList) {
    midiStore.replaceSoundList(deserializeSoundList(payload.soundList));
  }
  ui.showLibrary = false;
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

watch(() => ui.showLibrary, open => {
  if (!open) {
    deleteTarget.value = null;
    errorMessage.value = '';
    showReplaceConfirm.value = false;
    pendingLoad.value = null;
    return;
  }
  activeKind.value = ui.libraryFocus;
  saveName.value = suggestedNameFor(activeKind.value);
  deleteTarget.value = null;
  void refresh();
});

const selectKind = (kind: LibraryKind) => {
  activeKind.value = kind;
  saveName.value = suggestedNameFor(kind);
  deleteTarget.value = null;
  void refresh();
};

const saveCurrent = async () => {
  const name = saveName.value.trim();
  if (!name) return;
  busy.value = 'save';
  errorMessage.value = '';
  try {
    const payload = currentPayload(activeKind.value);
    if (activeKind.value === 'sound') stampSoundName(payload, name);
    await saveLibrary(activeKind.value, name, payload);
    await refresh();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('library.saveError');
  } finally {
    busy.value = null;
  }
};

const loadRecord = (record: LibraryRecord) => {
  errorMessage.value = '';
  try {
    if (needsListConfirm(record.kind, record.payload)) {
      pendingLoad.value = record;
      showReplaceConfirm.value = true;
      return;
    }
    applyRecord(record);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('library.loadError');
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
      encodeLibraryFile(record.kind, record.name, record.payload, record.updatedAt),
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
    await saveLibrary(decoded.kind, decoded.name, decoded.payload);
    activeKind.value = decoded.kind;
    saveName.value = suggestedNameFor(decoded.kind);
    await refresh();
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
.unified-library { max-height: min(78vh, 760px); overflow: hidden; }
.library-header { display: flex; align-items: center; justify-content: space-between; }
.kind-tabs { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 16px 12px; }
.kind-tab.is-on { box-shadow: inset 0 0 0 1px #ceb393, 0 3px 10px rgba(0,0,0,.16) !important; }
.save-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 0 16px 14px; }
.library-list { min-height: 150px; max-height: 430px; padding: 4px 8px 8px; overflow-y: auto; }
.library-empty { display: grid; min-height: 150px; place-items: center; color: #ad9e96; font-size: var(--volca-type-body); }
.library-item { min-height: 64px; display: flex; align-items: center; gap: 6px; border-top: 1px solid rgba(206,179,147,.16); }
.library-meta { min-width: 0; flex: 1; display: grid; gap: 2px; padding: 10px 8px; }
.library-meta strong { overflow: hidden; color: #e1d5cd; font-size: var(--volca-type-body); text-overflow: ellipsis; white-space: nowrap; }
.library-meta small { color: #ad9e96; font-size: var(--volca-type-label); }
</style>
