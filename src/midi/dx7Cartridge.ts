/** Yamaha DX7 32-voice cartridge SysEx (0x43 / format 9). */
export const buildDx7Cartridge = (voices: Uint8Array[]): Uint8Array => {
    const allVoicesData = voices.reduce<number[]>((acc, voice) => acc.concat(Array.from(voice)), []);
    const checksum = (0x100 - allVoicesData.reduce((acc, value) => (acc + value) & 0xFF, 0)) & 0x7F;
    return new Uint8Array([0xF0, 0x43, 0x00, 0x09, 0x20, 0x00, ...allVoicesData, checksum, 0xF7]);
};
