import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { MIDIConnectionState, isDeviceReadyState, isIdleConnectedState } from '@/midi/connectionState';
import { buildDx7Cartridge, buildDx7SingleVoice, packedVoiceName } from '@/midi/dx7Cartridge';
import { SOUND_LIST_SLOT_COUNT, mapImportedVoiceSlots, padPackedProgram, padProgramDump, remapSlotAfterReorder, sequenceSlotsAffectedByReorder } from '@/utils/soundListBackup';
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
    waitForMidiPorts,
} from '@/midi/midiAccessSession';
import { isDesktopApp } from '@/utils/runtime';
import { formatMidiBytes, MidiTransport } from '@/midi/midiTransport';
import {
    createCurrentSequenceRequest, createCurrentVoiceDump, createCurrentVoiceRequest, createDeviceInquiry,
    createProgramDump, createProgramRequest, createSequenceDump, createSequenceRequest, decodeCurrentSequence, decodeCurrentVoice,
    decodeProgramDump, decodeSequenceDump, isCurrentSequenceDump, isCurrentVoiceDump, isDeviceInquiryReply,
    isProgramDump, isSequenceDump, isStatusReply, statusLabel,
} from '@/midi/volcaFm2Protocol';
import { loadProgramReferences, matchCurrentVoice } from '@/midi/programLoader';
import { decodeSequenceData, sequenceDumpProgramNo, withSequenceDumpProgramNo } from '@/utils/sequenceCodec';
import { NUM_OF_SEQUENCES } from '@/types/sequence';
import type { DeviceBackupProgress } from '@/utils/deviceBackup';

type MIDIAccess = globalThis.MIDIAccess;
type MIDIInput = globalThis.MIDIInput;
type MIDIOutput = globalThis.MIDIOutput;
type MIDIMessageEvent = globalThis.MIDIMessageEvent;

const REPLY_TIMEOUT_MS = 4000;
const SEQUENCE_DUMP_TIMEOUT_MS = 8000;
const BACKUP_PROGRAM_TIMEOUT_MS = 120;
const BACKUP_SEQUENCE_TIMEOUT_MS = 500;
const BACKUP_RETRY_COUNT = 4;
const PROGRAM_WRITE_RETRY_COUNT = 10;
const PROGRAM_WRITE_RETRY_DELAY_MS = 2000;

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
    const sequenceReadState = ref<'idle' | 'requesting' | 'received' | 'error'>('idle');
    const currentSequenceData = ref<Uint8Array | null>(null);
    const programWriteState = ref<'idle' | 'sending' | 'ok' | 'nak' | 'error'>('idle');
    const programWriteProgress = ref(0);
    const programWriteSlot = ref<number | null>(null);
    const currentVoiceData = ref<Uint8Array | null>(null);
    const soundEditState = ref<'idle' | 'requesting' | 'received' | 'sending' | 'ok' | 'nak' | 'error'>('idle');
    const logs = ref<string[]>([]);
    const needsDocumentReload = ref(false);
    const autoReloading = ref(false);
    let programLoadPromise: Promise<boolean> | null = null;
    let currentVoiceFetchPromise: Promise<boolean> | null = null;
    let currentVoiceWaiter: ((ok: boolean) => void) | null = null;
    let sequenceReadPromise: Promise<boolean> | null = null;
    let sequenceReadWaiter: ((ok: boolean) => void) | null = null;
    let sequenceWriteWaiter: ((ok: boolean) => void) | null = null;
    let programWriteWaiter: ((ok: boolean) => void) | null = null;
    let detectGeneration = 0;
    let rescanTimer: ReturnType<typeof setTimeout> | null = null;
    let sessionTail = Promise.resolve();
    let backupProgramSlots: (Uint8Array | undefined)[] = [];
    let backupSequenceSlots: (Uint8Array | undefined)[] = [];
    let backupNack = false;
    let programDumpWaiter: ((programNo: number) => void) | null = null;

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
    const backupProgress = ref<DeviceBackupProgress | null>(null);
    const backupFetching = computed(() => backupProgress.value !== null);
    const backupRestoring = ref(false);
    const fetchingProgramDump = ref(false);
    const fetchingSequenceDumps = ref(false);
    const soundListWriteError = ref<{ kind: 'program' | 'sequence'; slot: number } | null>(null);
    const emptySequenceSlots = () => Array.from({ length: NUM_OF_SEQUENCES }, () => undefined as Uint8Array | undefined);
    const sequenceSlotData = ref<(Uint8Array | undefined)[]>(emptySequenceSlots());
    const remappedSequenceSlots = new Set<number>();
    let sequenceLoadPromise: Promise<boolean> | null = null;
    let sequenceDumpWaiter: ((sequenceNo: number) => void) | null = null;

    const cacheSequenceSlotDump = (slot: number, sequenceData: Uint8Array) => {
        const sequenceNo = slot & 0x0f;
        const next = Array.from({ length: NUM_OF_SEQUENCES }, (_, sequenceSlot) => sequenceSlotData.value[sequenceSlot]);
        next[sequenceNo] = sequenceData.slice();
        sequenceSlotData.value = next;
    };

    const log = (message: string) => {
        const ts = new Date().toTimeString().slice(0, 8) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
        logs.value.push(`[${ts}] ${message}`);
        if (logs.value.length > 500) logs.value.shift();
    };

    const clearLogs = () => {
        logs.value = [];
    };

    const armTimeout = (isPending: () => boolean, onTimeout: () => void, timeoutMs = REPLY_TIMEOUT_MS) => {
        setTimeout(() => {
            if (isPending()) onTimeout();
        }, timeoutMs);
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
        void input.open().catch(error => log(`MIDI input open failed "${input.name}": ${error}`));
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
            if (isDeviceReadyState(connectionState.value)) return;
            if (connectionState.value === MIDIConnectionState.INITIALIZING) return;
            void detectVolcaFM2();
        }, 300);
    };

    const handleStateChange = (port: MIDIPort) => {
        const access = midiAccess.value;
        if (!access) return;
        const previousInputs = new Set(midiInputs.value);
        const previousOutputs = new Set(midiOutputs.value);
        refreshPortLists();
        const newPortAppeared = midiInputs.value.some(name => !previousInputs.has(name))
            || midiOutputs.value.some(name => !previousOutputs.has(name));
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
            newPortAppeared,
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

    const attachAccess = async (access: MIDIAccess) => {
        midiAccess.value = access;
        needsDocumentReload.value = false;
        transport.bindStateChange(handleStateChange);
        refreshPortLists();
        log(`MIDI initialized. inputs=[${midiInputs.value.join(', ')}] outputs=[${midiOutputs.value.join(', ')}]`);
        if (midiInputs.value.length === 0 && midiOutputs.value.length === 0) {
            log('No MIDI ports yet; waiting up to 2s for Chrome to enumerate them...');
            const found = await waitForMidiPorts({
                hasPorts: () => access.inputs.size > 0 || access.outputs.size > 0,
                subscribe: onChange => {
                    access.addEventListener('statechange', onChange);
                    return () => access.removeEventListener('statechange', onChange);
                },
                timeoutMs: 2000,
            });
            refreshPortLists();
            log(found
                ? `MIDI ports appeared. inputs=[${midiInputs.value.join(', ')}] outputs=[${midiOutputs.value.join(', ')}]`
                : 'MIDI ports did not appear within 2s.');
        }
        await transport.openAllPorts((port, error) => {
            const name = port.name ?? '';
            if (error) log(`MIDI ${port.type} open failed "${name}": ${error}`);
            else log(`MIDI ${port.type} "${name}" ${port.state}/${port.connection}.`);
        });
        access.inputs.forEach(input => bindInput(input, access));
    };

    const initMIDI = () => runMidiSession(async () => {
        connectionState.value = MIDIConnectionState.INITIALIZING;
        try {
            await attachAccess(await transport.initialize());
            await detectVolcaFM2();
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
            await attachAccess(await transport.initialize());
            await detectVolcaFM2();
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
                void ensureAllProgramDumps()
                    .then(() => ensureAllSequenceDumps())
                    .catch(error => log(`Device reference preload failed: ${error}`));
            } else {
                log(`Device Inquiry Reply from "${input.name}" matched volca fm2, but no paired MIDI output was found. outputs=[${transport.outputNames().join(', ')}]`);
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
            if (backupFetching.value) backupProgramSlots[programNo] = programDataArray;
            programDumpWaiter?.(programNo);
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
        } else if (isCurrentSequenceDump(data)) {
            try {
                const sequenceData = decodeCurrentSequence(data);
                currentSequenceData.value = sequenceData;
                if (sequenceReadState.value === 'requesting') {
                    sequenceReadState.value = 'received';
                    sequenceReadWaiter?.(true);
                    sequenceReadWaiter = null;
                }
                log(`Current sequence dump received (${sequenceData.length} bytes).`);
            } catch (error) {
                if (sequenceReadState.value === 'requesting') {
                    sequenceReadState.value = 'error';
                    sequenceReadWaiter?.(false);
                    sequenceReadWaiter = null;
                }
                log(`Current sequence dump decode failed: ${error}`);
            }
        } else if (isSequenceDump(data)) {
            try {
                const sequenceNo = data[7] & 0x0f;
                const sequenceData = decodeSequenceDump(data);
                cacheSequenceSlotDump(sequenceNo, sequenceData);
                if (backupFetching.value) backupSequenceSlots[sequenceNo] = sequenceData;
                sequenceDumpWaiter?.(sequenceNo);
                log(`Sequence dump received: #${sequenceNo} (${sequenceData.length} bytes).`);
            } catch (error) {
                log(`Sequence dump decode failed: ${error}`);
            }
        } else if (isStatusReply(data)) {
            log(`Status reply: 0x${data[6].toString(16)} (${statusLabel(data[6])})`);
            if (backupFetching.value && data[6] !== 0x23) {
                backupNack = true;
                return;
            }
            if (programWriteState.value === 'sending') {
                const ok = data[6] === 0x23;
                programWriteState.value = ok ? 'ok' : 'nak';
                programWriteWaiter?.(ok);
                programWriteWaiter = null;
                return;
            }
            if (sequenceWriteState.value === 'sending') {
                const ok = data[6] === 0x23;
                sequenceWriteState.value = ok ? 'ok' : 'nak';
                sequenceWriteWaiter?.(ok);
                sequenceWriteWaiter = null;
                return;
            }
            if (sequenceReadState.value === 'requesting') {
                sequenceReadState.value = 'error';
                sequenceReadWaiter?.(false);
                sequenceReadWaiter = null;
            }
            if (soundEditState.value === 'sending') {
                soundEditState.value = data[6] === 0x23 ? 'ok' : 'nak';
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

        const inquiry = createDeviceInquiry();
        await new Promise(resolve => setTimeout(resolve, 100));
        await transport.sendToAll(inquiry, (outputName, error) => {
            if (error) log(`Device Inquiry send failed on "${outputName}": ${error}`);
            else log(`TX Device Inquiry to "${outputName}": ${formatMidiBytes(inquiry)}`);
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
        sequenceSlotData.value = emptySequenceSlots();
        remappedSequenceSlots.clear();
        programLoadPromise = loadAllProgramDumps().finally(() => { programLoadPromise = null; });
        return programLoadPromise.then(ok => {
            void ensureAllSequenceDumps();
            return ok;
        });
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

    const sequenceProgramNos = computed(() =>
        Array.from({ length: NUM_OF_SEQUENCES }, (_, slot) => {
            const data = sequenceSlotData.value[slot];
            return data ? sequenceDumpProgramNo(data) : null;
        }),
    );

    const sequenceUsageByProgram = computed(() => {
        const usage = Array.from({ length: SOUND_LIST_SLOT_COUNT }, () => [] as number[]);
        sequenceProgramNos.value.forEach((programNo, sequenceSlot) => {
            if (programNo == null || programNo < 0 || programNo >= SOUND_LIST_SLOT_COUNT) return;
            usage[programNo].push(sequenceSlot + 1);
        });
        return usage;
    });

    const sequencesAffectedByReorder = (fromSlot: number, toSlot: number) =>
        sequenceSlotsAffectedByReorder(sequenceProgramNos.value, fromSlot, toSlot);

    const remapCachedSequenceProgramNos = (fromSlot: number, toSlot: number) => {
        const next = Array.from({ length: NUM_OF_SEQUENCES }, (_, slot) => sequenceSlotData.value[slot]);
        next.forEach((data, sequenceSlot) => {
            if (!data) return;
            const programNo = sequenceDumpProgramNo(data);
            const remapped = remapSlotAfterReorder(programNo, fromSlot, toSlot);
            if (remapped === null || remapped === programNo) return;
            next[sequenceSlot] = withSequenceDumpProgramNo(data, remapped);
            remappedSequenceSlots.add(sequenceSlot);
        });
        sequenceSlotData.value = next;
    };

    const reorderSoundList = (fromSlot: number, toSlot: number, options?: { remapSequences?: boolean }) => {
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
        if (options?.remapSequences) remapCachedSequenceProgramNos(fromSlot, toSlot);
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
        sequenceSlotData.value = emptySequenceSlots();
        remappedSequenceSlots.clear();
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
        if (programWriteState.value === 'sending') return false;
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
        soundListWriteError.value = null;
        programWriteProgress.value = 0;
        programWriteSlot.value = 0;
        for (let slot = 0; slot < SOUND_LIST_SLOT_COUNT; slot++) {
            programWriteSlot.value = slot;
            if (!await writeProgramSlot(slot)) {
                soundListWriteError.value = { kind: 'program', slot };
                return false;
            }
            programWriteProgress.value = slot + 1;
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        programWriteSlot.value = null;
        const sequenceSlotsToWrite = Array.from(remappedSequenceSlots).sort(
            (leftSlot, rightSlot) => leftSlot - rightSlot,
        );
        for (const sequenceSlot of sequenceSlotsToWrite) {
            const sequenceData = sequenceSlotData.value[sequenceSlot];
            if (!sequenceData) {
                remappedSequenceSlots.delete(sequenceSlot);
                continue;
            }
            if (!await writeSequenceSlot(sequenceSlot, sequenceData)) {
                soundListWriteError.value = { kind: 'sequence', slot: sequenceSlot };
                programWriteState.value = 'error';
                return false;
            }
        }
        programWriteState.value = 'ok';
        log('Wrote all 64 programs to internal memory.');
        return true;
    };

    const waitForSequenceWriteAck = () => new Promise<boolean>(resolve => {
        sequenceWriteWaiter = resolve;
        armTimeout(
            () => sequenceWriteState.value === 'sending',
            () => {
                sequenceWriteState.value = 'error';
                sequenceWriteWaiter?.(false);
                sequenceWriteWaiter = null;
            },
            SEQUENCE_DUMP_TIMEOUT_MS,
        );
    });

    const writeSequenceSlot = async (slot: number, sequenceData: Uint8Array) => {
        if (sequenceWriteState.value === 'sending') return false;
        const sequenceNo = slot & 0x0f;
        const attempts = PROGRAM_WRITE_RETRY_COUNT + 1;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            sequenceWriteState.value = 'sending';
            const retryLabel = attempt > 1 ? ` (retry ${attempt - 1}/${PROGRAM_WRITE_RETRY_COUNT})` : '';
            log(`Sending SEQUENCE DATA DUMP (Func 0x4C) to sequence #${sequenceNo}${retryLabel}...`);
            if (!sendSysEx(createSequenceDump(sequenceNo, sequenceData))) {
                sequenceWriteState.value = 'error';
                log(`Failed to send sequence #${sequenceNo}: no MIDI output selected.`);
                return false;
            }
            if (await waitForSequenceWriteAck()) {
                cacheSequenceSlotDump(sequenceNo, sequenceData);
                remappedSequenceSlots.delete(sequenceNo);
                return true;
            }
            if (sequenceWriteState.value === 'sending') sequenceWriteState.value = 'error';
            if (attempt === attempts) {
                log(`Sequence #${sequenceNo} write failed after ${attempts} attempts (${sequenceWriteState.value}).`);
                return false;
            }
            log(`Sequence #${sequenceNo} write failed (${sequenceWriteState.value}); retrying ${attempt}/${PROGRAM_WRITE_RETRY_COUNT}...`);
            await new Promise(resolve => setTimeout(resolve, PROGRAM_WRITE_RETRY_DELAY_MS));
        }
        return false;
    };

    const failSequenceRead = (message: string) => {
        sequenceReadState.value = 'error';
        log(message);
        sequenceReadWaiter?.(false);
        sequenceReadWaiter = null;
    };

    const requestCurrentSequenceDump = async () => {
        if (sequenceReadPromise) return sequenceReadPromise;
        sequenceReadPromise = (async () => {
            sequenceReadState.value = 'requesting';
            log('Requesting CURRENT SEQUENCE DATA DUMP (Func 0x10)...');
            if (!sendSysEx(createCurrentSequenceRequest())) {
                failSequenceRead('Failed to send current sequence request: no MIDI output selected.');
                return false;
            }
            return await new Promise<boolean>(resolve => {
                sequenceReadWaiter = resolve;
                armTimeout(
                    () => sequenceReadState.value === 'requesting',
                    () => failSequenceRead('Current sequence request timed out (no Func 0x40 reply within 8s).'),
                    SEQUENCE_DUMP_TIMEOUT_MS,
                );
            });
        })().finally(() => { sequenceReadPromise = null; });
        return sequenceReadPromise;
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

    const waitForBackupSlot = async (isReady: () => boolean, timeoutMs: number) => {
        const startedAt = performance.now();
        backupNack = false;
        while (!isReady()) {
            if (backupNack) return false;
            if (performance.now() - startedAt >= timeoutMs) return false;
            await new Promise(resolve => setTimeout(resolve, 5));
        }
        return true;
    };

    const requestBackupSlot = async (
        label: string,
        request: () => boolean,
        isReady: () => boolean,
        initialTimeoutMs: number,
    ) => {
        let timeoutMs = initialTimeoutMs;
        for (let attempt = 1; attempt <= BACKUP_RETRY_COUNT; attempt++) {
            if (!request()) return false;
            if (await waitForBackupSlot(isReady, timeoutMs)) return true;
            log(`${label} timed out after ${timeoutMs}ms (attempt ${attempt}/${BACKUP_RETRY_COUNT}); backing off.`);
            timeoutMs *= 2;
        }
        return false;
    };

    const receivedSequenceCount = computed(() => sequenceSlotData.value.filter(Boolean).length);

    const loadAllSequenceDumps = async () => {
        if (!selectedMidiOut.value || backupFetching.value) return false;
        fetchingSequenceDumps.value = true;
        log('Loading sequence Program No. references...');
        try {
            for (let slot = 0; slot < NUM_OF_SEQUENCES; slot++) {
                if (sequenceSlotData.value[slot]) continue;
                if (backupFetching.value) return receivedSequenceCount.value === NUM_OF_SEQUENCES;
                let received = false;
                sequenceDumpWaiter = incomingSlot => {
                    if (incomingSlot === slot) received = true;
                };
                const ok = await requestBackupSlot(
                    `Sequence #${slot}`,
                    () => {
                        received = false;
                        return sendSysEx(createSequenceRequest(slot));
                    },
                    () => received || Boolean(sequenceSlotData.value[slot]),
                    BACKUP_SEQUENCE_TIMEOUT_MS,
                );
                sequenceDumpWaiter = null;
                if (!ok && !sequenceSlotData.value[slot]) {
                    log(`Sequence #${slot} was not received.`);
                }
            }
            log(`Sequence references: ${receivedSequenceCount.value}/${NUM_OF_SEQUENCES} received.`);
            return receivedSequenceCount.value === NUM_OF_SEQUENCES;
        } finally {
            fetchingSequenceDumps.value = false;
            sequenceDumpWaiter = null;
        }
    };

    const ensureAllSequenceDumps = async () => {
        if (receivedSequenceCount.value === NUM_OF_SEQUENCES) return true;
        if (programLoadPromise) await programLoadPromise;
        if (receivedSequenceCount.value === NUM_OF_SEQUENCES) return true;
        if (!sequenceLoadPromise) {
            sequenceLoadPromise = loadAllSequenceDumps().finally(() => { sequenceLoadPromise = null; });
        }
        return sequenceLoadPromise;
    };

    const fetchProgramDump = async (slot: number): Promise<Uint8Array | null> => {
        if (backupFetching.value || programDumpWaiter || fetchingProgramDump.value) return null;
        if (!isIdleConnected.value || !selectedMidiOut.value) {
            log('Program fetch failed: volca fm2 is not connected.');
            return null;
        }
        fetchingProgramDump.value = true;
        const programNo = Math.max(0, Math.min(SOUND_LIST_SLOT_COUNT - 1, Math.round(Number(slot)) || 0));
        let received: Uint8Array | undefined;
        programDumpWaiter = incomingSlot => {
            if (incomingSlot === programNo) received = programData.value[programNo];
        };
        log(`Fetching program #${programNo} from the device...`);
        try {
            const ok = await requestBackupSlot(
                `Program #${programNo}`,
                () => {
                    received = undefined;
                    return sendSysEx(createProgramRequest(programNo));
                },
                () => Boolean(received),
                BACKUP_PROGRAM_TIMEOUT_MS,
            );
            if (!ok || !received) {
                log(`Program fetch failed: program #${programNo} was not received.`);
                return null;
            }
            log(`Program fetch complete: #${programNo}.`);
            return padProgramDump(received);
        } finally {
            programDumpWaiter = null;
            fetchingProgramDump.value = false;
        }
    };

    const captureDeviceBackup = async () => {
        if (backupFetching.value) return null;
        if (!isIdleConnected.value || !selectedMidiOut.value) {
            log('Device backup failed: volca fm2 is not connected.');
            return null;
        }
        backupProgramSlots = Array.from({ length: SOUND_LIST_SLOT_COUNT });
        backupSequenceSlots = Array.from({ length: NUM_OF_SEQUENCES });
        backupProgress.value = { phase: 'program', current: 0, total: SOUND_LIST_SLOT_COUNT };
        log('Capturing device backup: 64 programs and 16 sequences...');
        try {
            for (let slot = 0; slot < SOUND_LIST_SLOT_COUNT; slot++) {
                backupProgress.value = { phase: 'program', current: slot + 1, total: SOUND_LIST_SLOT_COUNT };
                backupProgramSlots[slot] = undefined;
                const ok = await requestBackupSlot(
                    `Backup program #${slot}`,
                    () => sendSysEx(createProgramRequest(slot)),
                    () => Boolean(backupProgramSlots[slot]),
                    BACKUP_PROGRAM_TIMEOUT_MS,
                );
                if (!ok || !backupProgramSlots[slot]) {
                    log(`Device backup failed: program #${slot} was not received.`);
                    return null;
                }
            }
            for (let slot = 0; slot < NUM_OF_SEQUENCES; slot++) {
                backupProgress.value = { phase: 'sequence', current: slot + 1, total: NUM_OF_SEQUENCES };
                backupSequenceSlots[slot] = undefined;
                const ok = await requestBackupSlot(
                    `Backup sequence #${slot}`,
                    () => sendSysEx(createSequenceRequest(slot)),
                    () => Boolean(backupSequenceSlots[slot]),
                    BACKUP_SEQUENCE_TIMEOUT_MS,
                );
                if (!ok || !backupSequenceSlots[slot]) {
                    log(`Device backup failed: sequence #${slot} was not received.`);
                    return null;
                }
            }
            const programs = backupProgramSlots.map((data, slot) => ({
                name: packedVoiceName(data as Uint8Array),
                data: padProgramDump(data as Uint8Array),
            }));
            const sequences = backupSequenceSlots.map(data => decodeSequenceData(data as Uint8Array));
            log('Device backup complete: 64 programs and 16 sequences.');
            return { programs, sequences };
        } finally {
            backupProgress.value = null;
            backupProgramSlots = [];
            backupSequenceSlots = [];
            backupNack = false;
        }
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
        sequenceReadState,
        currentSequenceData,
        programWriteState,
        programWriteProgress,
        programWriteSlot,
        currentVoiceData,
        soundEditState,
        logs,
        needsDocumentReload,
        autoReloading,
        receivedProgramCount,
        receivedSequenceCount,
        soundList,
        isDeviceReady,
        isIdleConnected,
        isLibraryReady,
        isSearching,
        isFetchingCurrentProgram,
        backupProgress,
        backupFetching,
        backupRestoring,
        fetchingProgramDump,
        fetchingSequenceDumps,
        soundListWriteError,
        sequenceUsageByProgram,
        initMIDI,
        bootMIDI,
        reconnectMIDI,
        reloadMidiDocument,
        detectVolcaFM2,
        requestProgramDump,
        ensureAllProgramDumps,
        ensureAllSequenceDumps,
        reloadAllProgramDumps,
        cloneSoundList,
        reorderSoundList,
        sequencesAffectedByReorder,
        cacheSequenceSlotDump,
        importPackedVoices,
        replaceSoundList,
        updateSoundListSlot,
        programBytesAt,
        dx7CartridgeBytes,
        sendSysEx,
        requestCurrentVoiceProgramNo,
        requestCurrentSequenceDump,
        sendCurrentSequenceDump,
        requestCurrentVoiceDump,
        sendCurrentVoiceDump,
        writeProgramSlot,
        writeSequenceSlot,
        writeSoundListToDevice,
        addLog: log,
        clearLogs,
        onNoteEvent,
        onMidiMessage,
        onProgramChange,
        sendMidiMessage,
        captureDeviceBackup,
        fetchProgramDump,
        reset,
    };
});
