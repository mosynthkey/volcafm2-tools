import { createI18n } from 'vue-i18n'

const messages = {
  ja: {
    common: { ok: 'OK', cancel: 'キャンセル', close: '閉じる', save: '保存', load: '読み込む', delete: '削除', back: '戻る', loading: '読み込み中…', send: '送信' },
    app: {
      description: 'DX7 SysEx変換とvolca fm2のシーケンス編集をひとつの画面で行います。',
      showLog: 'ログを表示', log: 'ログ', tools: 'ツール', about: 'このアプリについて',
      expandSidebar: '左ペインを広げる', collapseSidebar: '左ペインを小さくする',
      nav: { sound: '音色を編集', sequence: 'シーケンスを編集', dx7: '音色をDX7 SysExに変換' },
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
      program: 'プログラム No.', programNameUnknown: '音色名を取得していません', getCurrentProgram: '取得',
      programFetchFailedTitle: 'プログラム番号を取得できませんでした', programFetchFailed: 'volca fm2とのMIDI IN/OUT接続を確認してください。',
      programFetchTitle: 'プログラム No. を取得', receivingProgramsForMatch: '照合用の音色データを受信中…', matchingCurrentProgram: '現在の音色からプログラム No. を照合中…',
      velocity: 'ベロシティ', gate: 'ゲート %', clear: 'クリア', randomize: 'ランダマイズ', randomizeTitle: 'ステップをランダマイズ',
      randomizeDescription: 'ノートとモーションを含む16ステップの順番をランダムに入れ替えます。', randomizeRun: '入れ替える',
      captureButton: 'シーケンス取り込み', captureTitle: 'シーケンス取り込み', captureDescription: 'volca fm2の現在のシーケンスを1周再生し、MIDIノートと16ステップを取り込みます。',
      captureResolution: 'volca fm2のステップ解像度', captureStep1: 'volca fm2のMIDI OUTがインターフェースのMIDI INに接続されていることを確認します。',
      captureStep2: 'volca fm2のMIDI ClockとMIDI Noteの送信を有効にします。', captureStep3: '開始すると現在のノートは、取り込んだ演奏で置き換えられます。',
      captureStart: '開始', captureCancel: '取り込みを中止', captureRunning: 'MIDI Clockとノートを受信中です…', captureProgress: 'ステップ {count}/16',
      captureDone: '{count}音をピアノロールに取り込みました。', captureNoClock: 'MIDI Clockを受信できませんでした。MIDI OUTの配線とvolca fm2のClock送信設定を確認してください。',
      captureClockStopped: 'MIDI Clockが途中で止まりました。volca fm2の再生状態とMIDI OUTの接続を確認してください。', captureStartFailed: 'MIDI Startを送信できませんでした。MIDI IN/OUTの接続を確認してください。',
      importSmf: 'SMFインポート', importSettings: 'SMFインポート', importBar: '開始小節', import: 'インポート', importError: 'インポート失敗',
      sendFailedTitle: '送信できませんでした', sendNak: '送信しましたがvolca fm2がエラーを返しました（NAK）。', sendError: '送信できませんでした。接続を確認してください。',
      stepInput: 'ステップ入力', stepInputExit: 'ステップ入力を終了', stepIndicator: 'ステップ {count}/16', stepPrev: '前のステップへ', stepNext: '次のステップへ（無音のまま進む）', stepReset: '先頭に戻す',
      motionParam: 'パラメーター', motionTarget: 'モーションの対象', motionEnable: 'このパラメーターのモーションを有効化', library: 'Sequence Library',
      autoMotion: '自動モーション書き込み', writeMotion: '波形を選択',
      motionPatterns: { linearUp: 'Linear Up', linearDown: 'Linear Down', sine1: 'Sine ×1', sine2: 'Sine ×2', triangle1: 'Triangle ×1', triangle2: 'Triangle ×2', square: 'Square', random: 'Random' },
      motionParams: { transpose: 'Transpose', velocity: 'Velocity', algorithm: 'Algorithm', modulatorAttack: 'Modulator Attack', modulatorDecay: 'Modulator Decay', carrierAttack: 'Carrier Attack', carrierDecay: 'Carrier Decay', lfoRate: 'LFO Rate', lfoPitchDepth: 'LFO Pitch Depth', arpType: 'Arp Type', arpDivision: 'Arp Division', chorusDepth: 'Chorus Depth', reverbDepth: 'Reverb Depth' },
    },
    sound: {
      title: 'Sound Edit', connectionError: 'volca fm2とのMIDI IN/OUT接続を確認してください。', selectAlgorithm: 'Algorithmを選択', library: 'Sound Library', untitled: 'Untitled Sound',
      voiceName: 'Voice Name', getCurrent: '現在の音色を取得', initialize: '初期化', algorithm: 'Algorithm', modulation: 'Modulation', feedback: 'Feedback', carrierOutput: 'Carrier / Output',
      oscKeySync: 'OSC Key Sync', macros: 'volca fm2 Macros', transpose: 'Transpose', modAttack: 'Mod Attack', modDecay: 'Mod Decay', carrierAttack: 'Carrier Attack', carrierDecay: 'Carrier Decay', semitone: 'Semitone', octave: 'volca Octave',
      operator: 'Operator {count}', allOperators: 'All Operators', showAllOperators: 'All', frequencyOutput: 'Frequency & Output', mode: 'Mode', oscillatorMode: 'Oscillator mode', ratio: 'Ratio', fixed: 'Fixed', coarse: 'Coarse', fine: 'Fine', detune: 'Detune', outputLevel: 'Output Level', ampModSens: 'Amp Mod Sens', keyVelocity: 'Key Velocity', rateScaling: 'Rate Scaling',
      amplitudeEnvelope: 'Amplitude Envelope', rateLevel: 'Rate / Level', rate: 'Rate {count}', level: 'Level {count}', keyboardScaling: 'Keyboard Scaling', keyResponse: 'Level response across keys', breakPoint: 'Break Point', leftDepth: 'Left Depth', rightDepth: 'Right Depth', leftCurve: 'Left Curve', rightCurve: 'Right Curve',
      waveform: 'Waveform', speed: 'Speed', delay: 'Delay', pitchModDepth: 'Pitch Mod Depth', ampModDepth: 'Amp Mod Depth', pitchModSens: 'Pitch Mod Sens', lfoKeySync: 'LFO Key Sync', pitchEnvelope: 'Pitch Envelope',
    },
    dx7: { cartridge: 'Cartridge {count}', download: 'ダウンロード' },
    library: { name: '名前', empty: 'まだ保存されたデータはありません。', loadError: '保存データを読み込めませんでした。', saveError: '保存できませんでした。', deleteError: '削除できませんでした。', deleteLabel: '{name}を削除' },
  },
  en: {
    common: { ok: 'OK', cancel: 'Cancel', close: 'Close', save: 'Save', load: 'Load', delete: 'Delete', back: 'Back', loading: 'Loading…', send: 'Send' },
    app: {
      description: 'DX7 SysEx conversion and volca fm2 sequence editing in one workspace.', showLog: 'Show log', log: 'Log', tools: 'Tools', about: 'About', expandSidebar: 'Expand sidebar', collapseSidebar: 'Collapse sidebar',
      nav: { sound: 'Edit the current voice', sequence: 'Edit the sequence', dx7: 'Convert voices to DX7 SysEx' },
      loadingPrograms: { title: 'Loading voice data', description: 'Receiving voices from the volca fm2.', waiting: 'Waiting for a response…' },
      connection: { title: 'volca fm2 was not found.', step1: 'Connect both MIDI IN and MIDI OUT on the volca fm2 to the MIDI interface connected to your computer.', step2: 'Open this app in Chrome or the desktop application.', step3: 'If the MIDI permission dialog appears, choose Allow.', retry: 'Detect volca fm2 again', initializing: 'Initializing MIDI', searching: 'Searching', disconnected: 'Not connected', connected: 'Connected', receiving: 'Receiving', error: 'Connection error' },
    },
    sequence: {
      program: 'Program No.', programNameUnknown: 'Program name is not available', getCurrentProgram: 'Get', programFetchFailedTitle: 'Could not get the program number', programFetchFailed: 'Check both MIDI IN and MIDI OUT connections to the volca fm2.', programFetchTitle: 'Get program number', receivingProgramsForMatch: 'Receiving voice data for comparison…', matchingCurrentProgram: 'Matching the current voice to a program number…', velocity: 'Velocity', gate: 'Gate %', clear: 'Clear', randomize: 'Randomize', randomizeTitle: 'Randomize steps', randomizeDescription: 'Shuffle all 16 steps, including notes and motion values.', randomizeRun: 'Shuffle', captureButton: 'Capture sequence', captureTitle: 'Capture sequence', captureDescription: 'Play the current volca fm2 sequence once and capture its MIDI notes as 16 steps.', captureResolution: 'volca fm2 step resolution', captureStep1: 'Confirm that MIDI OUT on the volca fm2 is connected to MIDI IN on the interface.', captureStep2: 'Enable MIDI Clock and MIDI Note transmission on the volca fm2.', captureStep3: 'Starting capture replaces the current notes with the captured performance.', captureStart: 'Start', captureCancel: 'Cancel capture', captureRunning: 'Receiving MIDI Clock and notes…', captureProgress: 'Step {count}/16', captureDone: 'Captured {count} note(s) into the piano roll.', captureNoClock: 'No MIDI Clock was received. Check MIDI OUT and the volca fm2 Clock transmit setting.', captureClockStopped: 'MIDI Clock stopped during capture. Check playback and MIDI OUT.', captureStartFailed: 'Could not send MIDI Start. Check MIDI IN and MIDI OUT.', importSmf: 'Import SMF', importSettings: 'Import SMF', importBar: 'Start bar', import: 'Import', importError: 'Import failed', sendFailedTitle: 'Send failed', sendNak: 'Sent, but volca fm2 returned an error (NAK).', sendError: 'Failed to send. Check the connection.', stepInput: 'Step Input', stepInputExit: 'Exit step input', stepIndicator: 'Step {count}/16', stepPrev: 'Previous step', stepNext: 'Next step (leave silent)', stepReset: 'Reset to step 1', motionParam: 'Parameter', motionTarget: 'Motion target', motionEnable: 'Enable motion for this parameter', library: 'Sequence Library', autoMotion: 'Auto Motion Write', writeMotion: 'Choose shape', motionPatterns: { linearUp: 'Linear Up', linearDown: 'Linear Down', sine1: 'Sine ×1', sine2: 'Sine ×2', triangle1: 'Triangle ×1', triangle2: 'Triangle ×2', square: 'Square', random: 'Random' },
      motionParams: { transpose: 'Transpose', velocity: 'Velocity', algorithm: 'Algorithm', modulatorAttack: 'Modulator Attack', modulatorDecay: 'Modulator Decay', carrierAttack: 'Carrier Attack', carrierDecay: 'Carrier Decay', lfoRate: 'LFO Rate', lfoPitchDepth: 'LFO Pitch Depth', arpType: 'Arp Type', arpDivision: 'Arp Division', chorusDepth: 'Chorus Depth', reverbDepth: 'Reverb Depth' },
    },
    sound: {
      title: 'Sound Edit', connectionError: 'Check both MIDI IN and MIDI OUT connections to the volca fm2.', selectAlgorithm: 'Select Algorithm', library: 'Sound Library', untitled: 'Untitled Sound', voiceName: 'Voice Name', getCurrent: 'Get current voice', initialize: 'Initialize', algorithm: 'Algorithm', modulation: 'Modulation', feedback: 'Feedback', carrierOutput: 'Carrier / Output', oscKeySync: 'OSC Key Sync', macros: 'volca fm2 Macros', transpose: 'Transpose', modAttack: 'Mod Attack', modDecay: 'Mod Decay', carrierAttack: 'Carrier Attack', carrierDecay: 'Carrier Decay', semitone: 'Semitone', octave: 'volca Octave', operator: 'Operator {count}', allOperators: 'All Operators', showAllOperators: 'All', frequencyOutput: 'Frequency & Output', mode: 'Mode', oscillatorMode: 'Oscillator mode', ratio: 'Ratio', fixed: 'Fixed', coarse: 'Coarse', fine: 'Fine', detune: 'Detune', outputLevel: 'Output Level', ampModSens: 'Amp Mod Sens', keyVelocity: 'Key Velocity', rateScaling: 'Rate Scaling', amplitudeEnvelope: 'Amplitude Envelope', rateLevel: 'Rate / Level', rate: 'Rate {count}', level: 'Level {count}', keyboardScaling: 'Keyboard Scaling', keyResponse: 'Level response across keys', breakPoint: 'Break Point', leftDepth: 'Left Depth', rightDepth: 'Right Depth', leftCurve: 'Left Curve', rightCurve: 'Right Curve', waveform: 'Waveform', speed: 'Speed', delay: 'Delay', pitchModDepth: 'Pitch Mod Depth', ampModDepth: 'Amp Mod Depth', pitchModSens: 'Pitch Mod Sens', lfoKeySync: 'LFO Key Sync', pitchEnvelope: 'Pitch Envelope',
    },
    dx7: { cartridge: 'Cartridge {count}', download: 'Download' },
    library: { name: 'Name', empty: 'No saved data yet.', loadError: 'Could not load saved data.', saveError: 'Could not save.', deleteError: 'Could not delete.', deleteLabel: 'Delete {name}' },
  },
} as const

const browserLocale = navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en'

export const i18n = createI18n({ legacy: false, locale: browserLocale, fallbackLocale: 'en', messages })
