import { createI18n } from 'vue-i18n'

const messages = {
  ja: {
    common: { ok: 'OK', cancel: 'キャンセル', close: '閉じる', save: '保存', load: '読み込む', delete: '削除', back: '戻る', loading: '読み込み中…', send: '送信', more: 'その他', library: 'ライブラリ', autoSend: '自動', autoSendHint: '変更を少し待ってからvolca fm2へ転送します', on: 'ON', off: 'OFF', clear: 'クリア', toggle: '切り替え' },
    app: {
      showLog: 'ログを表示', log: 'ログ', tools: 'ツール', about: 'volca fm2 tools', version: 'バージョン {version}', license: 'MIT ライセンス', copyright: 'Copyright (C) 2025 Masaki Ono',
      expandSidebar: '左ペインを広げる', collapseSidebar: '左ペインを小さくする',
      language: '言語',
      nav: { soundLabel: 'サウンド', sequenceLabel: 'シーケンス', dx7Label: 'DX7', sound: '音色を編集', sequence: 'シーケンスを編集', dx7: '音色をDX7 SysExに変換' },
      loadingPrograms: { title: '音色データを取得中', description: 'volca fm2の音色を読み込んでいます。', waiting: '応答を待っています…' },
      connection: {
        title: 'volca fm2が見つかりません。',
        step1: 'mac/PCと繋がっているMIDIインターフェースにvolca fm2のMIDI IN/OUTを両方接続してください。',
        step2: 'Chromeブラウザまたはデスクトップアプリから本アプリを開いてください。',
        step3: 'MIDI接続の許可ダイアログが表示された場合は、許可を選択してください。', retry: 'volca fm2を再検出',
        initializing: 'MIDI 初期化中', searching: '検索中', disconnected: '未接続', connected: '接続済み', receiving: '受信中', error: '接続エラー',
      },
    },
    sequence: {
      program: 'プログラム番号', programNameUnknown: '音色名を取得していません', getCurrentProgram: '取得',
      programFetchFailedTitle: 'プログラム番号を取得できませんでした', programFetchFailed: 'volca fm2とのMIDI IN/OUT接続を確認してください。',
      programFetchTitle: 'プログラム No. を取得', receivingProgramsForMatch: '照合用の音色データを受信中…', matchingCurrentProgram: '現在の音色からプログラム No. を照合中…',
      sectionLabel: 'シーケンス', velocity: 'Velocity', gate: 'Gate %', clear: 'クリア', randomize: 'ランダマイズ', randomizeTitle: 'ステップをランダマイズ',
      randomizeDescription: 'ノートとモーションを含む16ステップの順番をランダムに入れ替えます。', randomizeDontShowAgain: '今後このダイアログを表示しない', randomizeRun: '入れ替える',
      captureButton: '受信', captureTitle: 'シーケンス受信', captureDescription: 'volca fm2の現在のシーケンスを1周再生し、MIDIノートと16ステップを受信します。',
      captureNotesOnly: 'ノートしか取得できません。モーション（Modulation）は取り込めないため消えてしまいます。',
      captureResolution: 'volca fm2のステップ解像度', captureStep1: 'volca fm2のMIDI OUTがインターフェースのMIDI INに接続されていることを確認します。',
      captureStep2: 'volca fm2のMIDI ClockとMIDI Noteの送信を有効にします。', captureStep3: '開始すると現在のノートは、取り込んだ演奏で置き換えられます。',
      captureStart: '開始', captureCancel: '取り込みを中止', captureRunning: 'MIDI Clockとノートを受信中です…', captureProgress: 'ステップ {count}/16',
      captureDone: '{count}音をピアノロールに取り込みました。', captureNoClock: 'MIDI Clockを受信できませんでした。MIDI OUTの配線とvolca fm2のClock送信設定を確認してください。',
      captureClockStopped: 'MIDI Clockが途中で止まりました。volca fm2の再生状態とMIDI OUTの接続を確認してください。', captureStartFailed: 'MIDI Startを送信できませんでした。MIDI IN/OUTの接続を確認してください。',
      importSmf: 'SMFインポート', importSettings: 'SMFインポート', importBar: '開始小節', import: 'インポート', importError: 'インポート失敗',
      sendFailedTitle: '送信できませんでした', sendRetrying: '送信できませんでした（リトライ中）', sendNak: '送信しましたがvolca fm2がエラーを返しました（NAK）。', sendError: '送信できませんでした。接続を確認してください。',
      stepInput: 'ステップ入力', stepInputExit: 'ステップ入力を終了', stepIndicator: 'ステップ {count}/16', stepAria: 'ステップ {count}', stepPrev: '前のステップへ', stepNext: '次のステップへ（無音のまま進む）', stepReset: '先頭に戻す',
      tie: 'タイ', rest: 'レスト', libraryName: 'シーケンス {count}',
      motion: 'Motion',
      motionParam: 'Parameter', motionTarget: 'Target', motionEnable: 'このパラメータを有効にする', motionClear: 'このパラメータのモーションを0にする', library: 'ライブラリ',
      autoMotion: 'オートメーション', writeMotion: '波形を選ぶ',
      collapsePanel: 'パネルを折りたたむ', expandPanel: 'パネルを広げる',
      focusUsedPitches: '打ち込まれたノートとその上下2オクターブだけ表示', focusUsedPitchesShort: '±2oct',
      activeStep: 'Active Step', stepOn: 'Step On', motionStep: 'Motion On', funcTranspose: 'Transpose',
      selectedNote: '選択ノート', noteDefaults: 'ノート初期値',
      func: {
        voiceMode: 'Voice Mode', arpGroup: 'Arp', motionSequence: 'Motion Sequence',
        onOff: 'On/Off', motionOn: 'Motion On/Off', smooth: 'Smooth', warp: 'Warp Act.Step', transposeNote: 'Trnsps Note',
        chorus: 'Chorus', chorusDepth: 'Chorus Depth', reverb: 'Reverb', reverbDepth: 'Reverb Depth',
        arp: 'Arp', arpType: 'Arp Type', arpDiv: 'Arp Div', mono: 'Mono', unison: 'Unison', tempo: 'Tempo',
      },
      motionMin: 'Min', motionMax: 'Max', motionCycles: 'Cycles', motionOffset: 'Offset', motionPatterns: { linearUp: 'Linear Up', linearDown: 'Linear Down', sine: 'Sine', triangle: 'Triangle', square: 'Square', random: 'Random' },
      motionParams: { transpose: 'Transpose', velocity: 'Velocity', algorithm: 'Algorithm', modulatorAttack: 'Modulator Attack', modulatorDecay: 'Modulator Decay', carrierAttack: 'Carrier Attack', carrierDecay: 'Carrier Decay', lfoRate: 'LFO Rate', lfoPitchDepth: 'LFO Pitch Depth', arpType: 'Arp Type', arpDivision: 'Arp Division', chorusDepth: 'Chorus Depth', reverbDepth: 'Reverb Depth' },
      arpTypes: { off: 'オフ', rise1: 'RISE 1', rise2: 'RISE 2', rise3: 'RISE 3', fall1: 'FALL 1', fall2: 'FALL 2', fall3: 'FALL 3', rand1: 'RAND 1', rand2: 'RAND 2', rand3: 'RAND 3' },
      arpDivs: { d12: '1/12 STEP', d8: '1/8 STEP', d4: '1/4 STEP', d3: '1/3 STEP', d2: '1/2 STEP', d23: '2/3 STEP', d1: '1/1 STEP', d32: '3/2 STEP', d21: '2/1 STEP', d31: '3/1 STEP', d41: '4/1 STEP' },
    },
    sound: {
      title: 'サウンド編集', sectionLabel: 'サウンド', connectionError: 'volca fm2とのMIDI IN/OUT接続を確認してください。', selectAlgorithm: 'Algorithmを選択', library: '音色ライブラリ', untitled: '無題',
      voiceName: '音色名', getCurrent: '取得', initialize: '初期化', algorithm: 'Algorithm', modulator: 'Modulator', feedback: 'Feedback', carrierOutput: 'Carrier / Output',
      oscKeySync: 'OSC Key Sync', macros: 'volca fm2 Macros', transpose: 'Transpose', modAttack: 'Mod Attack', modDecay: 'Mod Decay', carrierAttack: 'Carrier Attack', carrierDecay: 'Carrier Decay', semitone: 'Semitone', octave: 'volca Octave',
      operator: 'Operator {count}', allOperators: '全オペレーター', showAllOperators: 'すべて', frequencyOutput: 'Frequency & Output', mode: 'Mode', oscillatorMode: 'Oscillator mode', ratio: 'Ratio', fixed: 'Fixed', coarse: 'Coarse', fine: 'Fine', detune: 'Detune', outputLevel: 'Output Level', ampModSens: 'Amp Mod Sens', keyVelocity: 'Key Velocity', rateScaling: 'Rate Scaling',
      amplitudeEnvelope: 'Amplitude Envelope', rateLevel: 'Rate / Level', rate: 'Rate {count}', level: 'Level {count}', keyboardScaling: 'Keyboard Scaling', keyResponse: 'Level response across keys', breakPoint: 'Break Point', leftDepth: 'Left Depth', rightDepth: 'Right Depth', leftCurve: 'Left Curve', rightCurve: 'Right Curve',
      waveform: 'Waveform', speed: 'Speed', delay: 'Delay', pitchModDepth: 'Pitch Mod Depth', ampModDepth: 'Amp Mod Depth', pitchModSens: 'Pitch Mod Sens', lfoKeySync: 'LFO Key Sync', pitchEnvelope: 'Pitch Envelope',
      lfo: 'LFO', eg: 'EG', algorithmLegend: 'アルゴリズム図の凡例', algorithmN: 'Algorithm {count}',
      levelLabel: 'Level', rateLabel: 'Rate',
      lfoWaves: { triangle: '三角波', sawDown: '下降ノコギリ', sawUp: '上昇ノコギリ', square: '矩形波', sine: 'サイン波', sampleHold: 'サンプル&ホールド' },
      compact: { output: '出力', ampMod: 'Amp Mod', keyVel: 'Key Vel', rateScale: 'Rate Sc', break: 'Break', leftDepth: 'L Depth', rightDepth: 'R Depth', leftCurve: 'L Curve', rightCurve: 'R Curve' },
    },
    dx7: { cartridge: 'カートリッジ {count}', download: 'ダウンロード' },
    library: { name: '名前', empty: 'まだ保存されたデータはありません。', loadError: '保存データを読み込めませんでした。', saveError: '保存できませんでした。', deleteError: '削除できませんでした。', deleteLabel: '{name}を削除' },
  },
  en: {
    common: { ok: 'OK', cancel: 'Cancel', close: 'Close', save: 'Save', load: 'Load', delete: 'Delete', back: 'Back', loading: 'Loading…', send: 'Send', more: 'More', library: 'Library', autoSend: 'Auto', autoSendHint: 'Buffer edits briefly, then send them to the volca fm2', on: 'ON', off: 'OFF', clear: 'Clear', toggle: 'Toggle' },
    app: {
      showLog: 'Show log', log: 'Log', tools: 'Tools', about: 'volca fm2 tools', version: 'Version {version}', license: 'MIT License', copyright: 'Copyright (C) 2025 Masaki Ono', expandSidebar: 'Expand sidebar', collapseSidebar: 'Collapse sidebar',
      language: 'Language',
      nav: { soundLabel: 'Sound', sequenceLabel: 'Sequence', dx7Label: 'DX7', sound: 'Edit the current voice', sequence: 'Edit the sequence', dx7: 'Convert voices to DX7 SysEx' },
      loadingPrograms: { title: 'Loading voice data', description: 'Receiving voices from the volca fm2.', waiting: 'Waiting for a response…' },
      connection: { title: 'volca fm2 was not found.', step1: 'Connect both MIDI IN and MIDI OUT on the volca fm2 to the MIDI interface connected to your computer.', step2: 'Open this app in Chrome or the desktop application.', step3: 'If the MIDI permission dialog appears, choose Allow.', retry: 'Detect volca fm2 again', initializing: 'Initializing MIDI', searching: 'Searching', disconnected: 'Not connected', connected: 'Connected', receiving: 'Receiving', error: 'Connection error' },
    },
    sequence: {
      program: 'Program No.', sectionLabel: 'Sequence', programNameUnknown: 'Program name is not available', getCurrentProgram: 'Get', programFetchFailedTitle: 'Could not get the program number', programFetchFailed: 'Check both MIDI IN and MIDI OUT connections to the volca fm2.', programFetchTitle: 'Get program number', receivingProgramsForMatch: 'Receiving voice data for comparison…', matchingCurrentProgram: 'Matching the current voice to a program number…', velocity: 'Velocity', gate: 'Gate %', clear: 'Clear', randomize: 'Randomize', randomizeTitle: 'Randomize steps', randomizeDescription: 'Shuffle all 16 steps, including notes and motion values.', randomizeDontShowAgain: "Don't show this dialog again", randomizeRun: 'Shuffle', captureButton: 'Receive', captureTitle: 'Receive sequence', captureDescription: 'Play the current volca fm2 sequence once and receive its MIDI notes as 16 steps.', captureNotesOnly: 'Only notes can be captured. Motion (modulation) is not received and will be lost.', captureResolution: 'volca fm2 step resolution', captureStep1: 'Confirm that MIDI OUT on the volca fm2 is connected to MIDI IN on the interface.', captureStep2: 'Enable MIDI Clock and MIDI Note transmission on the volca fm2.', captureStep3: 'Starting capture replaces the current notes with the captured performance.', captureStart: 'Start', captureCancel: 'Cancel capture', captureRunning: 'Receiving MIDI Clock and notes…', captureProgress: 'Step {count}/16', captureDone: 'Captured {count} note(s) into the piano roll.', captureNoClock: 'No MIDI Clock was received. Check MIDI OUT and the volca fm2 Clock transmit setting.', captureClockStopped: 'MIDI Clock stopped during capture. Check playback and MIDI OUT.', captureStartFailed: 'Could not send MIDI Start. Check MIDI IN and MIDI OUT.', importSmf: 'Import SMF', importSettings: 'Import SMF', importBar: 'Start bar', import: 'Import', importError: 'Import failed', sendFailedTitle: 'Send failed', sendRetrying: 'Send failed (retrying)', sendNak: 'Sent, but volca fm2 returned an error (NAK).', sendError: 'Failed to send. Check the connection.', stepInput: 'Step Input', stepInputExit: 'Exit step input', stepIndicator: 'Step {count}/16', stepAria: 'Step {count}', stepPrev: 'Previous step', stepNext: 'Next step (leave silent)', stepReset: 'Reset to step 1', tie: 'Tie', rest: 'Rest', libraryName: 'Sequence {count}', motion: 'Motion', motionParam: 'Parameter', motionTarget: 'Target', motionEnable: 'Enable this parameter', motionClear: 'Reset this parameter motion to 0', library: 'Library', autoMotion: 'Automation', writeMotion: 'Choose shape', collapsePanel: 'Collapse panel', expandPanel: 'Expand panel', focusUsedPitches: 'Show used notes and ±2 octaves only', focusUsedPitchesShort: '±2oct', activeStep: 'Active Step', stepOn: 'Step On', motionStep: 'Motion On', funcTranspose: 'Transpose', selectedNote: 'Selected Note', noteDefaults: 'Note Defaults', func: { voiceMode: 'Voice Mode', arpGroup: 'Arp', motionSequence: 'Motion Sequence', onOff: 'On/Off', motionOn: 'Motion On/Off', smooth: 'Smooth', warp: 'Warp Act.Step', transposeNote: 'Trnsps Note', chorus: 'Chorus', chorusDepth: 'Chorus Depth', reverb: 'Reverb', reverbDepth: 'Reverb Depth', arp: 'Arp', arpType: 'Arp Type', arpDiv: 'Arp Div', mono: 'Mono', unison: 'Unison', tempo: 'Tempo' }, motionMin: 'Min', motionMax: 'Max', motionCycles: 'Cycles', motionOffset: 'Offset', motionPatterns: { linearUp: 'Linear Up', linearDown: 'Linear Down', sine: 'Sine', triangle: 'Triangle', square: 'Square', random: 'Random' },
      motionParams: { transpose: 'Transpose', velocity: 'Velocity', algorithm: 'Algorithm', modulatorAttack: 'Modulator Attack', modulatorDecay: 'Modulator Decay', carrierAttack: 'Carrier Attack', carrierDecay: 'Carrier Decay', lfoRate: 'LFO Rate', lfoPitchDepth: 'LFO Pitch Depth', arpType: 'Arp Type', arpDivision: 'Arp Division', chorusDepth: 'Chorus Depth', reverbDepth: 'Reverb Depth' },
      arpTypes: { off: 'Off', rise1: 'RISE 1', rise2: 'RISE 2', rise3: 'RISE 3', fall1: 'FALL 1', fall2: 'FALL 2', fall3: 'FALL 3', rand1: 'RAND 1', rand2: 'RAND 2', rand3: 'RAND 3' },
      arpDivs: { d12: '1/12 STEP', d8: '1/8 STEP', d4: '1/4 STEP', d3: '1/3 STEP', d2: '1/2 STEP', d23: '2/3 STEP', d1: '1/1 STEP', d32: '3/2 STEP', d21: '2/1 STEP', d31: '3/1 STEP', d41: '4/1 STEP' },
    },
    sound: {
      title: 'Sound Edit', sectionLabel: 'Sound', connectionError: 'Check both MIDI IN and MIDI OUT connections to the volca fm2.', selectAlgorithm: 'Select Algorithm', library: 'Sound Library', untitled: 'Untitled Sound', voiceName: 'Voice Name', getCurrent: 'Get', initialize: 'Initialize', algorithm: 'Algorithm', modulator: 'Modulator', feedback: 'Feedback', carrierOutput: 'Carrier / Output', oscKeySync: 'OSC Key Sync', macros: 'volca fm2 Macros', transpose: 'Transpose', modAttack: 'Mod Attack', modDecay: 'Mod Decay', carrierAttack: 'Carrier Attack', carrierDecay: 'Carrier Decay', semitone: 'Semitone', octave: 'volca Octave', operator: 'Operator {count}', allOperators: 'All Operators', showAllOperators: 'All', frequencyOutput: 'Frequency & Output', mode: 'Mode', oscillatorMode: 'Oscillator mode', ratio: 'Ratio', fixed: 'Fixed', coarse: 'Coarse', fine: 'Fine', detune: 'Detune', outputLevel: 'Output Level', ampModSens: 'Amp Mod Sens', keyVelocity: 'Key Velocity', rateScaling: 'Rate Scaling', amplitudeEnvelope: 'Amplitude Envelope', rateLevel: 'Rate / Level', rate: 'Rate {count}', level: 'Level {count}', keyboardScaling: 'Keyboard Scaling', keyResponse: 'Level response across keys', breakPoint: 'Break Point', leftDepth: 'Left Depth', rightDepth: 'Right Depth', leftCurve: 'Left Curve', rightCurve: 'Right Curve', waveform: 'Waveform', speed: 'Speed', delay: 'Delay', pitchModDepth: 'Pitch Mod Depth', ampModDepth: 'Amp Mod Depth', pitchModSens: 'Pitch Mod Sens', lfoKeySync: 'LFO Key Sync', pitchEnvelope: 'Pitch Envelope',
      lfo: 'LFO', eg: 'EG', algorithmLegend: 'Algorithm diagram legend', algorithmN: 'Algorithm {count}',
      levelLabel: 'Level', rateLabel: 'Rate',
      lfoWaves: { triangle: 'Triangle', sawDown: 'Saw Down', sawUp: 'Saw Up', square: 'Square', sine: 'Sine', sampleHold: 'Sample & Hold' },
      compact: { output: 'Output', ampMod: 'Amp Mod', keyVel: 'Key Vel', rateScale: 'Rate Scale', break: 'Break', leftDepth: 'L Depth', rightDepth: 'R Depth', leftCurve: 'L Curve', rightCurve: 'R Curve' },
    },
    dx7: { cartridge: 'Cartridge {count}', download: 'Download' },
    library: { name: 'Name', empty: 'No saved data yet.', loadError: 'Could not load saved data.', saveError: 'Could not save.', deleteError: 'Could not delete.', deleteLabel: 'Delete {name}' },
  },
} as const

export type AppLocale = 'ja' | 'en'
const LOCALE_KEY = 'volca-fm2-locale'

const readStoredLocale = (): AppLocale | null => {
  try {
    const value = localStorage.getItem(LOCALE_KEY)
    return value === 'ja' || value === 'en' ? value : null
  } catch {
    return null
  }
}

const browserLocale: AppLocale = navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en'
const initialLocale = readStoredLocale() ?? browserLocale

export const i18n = createI18n({ legacy: false, locale: initialLocale, fallbackLocale: 'en', messages })
document.documentElement.lang = initialLocale

export const setAppLocale = (next: AppLocale) => {
  i18n.global.locale.value = next
  document.documentElement.lang = next
  try {
    localStorage.setItem(LOCALE_KEY, next)
  } catch {
    /* ignore quota / private mode */
  }
}
