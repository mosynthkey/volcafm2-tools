<template>
  <v-dialog :model-value="modelValue" max-width="640" @update:model-value="emit('update:modelValue', $event)">
    <v-card class="preset-library pa-4">
      <div class="library-header">
        <v-card-title>{{ title }}</v-card-title>
        <DialogCloseButton @click="emit('update:modelValue', false)" />
      </div>

      <div class="save-row">
        <v-text-field v-model="saveName" :label="t('library.name')" maxlength="40" density="compact" hide-details
          @keydown.enter.prevent="saveCurrent" />
        <v-btn :disabled="!saveName.trim()" :loading="busy === 'save'" @click="saveCurrent">
          <Save :size="17" class="mr-1" />{{ t('common.save') }}
        </v-btn>
      </div>

      <v-alert v-if="errorMessage" type="error" density="compact" variant="tonal" class="mt-3">
        {{ errorMessage }}
      </v-alert>

      <div class="library-list" :aria-busy="busy === 'load-list'">
        <div v-if="busy === 'load-list'" class="library-empty">{{ t('common.loading') }}</div>
        <div v-else-if="records.length === 0" class="library-empty">
          {{ t('library.empty') }}
        </div>
        <div v-for="record in records" v-else :key="record.id" class="library-item">
          <div class="library-meta">
            <strong>{{ record.name }}</strong><small>{{ formatDate(record.updatedAt) }}</small>
          </div>
          <v-btn size="small" @click="loadRecord(record)">{{ t('common.load') }}</v-btn>
          <template v-if="deleteTarget === record.id">
            <v-btn size="small" variant="text" @click="deleteTarget = null">{{ t('common.back') }}</v-btn>
            <v-btn size="small" color="error" :loading="busy === record.id" @click="removeRecord(record.id)">{{ t('common.delete') }}</v-btn>
          </template>
          <v-btn v-else class="library-delete-button" icon variant="text" size="small" :aria-label="t('library.deleteLabel', { name: record.name })"
            @click="deleteTarget = record.id">
            <Trash2 :size="17" />
          </v-btn>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Save, Trash2 } from '@lucide/vue';
import DialogCloseButton from '@/components/DialogCloseButton.vue';
import { deletePreset, listPresets, savePreset, type PresetKind, type PresetRecord } from '@/utils/presetLibrary';

const props = defineProps<{
  modelValue: boolean;
  kind: PresetKind;
  title: string;
  suggestedName: string;
  snapshot: () => unknown;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  load: [data: unknown];
}>();
const { t, locale } = useI18n();

const records = ref<PresetRecord[]>([]);
const saveName = ref('');
const busy = ref<string | null>(null);
const errorMessage = ref('');
const deleteTarget = ref<string | null>(null);

const refresh = async () => {
  busy.value = 'load-list';
  errorMessage.value = '';
  try {
    records.value = await listPresets(props.kind);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('library.loadError');
  } finally {
    busy.value = null;
  }
};

watch(() => props.modelValue, open => {
  if (!open) return;
  saveName.value = props.suggestedName;
  deleteTarget.value = null;
  void refresh();
});

const saveCurrent = async () => {
  const name = saveName.value.trim();
  if (!name) return;
  busy.value = 'save';
  errorMessage.value = '';
  try {
    const snapshot = props.snapshot();
    if (props.kind === 'sound' && snapshot && typeof snapshot === 'object' && 'name' in snapshot) {
      (snapshot as { name: string }).name = name.slice(0, 10);
    }
    await savePreset(props.kind, name, snapshot);
    await refresh();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('library.saveError');
  } finally {
    busy.value = null;
  }
};

const loadRecord = (record: PresetRecord) => {
  const data = JSON.parse(JSON.stringify(record.data)) as unknown;
  if (props.kind === 'sound' && data && typeof data === 'object' && 'name' in data) {
    (data as { name: string }).name = record.name.slice(0, 10);
  }
  emit('load', data);
  emit('update:modelValue', false);
};

const removeRecord = async (id: string) => {
  busy.value = id;
  errorMessage.value = '';
  try {
    await deletePreset(id);
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
.preset-library { max-height: min(78vh, 720px); overflow: hidden; }
.library-header { display: flex; align-items: center; justify-content: space-between; }
.save-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 8px 16px 14px; }
.library-list { min-height: 150px; max-height: 430px; padding: 4px 8px 8px; overflow-y: auto; }
.library-empty { display: grid; min-height: 150px; place-items: center; color: #ad9e96; font-size: var(--volca-type-body); }
.library-item { min-height: 64px; display: flex; align-items: center; gap: 6px; border-top: 1px solid rgba(206,179,147,.16); }
.library-meta { min-width: 0; flex: 1; display: grid; gap: 2px; padding: 10px 8px; }
.library-meta strong { overflow: hidden; color: #e1d5cd; font-size: var(--volca-type-body); text-overflow: ellipsis; white-space: nowrap; }
.library-meta small { color: #ad9e96; font-size: var(--volca-type-label); }
</style>
