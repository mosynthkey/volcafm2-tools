import {
    MOTION_PARAM_COUNT, MOTION_POINT_COUNT, NUM_OF_STEPS, NUM_OF_VOICES_PER_STEP,
    createMotionPoints, createSequenceNote, flagsFromU16, u16FromFlags,
    type SequenceNote, type SequenceState,
} from '../types/sequence';

const SEQ_DATA_SIZE = 1920;
export const SEQUENCE_DATA_SIZE = SEQ_DATA_SIZE;
const STEP_DATA_SIZE = 112;
const STEP_DATA_OFFSET = 80;
const TIE = 0x7f;

/**
 * 7-bit / 8-bit packing from the public MIDI implementation (NOTE 1).
 * Every 7 data bytes get a leading header that collects their bit7 values.
 * A short final group is packed the same way.
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

const getU16LE = (buf: Uint8Array, offset: number) => buf[offset] | (buf[offset + 1] << 8);

const gateByteValue = (percent: number) => Math.max(0, Math.min(126, Math.round((percent / 100) * 126)));
const gatePercentFromByte = (gate: number) => Math.round((gate / 126) * 100);

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
 */
export const buildSequenceDataBytes = (state: SequenceState): Uint8Array => {
    const buf = new Uint8Array(SEQ_DATA_SIZE);
    const { func } = state;

    buf.set([0x50, 0x54, 0x53, 0x54], 0);
    setU16LE(buf, 4, 0x4ee8);
    setU16LE(buf, 6, u16FromFlags(state.stepOn));
    buf[9] = state.programNo & 0x7f;
    setU16LE(buf, 12, u16FromFlags(state.activeStep));
    buf[15] = Math.max(1, state.activeStep.filter(Boolean).length);

    for (let p = 0; p < MOTION_PARAM_COUNT; p++) {
        buf[16 + p * 2] = state.motionEnabled[p] ? 0x01 : 0x00;
        const stepBits = u16FromFlags(state.motionStepEnabled[p] ?? Array.from({ length: NUM_OF_STEPS }, () => true));
        setU16LE(buf, 42 + p * 2, stepBits);
    }

    buf[68] = (func.motionOn ? 0x01 : 0)
        | (func.motionSmooth ? 0x02 : 0)
        | (func.warpActiveStep ? 0x04 : 0)
        | ((func.tempo & 0x03) << 3)
        | (func.voiceMono ? 0x20 : 0)
        | (func.voiceUnison ? 0x40 : 0)
        | (func.chorus ? 0x80 : 0);
    buf[69] = (func.arp ? 0x01 : 0)
        | (func.transposeNote ? 0x02 : 0)
        | (func.reverb ? 0x04 : 0);
    buf[70] = func.arpType & 0x0f;
    buf[71] = func.arpDiv & 0x0f;
    buf[72] = func.chorusDepth & 0x7f;
    buf[73] = func.reverbDepth & 0x7f;

    for (let step = 0; step < NUM_OF_STEPS; step++) {
        const base = STEP_DATA_OFFSET + step * STEP_DATA_SIZE;
        const active = state.notes
            .filter(n => n.startStep <= step && n.startStep + n.length - 1 >= step)
            .slice(0, NUM_OF_VOICES_PER_STEP);

        active.forEach((note, slot) => {
            const isStart = step === note.startStep;
            const isEnd = step === note.startStep + note.length - 1;
            const tie = note.length > 1 && !isEnd;
            setU16LE(buf, base + slot * 2, note.pitch & 0x7f);
            buf[base + 12 + slot] = note.pitch & 0x7f;
            buf[base + 18 + slot] = Math.max(1, Math.min(127, Math.round(note.velocity)));
            buf[base + 24 + slot] = (isStart ? 0x80 : 0x00) | (tie ? TIE : gateByteValue(note.gatePercent));
        });

        for (let p = 0; p < MOTION_PARAM_COUNT; p++) {
            const points = state.motionValues[p]?.[step] ?? createMotionPoints(64);
            const motionOffset = base + 43 + p * MOTION_POINT_COUNT;
            for (let k = 0; k < MOTION_POINT_COUNT; k++) {
                buf[motionOffset + k] = Math.max(0, Math.min(127, Math.round(points[k] ?? points[0] ?? 64)));
            }
        }
    }

    for (let step = 0; step < NUM_OF_STEPS; step++) {
        buf[1872 + step] = state.transposeFuncOn[step] ? 1 : 0;
    }

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
 */
export const decodeSequenceData = (seqData: Uint8Array): SequenceState => {
    const programNo = seqData[9] & 0x7f;
    const motionEnabled: boolean[] = [];
    const motionStepEnabled: boolean[][] = [];
    const motionValues: number[][][] = [];
    for (let p = 0; p < MOTION_PARAM_COUNT; p++) {
        motionEnabled.push((seqData[16 + p * 2] & 0x01) !== 0);
        motionStepEnabled.push(flagsFromU16(getU16LE(seqData, 42 + p * 2)));
        motionValues.push(Array.from({ length: NUM_OF_STEPS }, () => createMotionPoints(64)));
    }
    for (let step = 0; step < NUM_OF_STEPS; step++) {
        const base = STEP_DATA_OFFSET + step * STEP_DATA_SIZE;
        for (let p = 0; p < MOTION_PARAM_COUNT; p++) {
            const motionOffset = base + 43 + p * MOTION_POINT_COUNT;
            motionValues[p][step] = Array.from({ length: MOTION_POINT_COUNT }, (_, point) => seqData[motionOffset + point]);
        }
    }

    const notes: SequenceNote[] = [];
    let velocity = 100;
    let gatePercent = 80;
    let foundDefaults = false;

    for (let slot = 0; slot < NUM_OF_VOICES_PER_STEP; slot++) {
        let open: { pitch: number; startStep: number; velocity: number } | null = null;

        for (let step = 0; step < NUM_OF_STEPS; step++) {
            const base = STEP_DATA_OFFSET + step * STEP_DATA_SIZE;
            const vel = seqData[base + 18 + slot];
            const gateByte = seqData[base + 24 + slot];
            const trigger = (gateByte & 0x80) !== 0;
            const gate = gateByte & 0x7f;
            const pitch = getU16LE(seqData, base + slot * 2) & 0x7f;
            const active = vel > 0;

            if (active && !foundDefaults) {
                velocity = vel;
                if (gate !== TIE) {
                    gatePercent = gatePercentFromByte(gate);
                    foundDefaults = true;
                }
            }

            if (active && trigger) {
                if (open) notes.push(createSequenceNote(open.pitch, open.startStep, step - open.startStep, open.velocity, gatePercent));
                if (gate === TIE) {
                    open = { pitch, startStep: step, velocity: vel };
                } else {
                    notes.push(createSequenceNote(pitch, step, 1, vel, gatePercentFromByte(gate)));
                    open = null;
                }
            } else if (active && !trigger && open && pitch === open.pitch) {
                if (gate !== TIE) {
                    notes.push(createSequenceNote(open.pitch, open.startStep, step - open.startStep + 1, open.velocity, gatePercentFromByte(gate)));
                    open = null;
                }
            } else if (open) {
                notes.push(createSequenceNote(open.pitch, open.startStep, step - open.startStep, open.velocity, gatePercent));
                open = null;
            }
        }

        if (open) {
            notes.push(createSequenceNote(open.pitch, open.startStep, NUM_OF_STEPS - open.startStep, open.velocity, gatePercent));
        }
    }

    const funcByte = seqData[68];
    const funcByte2 = seqData[69];
    return {
        programNo,
        velocity,
        gatePercent,
        notes,
        motionEnabled,
        motionStepEnabled,
        motionValues,
        stepOn: flagsFromU16(getU16LE(seqData, 6)),
        activeStep: flagsFromU16(getU16LE(seqData, 12)),
        transposeFuncOn: Array.from({ length: NUM_OF_STEPS }, (_, step) => seqData[1872 + step] !== 0),
        func: {
            motionOn: (funcByte & 0x01) !== 0,
            motionSmooth: (funcByte & 0x02) !== 0,
            warpActiveStep: (funcByte & 0x04) !== 0,
            tempo: Math.min(2, (funcByte >> 3) & 0x03),
            voiceMono: (funcByte & 0x20) !== 0,
            voiceUnison: (funcByte & 0x40) !== 0,
            chorus: (funcByte & 0x80) !== 0,
            arp: (funcByte2 & 0x01) !== 0,
            transposeNote: (funcByte2 & 0x02) !== 0,
            reverb: (funcByte2 & 0x04) !== 0,
            arpType: Math.min(9, seqData[70] & 0x0f),
            arpDiv: Math.min(10, seqData[71] & 0x0f),
            chorusDepth: seqData[72] & 0x7f,
            reverbDepth: seqData[73] & 0x7f,
        },
    };
};
