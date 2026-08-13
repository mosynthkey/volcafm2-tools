export enum MIDIConnectionState {
    INITIALIZING,
    SEARCHING,
    NOT_FOUND,
    DETECTED,
    RECEIVING,
    RECEIVED,
    ERROR,
}

export const isDeviceReadyState = (state: MIDIConnectionState) =>
    state === MIDIConnectionState.DETECTED
    || state === MIDIConnectionState.RECEIVING
    || state === MIDIConnectionState.RECEIVED;

export const isIdleConnectedState = (state: MIDIConnectionState) =>
    state === MIDIConnectionState.DETECTED
    || state === MIDIConnectionState.RECEIVED;
