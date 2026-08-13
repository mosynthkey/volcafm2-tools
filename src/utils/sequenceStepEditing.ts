import { NUM_OF_STEPS, createSequenceNote, type SequenceNote } from '../types/sequence';

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

const fromStepPitches = (steps: Array<Set<number>>, source: SequenceNote[]): SequenceNote[] => {
    const notes: SequenceNote[] = [];
    const pitches = [...new Set(steps.flatMap(step => [...step]))];
    for (const pitch of pitches) {
        let start = -1;
        for (let step = 0; step <= NUM_OF_STEPS; step++) {
            const active = step < NUM_OF_STEPS && steps[step].has(pitch);
            if (active && start < 0) start = step;
            if (!active && start >= 0) {
                const attrs = attrsAt(source, pitch, start);
                notes.push(createSequenceNote(pitch, start, step - start, attrs.velocity, attrs.gatePercent));
                start = -1;
            }
        }
    }
    return notes;
};

export const clearSequenceStep = (notes: SequenceNote[], step: number): SequenceNote[] => {
    const steps = toStepPitches(notes);
    if (step >= 0 && step < NUM_OF_STEPS) steps[step].clear();
    return fromStepPitches(steps, notes);
};

export const tieSequenceStep = (notes: SequenceNote[], step: number): SequenceNote[] | null => {
    if (step <= 0 || step >= NUM_OF_STEPS) return null;
    const steps = toStepPitches(notes);
    if (steps[step - 1].size === 0) return null;
    steps[step] = new Set(steps[step - 1]);
    return fromStepPitches(steps, notes);
};
