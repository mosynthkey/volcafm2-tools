<template>
  <button class="app-toggle" type="button" role="switch" :aria-checked="modelValue"
    :aria-label="ariaLabel ?? t('common.toggle')" :disabled="disabled" :class="{ on: modelValue }"
    @click="$emit('update:modelValue', !modelValue)">
    <span class="app-toggle__state">{{ modelValue ? t('common.on') : t('common.off') }}</span>
    <span class="app-toggle__thumb" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
withDefaults(defineProps<{ modelValue: boolean; ariaLabel?: string; disabled?: boolean }>(), {
  ariaLabel: undefined, disabled: false,
});
defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<style scoped>
.app-toggle { position: relative; width: 50px; height: 50px; min-width: 50px; min-height: 50px; max-width: 50px; max-height: 50px; align-self: center; flex: 0 0 50px; padding: 0; border: 0; border-radius: 9px; background: transparent; color: #ad9e96; cursor: pointer; }
.app-toggle::before { position: absolute; inset: 8px 0; border: 1px solid rgba(206,179,147,.3); border-radius: 9px; background: #251c1e; content: ''; transition: background .16s ease, border-color .16s ease; }
.app-toggle:hover::before { border-color: rgba(206,179,147,.65); }
.app-toggle:focus-visible { outline: 2px solid #ceb393; outline-offset: 2px; }
.app-toggle:disabled { opacity: .42; cursor: not-allowed; }
.app-toggle__state { position: absolute; top: 50%; right: 5px; transform: translateY(-50%); font-size: 11px; font-weight: 800; line-height: 1; }
.app-toggle__thumb { position: absolute; top: 16px; left: 4px; width: 18px; height: 18px; border-radius: 5px; background: #817174; box-shadow: 0 2px 5px rgba(0,0,0,.32); transition: transform .18s cubic-bezier(.2,.8,.2,1), background .16s ease; }
.app-toggle.on { color: #f1e9e1; }
.app-toggle.on::before { border-color: #ceb393; background: rgba(206,179,147,.18); }
.app-toggle.on .app-toggle__state { right: auto; left: 5px; }
.app-toggle.on .app-toggle__thumb { transform: translateX(24px); background: #e1cab0; }
</style>
