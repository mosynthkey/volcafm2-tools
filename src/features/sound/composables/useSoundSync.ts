import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useMidiStore } from '@/stores/midiStore';
import { useSoundStore } from '@/stores/soundStore';

export const useSoundSync = () => {
    const midiStore = useMidiStore();
    const soundStore = useSoundStore();
    const currentVoiceRequestPending = ref(true);
    let unsubscribeProgramChange: (() => void) | null = null;

    const sendProgram = () => {
        soundStore.sendToDevice();
    };

    watch(() => midiStore.connectionState, () => {
        if (midiStore.isLibraryReady && currentVoiceRequestPending.value) {
            currentVoiceRequestPending.value = false;
            midiStore.requestCurrentVoiceDump();
        }
    }, { immediate: true });

    onMounted(() => {
        unsubscribeProgramChange = midiStore.onProgramChange(() => {
            if (midiStore.isLibraryReady) {
                currentVoiceRequestPending.value = false;
                midiStore.requestCurrentVoiceDump();
            } else {
                currentVoiceRequestPending.value = true;
            }
        });
    });
    onUnmounted(() => {
        unsubscribeProgramChange?.();
    });

    return { sendProgram };
};
