// volca fm2 SEQUENCE DATA (TABLE 3) のうち、本アプリで編集可能な範囲を表す状態
export const NUM_OF_STEPS = 16;
export const NUM_OF_VOICES_PER_STEP = 6;
export const MOTION_PARAM_COUNT = 13;

// SysEx MOTION Parameter / MOTION Data のオフセット順 (volca fm2 ファームウェア MOPARAM enum と一致)
export const MOTION_PARAM_KEYS = ['transpose', 'velocity', 'algorithm', 'modulatorAttack', 'modulatorDecay',
    'carrierAttack', 'carrierDecay', 'lfoRate', 'lfoPitchDepth', 'arpType', 'arpDivision', 'chorusDepth', 'reverbDepth'] as const;

// ピアノロール上の1ノート。連続した複数ステップにまたがる場合はTIE(タイ)として
// エンコードされ、アタックからリリースまで音が継続する(=「ステップをつなげた和音」)。
export interface SequenceNote {
    pitch: number;
    startStep: number; // 0-15
    length: number; // 何ステップ分継続するか (1-16)
}

export interface SequenceState {
    programNo: number;
    velocity: number;
    gatePercent: number;
    notes: SequenceNote[];
    motionEnabled: boolean[];
    // motionValues[paramIndex][stepIndex] = 0-127
    motionValues: number[][];
}

export const createEmptySequenceState = (): SequenceState => ({
    programNo: 0,
    velocity: 100,
    gatePercent: 80,
    notes: [],
    motionEnabled: Array.from({ length: MOTION_PARAM_COUNT }, () => false),
    motionValues: Array.from({ length: MOTION_PARAM_COUNT }, () => Array.from({ length: NUM_OF_STEPS }, () => 64)),
});
