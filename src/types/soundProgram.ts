export interface SoundOperator {
    egRates: number[];
    egLevels: number[];
    breakPoint: number;
    leftDepth: number;
    rightDepth: number;
    leftCurve: number;
    rightCurve: number;
    rateScaling: number;
    ampModSensitivity: number;
    keyVelocitySensitivity: number;
    outputLevel: number;
    oscillatorMode: number;
    coarse: number;
    fine: number;
    detune: number;
    enabled: boolean;
}

export interface SoundProgram {
    operators: SoundOperator[];
    pitchEgRates: number[];
    pitchEgLevels: number[];
    algorithm: number;
    feedback: number;
    oscillatorSync: boolean;
    lfoSpeed: number;
    lfoDelay: number;
    pitchModDepth: number;
    ampModDepth: number;
    lfoSync: boolean;
    lfoWave: number;
    pitchModSensitivity: number;
    transpose: number;
    name: string;
    modulatorAttack: number;
    modulatorDecay: number;
    carrierAttack: number;
    carrierDecay: number;
    octave: number;
}

