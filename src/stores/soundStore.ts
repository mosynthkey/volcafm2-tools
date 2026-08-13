import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useMidiStore } from '@/stores/midiStore';
import type { SoundOperator, SoundProgram } from '@/types/soundProgram';
import { createInitialSoundProgram, decodeSoundProgram, encodeSoundProgram, normalizeSoundProgramName } from '@/utils/soundProgramCodec';

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

    const loadFromVoiceData = (data: Uint8Array) => {
        program.value = decodeSoundProgram(data);
        loadedSignature.value = signature();
    };

    const loadPreset = (data: SoundProgram) => {
        program.value = data;
    };

    const markSaved = () => {
        loadedSignature.value = signature();
    };

    const reset = () => {
        program.value = createInitialSoundProgram();
    };

    const snapshot = () => JSON.parse(JSON.stringify(program.value)) as SoundProgram;

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
    };
});
