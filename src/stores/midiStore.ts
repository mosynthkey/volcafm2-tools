import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { MIDIConnectionState, isDeviceReadyState, isIdleConnectedState } from '@/midi/connectionState';
import { buildDx7Cartridge } from '@/midi/dx7Cartridge';
import { createMidiMessageRouter } from '@/midi/midiMessageRouter';
import { createSysexAssembler } from '@/midi/sysexAssembler';
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

const REPLY_TIMEOUT_MS = 4000;

export { MIDIConnectionState };

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

    const receivedProgramCount = computed(() => programData.value.filter(Boolean).length);
    const isDeviceReady = computed(() => isDeviceReadyState(connectionState.value));
    const isIdleConnected = computed(() => isIdleConnectedState(connectionState.value));
    const isLibraryReady = computed(() => connectionState.value === MIDIConnectionState.RECEIVED);
    const isSearching = computed(() =>
        connectionState.value === MIDIConnectionState.SEARCHING
        || connectionState.value === MIDIConnectionState.INITIALIZING);
    const isFetchingCurrentProgram = computed(() =>
        currentProgramFetchState.value === 'loading-programs'
        || currentProgramFetchState.value === 'requesting');

    const log = (message: string) => {
        const ts = new Date().toTimeString().slice(0, 8) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
        logs.value.push(`[${ts}] ${message}`);
        if (logs.value.length > 500) logs.value.shift();
    };

    const clearLogs = () => {
        logs.value = [];
    };

    const armTimeout = (isPending: () => boolean, onTimeout: () => void) => {
        setTimeout(() => {
            if (isPending()) onTimeout();
        }, REPLY_TIMEOUT_MS);
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
                const assembler = createSysexAssembler();
                input.onmidimessage = (event: MIDIMessageEvent) => {
                    const eventData = event.data;
                    if (!eventData) return;
                    router.publishRaw(eventData, input.name ?? '');

                    if (assembler.isChannelMessage(eventData)) {
                        const messageType = eventData[0] & 0xf0;
                        if (messageType === 0xc0) log(`RX Program Change: #${eventData[1] & 0x7f}`);
                        router.publishChannel(eventData);
                        return;
                    }

                    for (const message of assembler.push(eventData)) {
                        processMIDIMessage(message, input, access);
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
        midiAccess: MIDIAccess,
    ) => {
        if (data[0] !== 0xF0) return;
        log(`RX SysEx from "${input.name}": ${formatMidiBytes(data)}`);
        if (isDeviceInquiryReply(data)) {
            const outputId = transport.matchingOutputId(input.name ?? '');
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
            currentProgramFetchProgress.value = receivedProgramCount.value;
            log(`Program dump received: #${programNo} "${programName}"`);
            if (receivedProgramCount.value === 64) {
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
            .find((candidate: MIDIOutput) => candidate.name === selectedMidiOut.value);

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
        currentProgramFetchProgress.value = receivedProgramCount.value;
        if (missing.length === 0) {
            connectionState.value = MIDIConnectionState.RECEIVED;
            log('Program preload complete: 64/64 received.');
            return true;
        }
        connectionState.value = MIDIConnectionState.DETECTED;
        log(`Program preload incomplete: ${receivedProgramCount.value}/64 received; missing=[${missing.join(',')}].`);
        return false;
    };

    const ensureAllProgramDumps = () => {
        if (receivedProgramCount.value === 64) return Promise.resolve(true);
        if (!programLoadPromise) {
            programLoadPromise = loadAllProgramDumps().finally(() => { programLoadPromise = null; });
        }
        return programLoadPromise;
    };

    const requestProgramDump = async () => ensureAllProgramDumps();

    const requestCurrentVoiceProgramNo = async () => {
        currentProgramFetchState.value = 'loading-programs';
        currentProgramFetchProgress.value = receivedProgramCount.value;
        if (receivedProgramCount.value < 64) {
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
        armTimeout(
            () => currentProgramFetchState.value === 'requesting',
            () => {
                currentProgramFetchState.value = 'error';
                log('Current voice request timed out (no Func 0x42 reply within 4s).');
            },
        );
    };

    const dx7CartridgeBytes = (bank: 0 | 1) =>
        buildDx7Cartridge(programData.value.slice(bank * 32, bank * 32 + 32));

    const reset = () => {
        programNames.value = Array.from({ length: 64 }, () => ({ name: '' }));
        programData.value = [];
        lastReceivedProgram.value = null;
    };

    const sendCurrentSequenceDump = (bytes: Uint8Array) => {
        sequenceWriteState.value = 'sending';
        log('Sending CURRENT SEQUENCE DATA DUMP (Func 0x40)...');
        if (!sendSysEx(bytes)) {
            sequenceWriteState.value = 'error';
            log('Failed to send sequence dump: no MIDI output selected.');
            return;
        }
        armTimeout(
            () => sequenceWriteState.value === 'sending',
            () => {
                sequenceWriteState.value = 'error';
                log('Sequence dump write timed out (no ACK/NAK within 4s).');
            },
        );
    };

    const requestCurrentVoiceDump = () => {
        soundEditState.value = 'requesting';
        log('Requesting CURRENT PROGRAM DATA DUMP for Sound Edit (Func 0x12)...');
        if (!sendSysEx(createCurrentVoiceRequest())) {
            soundEditState.value = 'error';
            return;
        }
        armTimeout(
            () => soundEditState.value === 'requesting',
            () => {
                soundEditState.value = 'error';
                log('Sound Edit current program request timed out.');
            },
        );
    };

    const sendCurrentVoiceDump = (programDataBytes: Uint8Array) => {
        soundEditState.value = 'sending';
        const message = createCurrentVoiceDump(programDataBytes);
        log('Sending CURRENT PROGRAM DATA DUMP from Sound Edit (Func 0x42)...');
        if (!sendSysEx(message)) {
            soundEditState.value = 'error';
            return;
        }
        armTimeout(
            () => soundEditState.value === 'sending',
            () => {
                soundEditState.value = 'error';
                log('Sound Edit program write timed out (no ACK/NAK within 4s).');
            },
        );
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
        midiInputs,
        midiOutputs,
        selectedMidiIn,
        selectedMidiOut,
        programNames,
        lastReceivedProgram,
        currentProgramFetchState,
        currentProgramFetchProgress,
        matchedProgramNo,
        sequenceWriteState,
        currentVoiceData,
        soundEditState,
        logs,
        receivedProgramCount,
        isDeviceReady,
        isIdleConnected,
        isLibraryReady,
        isSearching,
        isFetchingCurrentProgram,
        initMIDI,
        detectVolcaFM2,
        requestProgramDump,
        dx7CartridgeBytes,
        sendSysEx,
        requestCurrentVoiceProgramNo,
        sendCurrentSequenceDump,
        requestCurrentVoiceDump,
        sendCurrentVoiceDump,
        addLog: log,
        clearLogs,
        onNoteEvent,
        onMidiMessage,
        onProgramChange,
        sendMidiMessage,
        reset,
    };
});
