import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { LibraryKind } from '@/utils/libraryFormat';
import { markPageHintSeen, PAGE_HINT_BY_TAB, type PageHintId } from '@/utils/pageHint';

export const useUiStore = defineStore('ui', () => {
    const activeTab = ref('sound-edit');
    const sidebarCollapsed = ref(false);
    const showInfo = ref(false);
    const showLog = ref(false);
    const connectionModalDismissed = ref(false);
    const showLibrary = ref(false);
    const libraryFocus = ref<LibraryKind>('sound');
    const showPageHint = ref(false);
    const pageHintId = ref<PageHintId>('sound');

    const openLibrary = (kind: LibraryKind) => {
        libraryFocus.value = kind;
        showLibrary.value = true;
    };

    const openPageHint = (id?: PageHintId) => {
        pageHintId.value = id ?? PAGE_HINT_BY_TAB[activeTab.value] ?? 'sound';
        showPageHint.value = true;
    };

    const dismissPageHint = () => {
        markPageHintSeen(pageHintId.value);
        showPageHint.value = false;
    };

    return {
        activeTab,
        sidebarCollapsed,
        showInfo,
        showLog,
        connectionModalDismissed,
        showLibrary,
        libraryFocus,
        openLibrary,
        showPageHint,
        pageHintId,
        openPageHint,
        dismissPageHint,
    };
});
