import { strict as assert } from 'node:assert';
import { EG_SHAPE_PRESETS } from '../src/features/sound/egShapePresets';
import { buildDx7SingleVoice, parseDx7Sysex } from '../src/midi/dx7Cartridge';
import { adsrToEg, egToAdsr, isAdsrEnvelope } from '../src/utils/adsrEnvelope';
import { createInitialSoundProgram, decodeSoundProgram, encodeSoundProgram, normalizeSoundProgramName } from '../src/utils/soundProgramCodec';

const initial = createInitialSoundProgram();
assert.equal(initial.algorithm, 0);
assert.deepEqual(initial.operators[0].egRates, [99, 99, 99, 99]);
assert.deepEqual(initial.operators[0].egLevels, [99, 99, 99, 0]);
assert.equal(initial.operators[0].outputLevel, 99);
assert.equal(initial.operators[0].coarse, 1);
for (const operator of initial.operators.slice(1)) {
    assert.equal(operator.outputLevel, 0);
    assert.deepEqual(operator.egRates, [99, 99, 99, 99]);
    assert.deepEqual(operator.egLevels, [99, 99, 99, 0]);
}
assert.deepEqual(decodeSoundProgram(encodeSoundProgram(initial)), initial);

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

const format0 = buildDx7SingleVoice(renamedBytes.subarray(0, 128));
assert.equal(parseDx7Sysex(format0)[0]?.name, 'NEW NAME!');

const adsrEg = adsrToEg({ attack: 0, decay: 39, sustain: 70, release: 20 });
assert.deepEqual([...adsrEg.rates], [99, 60, 99, 79]);
assert.deepEqual([...adsrEg.levels], [99, 70, 70, 0]);
assert.deepEqual(egToAdsr([...adsrEg.rates], [...adsrEg.levels]), { attack: 0, decay: 39, sustain: 70, release: 20 });
assert.equal(isAdsrEnvelope([...adsrEg.rates], [...adsrEg.levels]), true);
assert.equal(isAdsrEnvelope([99, 99, 99, 99], [80, 70, 70, 0]), false);
for (const shape of EG_SHAPE_PRESETS) {
  assert.equal(isAdsrEnvelope([...shape.rates], [...shape.levels]), true, shape.id);
}

console.log('Sound program codec verification passed (140-byte Current Program Data).');
