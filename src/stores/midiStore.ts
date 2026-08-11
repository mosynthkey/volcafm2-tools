import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createMidiMessageRouter } from '@/midi/midiMessageRouter';
import { formatMidiBytes, MidiTransport } from '@/midi/midiTransport';
import {
    createCurrentVoiceDump, createCurrentVoiceRequest, createDeviceInquiry,
    createProgramRequest, decodeCurrentVoice, isCurrentVoiceDump, isDeviceInquiryReply,
    isProgramDump, isStatusReply, statusLabel, unpackProgramDump,
} from '@/midi/volcaFm2Protocol';
import { loadProgramReferences, matchCurrentVoice } from '@/midi/programLoader';

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
    const lastReceivedProgram = ref<{ programNo: number; name: string } | null>(null);
    const currentProgramFetchState = ref<'idle' | 'loading-programs' | 'requesting' | 'received' | 'error'>('idle');
    const currentProgramFetchProgress = ref(0);
    const matchedProgramNo = ref<number | null>(null);
    const sequenceWriteState = ref<'idle' | 'sending' | 'ok' | 'nak' | 'error'>('idle');
    const currentVoiceData = ref<Uint8Array | null>(null);
    const soundEditState = ref<'idle' | 'requesting' | 'received' | 'sending' | 'ok' | 'error'>('idle');
    const logs = ref<string[]>([]);
    let programLoadPromise: Promise<boolean> | null = null;

    const log = (message: string) => {
        const ts = new Date().toTimeString().slice(0, 8) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
        logs.value.push(`[${ts}] ${message}`);
        if (logs.value.length > 500) logs.value.shift();
    };

    const clearLogs = () => {
        logs.value = [];
    };

    const router = createMidiMessageRouter();
    const transport = new MidiTransport(log);
    const onNoteEvent = router.onNote;
    const onMidiMessage = router.onMessage;
    const onProgramChange = router.onProgramChange;

    const initMIDI = async () => {
        try {
            const access = await transport.initialize();
            midiAccess.value = access;
            midiInputs.value = transport.inputNames();
            midiOutputs.value = transport.outputNames();

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
                    router.publishRaw(eventData, input.name ?? '');

                    // SysExでない、かつSysEx受信中でもない場合はチャンネルメッセージとして扱う
                    // (Note On/Off等。MIDIキーボードからのステップ入力に使う)。
                    const status = eventData[0];
                    if (sysexBuffer.length === 0 && status !== 0xF0 && status < 0xF8) {
                        const messageType = eventData[0] & 0xf0;
                        if (messageType === 0xc0) log(`RX Program Change: #${eventData[1] & 0x7f}`);
                        router.publishChannel(eventData);
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
            log(`RX SysEx from "${input.name}": ${formatMidiBytes(data)}`);
            if (isDeviceInquiryReply(data)) {
                const outputId = findMatchingOutputPort(input.name ?? '');
                if (outputId) {
                    selectedMidiIn.value = input.name;
                    selectedMidiOut.value = midiAccess.outputs.get(outputId)?.name ?? null;
                    connectionState.value = MIDIConnectionState.DETECTED;
                    log(`Device Inquiry Reply matched. in="${selectedMidiIn.value}" out="${selectedMidiOut.value}"`);
                    void ensureAllProgramDumps();
                }
            } else if (isProgramDump(data)) {
                connectionState.value = MIDIConnectionState.RECEIVING;
                const programNo = data[7];
                const programDataArray = unpackProgramDump(data.slice(8, -1));
                const programName = String.fromCharCode(...programDataArray.slice(118, 127));
                programNames.value[programNo] = { name: programName };
                programData.value[programNo] = programDataArray;
                lastReceivedProgram.value = { programNo, name: programName.trim() };
                currentProgramFetchProgress.value = programData.value.filter(Boolean).length;
                log(`Program dump received: #${programNo} "${programName}"`);
                if (currentProgramFetchProgress.value === 64) {
                    connectionState.value = MIDIConnectionState.RECEIVED;
                }
            } else if (isCurrentVoiceDump(data)) {
                try {
                    const currentProgramData = decodeCurrentVoice(data);
                    currentVoiceData.value = currentProgramData;
                    if (soundEditState.value === 'requesting') soundEditState.value = 'received';
                    if (currentProgramFetchState.value !== 'requesting') {
                        log(`Sound Edit current program received (${currentProgramData.length} bytes).`);
                        return;
                    }
                    const voiceData = currentProgramData.slice(0, 128);
                    const match = matchCurrentVoice(voiceData, programData.value, programNames.value);
                    matchedProgramNo.value = match.programNo;
                    currentProgramFetchState.value = 'received';
                    log(`Current voice matched program #${match.programNo} "${match.currentName}" (byte differences=${match.differences}, nameCandidates=${match.nameCandidateCount}).`);
                } catch (error) {
                    currentProgramFetchState.value = 'error';
                    log(`Current voice matching failed: ${error}`);
                }
            } else if (isStatusReply(data)) {
                log(`Status reply: 0x${data[6].toString(16)} (${statusLabel(data[6])})`);
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
            output.send(createDeviceInquiry());
        });

        setTimeout(() => {
            if (connectionState.value === MIDIConnectionState.SEARCHING) {
                connectionState.value = MIDIConnectionState.NOT_FOUND;
                log('volca fm2 not found (timeout).');
            }
        }, 2000);
    };

    const findMatchingOutputPort = (inputName: string) => {
        return transport.matchingOutputId(inputName);
    };

    const waitForProgram = async (programNo: number, timeoutMs: number) => {
        const startedAt = performance.now();
        while (!programData.value[programNo]) {
            if (performance.now() - startedAt >= timeoutMs) return false;
            await new Promise(resolve => setTimeout(resolve, 5));
        }
        return true;
    };

    const loadAllProgramDumps = async () => {
        if (!selectedMidiOut.value || !midiAccess.value) return false;

        const output = Array.from(midiAccess.value.outputs.values())
            .find((output: MIDIOutput) => output.name === selectedMidiOut.value);

        if (!output) {
            connectionState.value = MIDIConnectionState.ERROR;
            return false;
        }

        connectionState.value = MIDIConnectionState.RECEIVING;
        log('Preloading all 64 program dumps (adaptive response timing)...');
        const missing = await loadProgramReferences({
            hasProgram: programNo => Boolean(programData.value[programNo]),
            request: programNo => output.send(createProgramRequest(programNo)),
            waitFor: waitForProgram,
            log,
        });
        currentProgramFetchProgress.value = programData.value.filter(Boolean).length;
        if (missing.length === 0) {
            connectionState.value = MIDIConnectionState.RECEIVED;
            log('Program preload complete: 64/64 received.');
            return true;
        }
        connectionState.value = MIDIConnectionState.DETECTED;
        log(`Program preload incomplete: ${currentProgramFetchProgress.value}/64 received; missing=[${missing.join(',')}].`);
        return false;
    };

    const ensureAllProgramDumps = () => {
        if (programData.value.filter(Boolean).length === 64) return Promise.resolve(true);
        if (!programLoadPromise) {
            programLoadPromise = loadAllProgramDumps().finally(() => { programLoadPromise = null; });
        }
        return programLoadPromise;
    };

    const requestProgramDump = async () => {
        return ensureAllProgramDumps();
    };

    const requestCurrentVoiceProgramNo = async () => {
        currentProgramFetchState.value = 'loading-programs';
        currentProgramFetchProgress.value = programData.value.filter(Boolean).length;
        if (programData.value.filter(Boolean).length < 64) {
            log('Program data is incomplete; receiving all 64 programs before matching the current voice...');
            if (!await ensureAllProgramDumps()) {
                currentProgramFetchState.value = 'error';
                log('Current voice lookup failed: timed out while receiving the 64 reference programs.');
                return;
            }
        }

        currentProgramFetchState.value = 'requesting';
        currentProgramFetchProgress.value = 64;
        log('Requesting CURRENT VOICE DATA DUMP (Func 0x12)...');
        const request = createCurrentVoiceRequest();
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
        lastReceivedProgram.value = null;
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
        if (!sendSysEx(createCurrentVoiceRequest())) {
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
        const message = createCurrentVoiceDump(programDataBytes);
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
        const sent = transport.send(selectedMidiOut.value, bytes);
        if (sent) log(`TX SysEx: ${formatMidiBytes(bytes)}`);
        return sent;
    };

    const sendMidiMessage = (bytes: Uint8Array): boolean => {
        return transport.send(selectedMidiOut.value, bytes);
    };

    return {
        connectionState,
        MIDIConnectionState,
        midiInputs,
        midiOutputs,
        selectedMidiIn,
        selectedMidiOut,
        programNames,
        lastReceivedProgram,
        initMIDI,
        detectVolcaFM2,
        requestProgramDump,
        downloadSysEx,
        sendSysEx,
        currentProgramFetchState,
        currentProgramFetchProgress,
        matchedProgramNo,
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
        onProgramChange,
        sendMidiMessage,
        reset
    };
});
