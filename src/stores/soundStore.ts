import { computed, nextTick, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useMidiStore } from '@/stores/midiStore';
import type { SoundOperator, SoundProgram } from '@/types/soundProgram';
import { createInitialSoundProgram, decodeSoundProgram, encodeSoundProgram, normalizeSoundProgramName } from '@/utils/soundProgramCodec';

const HISTORY_LIMIT = 80;
const HISTORY_COMMIT_MS = 320;

export const useSoundStore = defineStore('sound', () => {
    const program = ref(createInitialSoundProgram());
    const loadedSignature = ref<string | null>(null);
    const selectedOperator = ref(-1);
    const showAlgorithmPicker = ref(false);
    const showLibrary = ref(false);
    const showError = ref(false);

    const encodedBytes = () => encodeSoundProgram(program.value);
    const signature = () => Array.from(encodedBytes()).join(',');
    const hasUnsavedChanges = computed(() => loadedSignature.value !== null && signature() !== loadedSignature.value);
    const cloneProgram = (value: SoundProgram) => JSON.parse(JSON.stringify(value)) as SoundProgram;
    const snapshot = () => cloneProgram(program.value);

    const applyProgram = (next: SoundProgram) => {
        program.value = cloneProgram(next);
    };

    const historyPast: SoundProgram[] = [];
    const historyFuture: SoundProgram[] = [];
    const canUndo = ref(false);
    const canRedo = ref(false);
    let historyBaseline = snapshot();
    let applyingHistory = false;
    let historyTimer: ReturnType<typeof setTimeout> | null = null;

    const historySignature = (state: SoundProgram) => JSON.stringify(state);
    const refreshHistoryFlags = () => {
        canUndo.value = historyPast.length > 0 || historySignature(program.value) !== historySignature(historyBaseline);
        canRedo.value = historyFuture.length > 0;
    };
    const applyHistoryState = (state: SoundProgram) => {
        applyingHistory = true;
        applyProgram(state);
        nextTick(() => { applyingHistory = false; });
    };
    const commitHistory = () => {
        if (historyTimer !== null) {
            clearTimeout(historyTimer);
            historyTimer = null;
        }
        if (applyingHistory) return;
        const current = snapshot();
        if (historySignature(current) === historySignature(historyBaseline)) {
            refreshHistoryFlags();
            return;
        }
        historyPast.push(historyBaseline);
        if (historyPast.length > HISTORY_LIMIT) historyPast.shift();
        historyBaseline = current;
        historyFuture.length = 0;
        refreshHistoryFlags();
    };
    const undo = () => {
        if (historyTimer !== null) {
            clearTimeout(historyTimer);
            historyTimer = null;
        }
        const current = snapshot();
        if (historySignature(current) !== historySignature(historyBaseline)) {
            historyFuture.push(current);
            historyBaseline = cloneProgram(historyBaseline);
            applyHistoryState(historyBaseline);
            refreshHistoryFlags();
            return;
        }
        const previous = historyPast.pop();
        if (!previous) return;
        historyFuture.push(historyBaseline);
        historyBaseline = previous;
        applyHistoryState(previous);
        refreshHistoryFlags();
    };
    const redo = () => {
        if (historyTimer !== null) {
            clearTimeout(historyTimer);
            historyTimer = null;
        }
        const next = historyFuture.pop();
        if (!next) return;
        historyPast.push(historyBaseline);
        if (historyPast.length > HISTORY_LIMIT) historyPast.shift();
        historyBaseline = next;
        applyHistoryState(next);
        refreshHistoryFlags();
    };

    watch(program, () => {
        if (applyingHistory) return;
        if (historyTimer !== null) clearTimeout(historyTimer);
        historyTimer = setTimeout(commitHistory, HISTORY_COMMIT_MS);
        refreshHistoryFlags();
    }, { deep: true });

    const loadFromVoiceData = (data: Uint8Array) => {
        program.value = decodeSoundProgram(data);
        loadedSignature.value = signature();
    };

    const loadPreset = (data: SoundProgram) => {
        program.value = cloneProgram(data);
    };

    const markSaved = () => {
        loadedSignature.value = signature();
    };

    const reset = () => {
        program.value = createInitialSoundProgram();
    };

    const encodedForSend = () => {
        program.value.name = normalizeSoundProgramName(program.value.name);
        return encodeSoundProgram(program.value);
    };

    const sendToDevice = () => {
        useMidiStore().sendCurrentVoiceDump(encodedForSend());
    };

    const updateOperator = (payload: { operatorIndex: number; field: keyof SoundOperator; value: number; arrayIndex?: number }) => {
        const operator = program.value.operators[payload.operatorIndex];
        if (payload.arrayIndex !== undefined) {
            (operator[payload.field] as number[])[payload.arrayIndex] = payload.value;
        } else {
            (operator[payload.field] as number) = payload.value;
        }
    };

    const selectOperator = (index: number) => {
        selectedOperator.value = index;
    };

    const toggleOperator = (index: number) => {
        selectedOperator.value = selectedOperator.value === index ? -1 : index;
    };

    const clearOperatorSelection = () => {
        selectedOperator.value = -1;
    };

    const pickAlgorithm = (algorithm: number) => {
        program.value.algorithm = algorithm;
        showAlgorithmPicker.value = false;
    };

    return {
        program,
        hasUnsavedChanges,
        selectedOperator,
        showAlgorithmPicker,
        showLibrary,
        showError,
        loadFromVoiceData,
        loadPreset,
        markSaved,
        reset,
        snapshot,
        encodedForSend,
        sendToDevice,
        updateOperator,
        selectOperator,
        toggleOperator,
        clearOperatorSelection,
        pickAlgorithm,
        canUndo,
        canRedo,
        undo,
        redo,
    };
});
