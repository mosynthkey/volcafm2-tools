<template>
  <v-btn class="dialog-close-button" icon variant="text" size="small" :title="label" :aria-label="label"
    @click="emit('click')">
    <X :size="20" />
  </v-btn>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { X } from '@lucide/vue';

const props = defineProps<{ label?: string }>();
const { t } = useI18n();
const label = props.label ?? t('common.close');
const emit = defineEmits<{ click: [] }>();
</script>
