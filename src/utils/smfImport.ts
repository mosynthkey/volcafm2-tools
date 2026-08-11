import type { SequenceNote } from '../types/sequence';

export interface ImportedNote {
    pitch: number;
    startTick: number;
    endTick: number;
    velocity: number;
}

export interface ParsedSmf {
    ticksPerQuarter: number;
    notes: ImportedNote[];
}

class ByteCursor {
    pos = 0;
    constructor(private view: DataView) { }
    u8() { return this.view.getUint8(this.pos++); }
    u16() { const v = this.view.getUint16(this.pos); this.pos += 2; return v; }
    u32() { const v = this.view.getUint32(this.pos); this.pos += 4; return v; }
    bytes(n: number) { const v = new Uint8Array(this.view.buffer, this.view.byteOffset + this.pos, n); this.pos += n; return v; }
    ascii(n: number) { return Array.from(this.bytes(n)).map(b => String.fromCharCode(b)).join(''); }
    get eof() { return this.pos >= this.view.byteLength; }

    varLen(): number {
        let value = 0;
        let byte: number;
        do {
            byte = this.u8();
            value = (value << 7) | (byte & 0x7f);
        } while (byte & 0x80);
        return value;
    }
}

/**
 * Standard MIDI File (format 0/1) を最小限パースし、トラックをマージした
 * ノートイベント(絶対tick)のリストを返す。テンポ/拍子等の再生情報は無視し、
 * ステップ量子化に必要な情報(ticksPerQuarter, ノートのon/offタイミング)のみ扱う。
 */
export const parseSmf = (buffer: ArrayBuffer): ParsedSmf => {
    const view = new DataView(buffer);
    const cursor = new ByteCursor(view);

    const headerId = cursor.ascii(4);
    if (headerId !== 'MThd') {
        throw new Error('MThdヘッダが見つかりません。標準MIDIファイル(.mid)を指定してください。');
    }
    const headerLen = cursor.u32();
    const headerEnd = cursor.pos + headerLen;
    const format = cursor.u16();
    const numTracks = cursor.u16();
    const division = cursor.u16();
    cursor.pos = headerEnd;

    if (division & 0x8000) {
        throw new Error('SMPTEタイムコード形式のMIDIファイルには対応していません。');
    }
    const ticksPerQuarter = division;

    const notes: ImportedNote[] = [];

    for (let t = 0; t < numTracks && !cursor.eof; t++) {
        const trackId = cursor.ascii(4);
        const trackLen = cursor.u32();
        const trackEnd = cursor.pos + trackLen;
        if (trackId !== 'MTrk') {
            cursor.pos = trackEnd;
            continue;
        }

        let absoluteTick = 0;
        let runningStatus = 0;
        // (channel<<8 | pitch) -> {startTick, velocity}
        const open = new Map<number, { startTick: number; velocity: number }>();

        while (cursor.pos < trackEnd) {
            absoluteTick += cursor.varLen();

            let status = cursor.u8();
            if (status < 0x80) {
                // ランニングステータス: このバイトは実はデータバイトの先頭だった
                cursor.pos--;
                status = runningStatus;
            } else {
                runningStatus = status;
            }

            if (status === 0xff) {
                cursor.u8(); // meta type
                const len = cursor.varLen();
                cursor.pos += len;
            } else if (status === 0xf0 || status === 0xf7) {
                const len = cursor.varLen();
                cursor.pos += len;
            } else {
                const type = status & 0xf0;
                const channel = status & 0x0f;

                if (type === 0x90 || type === 0x80) {
                    const pitch = cursor.u8();
                    const velocity = cursor.u8();
                    const key = (channel << 8) | pitch;
                    if (type === 0x90 && velocity > 0) {
                        open.set(key, { startTick: absoluteTick, velocity });
                    } else {
                        const start = open.get(key);
                        if (start) {
                            notes.push({ pitch, startTick: start.startTick, endTick: absoluteTick, velocity: start.velocity });
                            open.delete(key);
                        }
                    }
                } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
                    cursor.u8();
                    cursor.u8();
                } else if (type === 0xc0 || type === 0xd0) {
                    cursor.u8();
                } else {
                    // 未知のステータス。同期が取れなくなるため打ち切る。
                    cursor.pos = trackEnd;
                    break;
                }
            }
        }

        cursor.pos = trackEnd;
    }

    notes.sort((a, b) => a.startTick - b.startTick);
    return { ticksPerQuarter, notes };
};

export interface SmfImportResult {
    notes: SequenceNote[];
    velocity: number;
}

/**
 * パース済みSMFから、16ステップ分の窓(小節)を切り出してピアノロールのノートに変換する。
 * volca fm2の1シーケンス=16ステップに収まる範囲だけを対象とする。
 */
export const extractStepNotes = (
    parsed: ParsedSmf,
    stepsPerBeat: number,
    barOffset: number // 0-indexed
): SmfImportResult => {
    const ticksPerStep = parsed.ticksPerQuarter / stepsPerBeat;
    const windowStartTick = barOffset * 16 * ticksPerStep;
    const windowEndTick = windowStartTick + 16 * ticksPerStep;

    const inWindow = parsed.notes.filter(n => n.startTick >= windowStartTick && n.startTick < windowEndTick);

    const notes: SequenceNote[] = [];
    let velocitySum = 0;
    for (const n of inWindow) {
        const startStep = Math.round((n.startTick - windowStartTick) / ticksPerStep);
        if (startStep < 0 || startStep > 15) continue;
        const rawEndStep = Math.round((n.endTick - windowStartTick) / ticksPerStep) - 1;
        const endStep = Math.min(15, Math.max(startStep, rawEndStep));
        notes.push({ pitch: n.pitch, startStep, length: endStep - startStep + 1 });
        velocitySum += n.velocity;
    }

    const velocity = inWindow.length ? Math.round(velocitySum / inWindow.length) : 100;
    return { notes, velocity };
};

export const countBarsInSmf = (parsed: ParsedSmf, stepsPerBeat: number): number => {
    if (!parsed.notes.length) return 1;
    const ticksPerStep = parsed.ticksPerQuarter / stepsPerBeat;
    const lastTick = Math.max(...parsed.notes.map(n => n.endTick));
    return Math.max(1, Math.ceil(lastTick / (16 * ticksPerStep)));
};
