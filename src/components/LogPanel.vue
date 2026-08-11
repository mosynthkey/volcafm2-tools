<template>
  <div class="log-panel" :class="{ collapsed: !expanded }">
    <div class="log-panel-header" @click="expanded = !expanded">
      <v-icon size="small" class="mr-2">{{ expanded ? 'mdi-chevron-down' : 'mdi-chevron-up' }}</v-icon>
      <span class="log-title">{{ texts.title }} ({{ midiStore.logs.length }})</span>
      <v-spacer />
      <v-btn size="small" variant="text" @click.stop="midiStore.clearLogs">{{ texts.clear }}</v-btn>
    </div>
    <textarea v-if="expanded" ref="logBoxRef" class="log-box" readonly :value="logText"></textarea>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useMidiStore } from '@/stores/midiStore';

const midiStore = useMidiStore();
const expanded = ref(true);
const logBoxRef = ref<HTMLTextAreaElement | null>(null);

const logText = computed(() => midiStore.logs.join('\n'));

watch(logText, () => {
  nextTick(() => {
    if (logBoxRef.value) {
      logBoxRef.value.scrollTop = logBoxRef.value.scrollHeight;
    }
  });
});

const userLanguage = navigator.language.startsWith('ja') ? 'ja' : 'en';
const TEXTS = {
  ja: { title: 'ログ', clear: 'クリア' },
  en: { title: 'Log', clear: 'Clear' },
};
const texts = computed(() => TEXTS[userLanguage]);
</script>

<style scoped>
.log-panel {
  flex: 0 0 auto;
  border-top: 1px solid var(--volca-line, #55454780);
  background: rgba(35, 26, 28, 0.94);
  backdrop-filter: blur(18px);
}

.log-panel-header {
  display: flex;
  align-items: center;
  min-height: 35px;
  padding: 5px 15px;
  cursor: pointer;
  color: var(--volca-muted, #CEB393);
  font-size: var(--volca-type-body);
  user-select: none;
}

.log-title {
  color: var(--volca-text, #CEB393);
  font-weight: 650;
}

.log-box {
  width: 100%;
  height: 150px;
  box-sizing: border-box;
  resize: vertical;
  background: rgba(18, 13, 14, 0.88);
  color: #9fd18c;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--volca-type-body);
  line-height: 1.5;
  padding: 10px 14px;
  border: none;
  outline: none;
  white-space: pre;
}

@media (prefers-reduced-transparency: reduce) {
  .log-panel { backdrop-filter: none; background: #2a2021; }
}
</style>
