import { defineStore } from 'pinia';
import { ref } from 'vue';
import { pack8to7, unpack7to8 } from '../utils/sequenceCodec';
import { useSequencerStore } from './sequencerStore';

type MIDIAccess = globalThis.MIDIAccess;
type MIDIInput = globalThis.MIDIInput;
type MIDIOutput = globalThis.MIDIOutput;
type MIDIMessageEvent = globalThis.MIDIMessageEvent;

export enum MIDIConnectionState {
    INITIALIZING,   
    SEARCHING,
    NOT_FOUND,
    DETECTED,
    RECEIVING,
    RECEIVED,
    ERROR
}

export const useMidiStore = defineStore('midi', () => {
    const connectionState = ref<MIDIConnectionState>(MIDIConnectionState.INITIALIZING);
    const midiAccess = ref<MIDIAccess | null>(null);
    const midiInputs = ref<string[]>([]);
    const midiOutputs = ref<string[]>([]);
    const selectedMidiIn = ref<string | null>(null);
    const selectedMidiOut = ref<string | null>(null);
    const programNames = ref<{ name: string }[]>(Array.from({ length: 64 }, () => ({ name: '' })));
    const programData = ref<Uint8Array[]>([]);
    const currentProgramFetchState = ref<'idle' | 'loading-programs' | 'requesting' | 'received' | 'error'>('idle');
    const currentProgramFetchProgress = ref(0);
    const sequenceWriteState = ref<'idle' | 'sending' | 'ok' | 'nak' | 'error'>('idle');
    const currentVoiceData = ref<Uint8Array | null>(null);
    const soundEditState = ref<'idle' | 'requesting' | 'received' | 'sending' | 'ok' | 'error'>('idle');
    const logs = ref<string[]>([]);

    const toHex = (bytes: Uint8Array | number[], limit = 24) => {
        const arr = Array.from(bytes).slice(0, limit).map(b => b.toString(16).padStart(2, '0')).join(' ');
        return bytes.length > limit ? `${arr} ... (${bytes.length} bytes)` : `${arr} (${bytes.length} bytes)`;
    };

    const log = (message: string) => {
        const ts = new Date().toTimeString().slice(0, 8) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
        logs.value.push(`[${ts}] ${message}`);
        if (logs.value.length > 500) logs.value.shift();
    };

    const clearLogs = () => {
        logs.value = [];
    };

    type NoteEventCallback = (note: number, on: boolean, velocity: number) => void;
    const noteListeners = new Set<NoteEventCallback>();
    type MidiMessageCallback = (data: Uint8Array, inputName: string) => void;
    const midiMessageListeners = new Set<MidiMessageCallback>();

    /** MIDIキーボード等からのNote On/Offを購読する。戻り値の関数を呼ぶと解除される。 */
    const onNoteEvent = (cb: NoteEventCallback): (() => void) => {
        noteListeners.add(cb);
        return () => noteListeners.delete(cb);
    };

    const onMidiMessage = (cb: MidiMessageCallback): (() => void) => {
        midiMessageListeners.add(cb);
        return () => midiMessageListeners.delete(cb);
    };

    const handleChannelMessage = (data: Uint8Array) => {
        const type = data[0] & 0xf0;
        if (type === 0x90 || type === 0x80) {
            const note = data[1];
            const velocity = data[2] ?? 0;
            const on = type === 0x90 && velocity > 0;
            noteListeners.forEach(cb => cb(note, on, velocity));
        }
    };

    const VOLCA_FM2_ID = {
        MANUFACTURER: 0x42,    // KORG
        FAMILY_LSB: 0x2F,     // volca fm ID
        FAMILY_MSB: 0x01,
        MEMBER_LSB: 0x08,     // 2nd generation ID
        MEMBER_MSB: 0x00
    };

    const initMIDI = async () => {
        try {
            const access = await navigator.requestMIDIAccess({ sysex: true });
            midiAccess.value = access;
            midiInputs.value = Array.from(access.inputs.values())
                .map(input => input.name ?? '')
                .filter(Boolean);
            midiOutputs.value = Array.from(access.outputs.values())
                .map(output => output.name ?? '')
                .filter(Boolean);

            log(`MIDI initialized. inputs=[${midiInputs.value.join(', ')}] outputs=[${midiOutputs.value.join(', ')}]`);

            access.inputs.forEach(input => {
                // 大きなSysEx (SEQUENCE DATA DUMPなど数KB) はOS/ドライバによって
                // 複数のonmidimessageイベントに分割されて届くことがあるため、
                // F0で開始しF7で終わるまでバイト単位でバッファリングしてから処理する。
                // その間に挟まるシステムリアルタイムメッセージ(F8/FA/FB/FC/FE/FF)は読み飛ばす。
                let sysexBuffer: number[] = [];
                input.onmidimessage = (event: MIDIMessageEvent) => {
                    const eventData = event.data;
                    if (!eventData) return;
                    midiMessageListeners.forEach(cb => cb(eventData, input.name ?? ''));

                    // SysExでない、かつSysEx受信中でもない場合はチャンネルメッセージとして扱う
                    // (Note On/Off等。MIDIキーボードからのステップ入力に使う)。
                    const status = eventData[0];
                    if (sysexBuffer.length === 0 && status !== 0xF0 && status < 0xF8) {
                        handleChannelMessage(eventData);
                        return;
                    }

                    for (const byte of eventData) {
                        if (byte === 0xF0) {
                            sysexBuffer = [0xF0];
                        } else if (byte === 0xF8 || byte === 0xFA || byte === 0xFB || byte === 0xFC || byte === 0xFE || byte === 0xFF) {
                            continue;
                        } else if (sysexBuffer.length > 0) {
                            sysexBuffer.push(byte);
                            if (byte === 0xF7) {
                                processMIDIMessage(new Uint8Array(sysexBuffer), input, access);
                                sysexBuffer = [];
                            }
                        }
                    }
                };
            });
            detectVolcaFM2();
        } catch (err) {
            log(`MIDI init error: ${err}`);
            connectionState.value = MIDIConnectionState.ERROR;
        }
    };

    const processMIDIMessage = (
        data: Uint8Array,
        input: MIDIInput,
        midiAccess: MIDIAccess
    ) => {
        if (data[0] === 0xF0) {
            log(`RX SysEx from "${input.name}": ${toHex(data)}`);
            if (isVolcaFM2Reply(data)) {
                const outputId = findMatchingOutputPort(input.name ?? '');
                if (outputId) {
                    selectedMidiIn.value = input.name;
                    selectedMidiOut.value = midiAccess.outputs.get(outputId)?.name ?? null;
                    connectionState.value = MIDIConnectionState.DETECTED;
                    log(`Device Inquiry Reply matched. in="${selectedMidiIn.value}" out="${selectedMidiOut.value}"`);
                }
            } else if (isVolcaFM2Dump(data)) {
                connectionState.value = MIDIConnectionState.RECEIVING;
                const programNo = data[7];
                const programDataArray = processVolcaDump(data.slice(8, -1));
                const programName = String.fromCharCode(...programDataArray.slice(118, 127));
                programNames.value[programNo] = { name: programName };
                programData.value[programNo] = programDataArray;
                if (currentProgramFetchState.value === 'loading-programs') {
                    currentProgramFetchProgress.value = programData.value.filter(Boolean).length;
                }
                log(`Program dump received: #${programNo} "${programName}"`);
                if (programNo === 63) {
                    connectionState.value = MIDIConnectionState.RECEIVED;
                }
            } else if (isVolcaFM2CurrentVoiceDump(data)) {
                try {
                    const currentProgramData = unpack7to8(data.slice(7, -1), 140);
                    currentVoiceData.value = currentProgramData;
                    if (soundEditState.value === 'requesting') soundEditState.value = 'received';
                    if (currentProgramFetchState.value !== 'requesting') {
                        log(`Sound Edit current program received (${currentProgramData.length} bytes).`);
                        return;
                    }
                    const voiceData = currentProgramData.slice(0, 128);
                    const currentName = decodeVoiceName(voiceData);
                    const candidates = programData.value
                        .map((stored, programNo) => ({
                            programNo,
                            name: programNames.value[programNo]?.name.trim() ?? '',
                            differences: countByteDifferences(voiceData, stored),
                        }))
                        .filter(candidate => candidate.name === currentName);
                    const pool = candidates.length > 0
                        ? candidates
                        : programData.value.map((stored, programNo) => ({
                            programNo,
                            name: programNames.value[programNo]?.name.trim() ?? '',
                            differences: countByteDifferences(voiceData, stored),
                        }));
                    const match = pool.sort((a, b) => a.differences - b.differences)[0];
                    if (!match) throw new Error('No stored program data is available for comparison.');
                    useSequencerStore().programNo = match.programNo;
                    currentProgramFetchState.value = 'received';
                    log(`Current voice matched program #${match.programNo} "${currentName}" (byte differences=${match.differences}, nameCandidates=${candidates.length}).`);
                } catch (error) {
                    currentProgramFetchState.value = 'error';
                    log(`Current voice matching failed: ${error}`);
                }
            } else if (isVolcaFM2Status(data)) {
                const STATUS_LABELS: Record<number, string> = {
                    0x23: 'ACK: DATA LOAD COMPLETED',
                    0x24: 'NAK: DATA LOAD ERROR',
                    0x25: 'NAK: BUFFER FULL',
                    0x26: 'NAK: DATA FORMAT ERROR',
                };
                log(`Status reply: 0x${data[6].toString(16)} (${STATUS_LABELS[data[6]] ?? 'unknown'})`);
                if (sequenceWriteState.value === 'sending') {
                    sequenceWriteState.value = data[6] === 0x23 ? 'ok' : 'nak';
                }
                if (soundEditState.value === 'sending') {
                    soundEditState.value = data[6] === 0x23 ? 'ok' : 'error';
                }
            } else {
                log(`Unrecognized SysEx (func=0x${data[6]?.toString(16) ?? '??'}).`);
            }
        }
    };

    const detectVolcaFM2 = async () => {
        connectionState.value = MIDIConnectionState.SEARCHING;
        log('Searching for volca fm2 (sending Device Inquiry to all outputs)...');

        midiAccess.value?.outputs.forEach((output: MIDIOutput) => {
            const DEVICE_INQUIRY = [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7];
            output.send(new Uint8Array(DEVICE_INQUIRY));
        });

        setTimeout(() => {
            if (connectionState.value === MIDIConnectionState.SEARCHING) {
                connectionState.value = MIDIConnectionState.NOT_FOUND;
                log('volca fm2 not found (timeout).');
            }
        }, 2000);
    };

    const isVolcaFM2Reply = (data: Uint8Array) => {
        return (
            data[5] === VOLCA_FM2_ID.MANUFACTURER &&
            data[6] === VOLCA_FM2_ID.FAMILY_LSB &&
            data[7] === VOLCA_FM2_ID.FAMILY_MSB &&
            data[8] === VOLCA_FM2_ID.MEMBER_LSB &&
            data[9] === VOLCA_FM2_ID.MEMBER_MSB
        );
    };

    const isVolcaFM2Dump = (data: Uint8Array) => {
        return (
            data[1] === VOLCA_FM2_ID.MANUFACTURER &&
            data[2] === 0x30 &&
            data[3] === 0x00 &&
            data[4] === VOLCA_FM2_ID.FAMILY_MSB &&
            data[5] === VOLCA_FM2_ID.FAMILY_LSB &&
            data[6] === 0x4E
        );
    };

    const isVolcaFM2CurrentVoiceDump = (data: Uint8Array) => {
        return (
            data[1] === VOLCA_FM2_ID.MANUFACTURER &&
            data[2] === 0x30 &&
            data[3] === 0x00 &&
            data[4] === VOLCA_FM2_ID.FAMILY_MSB &&
            data[5] === VOLCA_FM2_ID.FAMILY_LSB &&
            data[6] === 0x42
        );
    };

    const decodeVoiceName = (voiceData: Uint8Array) =>
        String.fromCharCode(...voiceData.slice(118, 128)).replace(/\0/g, '').trim();

    const countByteDifferences = (current: Uint8Array, stored: Uint8Array) => {
        let differences = 0;
        for (let index = 0; index < 128; index++) {
            if (current[index] !== stored[index]) differences++;
        }
        return differences;
    };

    const isVolcaFM2Status = (data: Uint8Array) => {
        return (
            data[1] === VOLCA_FM2_ID.MANUFACTURER &&
            data[2] === 0x30 &&
            data[3] === 0x00 &&
            data[4] === VOLCA_FM2_ID.FAMILY_MSB &&
            data[5] === VOLCA_FM2_ID.FAMILY_LSB &&
            data[6] >= 0x23 && data[6] <= 0x26
        );
    };

    const findMatchingOutputPort = (inputName: string) => {
        if (!midiAccess.value) return null;
        for (const [id, output] of midiAccess.value.outputs.entries()) {
            if (output.name === inputName) {
                return id;
            }
        }
        return null;
    };

    const requestProgramDump = async () => {
        reset();
        if (!selectedMidiOut.value || !midiAccess.value) return;

        const output = Array.from(midiAccess.value.outputs.values())
            .find((output: MIDIOutput) => output.name === selectedMidiOut.value);

        if (!output) {
            connectionState.value = MIDIConnectionState.ERROR;
            return;
        }

        log('Requesting all 64 program dumps...');
        let DUMP_REQUEST = [0xF0, 0x42, 0x30, 0x00, 0x01, 0x2F, 0x1E, 0x00, 0xF7];
        for (let i = 0; i < 64; i++) {
            DUMP_REQUEST[7] = i;
            output.send(new Uint8Array(DUMP_REQUEST));
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    };

    const waitForProgramDumps = async (timeoutMs = 6000) => {
        const startedAt = performance.now();
        while (programData.value.filter(Boolean).length < 64) {
            if (performance.now() - startedAt >= timeoutMs) return false;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return true;
    };

    const requestCurrentVoiceProgramNo = async () => {
        currentProgramFetchState.value = 'loading-programs';
        currentProgramFetchProgress.value = programData.value.filter(Boolean).length;
        if (programData.value.filter(Boolean).length < 64) {
            log('Program data is incomplete; receiving all 64 programs before matching the current voice...');
            await requestProgramDump();
            if (!await waitForProgramDumps()) {
                currentProgramFetchState.value = 'error';
                log('Current voice lookup failed: timed out while receiving the 64 reference programs.');
                return;
            }
        }

        currentProgramFetchState.value = 'requesting';
        currentProgramFetchProgress.value = 64;
        log('Requesting CURRENT VOICE DATA DUMP (Func 0x12)...');
        const request = new Uint8Array([0xf0, 0x42, 0x30, 0x00, 0x01, 0x2f, 0x12, 0xf7]);
        if (!sendSysEx(request)) {
            currentProgramFetchState.value = 'error';
            return;
        }
        setTimeout(() => {
            if (currentProgramFetchState.value === 'requesting') {
                currentProgramFetchState.value = 'error';
                log('Current voice request timed out (no Func 0x42 reply within 4s).');
            }
        }, 4000);
    };

    const processVolcaDump = (data: Uint8Array) => {
        const unpackedData: Uint8Array = new Uint8Array(128);
        let r = 0, w = 0; // read, write index

        while (r < data.length) {
            unpackedData[w + 0] = data[r + 1] | (((data[r + 0] >> 0) & 1) << 7);
            unpackedData[w + 1] = data[r + 2] | (((data[r + 0] >> 1) & 1) << 7);
            unpackedData[w + 2] = data[r + 3] | (((data[r + 0] >> 2) & 1) << 7);
            unpackedData[w + 3] = data[r + 4] | (((data[r + 0] >> 3) & 1) << 7);
            unpackedData[w + 4] = data[r + 5] | (((data[r + 0] >> 4) & 1) << 7);
            unpackedData[w + 5] = data[r + 6] | (((data[r + 0] >> 5) & 1) << 7);
            unpackedData[w + 6] = data[r + 7] | (((data[r + 0] >> 6) & 1) << 7);
            r += 8;
            w += 7;
        }

        return unpackedData.slice(0, 128);
    }

    const downloadSysEx = (isFirst: boolean) => {
        const dx7Header = [0xF0, 0x43, 0x00, 0x09, 0x20, 0x00];
        const dx7Footer = [0x00, 0xF7];

        const allVoicesData = isFirst
            ? programData.value.slice(0, 32).reduce<number[]>((acc, val) => acc.concat(Array.from(val)), [])
            : programData.value.slice(32, 64).reduce<number[]>((acc, val) => acc.concat(Array.from(val)), []);

        const checksum = (0x100 - allVoicesData.reduce((acc, val) => (acc + val) & 0xFF, 0)) & 0x7F;
        dx7Footer[0] = checksum;

        const dx7CartridgeData = [...dx7Header, ...allVoicesData, ...dx7Footer];
        const blob = new Blob([new Uint8Array(dx7CartridgeData)], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = isFirst ? 'volca_fm2_dx7_cartridge_1.syx' : 'volca_fm2_dx7_cartridge_2.syx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    const reset = () => {
        programNames.value = Array.from({ length: 64 }, () => ({ name: '' }));
        programData.value = [];
    }

    const sendCurrentSequenceDump = (bytes: Uint8Array) => {
        sequenceWriteState.value = 'sending';
        log('Sending CURRENT SEQUENCE DATA DUMP (Func 0x40)...');
        if (!sendSysEx(bytes)) {
            sequenceWriteState.value = 'error';
            log('Failed to send sequence dump: no MIDI output selected.');
            return;
        }
        setTimeout(() => {
            if (sequenceWriteState.value === 'sending') {
                sequenceWriteState.value = 'error';
                log('Sequence dump write timed out (no ACK/NAK within 4s).');
            }
        }, 4000);
    };

    const requestCurrentVoiceDump = () => {
        soundEditState.value = 'requesting';
        log('Requesting CURRENT PROGRAM DATA DUMP for Sound Edit (Func 0x12)...');
        if (!sendSysEx(new Uint8Array([0xf0, 0x42, 0x30, 0x00, 0x01, 0x2f, 0x12, 0xf7]))) {
            soundEditState.value = 'error';
            return;
        }
        setTimeout(() => {
            if (soundEditState.value === 'requesting') {
                soundEditState.value = 'error';
                log('Sound Edit current program request timed out.');
            }
        }, 4000);
    };

    const sendCurrentVoiceDump = (programDataBytes: Uint8Array) => {
        soundEditState.value = 'sending';
        const message = new Uint8Array([0xf0, 0x42, 0x30, 0x00, 0x01, 0x2f, 0x42, ...pack8to7(programDataBytes), 0xf7]);
        log('Sending CURRENT PROGRAM DATA DUMP from Sound Edit (Func 0x42)...');
        if (!sendSysEx(message)) {
            soundEditState.value = 'error';
            return;
        }
        setTimeout(() => {
            if (soundEditState.value === 'sending') {
                soundEditState.value = 'error';
                log('Sound Edit program write timed out (no ACK/NAK within 4s).');
            }
        }, 4000);
    };

    const sendSysEx = (bytes: Uint8Array): boolean => {
        if (!selectedMidiOut.value || !midiAccess.value) return false;

        const output = Array.from(midiAccess.value.outputs.values())
            .find((output: MIDIOutput) => output.name === selectedMidiOut.value);

        if (!output) return false;

        log(`TX SysEx to "${output.name}": ${toHex(bytes)}`);
        output.send(bytes);
        return true;
    };

    const sendMidiMessage = (bytes: Uint8Array): boolean => {
        if (!selectedMidiOut.value || !midiAccess.value) return false;
        const output = Array.from(midiAccess.value.outputs.values())
            .find((candidate: MIDIOutput) => candidate.name === selectedMidiOut.value);
        if (!output) return false;
        log(`TX MIDI: ${toHex(bytes)}`);
        output.send(bytes);
        return true;
    };

    return {
        connectionState,
        MIDIConnectionState,
        midiInputs,
        midiOutputs,
        selectedMidiIn,
        selectedMidiOut,
        programNames,
        initMIDI,
        detectVolcaFM2,
        requestProgramDump,
        downloadSysEx,
        sendSysEx,
        currentProgramFetchState,
        currentProgramFetchProgress,
        requestCurrentVoiceProgramNo,
        sequenceWriteState,
        sendCurrentSequenceDump,
        currentVoiceData,
        soundEditState,
        requestCurrentVoiceDump,
        sendCurrentVoiceDump,
        logs,
        addLog: log,
        clearLogs,
        onNoteEvent,
        onMidiMessage,
        sendMidiMessage,
        reset
    };
});
