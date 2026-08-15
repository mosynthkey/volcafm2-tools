import assert from 'node:assert/strict'
import {
  isStaleDetectGeneration,
  midiStateChangeAction,
  nextDetectGeneration,
  portNamesFrom,
  selectedPortDisconnected,
  shouldWarnBeforeDocumentReload,
} from '../src/midi/midiAccessSession'

const first = nextDetectGeneration(0)
const second = nextDetectGeneration(first)
assert.equal(first, 1)
assert.equal(second, 2)
assert.equal(isStaleDetectGeneration(first, first), false)
assert.equal(isStaleDetectGeneration(first, second), true)

assert.deepEqual(portNamesFrom([
  { name: 'volca fm2', state: 'connected' },
  { name: '', state: 'connected' },
  { name: null, state: 'disconnected' },
]), ['volca fm2'])

assert.equal(selectedPortDisconnected('volca fm2', [
  { name: 'volca fm2', state: 'disconnected' },
]), true)
assert.equal(selectedPortDisconnected('volca fm2', [
  { name: 'volca fm2', state: 'connected' },
]), false)
assert.equal(selectedPortDisconnected(null, [
  { name: 'volca fm2', state: 'disconnected' },
]), false)

assert.equal(midiStateChangeAction({
  isDeviceReady: true,
  isBusy: false,
  portState: 'disconnected',
  selectedDisconnected: true,
}), 'mark-disconnected')
assert.equal(midiStateChangeAction({
  isDeviceReady: false,
  isBusy: false,
  portState: 'connected',
  selectedDisconnected: false,
}), 'rescan')
assert.equal(midiStateChangeAction({
  isDeviceReady: false,
  isBusy: true,
  portState: 'connected',
  selectedDisconnected: false,
}), 'refresh')
assert.equal(midiStateChangeAction({
  isDeviceReady: true,
  isBusy: false,
  portState: 'connected',
  selectedDisconnected: false,
}), 'refresh')

assert.equal(shouldWarnBeforeDocumentReload({ hasUnsavedProgram: false, hasSequenceNotes: false }), false)
assert.equal(shouldWarnBeforeDocumentReload({ hasUnsavedProgram: true, hasSequenceNotes: false }), true)
assert.equal(shouldWarnBeforeDocumentReload({ hasUnsavedProgram: false, hasSequenceNotes: true }), true)

console.log('verify-midi-reconnect: ok')
