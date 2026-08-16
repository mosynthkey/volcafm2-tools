import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { MIDIConnectionState, isDeviceReadyState, isIdleConnectedState } from '@/midi/connectionState';
import { buildDx7Cartridge, buildDx7SingleVoice, packedVoiceName } from '@/midi/dx7Cartridge';
import { SOUND_LIST_SLOT_COUNT, mapImportedVoiceSlots, padPackedProgram, padProgramDump, remapSlotAfterReorder } from '@/utils/soundListBackup';
import { writePackedVoiceName } from '@/utils/soundProgramCodec';
import { createMidiMessageRouter } from '@/midi/midiMessageRouter';
import { createSysexAssembler } from '@/midi/sysexAssembler';
import {
    clearAutoReloadMidi,
    isStaleDetectGeneration,
    markAutoReloadMidi,
    midiStateChangeAction,
    nextDetectGeneration,
    readDidAutoReloadMidi,
    selectedPortDisconnected,
    shouldAutoReloadMidiDocument,
    desktopMidiBootAction,
} from '@/midi/midiAccessSession';
import { isDesktopApp } from '@/utils/runtime';
import { formatMidiBytes, MidiTransport } from '@/midi/midiTransport';
import {
    createCurrentVoiceDump, createCurrentVoiceRequest, createDeviceInquiry,
    createProgramDump, createProgramRequest, decodeCurrentVoice, decodeProgramDump,
    isCurrentVoiceDump, isDeviceInquiryReply, isProgramDump, isStatusReply, statusLabel,
} from '@/midi/volcaFm2Protocol';
import { loadProgramReferences, matchCurrentVoice } from '@/midi/programLoader';

type MIDIAccess = globalThis.MIDIAccess;
type MIDIInput = globalThis.MIDIInput;
type MIDIOutput = globalThis.MIDIOutput;
type MIDIMessageEvent = globalThis.MIDIMessageEvent;

const REPLY_TIMEOUT_MS = 4000;
const PROGRAM_WRITE_RETRY_COUNT = 5;
const PROGRAM_WRITE_RETRY_DELAY_MS = 800;

export { MIDIConnectionState };

export const useMidiStore = defineStore('midi', () => {
    const connectionState = ref<MIDIConnectionState>(MIDIConnectionState.INITIALIZING);
    const midiAccess = ref<MIDIAccess | null>(null);
    const midiInputs = ref<string[]>([]);
    const midiOutputs = ref<string[]>([]);
    const selectedMidiIn = ref<string | null>(null);
    const selectedMidiOut = ref<string | null>(null);
    const emptyNames = () => Array.from({ length: SOUND_LIST_SLOT_COUNT }, () => ({ name: '' }));
    const programNames = ref<{ name: string }[]>(emptyNames());
    const programData = ref<(Uint8Array | undefined)[]>([]);
    const lastReceivedProgram = ref<{ programNo: number; name: string } | null>(null);
    const currentProgramFetchState = ref<'idle' | 'loading-programs' | 'requesting' | 'received' | 'error'>('idle');
    const currentProgramFetchProgress = ref(0);
    const matchedProgramNo = ref<number | null>(null);
    const sequenceWriteState = ref<'idle' | 'sending' | 'ok' | 'nak' | 'error'>('idle');
    const programWriteState = ref<'idle' | 'sending' | 'ok' | 'nak' | 'error'>('idle');
    const programWriteProgress = ref(0);
    const programWriteSlot = ref<number | null>(null);
    const currentVoiceData = ref<Uint8Array | null>(null);
    const soundEditState = ref<'idle' | 'requesting' | 'received' | 'sending' | 'ok' | 'error'>('idle');
    const logs = ref<string[]>([]);
    const needsDocumentReload = ref(false);
    const autoReloading = ref(false);
    let programLoadPromise: Promise<boolean> | null = null;
    let currentVoiceFetchPromise: Promise<boolean> | null = null;
    let currentVoiceWaiter: ((ok: boolean) => void) | null = null;
    let programWriteWaiter: ((ok: boolean) => void) | null = null;
    let detectGeneration = 0;
    let rescanTimer: ReturnType<typeof setTimeout> | null = null;
    let sessionTail = Promise.resolve();

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

    const runMidiSession = (work: () => Promise<void>) => {
        const next = sessionTail.then(work, work);
        sessionTail = next.then(() => undefined, () => undefined);
        return next;
    };

    const refreshPortLists = () => {
        midiInputs.value = transport.inputNames();
        midiOutputs.value = transport.outputNames();
    };

    const bindInput = (input: MIDIInput, access: MIDIAccess) => {
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
    };

    const scheduleRescan = () => {
        if (rescanTimer !== null) clearTimeout(rescanTimer);
        rescanTimer = setTimeout(() => {
            rescanTimer = null;
            if (!isDeviceReadyState(connectionState.value)
                && connectionState.value !== MIDIConnectionState.SEARCHING
                && connectionState.value !== MIDIConnectionState.INITIALIZING) {
                void detectVolcaFM2();
            }
        }, 300);
    };

    const handleStateChange = (port: MIDIPort) => {
        const access = midiAccess.value;
        if (!access) return;
        refreshPortLists();
        if (port.type === 'input' && port.state === 'connected') bindInput(port as MIDIInput, access);
        const selectedDisconnected = selectedPortDisconnected(selectedMidiIn.value, access.inputs.values())
            || selectedPortDisconnected(selectedMidiOut.value, access.outputs.values());
        const action = midiStateChangeAction({
            isDeviceReady: isDeviceReadyState(connectionState.value),
            isBusy: connectionState.value === MIDIConnectionState.SEARCHING
                || connectionState.value === MIDIConnectionState.INITIALIZING
                || connectionState.value === MIDIConnectionState.RECEIVING,
            portState: port.state,
            selectedDisconnected,
        });
        log(`MIDI ${port.type} "${port.name ?? ''}" ${port.state}/${port.connection}.`);
        if (action === 'mark-disconnected') {
            selectedMidiIn.value = null;
            selectedMidiOut.value = null;
            connectionState.value = MIDIConnectionState.NOT_FOUND;
            log('Selected MIDI port disconnected.');
            return;
        }
        if (action === 'rescan') scheduleRescan();
    };

    const midiStorage = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);

    const maybeAutoReloadMidiDocument = () => {
        const shouldReload = shouldAutoReloadMidiDocument({
            isDesktop: isDesktopApp,
            didAutoReload: readDidAutoReloadMidi(midiStorage()),
            midiAccessFailed: needsDocumentReload.value
                || connectionState.value === MIDIConnectionState.ERROR,
            deviceNotFound: connectionState.value === MIDIConnectionState.NOT_FOUND,
            hasNoPorts: midiInputs.value.length === 0 && midiOutputs.value.length === 0,
        });
        if (!shouldReload) return;
        markAutoReloadMidi(midiStorage());
        autoReloading.value = true;
        log('Desktop MIDI: reloading this window, then reconnecting MIDIAccess.');
        window.location.reload();
    };

    const attachAccess = (access: MIDIAccess) => {
        midiAccess.value = access;
        needsDocumentReload.value = false;
        refreshPortLists();
        log(`MIDI initialized. inputs=[${midiInputs.value.join(', ')}] outputs=[${midiOutputs.value.join(', ')}]`);
        access.inputs.forEach(input => bindInput(input, access));
        transport.bindStateChange(handleStateChange);
    };

    const initMIDI = () => runMidiSession(async () => {
        connectionState.value = MIDIConnectionState.INITIALIZING;
        try {
            attachAccess(await transport.initialize());
            detectVolcaFM2();
        } catch (err) {
            log(`MIDI init error: ${err}`);
            needsDocumentReload.value = true;
            connectionState.value = MIDIConnectionState.ERROR;
            maybeAutoReloadMidiDocument();
        }
    });

    const reconnectMIDI = () => runMidiSession(async () => {
        connectionState.value = MIDIConnectionState.INITIALIZING;
        selectedMidiIn.value = null;
        selectedMidiOut.value = null;
        log('Reconnecting MIDI (close ports, requestMIDIAccess again)...');
        try {
            attachAccess(await transport.initialize());
            detectVolcaFM2();
        } catch (err) {
            log(`MIDI reconnect error: ${err}`);
            needsDocumentReload.value = true;
            connectionState.value = MIDIConnectionState.ERROR;
            maybeAutoReloadMidiDocument();
        }
    });

    const bootMIDI = () => {
        const action = desktopMidiBootAction({
            isDesktop: isDesktopApp,
            didAutoReload: readDidAutoReloadMidi(midiStorage()),
        });
        if (action === 'reconnect') {
            log('Desktop MIDI: window reloaded; reconnecting MIDIAccess.');
            return reconnectMIDI();
        }
        return initMIDI();
    };

    const reloadMidiDocument = () => {
        log('Reloading this window to recreate MIDIAccess (same as a browser refresh).');
        window.location.reload();
    };

    const matchIncomingCurrentVoice = (currentProgramData: Uint8Array) => {
        const match = matchCurrentVoice(currentProgramData.slice(0, 128), programData.value, programNames.value);
        matchedProgramNo.value = match.programNo;
        log(`Current sound matched program #${match.programNo} "${match.currentName}" (byte differences=${match.differences}, nameCandidates=${match.nameCandidateCount}).`);
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
                clearAutoReloadMidi(midiStorage());
                log(`Device Inquiry Reply matched. in="${selectedMidiIn.value}" out="${selectedMidiOut.value}"`);
                void ensureAllProgramDumps();
            }
        } else if (isProgramDump(data)) {
            connectionState.value = MIDIConnectionState.RECEIVING;
            const programNo = data[7];
            const programDataArray = decodeProgramDump(data);
            const programName = packedVoiceName(programDataArray);
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
                const lookingUpProgramNo = currentProgramFetchState.value === 'requesting';
                try {
                    matchIncomingCurrentVoice(currentProgramData);
                } catch (error) {
                    if (lookingUpProgramNo) throw error;
                    log(`Current sound matching failed: ${error}`);
                }
                if (lookingUpProgramNo) {
                    currentProgramFetchState.value = 'received';
                    currentVoiceWaiter?.(true);
                    currentVoiceWaiter = null;
                    return;
                }
                log(`Sound Edit current program received (${currentProgramData.length} bytes).`);
            } catch (error) {
                currentProgramFetchState.value = 'error';
                currentVoiceWaiter?.(false);
                currentVoiceWaiter = null;
                log(`Current sound matching failed: ${error}`);
            }
        } else if (isStatusReply(data)) {
            log(`Status reply: 0x${data[6].toString(16)} (${statusLabel(data[6])})`);
            if (programWriteState.value === 'sending') {
                const ok = data[6] === 0x23;
                programWriteState.value = ok ? 'ok' : 'nak';
                programWriteWaiter?.(ok);
                programWriteWaiter = null;
                return;
            }
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
        const generation = nextDetectGeneration(detectGeneration);
        detectGeneration = generation;
        connectionState.value = MIDIConnectionState.SEARCHING;
        log('Searching for volca fm2 (sending Device Inquiry to all outputs)...');

        midiAccess.value?.outputs.forEach((output: MIDIOutput) => {
            output.send(createDeviceInquiry());
        });

        setTimeout(() => {
            if (isStaleDetectGeneration(generation, detectGeneration)) return;
            if (connectionState.value === MIDIConnectionState.SEARCHING) {
                connectionState.value = MIDIConnectionState.NOT_FOUND;
                log('volca fm2 not found (timeout).');
                maybeAutoReloadMidiDocument();
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

    const reloadAllProgramDumps = () => {
        if (programLoadPromise) return programLoadPromise;
        programNames.value = emptyNames();
        programData.value = [];
        lastReceivedProgram.value = null;
        currentProgramFetchProgress.value = 0;
        programLoadPromise = loadAllProgramDumps().finally(() => { programLoadPromise = null; });
        return programLoadPromise;
    };

    const requestProgramDump = async () => ensureAllProgramDumps();

    const failCurrentVoiceFetch = (message: string) => {
        currentProgramFetchState.value = 'error';
        log(message);
        currentVoiceWaiter?.(false);
        currentVoiceWaiter = null;
    };

    const requestCurrentVoiceProgramNo = async () => {
        if (currentVoiceFetchPromise) return currentVoiceFetchPromise;
        currentVoiceFetchPromise = (async () => {
            currentProgramFetchState.value = 'loading-programs';
            currentProgramFetchProgress.value = receivedProgramCount.value;
            if (receivedProgramCount.value < 64) {
                log('Program data is incomplete; receiving all 64 programs before matching the current sound...');
                if (!await ensureAllProgramDumps()) {
                    failCurrentVoiceFetch('Current sound lookup failed: timed out while receiving the 64 reference programs.');
                    return false;
                }
            }

            currentProgramFetchState.value = 'requesting';
            currentProgramFetchProgress.value = 64;
            log('Requesting CURRENT VOICE DATA DUMP (Func 0x12)...');
            const request = createCurrentVoiceRequest();
            if (!sendSysEx(request)) {
                failCurrentVoiceFetch('Failed to send current sound request: no MIDI output selected.');
                return false;
            }
            return await new Promise<boolean>(resolve => {
                currentVoiceWaiter = resolve;
                armTimeout(
                    () => currentProgramFetchState.value === 'requesting',
                    () => failCurrentVoiceFetch('Current sound request timed out (no Func 0x42 reply within 4s).'),
                );
            });
        })().finally(() => { currentVoiceFetchPromise = null; });
        return currentVoiceFetchPromise;
    };

    const namedProgram = (slot: number, data: Uint8Array) => {
        const name = programNames.value[slot]?.name?.trim();
        return name ? writePackedVoiceName(data, name) : data;
    };
    const packedAt = (slot: number) => namedProgram(slot, padPackedProgram(programData.value[slot]));
    const programBytesAt = (slot: number) => namedProgram(slot, padProgramDump(programData.value[slot]));

    const dx7CartridgeBytes = (bank: 0 | 1) =>
        buildDx7Cartridge(Array.from({ length: 32 }, (_, voiceIndex) => packedAt(bank * 32 + voiceIndex)));

    const soundList = computed(() =>
        Array.from({ length: SOUND_LIST_SLOT_COUNT }, (_, slot) => ({
            slot,
            name: programNames.value[slot]?.name ?? '',
            loaded: Boolean(programData.value[slot]),
        })),
    );

    const cloneSoundList = () =>
        Array.from({ length: SOUND_LIST_SLOT_COUNT }, (_, slot) => ({
            name: programNames.value[slot]?.name ?? '',
            data: programBytesAt(slot),
        }));

    const reorderSoundList = (fromSlot: number, toSlot: number) => {
        if (fromSlot === toSlot) return;
        if (fromSlot < 0 || toSlot < 0 || fromSlot >= SOUND_LIST_SLOT_COUNT || toSlot >= SOUND_LIST_SLOT_COUNT) return;
        const names = Array.from({ length: SOUND_LIST_SLOT_COUNT }, (_, slot) => programNames.value[slot] ?? { name: '' });
        const data = Array.from({ length: SOUND_LIST_SLOT_COUNT }, (_, slot) => programData.value[slot]);
        const [movedName] = names.splice(fromSlot, 1);
        const [movedData] = data.splice(fromSlot, 1);
        names.splice(toSlot, 0, movedName);
        data.splice(toSlot, 0, movedData);
        matchedProgramNo.value = remapSlotAfterReorder(matchedProgramNo.value, fromSlot, toSlot);
        programNames.value = names;
        programData.value = data;
    };

    const importPackedVoices = (voices: Uint8Array[], startSlot: number) => {
        const destinations = mapImportedVoiceSlots(voices.length, startSlot);
        const nextData = programData.value.slice();
        const nextNames = Array.from({ length: SOUND_LIST_SLOT_COUNT }, (_, slot) => programNames.value[slot] ?? { name: '' });
        voices.forEach((voice, voiceIndex) => {
            const slot = destinations[voiceIndex];
            const packed = padProgramDump(voice);
            nextData[slot] = packed;
            nextNames[slot] = { name: packedVoiceName(packed) };
        });
        programData.value = nextData;
        programNames.value = nextNames;
    };

    const replaceSoundList = (programs: { name: string; data: Uint8Array }[]) => {
        programNames.value = Array.from({ length: SOUND_LIST_SLOT_COUNT }, (_, slot) => ({
            name: programs[slot]?.name || packedVoiceName(padProgramDump(programs[slot]?.data)),
        }));
        programData.value = Array.from({ length: SOUND_LIST_SLOT_COUNT }, (_, slot) =>
            padProgramDump(programs[slot]?.data));
    };

    const reset = () => {
        programNames.value = emptyNames();
        programData.value = [];
        lastReceivedProgram.value = null;
    };

    const updateSoundListSlot = (slot: number, data: Uint8Array) => {
        if (slot < 0 || slot >= SOUND_LIST_SLOT_COUNT) return;
        const dump = padProgramDump(data);
        const nextData = programData.value.slice();
        nextData[slot] = dump;
        programData.value = nextData;
        const nextNames = Array.from({ length: SOUND_LIST_SLOT_COUNT }, (_, index) =>
            programNames.value[index] ?? { name: '' });
        nextNames[slot] = { name: packedVoiceName(dump) };
        programNames.value = nextNames;
    };

    const waitForProgramWriteAck = () => new Promise<boolean>(resolve => {
        programWriteWaiter = resolve;
        armTimeout(
            () => programWriteState.value === 'sending',
            () => {
                programWriteState.value = 'error';
                programWriteWaiter?.(false);
                programWriteWaiter = null;
            },
        );
    });

    const writeProgramSlot = async (slot: number) => {
        const attempts = PROGRAM_WRITE_RETRY_COUNT + 1;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            programWriteState.value = 'sending';
            const retryLabel = attempt > 1 ? ` (retry ${attempt - 1}/${PROGRAM_WRITE_RETRY_COUNT})` : '';
            log(`Sending PROGRAM DATA DUMP (Func 0x4E) to program #${slot}${retryLabel}...`);
            if (!sendSysEx(createProgramDump(slot, programBytesAt(slot)))) {
                programWriteState.value = 'error';
                log(`Failed to send program #${slot}: no MIDI output selected.`);
                return false;
            }
            if (await waitForProgramWriteAck()) return true;
            if (programWriteState.value === 'sending') programWriteState.value = 'error';
            if (attempt === attempts) {
                log(`Program #${slot} write failed after ${attempts} attempts (${programWriteState.value}).`);
                return false;
            }
            log(`Program #${slot} write failed (${programWriteState.value}); retrying ${attempt}/${PROGRAM_WRITE_RETRY_COUNT}...`);
            await new Promise(resolve => setTimeout(resolve, PROGRAM_WRITE_RETRY_DELAY_MS));
        }
        return false;
    };

    const writeSoundListToDevice = async () => {
        if (programWriteState.value === 'sending') return false;
        programWriteProgress.value = 0;
        programWriteSlot.value = 0;
        for (let slot = 0; slot < SOUND_LIST_SLOT_COUNT; slot++) {
            programWriteSlot.value = slot;
            if (!await writeProgramSlot(slot)) return false;
            programWriteProgress.value = slot + 1;
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        programWriteSlot.value = null;
        programWriteState.value = 'ok';
        log('Wrote all 64 programs to internal memory.');
        return true;
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

    const sendDx7SingleVoiceDump = (programDataBytes: Uint8Array) => {
        const packed = programDataBytes.length >= 128
            ? programDataBytes.subarray(0, 128)
            : padPackedProgram(programDataBytes);
        return sendSysEx(buildDx7SingleVoice(packed));
    };

    const sendCurrentVoiceDump = (programDataBytes: Uint8Array, options?: { refreshNameDisplay?: boolean }) => {
        if (options?.refreshNameDisplay) {
            log('Sending DX7 format 0 dump so the unit display can pick up Sound Name...');
            sendDx7SingleVoiceDump(programDataBytes);
        }
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
        programWriteState,
        programWriteProgress,
        programWriteSlot,
        currentVoiceData,
        soundEditState,
        logs,
        needsDocumentReload,
        autoReloading,
        receivedProgramCount,
        soundList,
        isDeviceReady,
        isIdleConnected,
        isLibraryReady,
        isSearching,
        isFetchingCurrentProgram,
        initMIDI,
        bootMIDI,
        reconnectMIDI,
        reloadMidiDocument,
        detectVolcaFM2,
        requestProgramDump,
        ensureAllProgramDumps,
        reloadAllProgramDumps,
        cloneSoundList,
        reorderSoundList,
        importPackedVoices,
        replaceSoundList,
        updateSoundListSlot,
        programBytesAt,
        dx7CartridgeBytes,
        sendSysEx,
        requestCurrentVoiceProgramNo,
        sendCurrentSequenceDump,
        requestCurrentVoiceDump,
        sendCurrentVoiceDump,
        writeSoundListToDevice,
        addLog: log,
        clearLogs,
        onNoteEvent,
        onMidiMessage,
        onProgramChange,
        sendMidiMessage,
        reset,
    };
});
