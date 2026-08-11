import { NUM_OF_STEPS, type SequenceNote } from '../types/sequence';

const toStepPitches = (notes: SequenceNote[]): Array<Set<number>> =>
    Array.from({ length: NUM_OF_STEPS }, (_, step) => new Set(
        notes.filter(note => note.startStep <= step && note.startStep + note.length > step)
            .map(note => note.pitch)
    ));

const fromStepPitches = (steps: Array<Set<number>>): SequenceNote[] => {
    const notes: SequenceNote[] = [];
    const pitches = [...new Set(steps.flatMap(step => [...step]))];
    for (const pitch of pitches) {
        let start = -1;
        for (let step = 0; step <= NUM_OF_STEPS; step++) {
            const active = step < NUM_OF_STEPS && steps[step].has(pitch);
            if (active && start < 0) start = step;
            if (!active && start >= 0) {
                notes.push({ pitch, startStep: start, length: step - start });
                start = -1;
            }
        }
    }
    return notes;
};

export const clearSequenceStep = (notes: SequenceNote[], step: number): SequenceNote[] => {
    const steps = toStepPitches(notes);
    if (step >= 0 && step < NUM_OF_STEPS) steps[step].clear();
    return fromStepPitches(steps);
};

export const tieSequenceStep = (notes: SequenceNote[], step: number): SequenceNote[] | null => {
    if (step <= 0 || step >= NUM_OF_STEPS) return null;
    const steps = toStepPitches(notes);
    if (steps[step - 1].size === 0) return null;
    steps[step] = new Set(steps[step - 1]);
    return fromStepPitches(steps);
};
