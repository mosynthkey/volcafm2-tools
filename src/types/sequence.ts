// Sequence dump layout from the public MIDI implementation (TABLE 3).
export const NUM_OF_STEPS = 16;
export const NUM_OF_VOICES_PER_STEP = 6;
export const MOTION_PARAM_COUNT = 13;
export const MOTION_POINT_COUNT = 5;

// MOTION Parameter / MOTION Data order in the sequence dump.
export const MOTION_PARAM_KEYS = ['transpose', 'velocity', 'algorithm', 'modulatorAttack', 'modulatorDecay',
    'carrierAttack', 'carrierDecay', 'lfoRate', 'lfoPitchDepth', 'arpType', 'arpDivision', 'chorusDepth', 'reverbDepth'] as const;

export const ARP_TYPE_COUNT = 10;
export const ARP_DIV_COUNT = 11;

export interface SequenceNote {
    pitch: number;
    startStep: number; // 0-15
    length: number; // 何ステップ分継続するか (1-16)
    velocity: number; // 1-127
    gatePercent: number; // 0-100, リリースステップのゲート
}

export interface SequenceFunc {
    motionOn: boolean;
    motionSmooth: boolean;
    warpActiveStep: boolean;
    tempo: number; // 0~2 = 1/1, 1/2, 1/4
    voiceMono: boolean;
    voiceUnison: boolean;
    chorus: boolean;
    arp: boolean;
    transposeNote: boolean;
    reverb: boolean;
    arpType: number; // 0-9
    arpDiv: number; // 0-10
    chorusDepth: number; // 0-127
    reverbDepth: number; // 0-127
}

export interface SequenceState {
    programNo: number;
    velocity: number;
    gatePercent: number;
    notes: SequenceNote[];
    motionEnabled: boolean[];
    // motionStepEnabled[paramIndex][stepIndex]
    motionStepEnabled: boolean[][];
    // motionValues[paramIndex][stepIndex][point 0-4]
    motionValues: number[][][];
    stepOn: boolean[];
    activeStep: boolean[];
    transposeFuncOn: boolean[];
    func: SequenceFunc;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));

export const createBoolRow = (value = true): boolean[] =>
    Array.from({ length: NUM_OF_STEPS }, () => value);

export const createMotionPoints = (value = 64): number[] =>
    Array.from({ length: MOTION_POINT_COUNT }, () => clamp(value, 0, 127));

export const createMotionGrid = (fill = 64): number[][][] =>
    Array.from({ length: MOTION_PARAM_COUNT }, () =>
        Array.from({ length: NUM_OF_STEPS }, () => createMotionPoints(fill)));

export const createMotionStepEnabled = (value = true): boolean[][] =>
    Array.from({ length: MOTION_PARAM_COUNT }, () => createBoolRow(value));

export const createEmptyFunc = (): SequenceFunc => ({
    motionOn: false,
    motionSmooth: false,
    warpActiveStep: false,
    tempo: 0,
    voiceMono: false,
    voiceUnison: false,
    chorus: false,
    arp: false,
    transposeNote: false,
    reverb: false,
    arpType: 0,
    arpDiv: 0,
    chorusDepth: 0,
    reverbDepth: 0,
});

export const createSequenceNote = (
    pitch: number,
    startStep: number,
    length: number,
    velocity = 100,
    gatePercent = 80,
): SequenceNote => ({
    pitch,
    startStep,
    length: Math.max(1, length),
    velocity: clamp(velocity, 1, 127),
    gatePercent: clamp(gatePercent, 0, 100),
});

export const flagsFromU16 = (value: number): boolean[] =>
    Array.from({ length: NUM_OF_STEPS }, (_, step) => ((value >> step) & 1) === 1);

export const u16FromFlags = (flags: boolean[]): number =>
    flags.reduce((acc, on, step) => acc | (on ? (1 << step) : 0), 0) & 0xffff;

const asBoolRow = (raw: unknown, fallback: boolean): boolean[] => {
    if (!Array.isArray(raw)) return createBoolRow(fallback);
    return createBoolRow(fallback).map((_, step) => typeof raw[step] === 'boolean' ? raw[step] : fallback);
};

const asMotionStepEnabled = (raw: unknown): boolean[][] => {
    if (!Array.isArray(raw)) return createMotionStepEnabled(true);
    return Array.from({ length: MOTION_PARAM_COUNT }, (_, param) => asBoolRow(raw[param], true));
};

const asMotionValues = (raw: unknown): number[][][] => {
    const grid = createMotionGrid(64);
    if (!Array.isArray(raw)) return grid;
    for (let param = 0; param < MOTION_PARAM_COUNT; param++) {
        const row = raw[param];
        if (!Array.isArray(row)) continue;
        for (let step = 0; step < NUM_OF_STEPS; step++) {
            const cell = row[step];
            if (Array.isArray(cell)) {
                grid[param][step] = createMotionPoints(64).map((_, point) => clamp(Number(cell[point] ?? cell[0] ?? 64) || 0, 0, 127));
            } else if (typeof cell === 'number') {
                grid[param][step] = createMotionPoints(cell);
            }
        }
    }
    return grid;
};

export const normalizeSequenceState = (raw: Partial<SequenceState> | null | undefined): SequenceState => {
    const velocity = clamp(raw?.velocity ?? 100, 1, 127);
    const gatePercent = clamp(raw?.gatePercent ?? 80, 0, 100);
    const funcRaw: Partial<SequenceFunc> = raw?.func ?? {};
    return {
        programNo: clamp(raw?.programNo ?? 0, 0, 63),
        velocity,
        gatePercent,
        notes: (raw?.notes ?? []).map(note => createSequenceNote(
            note.pitch, note.startStep, note.length, note.velocity ?? velocity, note.gatePercent ?? gatePercent,
        )),
        motionEnabled: Array.from({ length: MOTION_PARAM_COUNT }, (_, param) => Boolean(raw?.motionEnabled?.[param])),
        motionStepEnabled: asMotionStepEnabled(raw?.motionStepEnabled),
        motionValues: asMotionValues(raw?.motionValues),
        stepOn: asBoolRow(raw?.stepOn, true),
        activeStep: asBoolRow(raw?.activeStep, true),
        transposeFuncOn: asBoolRow(raw?.transposeFuncOn, false),
        func: {
            ...createEmptyFunc(),
            ...funcRaw,
            motionOn: funcRaw.motionOn ?? Boolean(raw?.motionEnabled?.some(Boolean)),
            tempo: clamp(funcRaw.tempo ?? 0, 0, 2),
            arpType: clamp(funcRaw.arpType ?? 0, 0, ARP_TYPE_COUNT - 1),
            arpDiv: clamp(funcRaw.arpDiv ?? 0, 0, ARP_DIV_COUNT - 1),
            chorusDepth: clamp(funcRaw.chorusDepth ?? 0, 0, 127),
            reverbDepth: clamp(funcRaw.reverbDepth ?? 0, 0, 127),
        },
    };
};

export const createEmptySequenceState = (): SequenceState => normalizeSequenceState({});
