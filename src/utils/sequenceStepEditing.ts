import {
    NUM_OF_STEPS, NUM_OF_VOICES_PER_STEP, createSequenceNote,
    type SequenceNote, type SequenceState,
} from '../types/sequence';
import { euclideanHits } from './euclidean';

const isActiveAt = (note: SequenceNote, step: number) =>
    note.startStep <= step && note.startStep + note.length > step;

const toStepPitches = (notes: SequenceNote[]): Array<Set<number>> =>
    Array.from({ length: NUM_OF_STEPS }, (_, step) => new Set(
        notes.filter(note => isActiveAt(note, step)).map(note => note.pitch)
    ));

const attrsAt = (notes: SequenceNote[], pitch: number, step: number) => {
    const note = notes.find(candidate => candidate.pitch === pitch && isActiveAt(candidate, step));
    return { velocity: note?.velocity ?? 100, gatePercent: note?.gatePercent ?? 80 };
};

const fromStepPitches = (
    steps: Array<Set<number>>,
    getAttrs: (pitch: number, startStep: number) => { velocity: number; gatePercent: number },
): SequenceNote[] => {
    const notes: SequenceNote[] = [];
    const pitches = [...new Set(steps.flatMap(step => [...step]))];
    for (const pitch of pitches) {
        let start = -1;
        for (let step = 0; step <= NUM_OF_STEPS; step++) {
            const active = step < NUM_OF_STEPS && steps[step].has(pitch);
            if (active && start < 0) start = step;
            if (!active && start >= 0) {
                const attrs = getAttrs(pitch, start);
                notes.push(createSequenceNote(pitch, start, step - start, attrs.velocity, attrs.gatePercent));
                start = -1;
            }
        }
    }
    return notes;
};

const notesFromSteps = (steps: Array<Set<number>>, source: SequenceNote[]) =>
    fromStepPitches(steps, (pitch, start) => attrsAt(source, pitch, start));

export const clearSequenceStep = (notes: SequenceNote[], step: number): SequenceNote[] => {
    const steps = toStepPitches(notes);
    if (step >= 0 && step < NUM_OF_STEPS) steps[step].clear();
    return notesFromSteps(steps, notes);
};

export const tieSequenceStep = (notes: SequenceNote[], step: number): SequenceNote[] | null => {
    if (step <= 0 || step >= NUM_OF_STEPS) return null;
    const steps = toStepPitches(notes);
    if (steps[step - 1].size === 0) return null;
    steps[step] = new Set(steps[step - 1]);
    return notesFromSteps(steps, notes);
};

export const copySequenceStep = (state: SequenceState, from: number, to: number): SequenceState => {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to
        || from < 0 || to < 0 || from >= NUM_OF_STEPS || to >= NUM_OF_STEPS) {
        return state;
    }

    const steps = toStepPitches(state.notes);
    const sourcePitches = new Set(steps[from]);
    const copiedAttrs = new Map([...sourcePitches].map(pitch => [pitch, attrsAt(state.notes, pitch, from)]));
    steps[to] = new Set(sourcePitches);
    const notes = fromStepPitches(steps, (pitch, start) => (
        start === to && copiedAttrs.has(pitch) ? copiedAttrs.get(pitch)! : attrsAt(state.notes, pitch, start)
    ));

    const copyFlag = (flags: boolean[]) => flags.map((flag, step) => step === to ? flags[from] : flag);
    const activeStep = copyFlag(state.activeStep);
    if (!activeStep.some(Boolean)) activeStep[to] = true;

    return {
        ...state,
        notes,
        motionEnabled: [...state.motionEnabled],
        motionStepEnabled: state.motionStepEnabled.map(flags => copyFlag(flags)),
        motionValues: state.motionValues.map(values => values.map((cell, step) => [...(step === to ? values[from] : cell)])),
        stepOn: copyFlag(state.stepOn),
        activeStep,
        transposeFuncOn: copyFlag(state.transposeFuncOn),
        func: { ...state.func },
    };
};

export const copySequenceStepsEuclid = (
    state: SequenceState,
    from: number,
    pulses: number,
    rotation: number,
): SequenceState => {
    let next = state;
    for (const to of euclideanHits(NUM_OF_STEPS, pulses, rotation)) {
        next = copySequenceStep(next, from, to);
    }
    return next;
};

const occupies = (note: SequenceNote, start: number, end: number) =>
    note.startStep <= end && note.startStep + note.length - 1 >= start;

const voicesAt = (notes: SequenceNote[], step: number) =>
    notes.filter(note => isActiveAt(note, step)).length;

export const copySequenceNoteEuclid = (
    state: SequenceState,
    source: SequenceNote,
    pulses: number,
    rotation: number,
): SequenceState => {
    let notes = [...state.notes];
    for (const target of euclideanHits(NUM_OF_STEPS, pulses, rotation)) {
        if (target === source.startStep) continue;
        const start = target;
        const length = Math.max(1, Math.min(source.length, NUM_OF_STEPS - start));
        const end = start + length - 1;
        const withoutOverlap = notes.filter(note =>
            !(note.pitch === source.pitch && occupies(note, start, end)));
        let canPlace = true;
        for (let step = start; step <= end; step++) {
            if (voicesAt(withoutOverlap, step) >= NUM_OF_VOICES_PER_STEP) {
                canPlace = false;
                break;
            }
        }
        if (!canPlace) continue;
        notes = [
            ...withoutOverlap,
            createSequenceNote(source.pitch, start, length, source.velocity, source.gatePercent),
        ];
    }
    return { ...state, notes };
};
