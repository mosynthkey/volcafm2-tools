<template>
  <div class="envelope-frame" :class="{ compact }">
    <slot />
    <button type="button" class="envelope-menu" :title="t('common.more')" :aria-label="t('common.more')"
      :aria-expanded="menuOpen" @click.stop="toggleMenu">
      <MoreHorizontal :size="compact ? 14 : 16" />
    </button>
  </div>
  <Teleport to="body">
    <div v-if="menuOpen" class="envelope-menu-layer" @pointerdown="menuOpen = false">
      <div class="envelope-menu-list" :style="menuStyle" role="menu" @pointerdown.stop>
        <button type="button" role="menuitem" @click="copyEnvelope">{{ t('sound.copyEnvelope') }}</button>
        <button type="button" role="menuitem" :disabled="!sound.envelopeClipboard" @click="pasteEnvelope">
          {{ t('sound.pasteEnvelope') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { MoreHorizontal } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { useSoundStore } from '@/stores/soundStore';

const props = defineProps<{
  rates: number[]
  levels: number[]
  compact?: boolean
}>();
const emit = defineEmits<{ apply: [rates: number[], levels: number[]] }>();
const { t } = useI18n();
const sound = useSoundStore();
const menuOpen = ref(false);
const menuStyle = ref<Record<string, string>>({});
const toggleMenu = (event: MouseEvent) => {
  const button = event.currentTarget as HTMLElement;
  const rect = button.getBoundingClientRect();
  const width = 168;
  const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
  const top = Math.min(rect.bottom + 4, window.innerHeight - 96);
  menuStyle.value = { left: `${left}px`, top: `${top}px` };
  menuOpen.value = !menuOpen.value;
  if (menuOpen.value) nextTick(() => document.querySelector<HTMLButtonElement>('.envelope-menu-list button')?.focus());
};
const copyEnvelope = () => {
  sound.copyEnvelope(props.rates, props.levels);
  menuOpen.value = false;
};
const pasteEnvelope = () => {
  const clip = sound.envelopeClipboard;
  menuOpen.value = false;
  if (!clip) return;
  emit('apply', clip.rates, clip.levels);
};
</script>

<style scoped>
.envelope-frame { position: relative; display: grid; min-width: 0; }
.envelope-frame > :first-child { min-width: 0; }
.envelope-menu {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: rgba(37, 28, 30, .82);
  color: #ad9e96;
  cursor: pointer;
}
.envelope-frame.compact .envelope-menu { top: 2px; right: 2px; width: 22px; height: 22px; border-radius: 5px; }
.envelope-menu:hover { background: rgba(48, 36, 38, .96); color: #f1e9e1; }
.envelope-menu:focus-visible { outline: 2px solid #e1cab0; outline-offset: 1px; }
</style>

<style>
.envelope-menu-layer { position: fixed; inset: 0; z-index: 4000; }
.envelope-menu-list {
  position: fixed;
  min-width: 160px;
  padding: 4px;
  border: 1px solid rgba(206, 179, 147, 0.28);
  border-radius: 10px;
  background: #2b2022;
  box-shadow: 0 16px 40px rgba(10, 5, 6, 0.45);
}
.envelope-menu-list button {
  display: block;
  width: 100%;
  margin: 0;
  padding: 10px 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--volca-text);
  font: inherit;
  font-size: var(--volca-type-body);
  font-weight: 650;
  text-align: left;
  cursor: pointer;
}
.envelope-menu-list button:hover:not(:disabled) { background: rgba(206, 179, 147, 0.14); }
.envelope-menu-list button:disabled { color: #8f817a; cursor: default; }
.envelope-menu-list button:focus-visible { outline: 2px solid var(--volca-accent); outline-offset: 1px; }
</style>
