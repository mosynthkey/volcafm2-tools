<template>
  <div class="editor-library-cluster">
    <div class="editor-toolbar-section editor-library">
      <span class="editor-toolbar-section__label volca-section-title">{{ t('library.sectionLabel') }}</span>
      <ToolbarIconButton :label="t('library.save')">
        <v-btn icon :loading="saving" :title="t('library.save')" :aria-label="t('library.save')" @click="openSave">
          <Save :size="16" />
        </v-btn>
      </ToolbarIconButton>
      <ToolbarIconButton :label="t('library.open')">
        <v-btn icon :title="t('library.open')" :aria-label="t('library.open')" @click="ui.openLibrary(kind)">
          <FolderOpen :size="16" />
        </v-btn>
      </ToolbarIconButton>
    </div>
    <div v-if="page" class="editor-toolbar-section editor-hint">
      <ToolbarIconButton :label="t('hint.title')">
        <PageHintButton :page="page" />
      </ToolbarIconButton>
    </div>
  </div>

  <AppDialog v-model="showSave" :title="t('library.saveToLibrary')" max-width="440">
    <v-text-field v-model="saveName" :label="t('library.name')" maxlength="40" density="compact" hide-details autofocus
      @keydown.enter.prevent="confirmSave" />
    <v-textarea
      v-model="saveMemo"
      class="save-memo"
      :label="t('library.memo')"
      rows="3"
      auto-grow
      density="compact"
      hide-details
    />
    <p v-if="errorMessage" class="dialog-error save-error">{{ errorMessage }}</p>
    <template #actions>
      <v-btn variant="text" @click="showSave = false">{{ t('common.cancel') }}</v-btn>
      <v-btn :disabled="!saveName.trim()" :loading="saving" @click="confirmSave">
        <Save :size="16" class="mr-1" />{{ t('common.save') }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderOpen, Save } from '@lucide/vue'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import PageHintButton from '@/components/PageHintButton.vue'
import ToolbarIconButton from '@/components/ToolbarIconButton.vue'
import { useLibraryCurrent } from '@/composables/useLibraryCurrent'
import { useUiStore } from '@/stores/uiStore'
import { formatThrownError } from '@/utils/appError'
import type { PageHintId } from '@/utils/pageHint'
import type { LibraryKind } from '@/utils/libraryFormat'

const props = defineProps<{ kind: LibraryKind; page?: PageHintId }>()
const { t } = useI18n()
const ui = useUiStore()
const { suggestedNameFor, saveCurrent } = useLibraryCurrent()
const showSave = ref(false)
const saveName = ref('')
const saveMemo = ref('')
const saving = ref(false)
const errorMessage = ref('')

const openSave = () => {
  saveName.value = suggestedNameFor(props.kind)
  saveMemo.value = ''
  errorMessage.value = ''
  showSave.value = true
}

const confirmSave = async () => {
  if (!saveName.value.trim() || saving.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    await saveCurrent(props.kind, saveName.value, saveMemo.value)
    showSave.value = false
  } catch (error) {
    errorMessage.value = formatThrownError(error, 'library.saveError', key => String(t(key)))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.save-memo { margin-top: 12px; }
.save-error { margin-top: 12px; }
</style>
