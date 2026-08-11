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
import { MOTION_PARAM_COUNT, NUM_OF_STEPS, type SequenceNote, type SequenceState } from '../src/types/sequence';

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
    programNo: 12,
    velocity: 110,
    gatePercent: 80,
    notes: [
        // ステップ0〜3をタイで繋いだCメジャーコード (「ステップをつなげた和音」)
        { pitch: 60, startStep: 0, length: 4 },
        { pitch: 64, startStep: 0, length: 4 },
        { pitch: 67, startStep: 0, length: 4 },
        // 単発ノート
        { pitch: 72, startStep: 4, length: 1 },
        // 2ステップだけタイで繋いだノート
        { pitch: 65, startStep: 8, length: 2 },
        { pitch: 60, startStep: 12, length: 1 },
    ],
    motionEnabled: Array.from({ length: MOTION_PARAM_COUNT }, (_, i) => i === 2 || i === 7), // ALGORITHM, LFO RATE
    motionValues: Array.from({ length: MOTION_PARAM_COUNT }, (_, p) =>
        Array.from({ length: NUM_OF_STEPS }, (_, s) => (p === 2 ? s * 8 : 127 - s * 8))
    ),
};

const seqBytes = buildSequenceDataBytes(sampleState);
check('length === 1920', seqBytes.length === 1920, `actual=${seqBytes.length}`);
check("header 'PTST'", String.fromCharCode(...seqBytes.slice(0, 4)) === 'PTST');
check('devCode === 0x4ee8 (LE: E8,4E)', seqBytes[4] === 0xe8 && seqBytes[5] === 0x4e);
check("footer 'PTED'", String.fromCharCode(...seqBytes.slice(1916, 1920)) === 'PTED');
check('programNo byte (offset 9)', seqBytes[9] === sampleState.programNo);
check('FUNC MOTION on (offset 68 bit0)', (seqBytes[68] & 0x01) === 1);

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
    'notes round-trip (incl. tied multi-step chords)',
    a.length === b.length && a.every((n, i) => n.pitch === b[i].pitch && n.startStep === b[i].startStep && n.length === b[i].length),
    `sent=${JSON.stringify(a)} got=${JSON.stringify(b)}`
);
check(
    'motionEnabled round-trips',
    sampleState.motionEnabled.every((v, i) => v === decodedState.motionEnabled[i])
);
check(
    'motionValues round-trip for enabled params',
    sampleState.motionEnabled.every((enabled, p) =>
        !enabled || sampleState.motionValues[p].every((v, s) => v === decodedState.motionValues[p][s])
    )
);

// ---------------------------------------------------------------------------
console.log('');
if (failCount === 0) {
    console.log(`ALL CHECKS PASSED`);
    process.exit(0);
} else {
    console.log(`${failCount} CHECK(S) FAILED`);
    process.exit(1);
}
