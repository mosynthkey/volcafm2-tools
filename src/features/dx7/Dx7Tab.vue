<template>
  <v-container>
    <div v-if="midiStore.isDeviceReady">
      <v-card v-for="(cartridge, index) in 2" :key="index" class="mb-4 pa-4" style="margin: 0 auto;">
        <v-row align="center">
          <v-col>
            <v-card-title>{{ t('dx7.cartridge', { count: index + 1 }) }}</v-card-title>
          </v-col>
          <v-col class="text-right">
            <v-btn @click="downloadCartridge(index)"
              :disabled="!midiStore.isLibraryReady"
              :class="{ dimmed: !midiStore.isLibraryReady }">
              {{ t('dx7.download') }}
              <Download :size="16" class="ml-1" />
            </v-btn>
          </v-col>
        </v-row>
        <v-divider class="my-4" />
        <v-row v-for="row in 4" :key="row">
          <v-col v-for="col in 8" :key="col" class="text-left"
            :class="{ 'dimmed-text': !midiStore.programNames[(index * 32) + (row - 1) * 8 + (col - 1)]?.name }">
            {{ (index * 32) + (row - 1) * 8 + (col - 1) }}:<br>
            {{ midiStore.programNames[(index * 32) + (row - 1) * 8 + (col - 1)]?.name || '-' }}
          </v-col>
        </v-row>
      </v-card>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useMidiStore } from '@/stores/midiStore';
import { useUiStore } from '@/stores/uiStore';
import { downloadBinary } from '@/utils/downloadBinary';
import { Download } from '@lucide/vue';
import { useI18n } from 'vue-i18n';

const midiStore = useMidiStore();
const ui = useUiStore();
const { t } = useI18n();

watch([() => ui.activeTab, () => midiStore.isDeviceReady], ([tab, ready]) => {
  if (tab === 'dx7' && ready) void midiStore.reloadAllProgramDumps();
}, { immediate: true });
const downloadCartridge = (index: number) => {
  const bank = index === 0 ? 0 : 1;
  downloadBinary(midiStore.dx7CartridgeBytes(bank), `volca_fm2_dx7_cartridge_${index + 1}.syx`);
};
</script>

<style scoped>
.v-btn.dimmed {
  opacity: 0.5;
  pointer-events: none;
}

.mb-4 {
  margin-bottom: 16px;
}

.pa-4 {
  padding: 16px;
}

.dimmed-text {
  opacity: 0.5;
}
</style>
