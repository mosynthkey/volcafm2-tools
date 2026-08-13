import {
    displayToMidi,
    formatMotionValue,
    getMotionDisplayRange,
    midiToDisplay,
    transposeNoteFromMidi,
    transposeOctaveFromMidi,
} from '../src/utils/motionValue'

let failCount = 0
const check = (label: string, condition: boolean, detail?: string) => {
    if (condition) console.log(`  OK  ${label}`)
    else {
        failCount++
        console.log(`  NG  ${label}${detail ? ` — ${detail}` : ''}`)
    }
}

console.log('motion value display mapping')

check('algorithm 0 → 1, 127 → 32', midiToDisplay(2, 0, false) === 1 && midiToDisplay(2, 127, false) === 32)
check('algorithm 1 and 32 round-trip', displayToMidi(2, 1, false) <= 3 && midiToDisplay(2, displayToMidi(2, 32, false), false) === 32)
check('LFO 0 → 0, 127 → 99', midiToDisplay(7, 0, false) === 0 && midiToDisplay(7, 127, false) === 99)
check('EG 64 → 0, 1 → -63, 127 → +63', midiToDisplay(3, 64, false) === 0 && midiToDisplay(3, 1, false) === -63 && midiToDisplay(3, 127, false) === 63)
check('EG +12 round-trip', midiToDisplay(3, displayToMidi(3, 12, false), false) === 12)
check('velocity 0 displays as 1', midiToDisplay(1, 0, false) === 1)
check('arp type 0 → Off, 127 → N3', formatMotionValue(9, 0, false) === 'Off' && formatMotionValue(9, 127, false) === 'N3')
check('arp div 0 → 1/12', formatMotionValue(10, 0, false) === '1/12')
check('chorus stays 0-127', midiToDisplay(11, 64, false) === 64 && getMotionDisplayRange(11, false).max === 127)

check('transpose note center is 0', transposeNoteFromMidi(64) === 0)
check('transpose note 0 is -36, 127 is +36', transposeNoteFromMidi(0) === -36 && transposeNoteFromMidi(127) === 36)
check('transpose octave center is 0', transposeOctaveFromMidi(64) === 0)
check('transpose octave extremes -3 / +3', transposeOctaveFromMidi(0) === -3 && transposeOctaveFromMidi(127) === 3)
check('transpose note +12 round-trip', midiToDisplay(0, displayToMidi(0, 12, true), true) === 12)
check('transpose octave -2 round-trip', midiToDisplay(0, displayToMidi(0, -2, false), false) === -2)
check('format signed transpose', formatMotionValue(0, displayToMidi(0, 5, true), true) === '+5')

if (failCount) {
    console.error(`\n${failCount} check(s) failed`)
    process.exit(1)
}
console.log('\nall checks passed')
