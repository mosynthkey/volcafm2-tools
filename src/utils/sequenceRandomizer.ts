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

export const createShiftedStepOrder = (delta: number): number[] => {
    const shift = ((Math.round(delta) % NUM_OF_STEPS) + NUM_OF_STEPS) % NUM_OF_STEPS;
    return Array.from({ length: NUM_OF_STEPS }, (_, step) => (step - shift + NUM_OF_STEPS) % NUM_OF_STEPS);
};

export const createReversedStepOrder = (): number[] =>
    Array.from({ length: NUM_OF_STEPS }, (_, step) => NUM_OF_STEPS - 1 - step);

export type SequenceReorderScope = 'all' | 'notes' | 'motion';

const isActiveAt = (note: SequenceNote, step: number) =>
    note.startStep <= step && note.startStep + note.length > step;

const attrsAt = (notes: SequenceNote[], pitch: number, step: number) => {
    const note = notes.find(candidate => candidate.pitch === pitch && isActiveAt(candidate, step));
    return { velocity: note?.velocity ?? 100, gatePercent: note?.gatePercent ?? 80 };
};

export const reorderSequenceSteps = (
    state: SequenceState,
    order: number[],
    scope: SequenceReorderScope = 'all',
): SequenceState => {
    if (order.length !== NUM_OF_STEPS || new Set(order).size !== NUM_OF_STEPS
        || order.some(step => step < 0 || step >= NUM_OF_STEPS)) {
        throw new Error('Step order must contain each step from 0 to 15 exactly once.');
    }

    const reorderedNotes: SequenceNote[] = [];
    if (scope !== 'motion') {
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
    }

    const reorderFlags = (flags: boolean[]) => order.map(oldStep => flags[oldStep]);
    const reorderMotion = scope !== 'notes';
    const reorderStepFlags = scope === 'all';
    return {
        ...state,
        notes: scope === 'motion' ? state.notes.map(note => ({ ...note })) : reorderedNotes,
        motionEnabled: [...state.motionEnabled],
        motionStepEnabled: reorderMotion
            ? state.motionStepEnabled.map(flags => reorderFlags(flags))
            : state.motionStepEnabled.map(flags => [...flags]),
        motionValues: reorderMotion
            ? state.motionValues.map(values => order.map(oldStep => [...values[oldStep]]))
            : state.motionValues.map(values => values.map(points => [...points])),
        stepOn: reorderStepFlags ? reorderFlags(state.stepOn) : [...state.stepOn],
        activeStep: reorderStepFlags ? reorderFlags(state.activeStep) : [...state.activeStep],
        transposeFuncOn: reorderStepFlags ? reorderFlags(state.transposeFuncOn) : [...state.transposeFuncOn],
        func: { ...state.func },
    };
};
