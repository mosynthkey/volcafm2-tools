import assert from 'node:assert/strict'
import {
  isStaleDetectGeneration,
  midiStateChangeAction,
  nextDetectGeneration,
  matchingMidiOutputName,
  portNamesFrom,
  waitForMidiPorts,
  selectedPortDisconnected,
  desktopMidiBootAction,
  shouldAutoReloadMidiDocument,
  readDidAutoReloadMidi,
  markAutoReloadMidi,
  clearAutoReloadMidi,
  MIDI_AUTO_RELOAD_KEY,
} from '../src/midi/midiAccessSession'
import { DESKTOP_APP_DOWNLOAD_URL } from '../src/utils/clientEnvironment'

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

assert.equal(matchingMidiOutputName('Volt 476', ['NTS-3 kaoss pad kit MIDI OUT', 'Volt 476']), 'Volt 476')
assert.equal(matchingMidiOutputName('NTS-3 kaoss pad kit MIDI IN', [
  'NTS-3 kaoss pad kit MIDI OUT',
  'NTS-3 kaoss pad kit SOUND',
  'Volt 476',
]), 'NTS-3 kaoss pad kit MIDI OUT')
assert.equal(matchingMidiOutputName('NTS-3 kaoss pad kit XY/KNOB', [
  'NTS-3 kaoss pad kit MIDI OUT',
  'NTS-3 kaoss pad kit SOUND',
]), null)

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
  isDeviceReady: false,
  isBusy: true,
  portState: 'connected',
  selectedDisconnected: false,
  newPortAppeared: true,
}), 'rescan')
assert.equal(midiStateChangeAction({
  isDeviceReady: true,
  isBusy: false,
  portState: 'connected',
  selectedDisconnected: false,
}), 'refresh')

{
  const immediate = await waitForMidiPorts({
    hasPorts: () => true,
    subscribe: () => () => {},
    timeoutMs: 50,
  })
  assert.equal(immediate, true)
  let notified = false
  const late = waitForMidiPorts({
    hasPorts: () => notified,
    subscribe: onChange => {
      setTimeout(() => {
        notified = true
        onChange()
      }, 10)
      return () => {}
    },
    timeoutMs: 200,
  })
  assert.equal(await late, true)
}

assert.equal(desktopMidiBootAction({ isDesktop: false, didAutoReload: true }), 'init')
assert.equal(desktopMidiBootAction({ isDesktop: true, didAutoReload: false }), 'init')
assert.equal(desktopMidiBootAction({ isDesktop: true, didAutoReload: true }), 'reconnect')

assert.equal(shouldAutoReloadMidiDocument({
  isDesktop: true, didAutoReload: false, midiAccessFailed: true, deviceNotFound: false, hasNoPorts: false,
}), true)
assert.equal(shouldAutoReloadMidiDocument({
  isDesktop: true, didAutoReload: false, midiAccessFailed: false, deviceNotFound: true, hasNoPorts: true,
}), true)
assert.equal(shouldAutoReloadMidiDocument({
  isDesktop: true, didAutoReload: false, midiAccessFailed: false, deviceNotFound: true, hasNoPorts: false,
}), false)
assert.equal(shouldAutoReloadMidiDocument({
  isDesktop: true, didAutoReload: true, midiAccessFailed: true, deviceNotFound: false, hasNoPorts: false,
}), false)
assert.equal(shouldAutoReloadMidiDocument({
  isDesktop: false, didAutoReload: false, midiAccessFailed: true, deviceNotFound: false, hasNoPorts: false,
}), false)

const memory = new Map<string, string>()
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value) },
  removeItem: (key: string) => { memory.delete(key) },
}
assert.equal(readDidAutoReloadMidi(storage), false)
markAutoReloadMidi(storage)
assert.equal(memory.get(MIDI_AUTO_RELOAD_KEY), '1')
assert.equal(readDidAutoReloadMidi(storage), true)
clearAutoReloadMidi(storage)
assert.equal(readDidAutoReloadMidi(storage), false)

assert.equal(
  DESKTOP_APP_DOWNLOAD_URL,
  'https://github.com/mosynthkey/volcafm2-tools/releases/latest/download/volca-fm2-tools-macOS.dmg',
)

console.log('verify-midi-reconnect: ok')
