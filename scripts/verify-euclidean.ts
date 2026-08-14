/**
 * Euclidean rhythm math and Euclid Step Copy paste behavior.
 *
 * 実行: npx tsx scripts/verify-euclidean.ts
 */
import { NUM_OF_STEPS, NUM_OF_VOICES_PER_STEP, createEmptySequenceState, createSequenceNote } from '../src/types/sequence';
import { euclideanHits, euclideanPattern, rotationAligningHitToStep } from '../src/utils/euclidean';
import { copySequenceNoteEuclid, copySequenceStepsEuclid } from '../src/utils/sequenceStepEditing';

let failCount = 0;
const check = (label: string, condition: boolean, detail?: string) => {
    if (condition) {
        console.log(`  OK  ${label}`);
    } else {
        failCount++;
        console.log(`  NG  ${label}${detail ? ` -- ${detail}` : ''}`);
    }
};

const gapsFor = (hits: number[], steps: number) => {
    if (hits.length <= 1) return [];
    return hits.map((hit, index) => {
        const next = hits[(index + 1) % hits.length];
        return (next - hit + steps) % steps || steps;
    });
};

console.log('euclideanHits');
const four = euclideanHits(NUM_OF_STEPS, 4, 0);
check('4 pulses land on 0,4,8,12', JSON.stringify(four) === JSON.stringify([0, 4, 8, 12]), JSON.stringify(four));
check('5 pulses are maximally even', (() => {
    const hits = euclideanHits(NUM_OF_STEPS, 5, 0);
    const gaps = gapsFor(hits, NUM_OF_STEPS);
    return hits.length === 5 && Math.max(...gaps) - Math.min(...gaps) <= 1;
})());
check('1 pulse has a single hit', euclideanHits(NUM_OF_STEPS, 1, 0).length === 1);
check('16 pulses fill every step', euclideanHits(NUM_OF_STEPS, 16, 0).length === NUM_OF_STEPS);
check('0 pulses have no hits', euclideanHits(NUM_OF_STEPS, 0, 0).length === 0);
check('rotation preserves hit count', euclideanHits(NUM_OF_STEPS, 5, 3).length === 5);
check('rotation 0 always includes step 0 when pulses > 0', euclideanHits(NUM_OF_STEPS, 7, 0).includes(0));
check('aligning rotation puts a hit on the source step', (() => {
    const source = 11;
    const rotation = rotationAligningHitToStep(NUM_OF_STEPS, 5, source);
    return euclideanHits(NUM_OF_STEPS, 5, rotation).includes(source);
})());
check('pattern length matches step count', euclideanPattern(NUM_OF_STEPS, 3, 2).length === NUM_OF_STEPS);
check('pattern true-count matches pulses', euclideanPattern(NUM_OF_STEPS, 9, 1).filter(Boolean).length === 9);

console.log('copySequenceStepsEuclid');
const base = createEmptySequenceState();
const stepSource = {
    ...base,
    notes: [createSequenceNote(60, 2, 1, 90, 40), createSequenceNote(64, 7, 2, 100, 80)],
    stepOn: base.stepOn.map((_, step) => step !== 2),
    transposeFuncOn: base.transposeFuncOn.map((_, step) => step === 2),
};
const stepCopied = copySequenceStepsEuclid(stepSource, 2, 4, rotationAligningHitToStep(NUM_OF_STEPS, 4, 2));
const stepHits = new Set(euclideanHits(NUM_OF_STEPS, 4, rotationAligningHitToStep(NUM_OF_STEPS, 4, 2)));
check('step copy pastes source pitches onto every hit', [...stepHits].every(step =>
    stepCopied.notes.some(note => note.pitch === 60 && note.startStep <= step && note.startStep + note.length > step)));
check('step copy skips writing the source onto itself as a no-op path', stepCopied.notes.some(note => note.pitch === 60 && note.startStep === 2));
check('step copy leaves a non-hit step unchanged', !stepHits.has(7)
    && stepCopied.notes.some(note => note.pitch === 64 && note.startStep === 7 && note.length === 2));
check('step copy duplicates Step On / Transpose onto hits', [...stepHits].every(step =>
    stepCopied.stepOn[step] === stepSource.stepOn[2] && stepCopied.transposeFuncOn[step] === stepSource.transposeFuncOn[2]));

console.log('copySequenceNoteEuclid');
const noteSource = {
    ...base,
    notes: [createSequenceNote(67, 0, 2, 110, 55), createSequenceNote(60, 5, 1, 80, 70)],
};
const noteCopied = copySequenceNoteEuclid(noteSource, noteSource.notes[0], 4, 0);
const noteHits = euclideanHits(NUM_OF_STEPS, 4, 0);
const pasted = noteCopied.notes.filter(note => note.pitch === 67);
check('note copy places the note on each non-source hit', noteHits.filter(step => step !== 0).every(step =>
    pasted.some(note => note.startStep === step)));
check('note copy keeps velocity and gate', pasted.every(note => note.velocity === 110 && note.gatePercent === 55));
check('note copy does not stack the same pitch at a hit', noteHits.every(step =>
    pasted.filter(note => note.startStep === step).length <= 1));
check('note copy leaves a different pitch on a non-overlapping step', noteCopied.notes.some(note =>
    note.pitch === 60 && note.startStep === 5));
const clamped = copySequenceNoteEuclid(
    { ...base, notes: [createSequenceNote(72, 0, 4, 100, 80)] },
    createSequenceNote(72, 0, 4, 100, 80),
    4,
    14,
);
check('note copy clamps length so it does not run past step 16', clamped.notes
    .filter(note => note.startStep === 14)
    .every(note => note.length === 2 && note.startStep + note.length <= NUM_OF_STEPS));

const crowded = {
    ...base,
    notes: [
        createSequenceNote(60, 8, 1),
        ...Array.from({ length: NUM_OF_VOICES_PER_STEP }, (_, voiceIndex) =>
            createSequenceNote(70 + voiceIndex, 4, 1)),
    ],
};
const skipped = copySequenceNoteEuclid(crowded, crowded.notes[0], 4, rotationAligningHitToStep(NUM_OF_STEPS, 4, 8));
check('note copy respects 6 voices per step', skipped.notes.filter(note =>
    note.startStep <= 4 && note.startStep + note.length > 4).length === NUM_OF_VOICES_PER_STEP);

console.log('');
if (failCount === 0) {
    console.log('ALL CHECKS PASSED');
    process.exit(0);
} else {
    console.log(`${failCount} CHECK(S) FAILED`);
    process.exit(1);
}
