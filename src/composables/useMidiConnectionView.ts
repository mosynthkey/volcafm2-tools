import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { MIDIConnectionState } from '@/midi/connectionState';
import { useMidiStore } from '@/stores/midiStore';
import { useUiStore } from '@/stores/uiStore';
import { NUM_OF_SEQUENCES } from '@/types/sequence';
import { isDesktopApp } from '@/utils/runtime';

export const useMidiConnectionView = () => {
    const midiStore = useMidiStore();
    const ui = useUiStore();
    const { t } = useI18n();

    const sidebarToggleLabel = computed(() => ui.sidebarCollapsed
        ? t('app.expandSidebar')
        : t('app.collapseSidebar'));
    const connectionTexts = computed(() => ({
        title: midiStore.connectionState === MIDIConnectionState.ERROR
            ? t('app.connection.errorTitle')
            : t('app.connection.title'),
        step1: t('app.connection.step1'),
        step2: t(isDesktopApp ? 'app.connection.step2Desktop' : 'app.connection.step2'),
        step3: t('app.connection.step3'),
        reconnect: t('app.connection.reconnect'),
        retry: t('app.connection.retry'),
        troubleshoot: t('app.connection.troubleshoot'),
    }));
    const showConnectionModal = computed(() =>
        !ui.connectionModalDismissed
        && !midiStore.isDeviceReady
        && !midiStore.autoReloading);
    const onConnectionModalUpdate = (open: boolean) => {
        if (!open) ui.connectionModalDismissed = true;
    };
    const openConnectionRecovery = () => {
        if (!midiStore.isDeviceReady) ui.connectionModalDismissed = false;
    };
    const showProgramLoadModal = computed(() =>
        midiStore.connectionState === MIDIConnectionState.RECEIVING
        && midiStore.currentProgramFetchProgress < 64);
    const programLoadProgress = computed(() => (midiStore.currentProgramFetchProgress / 64) * 100);
    const currentProgramLoadName = computed(() => midiStore.lastReceivedProgram
        ? `#${String(midiStore.lastReceivedProgram.programNo).padStart(2, '0')}  ${midiStore.lastReceivedProgram.name || '---'}`
        : t('app.loadingPrograms.waiting'));
    const showSequenceLoadModal = computed(() => midiStore.fetchingSequenceDumps);
    const sequenceLoadProgress = computed(() =>
        (midiStore.receivedSequenceCount / NUM_OF_SEQUENCES) * 100);
    const sequenceLoadStatus = computed(() =>
        `${midiStore.receivedSequenceCount}/${NUM_OF_SEQUENCES}`);
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
        if (midiStore.isSearching
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
        openConnectionRecovery,
        showProgramLoadModal,
        programLoadProgress,
        currentProgramLoadName,
        showSequenceLoadModal,
        sequenceLoadProgress,
        sequenceLoadStatus,
        connectionLabel,
        connectionTone,
    };
};
