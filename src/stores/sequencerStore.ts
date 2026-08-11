import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createEmptySequenceState, MOTION_PARAM_COUNT, NUM_OF_STEPS, NUM_OF_VOICES_PER_STEP, type SequenceNote, type SequenceState } from '../types/sequence';
import { encodeCurrentSequenceDump } from '../utils/sequenceCodec';
import { createRandomStepOrder, reorderSequenceSteps } from '../utils/sequenceRandomizer';
import { clearSequenceStep, tieSequenceStep } from '../utils/sequenceStepEditing';

export const useSequencerStore = defineStore('sequencer', () => {
    const initial = createEmptySequenceState();

    const programNo = ref(initial.programNo);
    const velocity = ref(initial.velocity);
    const gatePercent = ref(initial.gatePercent);
    const notes = ref<SequenceNote[]>(initial.notes);
    const motionEnabled = ref<boolean[]>(initial.motionEnabled);
    const motionValues = ref<number[][]>(initial.motionValues);

    const noteAt = (step: number, pitch: number) =>
        notes.value.find(n => n.pitch === pitch && n.startStep <= step && n.startStep + n.length - 1 >= step);

    const stepNoteCount = (step: number) =>
        notes.value.filter(n => n.startStep <= step && n.startStep + n.length - 1 >= step).length;

    const removeNote = (target: SequenceNote) => {
        const idx = notes.value.indexOf(target);
        if (idx >= 0) notes.value.splice(idx, 1);
    };

    /**
     * pitchのstartStep〜startStep+length-1にまたがるノート(=タイで繋いだ和音)を追加する。
     * 同じpitchで範囲が重なる既存ノートは置き換える。範囲内のいずれかのステップで
     * 既に6音(NUM_OF_VOICES_PER_STEP)に達している場合は追加できず false を返す。
     */
    const addNote = (pitch: number, startStep: number, length: number): boolean => {
        const start = Math.max(0, Math.min(NUM_OF_STEPS - 1, startStep));
        const len = Math.max(1, Math.min(NUM_OF_STEPS - start, length));
        const end = start + len - 1;

        const overlappingSamePitch = notes.value.filter(
            n => n.pitch === pitch && n.startStep <= end && n.startStep + n.length - 1 >= start
        );
        const withoutOverlap = notes.value.filter(n => !overlappingSamePitch.includes(n));

        for (let s = start; s <= end; s++) {
            const count = withoutOverlap.filter(n => n.startStep <= s && n.startStep + n.length - 1 >= s).length;
            if (count >= NUM_OF_VOICES_PER_STEP) return false;
        }

        withoutOverlap.push({ pitch, startStep: start, length: len });
        notes.value = withoutOverlap;
        return true;
    };

    const setMotionValue = (paramIndex: number, step: number, value: number) => {
        motionValues.value[paramIndex][step] = Math.max(0, Math.min(127, Math.round(value)));
    };

    const clearAll = () => {
        notes.value = [];
        motionEnabled.value = Array.from({ length: MOTION_PARAM_COUNT }, () => false);
        motionValues.value = Array.from({ length: MOTION_PARAM_COUNT }, () => Array.from({ length: NUM_OF_STEPS }, () => 64));
    };

    const insertRest = (step: number) => {
        notes.value = clearSequenceStep(notes.value, step);
    };

    const insertTie = (step: number): boolean => {
        const tied = tieSequenceStep(notes.value, step);
        if (!tied) return false;
        notes.value = tied;
        return true;
    };

    const loadFromDecoded = (state: SequenceState) => {
        programNo.value = state.programNo;
        velocity.value = state.velocity;
        gatePercent.value = state.gatePercent;
        notes.value = state.notes;
        motionEnabled.value = state.motionEnabled;
        motionValues.value = state.motionValues;
    };

    const randomizeSteps = (random: () => number = Math.random) => {
        const state = reorderSequenceSteps({
            programNo: programNo.value,
            velocity: velocity.value,
            gatePercent: gatePercent.value,
            notes: notes.value,
            motionEnabled: motionEnabled.value,
            motionValues: motionValues.value,
        }, createRandomStepOrder(random));
        loadFromDecoded(state);
    };

    const buildSysEx = (channel = 0) => encodeCurrentSequenceDump({
        programNo: programNo.value,
        velocity: velocity.value,
        gatePercent: gatePercent.value,
        notes: notes.value,
        motionEnabled: motionEnabled.value,
        motionValues: motionValues.value,
    }, channel);

    return {
        programNo,
        velocity,
        gatePercent,
        notes,
        motionEnabled,
        motionValues,
        noteAt,
        stepNoteCount,
        addNote,
        removeNote,
        setMotionValue,
        clearAll,
        insertRest,
        insertTie,
        loadFromDecoded,
        randomizeSteps,
        buildSysEx,
    };
});
