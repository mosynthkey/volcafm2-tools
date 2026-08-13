import { onMounted, onUnmounted, watch } from 'vue';
import { MIDIConnectionState } from '@/midi/connectionState';
import { useMidiConnectionView } from '@/composables/useMidiConnectionView';
import { useAutoSendStore } from '@/stores/autoSendStore';
import { useMidiStore } from '@/stores/midiStore';
import { useSequencerStore } from '@/stores/sequencerStore';
import { useUiStore } from '@/stores/uiStore';

export const useAppShell = () => {
    const midiStore = useMidiStore();
    const sequencerStore = useSequencerStore();
    const ui = useUiStore();
    useAutoSendStore();
    const connection = useMidiConnectionView();

    let unsubscribeProgramChange: (() => void) | null = null;
    onMounted(() => {
        unsubscribeProgramChange = midiStore.onProgramChange(programNo => {
            sequencerStore.setProgramNo(programNo);
        });
        void midiStore.initMIDI();
    });
    onUnmounted(() => unsubscribeProgramChange?.());

    watch([() => ui.activeTab, () => midiStore.connectionState], ([tab]) => {
        if (tab === 'sequencer' && midiStore.isLibraryReady) {
            void midiStore.requestCurrentVoiceProgramNo();
        }
    });
    watch(() => midiStore.matchedProgramNo, programNo => {
        if (programNo !== null) sequencerStore.setProgramNo(programNo);
    });
    watch(() => midiStore.connectionState, state => {
        if (state === MIDIConnectionState.DETECTED || state === MIDIConnectionState.RECEIVED) {
            ui.connectionModalDismissed = false;
        }
    });

    return { ui, ...connection };
};
