/**
 * SMF(標準MIDIファイル)パーサーの検証ツール。
 * 手組みの最小MIDIファイル(1トラック、4分音符4つ + 和音1つ)をバイナリで構築し、
 * parseSmf() -> extractStepNotes() が期待通りの結果を返すか確認する。
 *
 * 実行: npx tsx scripts/verify-smf-import.ts
 */
import { parseSmf, extractStepNotes } from '../src/utils/smfImport';

let failCount = 0;
const check = (label: string, condition: boolean, detail?: string) => {
    if (condition) {
        console.log(`  OK  ${label}`);
    } else {
        failCount++;
        console.log(`  NG  ${label}${detail ? ` -- ${detail}` : ''}`);
    }
};

// --- 最小限のSMF(format 0, division=96 tpqn)をバイナリで組み立てる ---
const bytes: number[] = [];
const pushStr = (s: string) => { for (const c of s) bytes.push(c.charCodeAt(0)); };
const push32 = (v: number) => { bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); };
const push16 = (v: number) => { bytes.push((v >>> 8) & 0xff, v & 0xff); };
const varLen = (v: number): number[] => {
    const out = [v & 0x7f];
    v >>= 7;
    while (v > 0) { out.unshift((v & 0x7f) | 0x80); v >>= 7; }
    return out;
};

const TPQN = 96;
pushStr('MThd');
push32(6);
push16(0); // format 0
push16(1); // 1 track
push16(TPQN);

// トラックイベントを組み立てる (4分音符ぶんのステップ=TPQN tick、16分音符=TPQN/4)
const STEP = TPQN / 4; // 16分音符1個ぶんのtick数 (stepsPerBeat=4と一致)
const track: number[] = [];
const noteOn = (delta: number, pitch: number, vel: number) => { track.push(...varLen(delta), 0x90, pitch, vel); };
const noteOff = (delta: number, pitch: number) => { track.push(...varLen(delta), 0x80, pitch, 0x40); };

// ステップ0: C4(60)単発ノート、1ステップぶんの長さ
noteOn(0, 60, 100);
noteOff(STEP, 60);
// ステップ1: 休み
// ステップ2〜3(2ステップぶん): E4(64)を弾いてタイで伸ばす。休み1ステップ挟んでからスタート。
noteOn(STEP, 64, 90); // delta=STEP(休み1つ分)でステップ2開始
noteOff(STEP * 2, 64); // 2ステップぶん(=STEP*2)の長さで終了
// ステップ8: Cメジャーコード (60,64,67) を単発で
noteOn(STEP * 4, 60, 110); // ここまでのdeltaでステップ8まで進める (現在ステップ4終了時点+4ステップ=8)
noteOn(0, 64, 110);
noteOn(0, 67, 110);
noteOff(STEP, 60);
noteOff(0, 64);
noteOff(0, 67);
// End of track
track.push(0x00, 0xff, 0x2f, 0x00);

pushStr('MTrk');
push32(track.length);
bytes.push(...track);

const buffer = new Uint8Array(bytes).buffer;

// --- パース ---
const parsed = parseSmf(buffer);
check('ticksPerQuarter === 96', parsed.ticksPerQuarter === TPQN, `actual=${parsed.ticksPerQuarter}`);
check('note count === 5', parsed.notes.length === 5, `actual=${parsed.notes.length}`);

const { notes } = extractStepNotes(parsed, 4, 0);
console.log('  decoded notes:', JSON.stringify(notes));

const findNote = (pitch: number, startStep: number) => notes.find(n => n.pitch === pitch && n.startStep === startStep);

check('step0: pitch60 length1', !!findNote(60, 0) && findNote(60, 0)!.length === 1);
check('step2: pitch64 length2 (tied)', !!findNote(64, 2) && findNote(64, 2)!.length === 2);
check('step8: chord 60/64/67 length1 each', ['60', '64', '67'].every(p => {
    const n = findNote(Number(p), 8);
    return !!n && n.length === 1;
}));

console.log('');
if (failCount === 0) {
    console.log('ALL CHECKS PASSED');
    process.exit(0);
} else {
    console.log(`${failCount} CHECK(S) FAILED`);
    process.exit(1);
}
