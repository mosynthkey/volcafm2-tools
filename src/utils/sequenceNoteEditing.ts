import {
    NUM_OF_STEPS, NUM_OF_VOICES_PER_STEP, createSequenceNote,
    type SequenceNote,
} from '../types/sequence';

export type NoteKey = { pitch: number; startStep: number }

export const noteKeyOf = (note: Pick<SequenceNote, 'pitch' | 'startStep'>) =>
    `${note.pitch}:${note.startStep}`;

export const sameNoteKey = (left: NoteKey, right: NoteKey) =>
    left.pitch === right.pitch && left.startStep === right.startStep;

const occupies = (note: SequenceNote, start: number, end: number) =>
    note.startStep <= end && note.startStep + note.length - 1 >= start;

const voicesAt = (notes: SequenceNote[], step: number) =>
    notes.filter(note => note.startStep <= step && note.startStep + note.length > step).length;

const canPlace = (notes: SequenceNote[], start: number, length: number) => {
    const end = start + length - 1;
    for (let step = start; step <= end; step++) {
        if (voicesAt(notes, step) >= NUM_OF_VOICES_PER_STEP) return false;
    }
    return true;
};

const replaceOverlappingPitch = (notes: SequenceNote[], next: SequenceNote) => {
    const end = next.startStep + next.length - 1;
    return notes.filter(note => !(note.pitch === next.pitch && occupies(note, next.startStep, end)));
};

export const notesIntersectingRect = (
    notes: SequenceNote[],
    stepA: number,
    pitchA: number,
    stepB: number,
    pitchB: number,
): SequenceNote[] => {
    const stepMin = Math.min(stepA, stepB);
    const stepMax = Math.max(stepA, stepB);
    const pitchMin = Math.min(pitchA, pitchB);
    const pitchMax = Math.max(pitchA, pitchB);
    return notes.filter(note => {
        const end = note.startStep + note.length - 1;
        return note.pitch >= pitchMin && note.pitch <= pitchMax
            && note.startStep <= stepMax && end >= stepMin;
    });
};

export const resizeSequenceNote = (
    notes: SequenceNote[],
    key: NoteKey,
    newLength: number,
): SequenceNote[] | null => {
    const target = notes.find(note => sameNoteKey(note, key));
    if (!target) return null;
    const length = Math.max(1, Math.min(NUM_OF_STEPS - target.startStep, Math.round(newLength)));
    if (length === target.length) return notes;
    const resized = createSequenceNote(target.pitch, target.startStep, length, target.velocity, target.gatePercent);
    const without = notes.filter(note => note !== target);
    const next = replaceOverlappingPitch(without, resized);
    if (!canPlace(next, resized.startStep, resized.length)) return null;
    return [...next, resized];
};

export const clampedNoteMove = (
    notes: SequenceNote[],
    keys: NoteKey[],
    pitchDelta: number,
    stepDelta: number,
    pitchMin: number,
    pitchMax: number,
) => {
    const keySet = new Set(keys.map(noteKeyOf));
    const moving = notes.filter(note => keySet.has(noteKeyOf(note)));
    if (!moving.length) return { moving, dPitch: 0, dStep: 0 };
    const minStart = Math.min(...moving.map(note => note.startStep));
    const maxEnd = Math.max(...moving.map(note => note.startStep + note.length - 1));
    const minPitch = Math.min(...moving.map(note => note.pitch));
    const maxPitch = Math.max(...moving.map(note => note.pitch));
    return {
        moving,
        dStep: Math.max(-minStart, Math.min(NUM_OF_STEPS - 1 - maxEnd, Math.round(stepDelta))),
        dPitch: Math.max(pitchMin - minPitch, Math.min(pitchMax - maxPitch, Math.round(pitchDelta))),
    };
};

export const moveSequenceNotes = (
    notes: SequenceNote[],
    keys: NoteKey[],
    pitchDelta: number,
    stepDelta: number,
    pitchMin: number,
    pitchMax: number,
): SequenceNote[] | null => {
    if (!keys.length) return notes;
    const { moving, dPitch, dStep } = clampedNoteMove(notes, keys, pitchDelta, stepDelta, pitchMin, pitchMax);
    if (!moving.length) return notes;
    if (!dPitch && !dStep) return notes;

    const keySet = new Set(keys.map(noteKeyOf));
    const staying = notes.filter(note => !keySet.has(noteKeyOf(note)));
    const moved = moving.map(note => createSequenceNote(
        note.pitch + dPitch,
        note.startStep + dStep,
        note.length,
        note.velocity,
        note.gatePercent,
    ));
    let next = staying;
    for (const note of moved) next = replaceOverlappingPitch(next, note);
    for (const note of moved) {
        if (!canPlace(next, note.startStep, note.length)) return null;
        next = [...next, note];
    }
    return next;
};

export const previewMovedNotes = (
    notes: SequenceNote[],
    keys: NoteKey[],
    pitchDelta: number,
    stepDelta: number,
    pitchMin: number,
    pitchMax: number,
): SequenceNote[] => {
    const { moving, dPitch, dStep } = clampedNoteMove(notes, keys, pitchDelta, stepDelta, pitchMin, pitchMax);
    return moving.map(note => createSequenceNote(
        note.pitch + dPitch,
        note.startStep + dStep,
        note.length,
        note.velocity,
        note.gatePercent,
    ));
};
