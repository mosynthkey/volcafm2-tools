<template>
  <v-menu location="top start" offset="6">
    <template #activator="{ props: menuProps }">
      <button v-bind="menuProps" class="locale-switch" type="button"
        :aria-label="t('app.language')" :title="t('app.language')">
        <span class="nav-icon"><Globe :size="18" /></span>
        <span>{{ currentLanguageName }}</span>
      </button>
    </template>
    <v-list class="locale-menu" density="compact">
      <v-list-item v-for="option in languageOptions" :key="option.id"
        :title="option.name" :active="locale === option.id"
        @click="setAppLocale(option.id)" />
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Globe } from '@lucide/vue'
import { setAppLocale, type AppLocale } from '@/i18n'

const { t, locale } = useI18n()
const languageOptions: { id: AppLocale; name: string }[] = [
  { id: 'ja', name: '日本語' },
  { id: 'en', name: 'English' },
]
const currentLanguageName = computed(() =>
  languageOptions.find(option => option.id === locale.value)?.name ?? languageOptions[0].name)
</script>
