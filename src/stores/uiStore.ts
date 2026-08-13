import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
    const activeTab = ref('sound-edit');
    const sidebarCollapsed = ref(false);
    const showInfo = ref(false);
    const showLog = ref(false);
    const connectionModalDismissed = ref(false);

    return {
        activeTab,
        sidebarCollapsed,
        showInfo,
        showLog,
        connectionModalDismissed,
    };
});
