import {
    NUM_OF_STEPS, createSequenceNote, type SequenceNote, type SequenceState,
} from '../types/sequence';

export const createRandomStepOrder = (random: () => number = Math.random): number[] => {
    const order = Array.from({ length: NUM_OF_STEPS }, (_, step) => step);
    for (let index = order.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(random() * (index + 1));
        [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
    }
    return order;
};

const isActiveAt = (note: SequenceNote, step: number) =>
    note.startStep <= step && note.startStep + note.length > step;

const attrsAt = (notes: SequenceNote[], pitch: number, step: number) => {
    const note = notes.find(candidate => candidate.pitch === pitch && isActiveAt(candidate, step));
    return { velocity: note?.velocity ?? 100, gatePercent: note?.gatePercent ?? 80 };
};

export const reorderSequenceSteps = (state: SequenceState, order: number[]): SequenceState => {
    if (order.length !== NUM_OF_STEPS || new Set(order).size !== NUM_OF_STEPS
        || order.some(step => step < 0 || step >= NUM_OF_STEPS)) {
        throw new Error('Step order must contain each step from 0 to 15 exactly once.');
    }

    const reorderedNotes: SequenceNote[] = [];
    const pitches = [...new Set(state.notes.map(note => note.pitch))];
    for (const pitch of pitches) {
        let runStart = -1;
        for (let newStep = 0; newStep <= NUM_OF_STEPS; newStep++) {
            const active = newStep < NUM_OF_STEPS
                && state.notes.some(note => note.pitch === pitch && isActiveAt(note, order[newStep]));
            if (active && runStart < 0) runStart = newStep;
            if (!active && runStart >= 0) {
                const attrs = attrsAt(state.notes, pitch, order[runStart]);
                reorderedNotes.push(createSequenceNote(pitch, runStart, newStep - runStart, attrs.velocity, attrs.gatePercent));
                runStart = -1;
            }
        }
    }

    const reorderFlags = (flags: boolean[]) => order.map(oldStep => flags[oldStep]);
    return {
        ...state,
        notes: reorderedNotes,
        motionEnabled: [...state.motionEnabled],
        motionStepEnabled: state.motionStepEnabled.map(flags => reorderFlags(flags)),
        motionValues: state.motionValues.map(values => order.map(oldStep => [...values[oldStep]])),
        stepOn: reorderFlags(state.stepOn),
        activeStep: reorderFlags(state.activeStep),
        transposeFuncOn: reorderFlags(state.transposeFuncOn),
        func: { ...state.func },
    };
};
