const isRealtime = (byte: number) =>
    byte === 0xF8 || byte === 0xFA || byte === 0xFB || byte === 0xFC || byte === 0xFE || byte === 0xFF;

/**
 * Reassemble SysEx that the OS/driver may split across multiple MIDI events.
 * Realtime bytes (clock/active sensing/etc.) that arrive mid-stream are skipped.
 */
export const createSysexAssembler = () => {
    let buffer: number[] = [];

    const isChannelMessage = (eventData: Uint8Array) => {
        const status = eventData[0];
        return buffer.length === 0 && status !== 0xF0 && status < 0xF8;
    };

    const push = (eventData: Uint8Array): Uint8Array[] => {
        const messages: Uint8Array[] = [];
        for (const byte of eventData) {
            if (byte === 0xF0) {
                buffer = [0xF0];
            } else if (isRealtime(byte)) {
                continue;
            } else if (buffer.length > 0) {
                buffer.push(byte);
                if (byte === 0xF7) {
                    messages.push(new Uint8Array(buffer));
                    buffer = [];
                }
            }
        }
        return messages;
    };

    return { isChannelMessage, push };
};
