import { NUM_OF_STEPS, type SequenceNote } from '../types/sequence';

export const MIDI_CLOCKS_PER_STEP = 6;
export const MIDI_CLOCKS_PER_PATTERN = NUM_OF_STEPS * MIDI_CLOCKS_PER_STEP;
export type SequencePlaybackResolution = 1 | 2 | 4;

export interface MidiSequenceCaptureResult {
    notes: SequenceNote[];
    velocity: number;
    gatePercent: number;
    clockCount: number;
}

interface ActiveNote {
    startTick: number;
    velocity: number;
}

const median = (values: number[], fallback: number) => {
    if (values.length === 0) return fallback;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
};

/** MIDI Clock (24 PPQN) と Note On/Off を16ステップへ量子化する。 */
export class MidiSequenceCapture {
    private clocksReceived = 0;
    private activeNotes = new Map<number, ActiveNote>();
    private capturedNotes: SequenceNote[] = [];
    private velocities: number[] = [];
    private gateRatios: number[] = [];
    readonly clocksPerStep: number;
    readonly clocksPerPattern: number;

    constructor(resolution: SequencePlaybackResolution = 1) {
        this.clocksPerStep = MIDI_CLOCKS_PER_STEP * resolution;
        this.clocksPerPattern = NUM_OF_STEPS * this.clocksPerStep;
    }

    get clockCount() { return this.clocksReceived; }
    get stepCount() { return Math.min(NUM_OF_STEPS, Math.ceil(this.clocksReceived / this.clocksPerStep)); }
    get isComplete() { return this.clocksReceived >= this.clocksPerPattern; }

    handleMessage(data: Uint8Array): 'continue' | 'complete' {
        const status = data[0];
        if (status === 0xf8) {
            this.clocksReceived++;
            return this.isComplete ? 'complete' : 'continue';
        }
        if (status === 0xfc) return 'complete';

        const type = status & 0xf0;
        if (type !== 0x80 && type !== 0x90) return 'continue';

        const pitch = data[1] & 0x7f;
        const velocity = data[2] ?? 0;
        const noteOn = type === 0x90 && velocity > 0;
        if (noteOn) {
            const previous = this.activeNotes.get(pitch);
            if (previous) this.closeNote(pitch, previous, this.currentTick());
            this.activeNotes.set(pitch, { startTick: this.currentTick(), velocity });
            this.velocities.push(velocity);
        } else {
            const active = this.activeNotes.get(pitch);
            if (active) this.closeNote(pitch, active, this.currentTick());
        }
        return 'continue';
    }

    finish(): MidiSequenceCaptureResult {
        const endTick = this.isComplete
            ? this.clocksPerPattern
            : Math.max(1, this.currentTick());
        for (const [pitch, active] of this.activeNotes) this.closeNote(pitch, active, endTick);

        return {
            notes: this.capturedNotes,
            velocity: Math.max(1, Math.min(127, Math.round(median(this.velocities, 100)))),
            gatePercent: Math.max(1, Math.min(100, Math.round(median(this.gateRatios, 0.8) * 100))),
            clockCount: this.clocksReceived,
        };
    }

    private currentTick() {
        // Noteは直前までに受信したClock数の境界上に置く。
        // Clock 12の直後は、1/2設定(12 clocks/step)の次ステップ先頭となる。
        return this.clocksReceived;
    }

    private closeNote(pitch: number, active: ActiveNote, endTick: number) {
        this.activeNotes.delete(pitch);
        const durationTicks = Math.max(1, endTick - active.startTick);
        const startStep = Math.min(NUM_OF_STEPS - 1, Math.floor(active.startTick / this.clocksPerStep));
        const length = Math.min(
            NUM_OF_STEPS - startStep,
            Math.max(1, Math.ceil(durationTicks / this.clocksPerStep)),
        );
        const finalStepTicks = ((durationTicks - 1) % this.clocksPerStep) + 1;
        this.gateRatios.push(finalStepTicks / this.clocksPerStep);
        this.capturedNotes.push({ pitch, startStep, length });
    }
}
