import type { SoundOperator, SoundProgram } from '@/types/soundProgram';

export const SOUND_PROGRAM_SIZE = 140;
export const SOUND_PROGRAM_NAME_LENGTH = 10;

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));

const operatorBase = (operatorIndex: number) => (5 - operatorIndex) * 17;

export const normalizeSoundProgramName = (value: string): string => Array.from(value)
    .map(character => {
        const code = character.charCodeAt(0);
        return code >= 0x20 && code <= 0x7e ? character : ' ';
    })
    .join('')
    .slice(0, SOUND_PROGRAM_NAME_LENGTH)
    .trimEnd();

const decodeOperator = (data: Uint8Array, operatorIndex: number): SoundOperator => {
    const base = operatorBase(operatorIndex);
    return {
        egRates: Array.from(data.slice(base, base + 4)),
        egLevels: Array.from(data.slice(base + 4, base + 8)),
        breakPoint: data[base + 8],
        leftDepth: data[base + 9],
        rightDepth: data[base + 10],
        leftCurve: data[base + 11] & 0x03,
        rightCurve: (data[base + 11] >> 2) & 0x03,
        rateScaling: data[base + 12] & 0x07,
        detune: (data[base + 12] >> 3) & 0x0f,
        ampModSensitivity: data[base + 13] & 0x03,
        keyVelocitySensitivity: (data[base + 13] >> 2) & 0x07,
        outputLevel: data[base + 14],
        oscillatorMode: data[base + 15] & 0x01,
        coarse: (data[base + 15] >> 1) & 0x1f,
        fine: data[base + 16],
        enabled: data[138 - operatorIndex] !== 0,
    };
};

export const decodeSoundProgram = (source: Uint8Array): SoundProgram => {
    const data = new Uint8Array(SOUND_PROGRAM_SIZE);
    data.set(source.slice(0, SOUND_PROGRAM_SIZE));
    return {
        operators: Array.from({ length: 6 }, (_, index) => decodeOperator(data, index)),
        pitchEgRates: Array.from(data.slice(102, 106)),
        pitchEgLevels: Array.from(data.slice(106, 110)),
        algorithm: data[110] & 0x1f,
        feedback: data[111] & 0x07,
        oscillatorSync: (data[111] & 0x08) !== 0,
        lfoSpeed: data[112],
        lfoDelay: data[113],
        pitchModDepth: data[114],
        ampModDepth: data[115],
        lfoSync: (data[116] & 0x01) !== 0,
        lfoWave: (data[116] >> 1) & 0x07,
        pitchModSensitivity: (data[116] >> 4) & 0x07,
        transpose: data[117],
        name: String.fromCharCode(...data.slice(118, 128)).replace(/\0/g, ' ').trimEnd(),
        modulatorAttack: clamp(data[128] - 64, -63, 63),
        modulatorDecay: clamp(data[129] - 64, -63, 63),
        carrierAttack: clamp(data[130] - 64, -63, 63),
        carrierDecay: clamp(data[131] - 64, -63, 63),
        octave: clamp(data[132] - 4, -2, 2),
    };
};

const encodeOperator = (data: Uint8Array, operator: SoundOperator, operatorIndex: number) => {
    const base = operatorBase(operatorIndex);
    for (let index = 0; index < 4; index++) {
        data[base + index] = clamp(operator.egRates[index], 0, 99);
        data[base + 4 + index] = clamp(operator.egLevels[index], 0, 99);
    }
    data[base + 8] = clamp(operator.breakPoint, 0, 99);
    data[base + 9] = clamp(operator.leftDepth, 0, 99);
    data[base + 10] = clamp(operator.rightDepth, 0, 99);
    data[base + 11] = clamp(operator.leftCurve, 0, 3) | (clamp(operator.rightCurve, 0, 3) << 2);
    data[base + 12] = clamp(operator.rateScaling, 0, 7) | (clamp(operator.detune, 0, 14) << 3);
    data[base + 13] = clamp(operator.ampModSensitivity, 0, 3) | (clamp(operator.keyVelocitySensitivity, 0, 7) << 2);
    data[base + 14] = clamp(operator.outputLevel, 0, 99);
    data[base + 15] = clamp(operator.oscillatorMode, 0, 1) | (clamp(operator.coarse, 0, 31) << 1);
    data[base + 16] = clamp(operator.fine, 0, 99);
    data[138 - operatorIndex] = operator.enabled ? 1 : 0;
};

export const encodeSoundProgram = (program: SoundProgram): Uint8Array => {
    const data = new Uint8Array(SOUND_PROGRAM_SIZE);
    program.operators.forEach((operator, index) => encodeOperator(data, operator, index));
    for (let index = 0; index < 4; index++) {
        data[102 + index] = clamp(program.pitchEgRates[index], 0, 99);
        data[106 + index] = clamp(program.pitchEgLevels[index], 0, 99);
    }
    data[110] = clamp(program.algorithm, 0, 31);
    data[111] = clamp(program.feedback, 0, 7) | (program.oscillatorSync ? 0x08 : 0);
    data[112] = clamp(program.lfoSpeed, 0, 99);
    data[113] = clamp(program.lfoDelay, 0, 99);
    data[114] = clamp(program.pitchModDepth, 0, 99);
    data[115] = clamp(program.ampModDepth, 0, 99);
    data[116] = (program.lfoSync ? 1 : 0) | (clamp(program.lfoWave, 0, 5) << 1) | (clamp(program.pitchModSensitivity, 0, 7) << 4);
    data[117] = clamp(program.transpose, 0, 48);
    const name = normalizeSoundProgramName(program.name).padEnd(SOUND_PROGRAM_NAME_LENGTH, ' ');
    for (let index = 0; index < SOUND_PROGRAM_NAME_LENGTH; index++) data[118 + index] = name.charCodeAt(index);
    data[128] = clamp(program.modulatorAttack + 64, 1, 127);
    data[129] = clamp(program.modulatorDecay + 64, 1, 127);
    data[130] = clamp(program.carrierAttack + 64, 1, 127);
    data[131] = clamp(program.carrierDecay + 64, 1, 127);
    data[132] = clamp(program.octave + 4, 2, 6);
    return data;
};

export const createInitialSoundProgram = (): SoundProgram => decodeSoundProgram(new Uint8Array([
    ...Array.from({ length: 102 }, (_, index) => index % 17 === 14 ? 80 : index % 17 < 4 ? 80 : index % 17 < 8 ? (index % 17 === 4 ? 99 : 0) : 0),
    50, 50, 50, 50, 50, 50, 50, 50, 31, 0, 35, 0, 0, 0, 8, 24,
    ...Array.from('INIT VOICE', character => character.charCodeAt(0)), 64, 64, 64, 64, 4, 1, 1, 1, 1, 1, 1, 0,
]));
