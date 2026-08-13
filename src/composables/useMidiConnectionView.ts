import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { MIDIConnectionState } from '@/midi/connectionState';
import { useMidiStore } from '@/stores/midiStore';
import { useUiStore } from '@/stores/uiStore';

export const useMidiConnectionView = () => {
    const midiStore = useMidiStore();
    const ui = useUiStore();
    const { t } = useI18n();

    const sidebarToggleLabel = computed(() => ui.sidebarCollapsed
        ? t('app.expandSidebar')
        : t('app.collapseSidebar'));
    const connectionTexts = computed(() => ({
        title: t('app.connection.title'),
        step1: t('app.connection.step1'),
        step2: t('app.connection.step2'),
        step3: t('app.connection.step3'),
        retry: t('app.connection.retry'),
    }));
    const showConnectionModal = computed(() => !ui.connectionModalDismissed && !midiStore.isDeviceReady);
    const onConnectionModalUpdate = (open: boolean) => {
        if (!open) ui.connectionModalDismissed = true;
    };
    const showProgramLoadModal = computed(() =>
        midiStore.connectionState === MIDIConnectionState.RECEIVING
        && midiStore.currentProgramFetchProgress < 64);
    const programLoadProgress = computed(() => (midiStore.currentProgramFetchProgress / 64) * 100);
    const currentProgramLoadName = computed(() => midiStore.lastReceivedProgram
        ? `#${String(midiStore.lastReceivedProgram.programNo).padStart(2, '0')}  ${midiStore.lastReceivedProgram.name || '---'}`
        : t('app.loadingPrograms.waiting'));
    const connectionLabel = computed(() => t({
        [MIDIConnectionState.INITIALIZING]: 'app.connection.initializing',
        [MIDIConnectionState.SEARCHING]: 'app.connection.searching',
        [MIDIConnectionState.NOT_FOUND]: 'app.connection.disconnected',
        [MIDIConnectionState.DETECTED]: 'app.connection.connected',
        [MIDIConnectionState.RECEIVING]: 'app.connection.receiving',
        [MIDIConnectionState.RECEIVED]: 'app.connection.connected',
        [MIDIConnectionState.ERROR]: 'app.connection.error',
    }[midiStore.connectionState]));
    const connectionTone = computed(() => {
        if (midiStore.isIdleConnected) return 'connected';
        if (midiStore.connectionState === MIDIConnectionState.SEARCHING
            || midiStore.connectionState === MIDIConnectionState.RECEIVING) return 'busy';
        if (midiStore.connectionState === MIDIConnectionState.ERROR) return 'error';
        return 'idle';
    });

    return {
        midiStore,
        sidebarToggleLabel,
        connectionTexts,
        showConnectionModal,
        onConnectionModalUpdate,
        showProgramLoadModal,
        programLoadProgress,
        currentProgramLoadName,
        connectionLabel,
        connectionTone,
    };
};
