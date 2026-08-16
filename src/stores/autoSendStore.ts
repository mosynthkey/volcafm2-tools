import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { MIDIConnectionState } from '@/midi/connectionState';
import { useMidiStore } from '@/stores/midiStore';
import { useSequencerStore } from '@/stores/sequencerStore';
import { useSoundStore } from '@/stores/soundStore';
import { useUiStore } from '@/stores/uiStore';

const STORAGE_KEY = 'volca-fm2-auto-send';
const DEBOUNCE_MS = 1000;
const RETRY_MS = 250;

const readEnabled = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) !== '0';
    } catch {
        return true;
    }
};

export const useAutoSendStore = defineStore('autoSend', () => {
    const midi = useMidiStore();
    const sound = useSoundStore();
    const sequence = useSequencerStore();
    const ui = useUiStore();
    const enabled = ref(readEnabled());

    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSentSequence = sequenceSignature();

    function sequenceSignature() {
        const { programNo: _programNo, ...payload } = sequence.toState();
        return JSON.stringify(payload);
    }

    const cancel = () => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
    };

    const midiBusy = () =>
        !midi.isDeviceReady
        || midi.isSearching
        || midi.isFetchingCurrentProgram
        || midi.soundEditState === 'sending'
        || midi.soundEditState === 'requesting'
        || midi.sequenceWriteState === 'sending'
        || midi.programWriteState === 'sending'
        || sequence.sendRetrying
        || midi.connectionState === MIDIConnectionState.RECEIVING
        || sequence.showCaptureDialog;

    const soundDirty = () => sound.hasUnsavedChanges;
    const sequenceDirty = () => sequenceSignature() !== lastSentSequence;
    const hasPending = () => soundDirty() || sequenceDirty();

    const flush = () => {
        timer = null;
        if (!enabled.value || !hasPending()) return;
        if (midiBusy()) {
            schedule(RETRY_MS);
            return;
        }

        const preferSound = ui.activeTab === 'sound-edit';
        if (preferSound && soundDirty()) {
            sound.sendToDevice();
            return;
        }
        if (sequenceDirty()) {
            sequence.sendToDevice();
            return;
        }
        if (soundDirty()) sound.sendToDevice();
    };

    const schedule = (delay = DEBOUNCE_MS) => {
        cancel();
        if (!enabled.value) return;
        timer = setTimeout(flush, delay);
    };

    const queue = () => {
        if (!enabled.value || !hasPending()) {
            if (!hasPending()) cancel();
            return;
        }
        schedule(DEBOUNCE_MS);
    };

    watch(enabled, value => {
        try {
            localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
        } catch {
            /* ignore quota / private mode */
        }
        if (value) queue();
        else cancel();
    });

    watch(() => sound.program, queue, { deep: true, flush: 'post' });
    watch(sequenceSignature, queue, { flush: 'post' });

    watch(() => midi.soundEditState, state => {
        if (state === 'sending') cancel();
        if (state === 'ok') sound.markSaved();
        if (state === 'error') sound.showError = true;
        if (state === 'ok' && enabled.value && hasPending()) schedule(RETRY_MS);
    });

    watch(() => midi.sequenceWriteState, state => {
        if (state === 'sending') cancel();
        if (state === 'ok') lastSentSequence = sequenceSignature();
        if (state === 'ok' && enabled.value && hasPending()) schedule(RETRY_MS);
    });

    watch(() => midi.currentVoiceData, data => {
        if (data) sound.loadFromVoiceData(data);
    });

    return { enabled, queue, cancel };
});
