<template>
  <button class="app-toggle" type="button" role="switch" :aria-checked="modelValue"
    :aria-label="ariaLabel" :disabled="disabled" :class="{ on: modelValue }"
    @click="$emit('update:modelValue', !modelValue)">
    <span class="app-toggle__state">{{ modelValue ? 'ON' : 'OFF' }}</span>
    <span class="app-toggle__thumb" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ modelValue: boolean; ariaLabel?: string; disabled?: boolean }>(), {
  ariaLabel: 'Toggle', disabled: false,
});
defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<style scoped>
.app-toggle { position: relative; width: 70px; height: 34px; flex: 0 0 70px; padding: 0; border: 1px solid rgba(206,179,147,.3); border-radius: 9px; background: #251c1e; color: #ad9e96; cursor: pointer; transition: background .16s ease, border-color .16s ease, color .16s ease; }
.app-toggle:hover { border-color: rgba(206,179,147,.65); }
.app-toggle:focus-visible { outline: 2px solid #ceb393; outline-offset: 2px; }
.app-toggle:disabled { opacity: .42; cursor: not-allowed; }
.app-toggle__state { position: absolute; top: 50%; right: 8px; transform: translateY(-50%); font-size: var(--volca-type-label); font-weight: 800; line-height: 1; }
.app-toggle__thumb { position: absolute; top: 5px; left: 5px; width: 22px; height: 22px; border-radius: 6px; background: #817174; box-shadow: 0 2px 5px rgba(0,0,0,.32); transition: transform .18s cubic-bezier(.2,.8,.2,1), background .16s ease; }
.app-toggle.on { border-color: #ceb393; background: rgba(206,179,147,.18); color: #f1e9e1; }
.app-toggle.on .app-toggle__state { right: auto; left: 8px; }
.app-toggle.on .app-toggle__thumb { transform: translateX(37px); background: #e1cab0; }
</style>
