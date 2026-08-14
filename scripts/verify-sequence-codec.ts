/**
 * SEQUENCE DATA (TABLE 3) の SysEx エンコード/デコードを、実機を使わずに検証するツール。
 *
 * 「書き込んで読み込んで、ちゃんと書き込めているか確認する」ためのループバックテスト:
 *   1. 適当なシーケンス状態を作る
 *   2. encodeCurrentSequenceDump() でvolca fm2に送るのと同じSysExバイト列を作る (書き込み)
 *   3. 受信時と全く同じ経路 (7bit->8bit unpack -> decodeSequenceData) で読み戻す (読み込み)
 *   4. 元の状態と一致するか比較する
 *
 * 実行: npx tsx scripts/verify-sequence-codec.ts
 */
import {
    buildSequenceDataBytes,
    decodeSequenceData,
    encodeCurrentSequenceDump,
    pack8to7,
    unpack7to8,
} from '../src/utils/sequenceCodec';
import { MOTION_PARAM_COUNT, NUM_OF_STEPS, createEmptySequenceState, createMotionPoints, createSequenceNote, type SequenceNote, type SequenceState } from '../src/types/sequence';
import { createReversedStepOrder, createShiftedStepOrder, reorderSequenceSteps } from '../src/utils/sequenceRandomizer';
import { clearSequenceStep, copySequenceStep, tieSequenceStep } from '../src/utils/sequenceStepEditing';
import { moveSequenceNotes, notesIntersectingRect, resizeSequenceNote } from '../src/utils/sequenceNoteEditing';
import { createMotionPattern } from '../src/utils/motionPatterns';

let failCount = 0;

const check = (label: string, condition: boolean, detail?: string) => {
    if (condition) {
        console.log(`  OK  ${label}`);
    } else {
        failCount++;
        console.log(`  NG  ${label}${detail ? ` -- ${detail}` : ''}`);
    }
};

// ---------------------------------------------------------------------------
// 1) pack8to7 / unpack7to8 のバイト単位ラウンドトリップ (端数グループを含む複数サイズ)
// ---------------------------------------------------------------------------
console.log('[1] pack8to7 / unpack7to8 round-trip');
for (const size of [1, 6, 7, 8, 13, 128, 140, 1920]) {
    const original = new Uint8Array(size).map((_, i) => (i * 37 + 5) & 0xff);
    const packed = pack8to7(original);
    const restored = unpack7to8(packed, size);
    const identical = original.length === restored.length && original.every((b, i) => b === restored[i]);
    check(`size=${size} (packed=${packed.length} bytes)`, identical);
}

// ---------------------------------------------------------------------------
// 2) SysExヘッダ/フッタと固定バイトの検証
// ---------------------------------------------------------------------------
console.log('[2] SEQUENCE DATA header/footer bytes');
const sampleState: SequenceState = {
    ...createEmptySequenceState(),
    programNo: 12,
    velocity: 110,
    gatePercent: 80,
    notes: [
        createSequenceNote(60, 0, 4, 110, 80),
        createSequenceNote(64, 0, 4, 100, 70),
        createSequenceNote(67, 0, 4, 90, 60),
        createSequenceNote(72, 4, 1, 120, 50),
        createSequenceNote(65, 8, 2, 85, 40),
        createSequenceNote(60, 12, 1, 75, 30),
    ],
    motionEnabled: Array.from({ length: MOTION_PARAM_COUNT }, (_, i) => i === 2 || i === 7),
    motionStepEnabled: Array.from({ length: MOTION_PARAM_COUNT }, (_, p) =>
        Array.from({ length: NUM_OF_STEPS }, (_, s) => p !== 2 || s !== 3)
    ),
    motionValues: Array.from({ length: MOTION_PARAM_COUNT }, (_, p) =>
        Array.from({ length: NUM_OF_STEPS }, (_, s) => createMotionPoints(p === 2 ? s * 8 : 127 - s * 8).map((value, point) => Math.min(127, value + point)))
    ),
    stepOn: Array.from({ length: NUM_OF_STEPS }, (_, step) => step !== 5),
    activeStep: Array.from({ length: NUM_OF_STEPS }, (_, step) => step !== 15),
    transposeFuncOn: Array.from({ length: NUM_OF_STEPS }, (_, step) => step === 0 || step === 8),
    func: {
        motionOn: true,
        motionSmooth: true,
        warpActiveStep: true,
        tempo: 2,
        voiceMono: true,
        voiceUnison: false,
        chorus: true,
        arp: true,
        transposeNote: true,
        reverb: true,
        arpType: 3,
        arpDiv: 6,
        chorusDepth: 40,
        reverbDepth: 80,
    },
};

const seqBytes = buildSequenceDataBytes(sampleState);
check('length === 1920', seqBytes.length === 1920, `actual=${seqBytes.length}`);
check("header 'PTST'", String.fromCharCode(...seqBytes.slice(0, 4)) === 'PTST');
check('devCode === 0x4ee8 (LE: E8,4E)', seqBytes[4] === 0xe8 && seqBytes[5] === 0x4e);
check("footer 'PTED'", String.fromCharCode(...seqBytes.slice(1916, 1920)) === 'PTED');
check('programNo byte (offset 9)', seqBytes[9] === sampleState.programNo);
check('FUNC MOTION on (offset 68 bit0)', (seqBytes[68] & 0x01) === 1);
check('FUNC SMOOTH / WARP / TEMPO / MONO / CHORUS', seqBytes[68] === (0x01 | 0x02 | 0x04 | (2 << 3) | 0x20 | 0x80));
check('FUNC ARP / TRANSPOSE NOTE / REVERB', seqBytes[69] === (0x01 | 0x02 | 0x04));
check('ARP TYPE / DIV / depths', seqBytes[70] === 3 && seqBytes[71] === 6 && seqBytes[72] === 40 && seqBytes[73] === 80);
check('STEP 6 muted', (seqBytes[6] & (1 << 5)) === 0);
check('STEP 16 not active', (seqBytes[13] & 0x80) === 0);
check('transpose func on steps 1 and 9', seqBytes[1872] === 1 && seqBytes[1880] === 1);

// ---------------------------------------------------------------------------
// 3) SysExメッセージ全体 (送信フォーマット) の検証
// ---------------------------------------------------------------------------
console.log('[3] Full SysEx dump message (Func 0x40)');
const sysex = encodeCurrentSequenceDump(sampleState, 0);
check('starts with F0,42,30,00,01,2F,40', [0xf0, 0x42, 0x30, 0x00, 0x01, 0x2f, 0x40].every((b, i) => sysex[i] === b));
check('ends with F7', sysex[sysex.length - 1] === 0xf7);
const expectedPackedLen = 1920 + Math.ceil(1920 / 7); // ヘッダバイトの分だけ増える
check(
    'total length = header(7) + packed + F7(1)',
    sysex.length === 7 + expectedPackedLen + 1,
    `actual=${sysex.length}, expected=${7 + expectedPackedLen + 1}`
);

// ---------------------------------------------------------------------------
// 4) 受信経路と同じ手順でデコードし、書き込んだ内容が読み込めるか確認
//    (volca fm2からのCURRENT SEQUENCE DATA DUMP受信処理: midiStore.ts の isVolcaFM2SequenceDump 側と同じ)
// ---------------------------------------------------------------------------
console.log('[4] Write -> read-back comparison (decode path used by midiStore.ts on receive)');
const packedFromSysex = sysex.slice(7, -1);
const decodedSeqBytes = unpack7to8(packedFromSysex, 1920);
check('decoded 1920-byte buffer === original buffer', decodedSeqBytes.every((b, i) => b === seqBytes[i]));

const decodedState = decodeSequenceData(decodedSeqBytes);
check('programNo round-trips', decodedState.programNo === sampleState.programNo);

const sortNotes = (notes: SequenceNote[]) =>
    [...notes].sort((a, b) => a.pitch - b.pitch || a.startStep - b.startStep);
const a = sortNotes(sampleState.notes);
const b = sortNotes(decodedState.notes);
check(
    'notes round-trip (incl. tied multi-step chords, velocity, gate)',
    a.length === b.length && a.every((n, i) => n.pitch === b[i].pitch && n.startStep === b[i].startStep && n.length === b[i].length && n.velocity === b[i].velocity && n.gatePercent === b[i].gatePercent),
    `sent=${JSON.stringify(a)} got=${JSON.stringify(b)}`
);
check(
    'motionEnabled round-trips',
    sampleState.motionEnabled.every((v, i) => v === decodedState.motionEnabled[i])
);
check(
    'motion step enable round-trips',
    sampleState.motionStepEnabled.every((flags, p) => flags.every((on, s) => on === decodedState.motionStepEnabled[p][s]))
);
check(
    'motionValues round-trip 5-point data',
    sampleState.motionValues.every((rows, p) =>
        rows.every((points, s) => points.every((value, point) => value === decodedState.motionValues[p][s][point]))
    )
);
check('step on / active step / transpose func round-trip',
    sampleState.stepOn.every((on, step) => on === decodedState.stepOn[step])
    && sampleState.activeStep.every((on, step) => on === decodedState.activeStep[step])
    && sampleState.transposeFuncOn.every((on, step) => on === decodedState.transposeFuncOn[step])
);
check('FUNC fields round-trip', JSON.stringify(decodedState.func) === JSON.stringify(sampleState.func));

// ---------------------------------------------------------------------------
// 5) ステップ並べ替え: ノート/タイとモーションが同じ順列で移動すること
// ---------------------------------------------------------------------------
console.log('[5] Step reorder');
const reversedOrder = createReversedStepOrder();
const reordered = reorderSequenceSteps(sampleState, reversedOrder);
const activePitches = (state: SequenceState, step: number) => state.notes
    .filter(note => note.startStep <= step && note.startStep + note.length > step)
    .map(note => note.pitch).sort((left, right) => left - right);
check(
    'notes follow the step permutation',
    reversedOrder.every((oldStep, newStep) => JSON.stringify(activePitches(reordered, newStep)) === JSON.stringify(activePitches(sampleState, oldStep)))
);
check(
    'motion values follow the step permutation',
    reordered.motionValues.every((values, parameter) => values.every((points, step) =>
        points.every((value, point) => value === sampleState.motionValues[parameter][reversedOrder[step]][point])))
);
check('step flags follow the permutation',
    reordered.stepOn.every((on, step) => on === sampleState.stepOn[reversedOrder[step]])
    && reordered.activeStep.every((on, step) => on === sampleState.activeStep[reversedOrder[step]])
);
check('program/velocity/gate stay unchanged', reordered.programNo === sampleState.programNo
    && reordered.velocity === sampleState.velocity && reordered.gatePercent === sampleState.gatePercent);
const shiftedLeft = reorderSequenceSteps(sampleState, createShiftedStepOrder(-1));
check('left shift moves step 1 to step 16', JSON.stringify(activePitches(shiftedLeft, 15)) === JSON.stringify(activePitches(sampleState, 0)));
check('left shift moves step 2 to step 1', JSON.stringify(activePitches(shiftedLeft, 0)) === JSON.stringify(activePitches(sampleState, 1)));
const shiftedRight = reorderSequenceSteps(sampleState, createShiftedStepOrder(1));
check('right shift moves step 16 to step 1', JSON.stringify(activePitches(shiftedRight, 0)) === JSON.stringify(activePitches(sampleState, 15)));
check('right shift moves step 1 to step 2', JSON.stringify(activePitches(shiftedRight, 1)) === JSON.stringify(activePitches(sampleState, 0)));
const notesOnly = reorderSequenceSteps(sampleState, reversedOrder, 'notes');
check('notes-only reverse moves notes', JSON.stringify(activePitches(notesOnly, 0)) === JSON.stringify(activePitches(sampleState, 15)));
check('notes-only reverse keeps motion', notesOnly.motionValues.every((values, parameter) =>
    values.every((points, step) => points.every((value, point) => value === sampleState.motionValues[parameter][step][point]))));
check('notes-only reverse keeps step flags', notesOnly.stepOn.every((on, step) => on === sampleState.stepOn[step]));
const motionOnly = reorderSequenceSteps(sampleState, reversedOrder, 'motion');
check('motion-only reverse keeps notes', JSON.stringify(activePitches(motionOnly, 0)) === JSON.stringify(activePitches(sampleState, 0)));
check('motion-only reverse moves motion', motionOnly.motionValues.every((values, parameter) =>
    values.every((points, step) => points.every((value, point) => value === sampleState.motionValues[parameter][reversedOrder[step]][point]))));

console.log('[5b] Automatic motion patterns');
const sine = createMotionPattern('sine', { min: 24, max: 104, cycles: 1 });
check('sine uses requested min/max', Math.min(...sine) === 24 && Math.max(...sine) === 104);
check('sine starts at min and reaches max at half cycle', sine[0] === 24 && sine[8] === 104);
const sineTwoCycles = createMotionPattern('sine', { min: 20, max: 100, cycles: 2 });
check('sine cycle count changes the phase', sineTwoCycles[4] === 100 && sineTwoCycles[8] === 20 && sineTwoCycles[12] === 100);
const sineOffset = createMotionPattern('sine', { min: 24, max: 104, cycles: 1, offset: 8 });
check('sine offset shifts phase by steps', sineOffset[0] === 104 && sineOffset[8] === 24);
const reversedRange = createMotionPattern('linearUp', { min: 110, max: 30 });
check('reversed min/max are normalized', reversedRange[0] === 30 && reversedRange[15] === 110);

// ---------------------------------------------------------------------------
// 6) Step InputのRest/Tie
// ---------------------------------------------------------------------------
console.log('[6] Step input Rest / Tie');
const editingNotes: SequenceNote[] = [
    createSequenceNote(60, 0, 4, 110, 80),
    createSequenceNote(64, 1, 1, 90, 50),
];
const rested = clearSequenceStep(editingNotes, 2);
check('Rest clears only the target step', JSON.stringify(activePitches({ ...sampleState, notes: rested }, 2)) === '[]');
check('Rest preserves the step before and after', activePitches({ ...sampleState, notes: rested }, 1).includes(60)
    && activePitches({ ...sampleState, notes: rested }, 3).includes(60));
const tied = tieSequenceStep(editingNotes, 2);
check('Tie copies all notes from the previous step', !!tied
    && JSON.stringify(activePitches({ ...sampleState, notes: tied }, 2)) === JSON.stringify(activePitches({ ...sampleState, notes: editingNotes }, 1)));
check('Tie is unavailable on step 1', tieSequenceStep(editingNotes, 0) === null);

const copySource = {
    ...sampleState,
    notes: [
        createSequenceNote(60, 0, 2, 111, 70),
        createSequenceNote(67, 4, 1, 80, 40),
    ],
    stepOn: sampleState.stepOn.map((_, step) => step !== 4),
    activeStep: sampleState.activeStep.map((_, step) => step !== 7),
    transposeFuncOn: sampleState.transposeFuncOn.map((_, step) => step === 4),
    motionStepEnabled: sampleState.motionStepEnabled.map(flags => flags.map((_, step) => step !== 4)),
    motionValues: sampleState.motionValues.map((values, parameter) => values.map((points, step) =>
        step === 4 ? createMotionPoints(20 + parameter) : points)),
};
const copied = copySequenceStep(copySource, 4, 7);
check('Copy replaces destination notes', JSON.stringify(activePitches(copied, 7)) === JSON.stringify(activePitches(copySource, 4)));
check('Copy leaves the source step unchanged', JSON.stringify(activePitches(copied, 4)) === JSON.stringify(activePitches(copySource, 4)));
check('Copy keeps other steps', JSON.stringify(activePitches(copied, 0)) === JSON.stringify(activePitches(copySource, 0)));
check('Copy uses source note attributes', copied.notes.some(note => note.pitch === 67 && note.startStep === 7 && note.velocity === 80 && note.gatePercent === 40));
check('Copy duplicates motion values', copied.motionValues.every((values, parameter) =>
    values[7].every((value, point) => value === copySource.motionValues[parameter][4][point])));
check('Copy duplicates step flags', copied.stepOn[7] === copySource.stepOn[4]
    && copied.transposeFuncOn[7] === copySource.transposeFuncOn[4]
    && copied.motionStepEnabled[0][7] === copySource.motionStepEnabled[0][4]);
check('Copy keeps at least one active step', copied.activeStep.some(Boolean));
const sameStep = copySequenceStep(copySource, 4, 4);
check('Copy onto the same step is a no-op', sameStep === copySource);

console.log('[7] Note resize / move / marquee');
const editNotes = [
    createSequenceNote(60, 0, 2, 100, 80),
    createSequenceNote(64, 4, 1, 90, 70),
    createSequenceNote(67, 4, 2, 80, 60),
];
const stretched = resizeSequenceNote(editNotes, { pitch: 60, startStep: 0 }, 4);
check('resize extends length', !!stretched && stretched.some(note => note.pitch === 60 && note.startStep === 0 && note.length === 4));
const moved = moveSequenceNotes(editNotes, [{ pitch: 64, startStep: 4 }], 0, 2, 36, 96);
check('move shifts start step', !!moved && moved.some(note => note.pitch === 64 && note.startStep === 6 && note.length === 1));
const chordMove = moveSequenceNotes(editNotes, [{ pitch: 64, startStep: 4 }, { pitch: 67, startStep: 4 }], 12, -1, 36, 96);
check('move keeps relative chord', !!chordMove
    && chordMove.some(note => note.pitch === 76 && note.startStep === 3)
    && chordMove.some(note => note.pitch === 79 && note.startStep === 3));
const boxed = notesIntersectingRect(editNotes, 3, 60, 5, 67);
check('marquee selects intersecting notes', boxed.length === 2 && boxed.every(note => note.startStep === 4));
const clampedResize = resizeSequenceNote(editNotes, { pitch: 60, startStep: 0 }, 99);
check('resize clamps to remaining steps', !!clampedResize && clampedResize.some(note => note.pitch === 60 && note.length === 16));
const blocked = Array.from({ length: 6 }, (_, index) => createSequenceNote(50 + index, 8, 1, 100, 80));
const blockedMove = moveSequenceNotes(
    [...blocked, createSequenceNote(70, 0, 1, 100, 80)],
    [{ pitch: 70, startStep: 0 }],
    0,
    8,
    36,
    96,
);
check('move rejects a full destination step', blockedMove === null);

// ---------------------------------------------------------------------------
console.log('');
if (failCount === 0) {
    console.log(`ALL CHECKS PASSED`);
    process.exit(0);
} else {
    console.log(`${failCount} CHECK(S) FAILED`);
    process.exit(1);
}
