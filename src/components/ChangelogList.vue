<template>
  <section class="changelog-list" :aria-label="t('app.changelogLabel')">
    <h3>{{ t('app.changelogLabel') }}</h3>
    <div class="changelog-list__scroll">
      <ul>
        <li v-for="(item, index) in items" :key="index">{{ item }}</li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, tm } = useI18n()
const items = computed(() => {
  const messages = tm('app.changelog')
  return Array.isArray(messages) ? messages.filter((item): item is string => typeof item === 'string') : []
})
</script>

<style scoped>
.changelog-list { margin-top: 16px; text-align: left; }
.changelog-list h3 {
  margin: 0 0 8px; color: var(--volca-accent); font-size: var(--volca-type-label);
  font-weight: 750; letter-spacing: .06em;
}
.changelog-list__scroll {
  max-height: min(42vh, 280px); overflow-y: auto; padding: 12px 14px;
  border: 1px solid var(--volca-line); border-radius: 8px; background: rgba(20, 15, 16, .28);
  scrollbar-width: thin;
}
.changelog-list ul { margin: 0; padding: 0 0 0 1.2em; }
.changelog-list li {
  margin: 0 0 10px; color: var(--volca-text); font-size: var(--volca-type-body); line-height: 1.55;
}
.changelog-list li:last-child { margin-bottom: 0; }
</style>
