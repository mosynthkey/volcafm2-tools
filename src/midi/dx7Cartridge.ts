/** Yamaha DX7 32-voice cartridge SysEx (0x43 / format 9) and 1-voice dump (format 0). */

export const DX7_PACKED_VOICE_SIZE = 128;
export const DX7_UNPACKED_VOICE_SIZE = 155;
export const DX7_CARTRIDGE_VOICE_COUNT = 32;
export const DX7_VOICE_NAME_LENGTH = 10;

export type Dx7PackedVoice = {
    name: string;
    packed: Uint8Array;
};

const packedOperatorSize = 17;
const unpackedOperatorSize = 21;

const checksum7 = (data: Uint8Array) =>
    (0x100 - data.reduce((sum, value) => (sum + value) & 0xff, 0)) & 0x7f;

const decodeName = (bytes: Uint8Array) =>
    String.fromCharCode(...bytes).replace(/\0/g, ' ').trimEnd();

export const packedVoiceName = (packed: Uint8Array) =>
    decodeName(packed.subarray(118, 118 + DX7_VOICE_NAME_LENGTH));

const unpackedVoiceName = (unpacked: Uint8Array) =>
    decodeName(unpacked.subarray(145, 145 + DX7_VOICE_NAME_LENGTH));

export const packDx7Voice = (unpacked: Uint8Array): Uint8Array => {
    const packed = new Uint8Array(DX7_PACKED_VOICE_SIZE);
    for (let operatorIndex = 0; operatorIndex < 6; operatorIndex++) {
        const unpackedBase = operatorIndex * unpackedOperatorSize;
        const packedBase = operatorIndex * packedOperatorSize;
        packed.set(unpacked.subarray(unpackedBase, unpackedBase + 11), packedBase);
        packed[packedBase + 11] = (unpacked[unpackedBase + 11] & 0x03)
            | ((unpacked[unpackedBase + 12] & 0x03) << 2);
        packed[packedBase + 12] = (unpacked[unpackedBase + 13] & 0x07)
            | ((unpacked[unpackedBase + 20] & 0x0f) << 3);
        packed[packedBase + 13] = (unpacked[unpackedBase + 14] & 0x03)
            | ((unpacked[unpackedBase + 15] & 0x07) << 2);
        packed[packedBase + 14] = unpacked[unpackedBase + 16];
        packed[packedBase + 15] = (unpacked[unpackedBase + 17] & 0x01)
            | ((unpacked[unpackedBase + 18] & 0x1f) << 1);
        packed[packedBase + 16] = unpacked[unpackedBase + 19];
    }
    packed.set(unpacked.subarray(126, 134), 102);
    packed[110] = unpacked[134] & 0x1f;
    packed[111] = (unpacked[135] & 0x07) | ((unpacked[136] & 0x01) << 3);
    packed[112] = unpacked[137];
    packed[113] = unpacked[138];
    packed[114] = unpacked[139];
    packed[115] = unpacked[140];
    packed[116] = (unpacked[141] & 0x01)
        | ((unpacked[142] & 0x07) << 1)
        | ((unpacked[143] & 0x07) << 4);
    packed[117] = unpacked[144];
    packed.set(unpacked.subarray(145, 155), 118);
    return packed;
};

export const unpackDx7Voice = (packed: Uint8Array): Uint8Array => {
    const unpacked = new Uint8Array(DX7_UNPACKED_VOICE_SIZE);
    for (let operatorIndex = 0; operatorIndex < 6; operatorIndex++) {
        const packedBase = operatorIndex * packedOperatorSize;
        const unpackedBase = operatorIndex * unpackedOperatorSize;
        unpacked.set(packed.subarray(packedBase, packedBase + 11), unpackedBase);
        unpacked[unpackedBase + 11] = packed[packedBase + 11] & 0x03;
        unpacked[unpackedBase + 12] = (packed[packedBase + 11] >> 2) & 0x03;
        unpacked[unpackedBase + 13] = packed[packedBase + 12] & 0x07;
        unpacked[unpackedBase + 20] = (packed[packedBase + 12] >> 3) & 0x0f;
        unpacked[unpackedBase + 14] = packed[packedBase + 13] & 0x03;
        unpacked[unpackedBase + 15] = (packed[packedBase + 13] >> 2) & 0x07;
        unpacked[unpackedBase + 16] = packed[packedBase + 14];
        unpacked[unpackedBase + 17] = packed[packedBase + 15] & 0x01;
        unpacked[unpackedBase + 18] = (packed[packedBase + 15] >> 1) & 0x1f;
        unpacked[unpackedBase + 19] = packed[packedBase + 16];
    }
    unpacked.set(packed.subarray(102, 110), 126);
    unpacked[134] = packed[110] & 0x1f;
    unpacked[135] = packed[111] & 0x07;
    unpacked[136] = (packed[111] >> 3) & 0x01;
    unpacked[137] = packed[112];
    unpacked[138] = packed[113];
    unpacked[139] = packed[114];
    unpacked[140] = packed[115];
    unpacked[141] = packed[116] & 0x01;
    unpacked[142] = (packed[116] >> 1) & 0x07;
    unpacked[143] = (packed[116] >> 4) & 0x07;
    unpacked[144] = packed[117];
    unpacked.set(packed.subarray(118, 128), 145);
    return unpacked;
};

/** volca extras (macros / octave / op on-off) are not in DX7 data; use centered defaults. */
export const packedVoiceToVolcaProgram = (packed: Uint8Array): Uint8Array => {
    const program = new Uint8Array(140);
    program.set(packed.subarray(0, DX7_PACKED_VOICE_SIZE));
    program[128] = 64;
    program[129] = 64;
    program[130] = 64;
    program[131] = 64;
    program[132] = 4;
    for (let operatorIndex = 0; operatorIndex < 6; operatorIndex++) {
        program[133 + operatorIndex] = 1;
    }
    return program;
};

export const buildDx7Cartridge = (voices: Uint8Array[]): Uint8Array => {
    const allVoicesData = voices.reduce<number[]>((acc, voice) => acc.concat(Array.from(voice)), []);
    const checksum = (0x100 - allVoicesData.reduce((acc, value) => (acc + value) & 0xFF, 0)) & 0x7F;
    return new Uint8Array([0xF0, 0x43, 0x00, 0x09, 0x20, 0x00, ...allVoicesData, checksum, 0xF7]);
};

export const buildDx7SingleVoice = (unpacked: Uint8Array): Uint8Array => {
    const voice = unpacked.length === DX7_PACKED_VOICE_SIZE ? unpackDx7Voice(unpacked) : unpacked.subarray(0, DX7_UNPACKED_VOICE_SIZE);
    const checksum = checksum7(voice);
    return new Uint8Array([0xF0, 0x43, 0x00, 0x00, 0x01, 0x1B, ...voice, checksum, 0xF7]);
};

const voicesFromMessage = (message: Uint8Array): Dx7PackedVoice[] => {
    if (message.length < 8 || message[0] !== 0xf0 || message[1] !== 0x43 || message[message.length - 1] !== 0xf7) {
        return [];
    }
    if ((message[2] & 0xf0) !== 0x00) return [];
    const format = message[3];
    const declaredLength = (message[4] << 7) | message[5];
    const availableLength = message.length - 8;
    const dataLength = Math.min(declaredLength, availableLength);
    const data = message.subarray(6, 6 + dataLength);
    if (format === 0x00 && data.length >= DX7_UNPACKED_VOICE_SIZE) {
        const unpacked = data.subarray(0, DX7_UNPACKED_VOICE_SIZE);
        const packed = packDx7Voice(unpacked);
        return [{ name: unpackedVoiceName(unpacked) || packedVoiceName(packed), packed }];
    }
    if (format === 0x09 && data.length >= DX7_PACKED_VOICE_SIZE * DX7_CARTRIDGE_VOICE_COUNT) {
        return Array.from({ length: DX7_CARTRIDGE_VOICE_COUNT }, (_, voiceIndex) => {
            const start = voiceIndex * DX7_PACKED_VOICE_SIZE;
            const packed = Uint8Array.from(data.subarray(start, start + DX7_PACKED_VOICE_SIZE));
            return { name: packedVoiceName(packed), packed };
        });
    }
    return [];
};

export const parseDx7Sysex = (fileBytes: Uint8Array): Dx7PackedVoice[] => {
    const voices: Dx7PackedVoice[] = [];
    let offset = 0;
    while (offset < fileBytes.length) {
        if (fileBytes[offset] !== 0xf0) {
            offset += 1;
            continue;
        }
        let end = offset + 1;
        while (end < fileBytes.length && fileBytes[end] !== 0xf7) end += 1;
        if (end >= fileBytes.length) break;
        voices.push(...voicesFromMessage(fileBytes.subarray(offset, end + 1)));
        offset = end + 1;
    }
    return voices;
};
