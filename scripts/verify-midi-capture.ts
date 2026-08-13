import assert from 'node:assert/strict';
import { MIDI_CLOCKS_PER_PATTERN, MidiSequenceCapture } from '../src/utils/midiSequenceCapture';

const clock = new Uint8Array([0xf8]);
const recorder = new MidiSequenceCapture();

// 最初のClockをtick 0として、step 1にC4を記録する。
recorder.handleMessage(clock);
recorder.handleMessage(new Uint8Array([0x90, 60, 96]));
for (let i = 0; i < 5; i++) recorder.handleMessage(clock);
recorder.handleMessage(new Uint8Array([0x80, 60, 0]));

// 7個目のClockがstep 2の先頭。E4を2ステップ保持する。
recorder.handleMessage(clock);
recorder.handleMessage(new Uint8Array([0x90, 64, 112]));
for (let i = 0; i < 12; i++) recorder.handleMessage(clock);
recorder.handleMessage(new Uint8Array([0x90, 64, 0]));

while (recorder.clockCount < MIDI_CLOCKS_PER_PATTERN) recorder.handleMessage(clock);
const result = recorder.finish();

assert.equal(result.clockCount, 96);
assert.deepEqual(result.notes, [
    { pitch: 60, startStep: 0, length: 1, velocity: 96, gatePercent: 83 },
    { pitch: 64, startStep: 1, length: 2, velocity: 112, gatePercent: 100 },
]);
assert.equal(result.velocity, 112);
assert.ok(result.gatePercent >= 80 && result.gatePercent <= 100);

console.log('MIDI sequence capture verification passed.');

for (const resolution of [1, 2, 4] as const) {
    const scaled = new MidiSequenceCapture(resolution);
    const clocksPerStep = 6 * resolution;
    const noteOnClock = clocksPerStep * 15 + 1;
    for (let clockNo = 1; clockNo <= 16 * clocksPerStep; clockNo++) {
        scaled.handleMessage(clock);
        if (clockNo === noteOnClock) scaled.handleMessage(new Uint8Array([0x90, 72, 100]));
    }
    const scaledResult = scaled.finish();
    assert.equal(scaled.clockCount, 16 * clocksPerStep);
    assert.equal(scaledResult.notes[0].startStep, 15);
    assert.equal(scaledResult.notes[0].length, 1);
    console.log(`  resolution=1/${resolution}: ${scaled.clockCount} clocks OK`);
}

// 同じ音程がステップ境界で再トリガーされても、前のノートと重ならない。
const boundary = new MidiSequenceCapture(2);
boundary.handleMessage(new Uint8Array([0x90, 60, 100]));
for (let i = 0; i < 12; i++) boundary.handleMessage(clock);
boundary.handleMessage(new Uint8Array([0x80, 60, 0]));
boundary.handleMessage(new Uint8Array([0x90, 60, 100]));
for (let i = 0; i < 12; i++) boundary.handleMessage(clock);
boundary.handleMessage(new Uint8Array([0x80, 60, 0]));
const boundaryResult = boundary.finish();
assert.deepEqual(boundaryResult.notes, [
    { pitch: 60, startStep: 0, length: 1, velocity: 100, gatePercent: 100 },
    { pitch: 60, startStep: 1, length: 1, velocity: 100, gatePercent: 100 },
]);
console.log('  repeated note on an exact step boundary: OK');
