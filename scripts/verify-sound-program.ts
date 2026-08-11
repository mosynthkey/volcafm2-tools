import { strict as assert } from 'node:assert';
import { createInitialSoundProgram, decodeSoundProgram, encodeSoundProgram, normalizeSoundProgramName } from '../src/utils/soundProgramCodec';

const program = createInitialSoundProgram();
program.name = 'TEST VOICE';
program.algorithm = 17;
program.feedback = 6;
program.oscillatorSync = true;
program.lfoWave = 5;
program.pitchModSensitivity = 7;
program.modulatorAttack = -63;
program.carrierDecay = 63;
program.octave = -2;
program.operators[0].enabled = false;
program.operators[0].coarse = 31;
program.operators[0].fine = 99;
program.operators[0].detune = 14;
program.operators[5].leftCurve = 3;
program.operators[5].rightCurve = 2;

const bytes = encodeSoundProgram(program);
assert.equal(bytes.length, 140);
assert.deepEqual(Array.from(bytes.slice(118, 128)), Array.from('TEST VOICE', character => character.charCodeAt(0)));
const decoded = decodeSoundProgram(bytes);

assert.equal(decoded.name, program.name);
assert.equal(decoded.algorithm, program.algorithm);
assert.equal(decoded.feedback, program.feedback);
assert.equal(decoded.oscillatorSync, true);
assert.equal(decoded.lfoWave, program.lfoWave);
assert.equal(decoded.pitchModSensitivity, program.pitchModSensitivity);
assert.equal(decoded.modulatorAttack, program.modulatorAttack);
assert.equal(decoded.carrierDecay, program.carrierDecay);
assert.equal(decoded.octave, program.octave);
assert.equal(decoded.operators[0].enabled, false);
assert.equal(decoded.operators[0].coarse, 31);
assert.equal(decoded.operators[0].fine, 99);
assert.equal(decoded.operators[0].detune, 14);
assert.equal(decoded.operators[5].leftCurve, 3);
assert.equal(decoded.operators[5].rightCurve, 2);

program.name = 'NEW NAME!';
const renamedBytes = encodeSoundProgram(program);
assert.equal(String.fromCharCode(...renamedBytes.slice(118, 128)), 'NEW NAME! ');
assert.equal(decodeSoundProgram(renamedBytes).name, 'NEW NAME!');
assert.equal(normalizeSoundProgramName('LONG VOICE NAME'), 'LONG VOICE');
assert.equal(normalizeSoundProgramName('FM音色'), 'FM');

console.log('Sound program codec verification passed (140-byte Current Program Data).');
