import { computed, nextTick, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useMidiStore } from '@/stores/midiStore';
import {
    createEmptySequenceState, createMotionGrid, createMotionPoints, createMotionStepEnabled,
    createSequenceNote, MOTION_PARAM_COUNT, NUM_OF_STEPS, NUM_OF_VOICES_PER_STEP,
    normalizeSequenceState, type SequenceNote, type SequenceState,
} from '../types/sequence';
import { encodeCurrentSequenceDump } from '../utils/sequenceCodec';
import { createRandomStepOrder, createReversedStepOrder, createShiftedStepOrder, reorderSequenceSteps, type SequenceReorderScope } from '../utils/sequenceRandomizer';
import { clearSequenceStep, copySequenceNoteEuclid, copySequenceStep, copySequenceStepsEuclid, tieSequenceStep } from '../utils/sequenceStepEditing';
import { moveSequenceNotes, resizeSequenceNote, sameNoteKey, clampedNoteMove, type NoteKey } from '../utils/sequenceNoteEditing';
import { extractStepNotes, parseSmf } from '../utils/smfImport';
import { getPref, setPref } from '../utils/appPrefs';
import { displayToMidi } from '../utils/motionValue';

const SKIP_RANDOMIZE_PREF = 'skipRandomizeDialog';
const SEND_MAX_ATTEMPTS = 5;
const SEND_RETRY_DELAY_MS = 800;
const HISTORY_LIMIT = 80;
const HISTORY_COMMIT_MS = 320;

const cloneSequenceState = (state: SequenceState): SequenceState => JSON.parse(JSON.stringify(state)) as SequenceState;

export const useSequencerStore = defineStore('sequencer', () => {
    const initial = createEmptySequenceState();

    const programNo = ref(initial.programNo);
    const velocity = ref(initial.velocity);
    const gatePercent = ref(initial.gatePercent);
    const notes = ref<SequenceNote[]>(initial.notes);
    const motionEnabled = ref<boolean[]>(initial.motionEnabled);
    const motionStepEnabled = ref<boolean[][]>(initial.motionStepEnabled);
    const motionValues = ref<number[][][]>(initial.motionValues);
    const stepOn = ref<boolean[]>(initial.stepOn);
    const activeStep = ref<boolean[]>(initial.activeStep);
    const transposeFuncOn = ref<boolean[]>(initial.transposeFuncOn);
    const func = ref(initial.func);
    const selectedNoteKey = ref<{ pitch: number; startStep: number } | null>(null);
    const selectedNoteKeys = ref<NoteKey[]>([]);
    const motionIndex = ref(0);
    const stepInputActive = ref(false);
    const stepCursor = ref(0);
    const chordBuffer = ref(new Set<number>());
    const heldNotes = ref(new Set<number>());
    const showRandomizeDialog = ref(false);
    const skipRandomizeDialog = ref(false);
    getPref<boolean>(SKIP_RANDOMIZE_PREF).then(value => {
        if (value === true) skipRandomizeDialog.value = true;
    });
    const showCaptureDialog = ref(false);
    const showImportDialog = ref(false);
    const importError = ref<string | null>(null);
    const sendRetrying = ref(false);
    const showSendRetrySnackbar = ref(false);
    const showSendErrorDialog = ref(false);
    const lastSendFailure = ref<'nak' | 'error' | null>(null);
    let sendAttempts = 0;
    let sendRetryScheduled = false;
    let sendRetryTimer: ReturnType<typeof setTimeout> | null = null;
    const smfBarOffset = ref(1);
    let pendingSmfFile: File | null = null;

    const toState = (): SequenceState => ({
        programNo: programNo.value,
        velocity: velocity.value,
        gatePercent: gatePercent.value,
        notes: notes.value,
        motionEnabled: motionEnabled.value,
        motionStepEnabled: motionStepEnabled.value,
        motionValues: motionValues.value,
        stepOn: stepOn.value,
        activeStep: activeStep.value,
        transposeFuncOn: transposeFuncOn.value,
        func: func.value,
    });

    const noteAt = (step: number, pitch: number) =>
        notes.value.find(n => n.pitch === pitch && n.startStep <= step && n.startStep + n.length - 1 >= step);

    const selectedNote = () => {
        const key = selectedNoteKey.value;
        if (!key) return null;
        return notes.value.find(note => note.pitch === key.pitch && note.startStep === key.startStep) ?? null;
    };

    const clearNoteSelection = () => {
        selectedNoteKey.value = null;
        selectedNoteKeys.value = [];
    };

    const setNoteSelection = (keys: NoteKey[]) => {
        selectedNoteKeys.value = keys.map(key => ({ pitch: key.pitch, startStep: key.startStep }));
        selectedNoteKey.value = selectedNoteKeys.value[selectedNoteKeys.value.length - 1] ?? null;
    };

    const isNoteSelected = (note: Pick<SequenceNote, 'pitch' | 'startStep'>) =>
        selectedNoteKeys.value.some(key => sameNoteKey(key, note));

    const selectNote = (note: SequenceNote | null, additive = false) => {
        if (!note) {
            clearNoteSelection();
            return;
        }
        const key = { pitch: note.pitch, startStep: note.startStep };
        if (additive) {
            const exists = selectedNoteKeys.value.some(item => sameNoteKey(item, key));
            setNoteSelection(exists
                ? selectedNoteKeys.value.filter(item => !sameNoteKey(item, key))
                : [...selectedNoteKeys.value, key]);
            return;
        }
        setNoteSelection([key]);
    };

    const stepNoteCount = (step: number) =>
        notes.value.filter(n => n.startStep <= step && n.startStep + n.length - 1 >= step).length;

    const removeNote = (target: SequenceNote) => {
        const idx = notes.value.indexOf(target);
        if (idx >= 0) notes.value.splice(idx, 1);
        if (selectedNoteKeys.value.some(key => sameNoteKey(key, target))) {
            selectedNoteKeys.value = selectedNoteKeys.value.filter(key => !sameNoteKey(key, target));
            selectedNoteKey.value = selectedNoteKeys.value[selectedNoteKeys.value.length - 1] ?? null;
        }
    };

    const addNote = (pitch: number, startStep: number, length: number, noteVelocity?: number, noteGate?: number): boolean => {
        const start = Math.max(0, Math.min(NUM_OF_STEPS - 1, startStep));
        const len = Math.max(1, Math.min(NUM_OF_STEPS - start, length));
        const end = start + len - 1;

        const overlappingSamePitch = notes.value.filter(
            n => n.pitch === pitch && n.startStep <= end && n.startStep + n.length - 1 >= start
        );
        const withoutOverlap = notes.value.filter(n => !overlappingSamePitch.includes(n));

        for (let s = start; s <= end; s++) {
            const count = withoutOverlap.filter(n => n.startStep <= s && n.startStep + n.length - 1 >= s).length;
            if (count >= NUM_OF_VOICES_PER_STEP) return false;
        }

        const created = createSequenceNote(
            pitch, start, len, noteVelocity ?? velocity.value, noteGate ?? gatePercent.value,
        );
        withoutOverlap.push(created);
        notes.value = withoutOverlap;
        return true;
    };

    const setMotionValue = (paramIndex: number, step: number, value: number, point?: number) => {
        const clamped = Math.max(0, Math.min(127, Math.round(value)));
        const current = motionValues.value[paramIndex][step] ?? createMotionPoints(64);
        motionValues.value[paramIndex][step] = point === undefined
            ? createMotionPoints(clamped)
            : current.map((existing, index) => index === point ? clamped : existing);
        func.value.motionOn = true;
    };

    const clearMotionParam = (paramIndex: number) => {
        const midi = displayToMidi(paramIndex, 0, func.value.transposeNote);
        motionValues.value[paramIndex] = Array.from({ length: NUM_OF_STEPS }, () => createMotionPoints(midi));
    };

    const toggleMotionStep = (paramIndex: number, step: number) => {
        motionStepEnabled.value[paramIndex][step] = !motionStepEnabled.value[paramIndex][step];
        if (motionStepEnabled.value[paramIndex][step]) {
            motionEnabled.value[paramIndex] = true;
            func.value.motionOn = true;
        }
    };

    const toggleStepOn = (step: number) => {
        stepOn.value[step] = !stepOn.value[step];
    };

    const toggleActiveStep = (step: number) => {
        setActiveStep(step, !activeStep.value[step]);
    };

    const toggleTransposeFunc = (step: number) => {
        transposeFuncOn.value[step] = !transposeFuncOn.value[step];
    };

    const setStepOn = (step: number, value: boolean) => {
        stepOn.value[step] = value;
    };

    const setActiveStep = (step: number, value: boolean) => {
        if (!value && activeStep.value[step] && activeStep.value.filter(Boolean).length <= 1) return;
        activeStep.value[step] = value;
    };

    const setTransposeFunc = (step: number, value: boolean) => {
        transposeFuncOn.value[step] = value;
    };

    const clearAll = () => {
        notes.value = [];
        clearNoteSelection();
        motionEnabled.value = Array.from({ length: MOTION_PARAM_COUNT }, () => false);
        motionStepEnabled.value = createMotionStepEnabled(true);
        motionValues.value = createMotionGrid(64);
        stepOn.value = Array.from({ length: NUM_OF_STEPS }, () => true);
        activeStep.value = Array.from({ length: NUM_OF_STEPS }, () => true);
        transposeFuncOn.value = Array.from({ length: NUM_OF_STEPS }, () => false);
        func.value = createEmptySequenceState().func;
    };

    const insertRest = (step: number) => {
        notes.value = clearSequenceStep(notes.value, step);
        clearNoteSelection();
    };

    const insertTie = (step: number): boolean => {
        const tied = tieSequenceStep(notes.value, step);
        if (!tied) return false;
        notes.value = tied;
        return true;
    };

    const setProgramNo = (value: number) => {
        programNo.value = Math.max(0, Math.min(63, Math.round(value)));
    };

    const importNotes = (next: SequenceNote[], defaultVelocity: number) => {
        notes.value = [];
        clearNoteSelection();
        velocity.value = defaultVelocity;
        for (const note of next) {
            addNote(note.pitch, note.startStep, note.length, note.velocity, note.gatePercent);
        }
    };

    const loadFromDecoded = (state: SequenceState | Partial<SequenceState>) => {
        const normalized = normalizeSequenceState(state);
        programNo.value = normalized.programNo;
        velocity.value = normalized.velocity;
        gatePercent.value = normalized.gatePercent;
        notes.value = normalized.notes;
        motionEnabled.value = normalized.motionEnabled;
        motionStepEnabled.value = normalized.motionStepEnabled;
        motionValues.value = normalized.motionValues;
        stepOn.value = normalized.stepOn;
        activeStep.value = normalized.activeStep;
        transposeFuncOn.value = normalized.transposeFuncOn;
        func.value = normalized.func;
        clearNoteSelection();
    };

    const applyNotes = (next: SequenceNote[] | null, nextKeys?: NoteKey[]) => {
        if (!next) return false;
        notes.value = next;
        if (nextKeys) setNoteSelection(nextKeys);
        return true;
    };

    const resizeNote = (key: NoteKey, newLength: number) => {
        const next = resizeSequenceNote(notes.value, key, newLength);
        if (!next) return false;
        const keys = selectedNoteKeys.value.some(item => sameNoteKey(item, key))
            ? selectedNoteKeys.value
            : [key];
        return applyNotes(next, keys);
    };

    const moveSelectedNotes = (pitchDelta: number, stepDelta: number, pitchMin: number, pitchMax: number) => {
        const keys = selectedNoteKeys.value;
        const next = moveSequenceNotes(notes.value, keys, pitchDelta, stepDelta, pitchMin, pitchMax);
        if (!next) return false;
        const { dPitch, dStep } = clampedNoteMove(notes.value, keys, pitchDelta, stepDelta, pitchMin, pitchMax);
        return applyNotes(next, keys.map(key => ({ pitch: key.pitch + dPitch, startStep: key.startStep + dStep })));
    };

    const removeSelectedNotes = () => {
        if (!selectedNoteKeys.value.length) return;
        const keySet = new Set(selectedNoteKeys.value.map(key => `${key.pitch}:${key.startStep}`));
        notes.value = notes.value.filter(note => !keySet.has(`${note.pitch}:${note.startStep}`));
        clearNoteSelection();
    };

    const randomizeSteps = (random: () => number = Math.random, scope: SequenceReorderScope = 'all') => {
        loadFromDecoded(reorderSequenceSteps(toState(), createRandomStepOrder(random), scope));
    };

    const reverseSteps = () => {
        loadFromDecoded(reorderSequenceSteps(toState(), createReversedStepOrder()));
    };

    const shiftSteps = (delta: number) => {
        if (!delta) return;
        loadFromDecoded(reorderSequenceSteps(toState(), createShiftedStepOrder(delta)));
    };

    const copyStep = (from: number, to: number) => {
        if (from === to) return;
        loadFromDecoded(copySequenceStep(toState(), from, to));
    };

    const copyStepEuclid = (from: number, pulses: number, rotation: number) => {
        loadFromDecoded(copySequenceStepsEuclid(toState(), from, pulses, rotation));
    };

    const copyNoteEuclid = (note: SequenceNote, pulses: number, rotation: number) => {
        loadFromDecoded(copySequenceNoteEuclid(toState(), note, pulses, rotation));
    };

    const historyPast: SequenceState[] = [];
    const historyFuture: SequenceState[] = [];
    const canUndo = ref(false);
    const canRedo = ref(false);
    let historyBaseline = cloneSequenceState(toState());
    let applyingHistory = false;
    let historyTimer: ReturnType<typeof setTimeout> | null = null;

    const historySignature = (state: SequenceState) => JSON.stringify(state);
    const refreshHistoryFlags = () => {
        canUndo.value = historyPast.length > 0 || historySignature(toState()) !== historySignature(historyBaseline);
        canRedo.value = historyFuture.length > 0;
    };
    const applyHistoryState = (state: SequenceState) => {
        applyingHistory = true;
        loadFromDecoded(state);
        nextTick(() => { applyingHistory = false; });
    };
    const commitHistory = () => {
        if (historyTimer !== null) {
            clearTimeout(historyTimer);
            historyTimer = null;
        }
        if (applyingHistory) return;
        const current = cloneSequenceState(toState());
        if (historySignature(current) === historySignature(historyBaseline)) {
            refreshHistoryFlags();
            return;
        }
        historyPast.push(historyBaseline);
        if (historyPast.length > HISTORY_LIMIT) historyPast.shift();
        historyBaseline = current;
        historyFuture.length = 0;
        refreshHistoryFlags();
    };
    const undo = () => {
        if (historyTimer !== null) {
            clearTimeout(historyTimer);
            historyTimer = null;
        }
        const current = cloneSequenceState(toState());
        if (historySignature(current) !== historySignature(historyBaseline)) {
            historyFuture.push(current);
            historyBaseline = cloneSequenceState(historyBaseline);
            applyHistoryState(historyBaseline);
            refreshHistoryFlags();
            return;
        }
        const previous = historyPast.pop();
        if (!previous) return;
        historyFuture.push(historyBaseline);
        historyBaseline = previous;
        applyHistoryState(previous);
        refreshHistoryFlags();
    };
    const redo = () => {
        if (historyTimer !== null) {
            clearTimeout(historyTimer);
            historyTimer = null;
        }
        const next = historyFuture.pop();
        if (!next) return;
        historyPast.push(historyBaseline);
        if (historyPast.length > HISTORY_LIMIT) historyPast.shift();
        historyBaseline = next;
        applyHistoryState(next);
        refreshHistoryFlags();
    };

    watch(toState, () => {
        if (applyingHistory) return;
        if (historyTimer !== null) clearTimeout(historyTimer);
        historyTimer = setTimeout(commitHistory, HISTORY_COMMIT_MS);
        refreshHistoryFlags();
    }, { deep: true });

    const buildSysEx = (channel = 0) => encodeCurrentSequenceDump(toState(), channel);

    const clearSendRetryTimer = () => {
        if (sendRetryTimer === null) return;
        clearTimeout(sendRetryTimer);
        sendRetryTimer = null;
    };

    const sendToDevice = () => {
        useMidiStore().sendCurrentSequenceDump(buildSysEx());
    };

    watch(() => useMidiStore().sequenceWriteState, state => {
        if (state === 'sending') {
            if (!sendRetryScheduled) {
                sendAttempts = 0;
                showSendErrorDialog.value = false;
            }
            sendRetryScheduled = false;
            sendAttempts += 1;
            return;
        }
        if (state === 'ok') {
            clearSendRetryTimer();
            sendAttempts = 0;
            sendRetrying.value = false;
            showSendRetrySnackbar.value = false;
            lastSendFailure.value = null;
            return;
        }
        if (state !== 'nak' && state !== 'error') return;

        lastSendFailure.value = state;
        clearSendRetryTimer();
        if (sendAttempts < SEND_MAX_ATTEMPTS) {
            sendRetrying.value = true;
            showSendRetrySnackbar.value = true;
            sendRetryScheduled = true;
            sendRetryTimer = setTimeout(() => {
                sendRetryTimer = null;
                sendToDevice();
            }, SEND_RETRY_DELAY_MS);
            return;
        }
        sendRetrying.value = false;
        showSendRetrySnackbar.value = false;
        showSendErrorDialog.value = true;
        sendAttempts = 0;
    });

    const canInsertTie = computed(() => stepCursor.value > 0 && stepNoteCount(stepCursor.value - 1) > 0);

    const clearStepInputBuffers = () => {
        heldNotes.value = new Set();
        chordBuffer.value = new Set();
    };

    const finishStepInput = () => {
        stepInputActive.value = false;
        clearStepInputBuffers();
        sendToDevice();
    };

    const advanceStepInput = () => {
        if (stepCursor.value === 15) finishStepInput();
        else stepCursor.value++;
    };

    const handleStepNote = (note: number, on: boolean) => {
        if (!stepInputActive.value) return;
        if (on) {
            heldNotes.value = new Set(heldNotes.value).add(note);
            chordBuffer.value = new Set(chordBuffer.value).add(note);
            return;
        }
        const nextHeld = new Set(heldNotes.value);
        nextHeld.delete(note);
        heldNotes.value = nextHeld;
        if (nextHeld.size === 0 && chordBuffer.value.size > 0) {
            for (const pitch of chordBuffer.value) addNote(pitch, stepCursor.value, 1);
            chordBuffer.value = new Set();
            advanceStepInput();
        }
    };

    const toggleStepInput = () => {
        stepInputActive.value = !stepInputActive.value;
        if (stepInputActive.value) stepCursor.value = 0;
        clearStepInputBuffers();
    };

    const insertStepRest = () => {
        clearStepInputBuffers();
        insertRest(stepCursor.value);
        advanceStepInput();
    };

    const insertStepTie = () => {
        clearStepInputBuffers();
        if (insertTie(stepCursor.value)) advanceStepInput();
    };

    const selectStepInput = (step: number) => {
        if (!stepInputActive.value) return;
        clearStepInputBuffers();
        stepCursor.value = Math.max(0, Math.min(15, step));
    };

    const applyRandomize = () => {
        randomizeSteps();
        showRandomizeDialog.value = false;
        sendToDevice();
    };

    const requestRandomize = () => {
        if (skipRandomizeDialog.value) {
            applyRandomize();
            return;
        }
        showRandomizeDialog.value = true;
    };

    const confirmRandomize = (dontShowAgain = false) => {
        if (dontShowAgain && !skipRandomizeDialog.value) {
            skipRandomizeDialog.value = true;
            setPref(SKIP_RANDOMIZE_PREF, true).catch(() => {
                skipRandomizeDialog.value = false;
            });
        }
        applyRandomize();
    };

    const queueSmfImport = (file: File) => {
        importError.value = null;
        pendingSmfFile = file;
        showImportDialog.value = true;
    };

    const cancelSmfImport = () => {
        showImportDialog.value = false;
        pendingSmfFile = null;
    };

    const confirmSmfImport = async () => {
        const file = pendingSmfFile;
        if (!file) return;
        showImportDialog.value = false;
        try {
            const parsed = parseSmf(await file.arrayBuffer());
            const { notes: imported, velocity: importedVelocity } = extractStepNotes(parsed, 4, Math.max(0, smfBarOffset.value - 1));
            importNotes(imported, importedVelocity);
            importError.value = null;
        } catch (error) {
            importError.value = String(error instanceof Error ? error.message : error);
        } finally {
            pendingSmfFile = null;
        }
    };

    const loadPreset = (data: unknown) => {
        loadFromDecoded(data as SequenceState);
        sendToDevice();
    };

    return {
        programNo,
        velocity,
        gatePercent,
        notes,
        motionEnabled,
        motionStepEnabled,
        motionValues,
        stepOn,
        activeStep,
        transposeFuncOn,
        func,
        selectedNoteKey,
        selectedNoteKeys,
        motionIndex,
        stepInputActive,
        stepCursor,
        chordBuffer,
        showRandomizeDialog,
        showCaptureDialog,
        showImportDialog,
        importError,
        sendRetrying,
        showSendRetrySnackbar,
        showSendErrorDialog,
        lastSendFailure,
        smfBarOffset,
        canInsertTie,
        canUndo,
        canRedo,
        toState,
        undo,
        redo,
        noteAt,
        selectedNote,
        selectNote,
        isNoteSelected,
        clearNoteSelection,
        setNoteSelection,
        resizeNote,
        moveSelectedNotes,
        removeSelectedNotes,
        stepNoteCount,
        setProgramNo,
        importNotes,
        addNote,
        removeNote,
        setMotionValue,
        clearMotionParam,
        toggleMotionStep,
        toggleStepOn,
        toggleActiveStep,
        toggleTransposeFunc,
        setStepOn,
        setActiveStep,
        setTransposeFunc,
        clearAll,
        insertRest,
        insertTie,
        loadFromDecoded,
        randomizeSteps,
        reverseSteps,
        shiftSteps,
        copyStep,
        copyStepEuclid,
        copyNoteEuclid,
        buildSysEx,
        sendToDevice,
        handleStepNote,
        toggleStepInput,
        insertStepRest,
        insertStepTie,
        selectStepInput,
        requestRandomize,
        confirmRandomize,
        queueSmfImport,
        cancelSmfImport,
        confirmSmfImport,
        loadPreset,
    };
});
