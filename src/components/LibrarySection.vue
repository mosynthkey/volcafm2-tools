<template>
  <div class="editor-toolbar-section editor-library">
    <span class="editor-toolbar-section__label volca-section-title">{{ t('library.sectionLabel') }}</span>
    <v-btn :loading="saving" @click="openSave">
      <Save :size="16" class="mr-1" />{{ t('library.saveToLibrary') }}
    </v-btn>
    <v-btn @click="ui.openLibrary(kind)">
      <FolderOpen :size="16" class="mr-1" />{{ t('library.openLibrary') }}
    </v-btn>
    <PageHintButton v-if="page" :page="page" />
  </div>

  <AppDialog v-model="showSave" :title="t('library.saveToLibrary')" max-width="440">
    <v-text-field v-model="saveName" :label="t('library.name')" maxlength="40" density="compact" hide-details autofocus
      @keydown.enter.prevent="confirmSave" />
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
import { useLibraryCurrent } from '@/composables/useLibraryCurrent'
import { useUiStore } from '@/stores/uiStore'
import type { PageHintId } from '@/utils/pageHint'
import type { LibraryKind } from '@/utils/libraryFormat'

const props = defineProps<{ kind: LibraryKind; page?: PageHintId }>()
const { t } = useI18n()
const ui = useUiStore()
const { suggestedNameFor, saveCurrent } = useLibraryCurrent()
const showSave = ref(false)
const saveName = ref('')
const saving = ref(false)
const errorMessage = ref('')

const openSave = () => {
  saveName.value = suggestedNameFor(props.kind)
  errorMessage.value = ''
  showSave.value = true
}

const confirmSave = async () => {
  if (!saveName.value.trim() || saving.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    await saveCurrent(props.kind, saveName.value)
    showSave.value = false
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('library.saveError')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.save-error { margin-top: 12px; }
</style>
