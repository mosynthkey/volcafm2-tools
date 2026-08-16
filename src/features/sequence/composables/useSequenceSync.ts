import { watch } from 'vue';
import { useMidiStore } from '@/stores/midiStore';
import { useSequencerStore } from '@/stores/sequencerStore';
import { useUiStore } from '@/stores/uiStore';

export const useSequenceSync = () => {
    const midi = useMidiStore();
    const sequence = useSequencerStore();
    const ui = useUiStore();

    watch([() => ui.activeTab, () => midi.isLibraryReady], ([tab, ready]) => {
        if (tab !== 'sequencer' || !ready) return;
        if (sequence.showCaptureDialog) return;
        if (midi.sequenceReadState === 'requesting') return;
        if (sequence.skipNextDeviceLoad) {
            sequence.skipNextDeviceLoad = false;
            return;
        }
        if (sequence.hasUnsavedChanges) return;
        void sequence.requestFromDevice({ silent: true });
    }, { immediate: true });
};
