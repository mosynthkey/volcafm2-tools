import { MOTION_PARAM_COUNT, NUM_OF_STEPS, NUM_OF_VOICES_PER_STEP, type SequenceNote, type SequenceState } from '../types/sequence';

const SEQ_DATA_SIZE = 1920;
const STEP_DATA_SIZE = 112;
const STEP_DATA_OFFSET = 80;

/**
 * KORG 7bit/8bit変換 (MIDI Implementation NOTE 1)。
 * 7バイトごとに1バイトのヘッダ (各データのbit7を集約) を先頭に付与する。
 * volca fm2ファームウェア側 (MidiMsg_TxExcl_SendData) と同一のグルーピングで、
 * 末尾が7バイト未満の端数グループにも自動的に対応する。
 */
export const pack8to7 = (data: Uint8Array | number[]): number[] => {
    const out: number[] = [];
    for (let i = 0; i < data.length; i += 7) {
        const chunk = Array.from(data.slice(i, i + 7));
        let header = 0;
        for (let j = 0; j < chunk.length; j++) {
            if (chunk[j] & 0x80) header |= (1 << j);
        }
        out.push(header, ...chunk.map(b => b & 0x7f));
    }
    return out;
};

const setU16LE = (buf: Uint8Array, offset: number, value: number) => {
    buf[offset] = value & 0xff;
    buf[offset + 1] = (value >> 8) & 0xff;
};

/**
 * pack8to7の逆変換。7バイトのヘッダ+最大7バイトのデータというグルーピングを
 * outputLengthに達するまで読み進める (末尾の端数グループにも対応)。
 */
export const unpack7to8 = (data: Uint8Array | number[], outputLength: number): Uint8Array => {
    const out = new Uint8Array(outputLength);
    let r = 0;
    let w = 0;
    while (w < outputLength) {
        const header = data[r];
        const chunkLen = Math.min(7, outputLength - w);
        for (let j = 0; j < chunkLen; j++) {
            out[w + j] = data[r + 1 + j] | (((header >> j) & 1) << 7);
        }
        r += 1 + chunkLen;
        w += chunkLen;
    }
    return out;
};

/**
 * 編集中のシーケンス状態から volca fm2 SEQUENCE DATA (TABLE 3, 1920バイト) を組み立てる。
 * MOTIONはSMOOTH offとし、5点のうち先頭値(DATA1)相当を全点に書き込む (note S10)。
 */
export const buildSequenceDataBytes = (state: SequenceState): Uint8Array => {
    const buf = new Uint8Array(SEQ_DATA_SIZE);

    // header 'PTST'
    buf.set([0x50, 0x54, 0x53, 0x54], 0);
    // devCode (SEQ_DEVCODE = 0x4ee8, little endian)
    setU16LE(buf, 4, 0x4ee8);
    // STEP Off/On, ACTIVE STEP Off/On: 16ステップすべて有効
    setU16LE(buf, 6, 0xffff);
    setU16LE(buf, 12, 0xffff);
    // programNo
    buf[9] = state.programNo & 0x7f;
    // numOfStep (受信時にvolca fm2側で再計算されるため実質無視される)
    buf[15] = NUM_OF_STEPS;

    // MOTION Parameter (offset 16-41): パラメータごとのMOTION有効/無効
    for (let p = 0; p < MOTION_PARAM_COUNT; p++) {
        buf[16 + p * 2] = state.motionEnabled[p] ? 0x01 : 0x00;
    }
    // MOTION Off/On (offset 42-67): 有効なパラメータは全16ステップで有効化
    for (let p = 0; p < MOTION_PARAM_COUNT; p++) {
        setU16LE(buf, 42 + p * 2, state.motionEnabled[p] ? 0xffff : 0x0000);
    }
    // FUNC MOTION On/Off (offset 68 bit0): いずれかのパラメータが有効ならON
    buf[68] = state.motionEnabled.some(Boolean) ? 0x01 : 0x00;

    for (let step = 0; step < NUM_OF_STEPS; step++) {
        const base = STEP_DATA_OFFSET + step * STEP_DATA_SIZE;
        // このステップで鳴っている(アタック中 or タイで継続中の)ノート、最大6音
        const active = state.notes
            .filter(n => n.startStep <= step && n.startStep + n.length - 1 >= step)
            .slice(0, NUM_OF_VOICES_PER_STEP);

        active.forEach((note, slot) => {
            const isStart = step === note.startStep;
            const isEnd = step === note.startStep + note.length - 1;
            const tie = note.length > 1 && !isEnd; // アタック〜最終ステップ手前まではTIEで継続
            const normalGate = Math.max(0, Math.min(126, Math.round((state.gatePercent / 100) * 126)));

            setU16LE(buf, base + slot * 2, note.pitch & 0x7f);
            buf[base + 12 + slot] = note.pitch & 0x7f; // noteDisp
            buf[base + 18 + slot] = Math.max(1, Math.min(127, Math.round(state.velocity))); // velocity (0=no note)
            // note S8/S9: TIE(127)+次ステップのTrigger Switch=0 で音が継続する。
            // アタック時のみTrigger Switch On、以降(TIE中・リリース時)はOffで再トリガーしない。
            buf[base + 24 + slot] = (isStart ? 0x80 : 0x00) | (tie ? 0x7f : normalGate);
        });

        for (let p = 0; p < MOTION_PARAM_COUNT; p++) {
            if (!state.motionEnabled[p]) continue;
            const value = Math.max(0, Math.min(127, Math.round(state.motionValues[p]?.[step] ?? 64)));
            const motionOffset = base + 43 + p * 5;
            for (let k = 0; k < 5; k++) buf[motionOffset + k] = value;
        }
    }

    // footer 'PTED'
    buf.set([0x50, 0x54, 0x45, 0x44], 1916);

    return buf;
};

/**
 * CURRENT SEQUENCE DATA DUMP (Func 0x40) のSysExメッセージを組み立てる。
 * volca fm2はこれを受信すると即座に編集バッファ(現在のシーケンス)へ反映する。
 */
export const encodeCurrentSequenceDump = (state: SequenceState, channel = 0): Uint8Array => {
    const seqData = buildSequenceDataBytes(state);
    const packed = pack8to7(seqData);
    const header = [0xf0, 0x42, 0x30 | (channel & 0x0f), 0x00, 0x01, 0x2f, 0x40];
    return new Uint8Array([...header, ...packed, 0xf7]);
};

/**
 * volca fm2から受信したSEQUENCE DATA (1920バイト, unpack済み) を編集状態に変換する。
 * MOTIONはDATA1 (先頭値) のみを採用する。
 * ノートはボイススロット(0-5)ごとに時系列を追い、Trigger SwitchとTIE(gate=127)から
 * タイで繋がった一連のノートを1つのSequenceNoteとして再構成する。
 * デバイス側のスロット割当てはステップ間で一定とは限らないため、厳密な再構成ではなく実用上妥当な近似。
 */
export const decodeSequenceData = (seqData: Uint8Array): SequenceState => {
    const programNo = seqData[9] & 0x7f;
    const motionEnabled: boolean[] = [];
    const motionValues: number[][] = [];
    for (let p = 0; p < MOTION_PARAM_COUNT; p++) {
        motionEnabled.push((seqData[16 + p * 2] & 0x01) !== 0);
        motionValues.push(Array.from({ length: NUM_OF_STEPS }, () => 64));
    }
    for (let step = 0; step < NUM_OF_STEPS; step++) {
        const base = STEP_DATA_OFFSET + step * STEP_DATA_SIZE;
        for (let p = 0; p < MOTION_PARAM_COUNT; p++) {
            motionValues[p][step] = seqData[base + 43 + p * 5];
        }
    }

    let velocity = 100;
    let gatePercent = 80;
    let foundVelocity = false;

    const notes: SequenceNote[] = [];
    const TIE = 0x7f;

    for (let slot = 0; slot < NUM_OF_VOICES_PER_STEP; slot++) {
        let open: { pitch: number; startStep: number } | null = null;

        for (let step = 0; step < NUM_OF_STEPS; step++) {
            const base = STEP_DATA_OFFSET + step * STEP_DATA_SIZE;
            const vel = seqData[base + 18 + slot];
            const gateByte = seqData[base + 24 + slot];
            const trigger = (gateByte & 0x80) !== 0;
            const gate = gateByte & 0x7f;
            const pitch = (seqData[base + slot * 2] | (seqData[base + slot * 2 + 1] << 8)) & 0x7f;
            const active = vel > 0;

            if (active && !foundVelocity) {
                velocity = vel;
                if (gate !== TIE) {
                    gatePercent = Math.round((gate / 126) * 100);
                    foundVelocity = true;
                }
            }

            if (active && trigger) {
                // 新しいアタック。開いているノートがあれば直前で閉じる。
                if (open) notes.push({ pitch: open.pitch, startStep: open.startStep, length: step - open.startStep });
                if (gate === TIE) {
                    open = { pitch, startStep: step };
                } else {
                    notes.push({ pitch, startStep: step, length: 1 });
                    open = null;
                }
            } else if (active && !trigger && open && pitch === open.pitch) {
                // タイによる継続
                if (gate !== TIE) {
                    notes.push({ pitch: open.pitch, startStep: open.startStep, length: step - open.startStep + 1 });
                    open = null;
                }
            } else if (open) {
                // 無音 or 別ピッチに切り替わった → 直前のステップで終了とみなす
                notes.push({ pitch: open.pitch, startStep: open.startStep, length: step - open.startStep });
                open = null;
            }
        }

        if (open) {
            notes.push({ pitch: open.pitch, startStep: open.startStep, length: NUM_OF_STEPS - open.startStep });
        }
    }

    return { programNo, velocity, gatePercent, notes, motionEnabled, motionValues };
};
