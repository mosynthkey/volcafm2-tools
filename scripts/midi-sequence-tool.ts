/**
 * 実機のvolca fm2に対して、ブラウザを介さず直接SysExの送受信をテストするためのCLIツール。
 * アプリ本体 (src/utils/sequenceCodec.ts, src/stores/midiStore.ts) と同じエンコード/デコード
 * ロジックを使うので、「アプリが実機と正しく通信できるか」をAIが自律的に検証できる。
 *
 * 使い方:
 *   npx tsx scripts/midi-sequence-tool.ts list
 *   npx tsx scripts/midi-sequence-tool.ts monitor [--port <name>] [--seconds 10]
 *   npx tsx scripts/midi-sequence-tool.ts inquiry [--port <name>]
 *   npx tsx scripts/midi-sequence-tool.ts read    [--port <name>] [--timeout 8]
 *   npx tsx scripts/midi-sequence-tool.ts write   [--port <name>]
 *   npx tsx scripts/midi-sequence-tool.ts roundtrip [--port <name>]
 */
import midi from '@julusian/midi';
import {
    buildSequenceDataBytes,
    decodeSequenceData,
    encodeCurrentSequenceDump,
    unpack7to8,
} from '../src/utils/sequenceCodec';
import { MOTION_PARAM_COUNT, NUM_OF_STEPS, type SequenceNote, type SequenceState } from '../src/types/sequence';

const args = process.argv.slice(2);
const command = args[0];

const getFlag = (name: string, def?: string) => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
};

const portNameFilter = getFlag('port');
const timeoutSec = Number(getFlag('timeout', '8'));
const monitorSec = Number(getFlag('seconds', '10'));

const now = () => new Date().toTimeString().slice(0, 8) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
const toHex = (bytes: number[] | Uint8Array, limit = 32) => {
    const arr = Array.from(bytes).slice(0, limit).map(b => b.toString(16).padStart(2, '0')).join(' ');
    return bytes.length > limit ? `${arr} ... (${bytes.length} bytes)` : `${arr} (${bytes.length} bytes)`;
};

const findPortIndex = (io: InstanceType<typeof midi.Input> | InstanceType<typeof midi.Output>) => {
    const count = io.getPortCount();
    for (let i = 0; i < count; i++) {
        const name = io.getPortName(i);
        if (!portNameFilter || name.includes(portNameFilter)) return i;
    }
    return -1;
};

const openPorts = () => {
    const input = new midi.Input();
    const output = new midi.Output();

    const inIdx = findPortIndex(input);
    const outIdx = findPortIndex(output);

    if (inIdx < 0 || outIdx < 0) {
        console.error(`Could not find matching MIDI port${portNameFilter ? ` for "${portNameFilter}"` : ''}.`);
        console.error('Available inputs:');
        for (let i = 0; i < input.getPortCount(); i++) console.error(`  [${i}] ${input.getPortName(i)}`);
        process.exit(1);
    }

    // sysex(第1引数)を受信するには false にする必要がある (デフォルトは無視される)
    input.ignoreTypes(false, false, false);
    input.openPort(inIdx);
    output.openPort(outIdx);

    console.log(`[${now()}] Opened input="${input.getPortName(inIdx)}" output="${output.getPortName(outIdx)}"`);
    return { input, output };
};

// -----------------------------------------------------------------------
// SysEx再組み立て (アプリのmidiStore.tsと同じロジック)
// -----------------------------------------------------------------------
type SysexHandler = (data: number[]) => void;
const attachSysexReassembly = (input: InstanceType<typeof midi.Input>, onComplete: SysexHandler, logRaw = false) => {
    let buffer: number[] = [];
    input.on('message', (_deltaTime: number, message: number[]) => {
        if (logRaw) {
            console.log(`[${now()}] RAW <- ${toHex(message)}`);
        }
        for (const byte of message) {
            if (byte === 0xf0) {
                buffer = [0xf0];
            } else if (byte === 0xf8 || byte === 0xfa || byte === 0xfb || byte === 0xfc || byte === 0xfe || byte === 0xff) {
                continue;
            } else if (buffer.length > 0) {
                buffer.push(byte);
                if (byte === 0xf7) {
                    onComplete(buffer);
                    buffer = [];
                }
            }
        }
    });
};

const VOLCA_HEADER = [0xf0, 0x42, 0x30, 0x00, 0x01, 0x2f];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// -----------------------------------------------------------------------
const cmdList = () => {
    const input = new midi.Input();
    const output = new midi.Output();
    console.log('MIDI Inputs:');
    for (let i = 0; i < input.getPortCount(); i++) console.log(`  [${i}] ${input.getPortName(i)}`);
    console.log('MIDI Outputs:');
    for (let i = 0; i < output.getPortCount(); i++) console.log(`  [${i}] ${output.getPortName(i)}`);
};

const cmdMonitor = async () => {
    const { input } = openPorts();
    attachSysexReassembly(input, data => {
        console.log(`[${now()}] SYSEX (complete, ${data.length} bytes) func=0x${data[6]?.toString(16)} ${toHex(data)}`);
    }, true);
    console.log(`Monitoring for ${monitorSec}s... (Ctrl+C to stop early)`);
    await sleep(monitorSec * 1000);
    process.exit(0);
};

const cmdProbe = async () => {
    const { input, output } = openPorts();
    const results: Record<string, boolean> = {};
    attachSysexReassembly(input, data => {
        console.log(`  <- RX func=0x${data[6]?.toString(16)} ${toHex(data)}`);
        results[String(data[6])] = true;
    });

    const requests: [string, number, number[]][] = [
        ['0x1E PROGRAM DATA DUMP REQUEST (1 PROGRAM, num=0)', 0x4e, [...VOLCA_HEADER, 0x1e, 0x00, 0xf7]],
        ['0x12 CURRENT PROGRAM DATA DUMP REQUEST', 0x42, [...VOLCA_HEADER, 0x12, 0xf7]],
        ['0x1C SEQUENCE DATA DUMP REQUEST (1 SEQUENCE, num=0)', 0x4c, [...VOLCA_HEADER, 0x1c, 0x00, 0xf7]],
        ['0x10 CURRENT SEQUENCE DATA DUMP REQUEST', 0x40, [...VOLCA_HEADER, 0x10, 0xf7]],
    ];

    for (const [label, , bytes] of requests) {
        console.log(`\n[${now()}] TX -> ${label}: ${toHex(bytes)}`);
        output.sendMessage(bytes);
        await sleep(2500);
    }

    console.log('\n--- Summary ---');
    for (const [label, expectedFunc] of requests) {
        console.log(`  ${results[String(expectedFunc)] ? 'OK (reply seen)' : 'NO REPLY'}  ${label}`);
    }
    process.exit(0);
};

const cmdInquiry = async () => {
    const { input, output } = openPorts();
    let replied = false;
    attachSysexReassembly(input, data => {
        console.log(`[${now()}] SYSEX <- ${toHex(data)}`);
        if (data[1] === 0x7e && data[3] === 0x06 && data[4] === 0x02) {
            replied = true;
            console.log('Device Inquiry Reply OK.');
        }
    }, true);
    const inquiry = [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7];
    console.log(`[${now()}] TX -> ${toHex(inquiry)}`);
    output.sendMessage(inquiry);
    await sleep(timeoutSec * 1000);
    if (!replied) console.error('No Device Inquiry Reply received (timeout).');
    process.exit(replied ? 0 : 1);
};

const cmdRead = async () => {
    const { input, output } = openPorts();
    let result: SequenceState | null = null;
    attachSysexReassembly(input, data => {
        console.log(`[${now()}] SYSEX <- func=0x${data[6]?.toString(16)} ${toHex(data)}`);
        const isSeqDump = VOLCA_HEADER.every((b, i) => data[i] === b) && data[6] === 0x40;
        if (isSeqDump) {
            const packed = data.slice(7, -1);
            const seqBytes = unpack7to8(packed, 1920);
            result = decodeSequenceData(seqBytes);
        }
    });
    const request = [...VOLCA_HEADER, 0x10, 0xf7];
    console.log(`[${now()}] TX -> CURRENT SEQUENCE DATA DUMP REQUEST: ${toHex(request)}`);
    output.sendMessage(request);

    const deadline = Date.now() + timeoutSec * 1000;
    while (!result && Date.now() < deadline) {
        await sleep(100);
    }

    if (!result) {
        console.error(`No sequence dump reply within ${timeoutSec}s (timeout).`);
        process.exit(1);
    }

    const r = result as SequenceState;
    console.log('--- Decoded SequenceState ---');
    console.log(`programNo: ${r.programNo}`);
    console.log(`velocity(representative): ${r.velocity}, gatePercent(representative): ${r.gatePercent}`);
    r.notes.forEach(n => {
        console.log(`  note pitch=${n.pitch} startStep=${n.startStep + 1} length=${n.length}${n.length > 1 ? ' (tied)' : ''}`);
    });
    r.motionEnabled.forEach((enabled, p) => {
        if (enabled) console.log(`  motion[${p}] enabled: values=[${r.motionValues[p].join(',')}]`);
    });
    process.exit(0);
};

const buildTestState = (): SequenceState => ({
    programNo: 5,
    velocity: 100,
    gatePercent: 80,
    notes: [
        // ステップをつなげた和音 (タイ): 0〜3
        { pitch: 60, startStep: 0, length: 4 },
        { pitch: 64, startStep: 0, length: 4 },
        { pitch: 67, startStep: 0, length: 4 },
        { pitch: 72, startStep: 4, length: 1 },
        { pitch: 65, startStep: 8, length: 2 },
    ],
    motionEnabled: Array.from({ length: MOTION_PARAM_COUNT }, (_, i) => i === 2),
    motionValues: Array.from({ length: MOTION_PARAM_COUNT }, (_, p) =>
        Array.from({ length: NUM_OF_STEPS }, (_, s) => (p === 2 ? (s * 8) % 128 : 64))
    ),
});

const cmdWrite = async () => {
    const { input, output } = openPorts();
    let status: number | null = null;
    attachSysexReassembly(input, data => {
        if (VOLCA_HEADER.every((b, i) => data[i] === b) && data[6] >= 0x23 && data[6] <= 0x26) {
            status = data[6];
        }
    });

    const state = buildTestState();
    const sysex = Array.from(encodeCurrentSequenceDump(state, 0));
    console.log(`[${now()}] TX -> CURRENT SEQUENCE DATA DUMP (${sysex.length} bytes): ${toHex(sysex)}`);
    output.sendMessage(sysex);

    const deadline = Date.now() + timeoutSec * 1000;
    while (status === null && Date.now() < deadline) await sleep(100);

    const STATUS_LABELS: Record<number, string> = {
        0x23: 'ACK: DATA LOAD COMPLETED',
        0x24: 'NAK: DATA LOAD ERROR',
        0x26: 'NAK: DATA FORMAT ERROR',
    };
    if (status === null) {
        console.error(`No ACK/NAK within ${timeoutSec}s (timeout).`);
        process.exit(1);
    }
    console.log(`RX <- 0x${(status as number).toString(16)} (${STATUS_LABELS[status] ?? 'unknown status'})`);
    process.exit(status === 0x23 ? 0 : 1);
};

const cmdRoundtrip = async () => {
    const { input, output } = openPorts();
    const sent = buildTestState();
    const expectedBytes = buildSequenceDataBytes(sent);

    let result: SequenceState | null = null;
    attachSysexReassembly(input, data => {
        const isSeqDump = VOLCA_HEADER.every((b, i) => data[i] === b) && data[6] === 0x40;
        if (isSeqDump) {
            const packed = data.slice(7, -1);
            const seqBytes = unpack7to8(packed, 1920);
            console.log(`[${now()}] RX sequence dump decoded (${seqBytes.length} bytes unpacked).`);
            result = decodeSequenceData(seqBytes);
        }
    });

    const writeSysex = Array.from(encodeCurrentSequenceDump(sent, 0));
    console.log(`[${now()}] TX -> WRITE (${writeSysex.length} bytes)`);
    output.sendMessage(writeSysex);
    await sleep(500); // 書き込み反映待ち

    const readRequest = [...VOLCA_HEADER, 0x10, 0xf7];
    console.log(`[${now()}] TX -> READ REQUEST`);
    output.sendMessage(readRequest);

    const deadline = Date.now() + timeoutSec * 1000;
    while (!result && Date.now() < deadline) {
        await sleep(100);
    }

    if (!result) {
        console.error(`No read-back within ${timeoutSec}s (timeout). Write path未確認 / Read path失敗。`);
        process.exit(1);
    }

    const r = result as SequenceState;
    let fail = 0;
    const check = (label: string, ok: boolean) => {
        console.log(`  ${ok ? 'OK' : 'NG'}  ${label}`);
        if (!ok) fail++;
    };

    check('programNo', r.programNo === sent.programNo);
    const sortNotes = (notes: SequenceNote[]) => [...notes].sort((x, y) => x.pitch - y.pitch || x.startStep - y.startStep);
    const sentNotes = sortNotes(sent.notes);
    const gotNotes = sortNotes(r.notes);
    check(
        `notes [${sentNotes.map(n => `${n.pitch}@${n.startStep}x${n.length}`).join(',')}] vs [${gotNotes.map(n => `${n.pitch}@${n.startStep}x${n.length}`).join(',')}]`,
        sentNotes.length === gotNotes.length &&
        sentNotes.every((n, k) => n.pitch === gotNotes[k].pitch && n.startStep === gotNotes[k].startStep && n.length === gotNotes[k].length)
    );
    sent.motionEnabled.forEach((en, p) => {
        check(`motion[${p}] enabled`, r.motionEnabled[p] === en);
        if (en) {
            check(`motion[${p}] values`, sent.motionValues[p].every((v, s) => v === r.motionValues[p][s]));
        }
    });

    console.log(fail === 0 ? '\nROUNDTRIP OK: 書き込んだ内容が正しく読み戻せました。' : `\nROUNDTRIP FAILED: ${fail}件不一致`);
    process.exit(fail === 0 ? 0 : 1);
};

// -----------------------------------------------------------------------
(async () => {
    switch (command) {
        case 'list': return cmdList();
        case 'monitor': return await cmdMonitor();
        case 'inquiry': return await cmdInquiry();
        case 'probe': return await cmdProbe();
        case 'read': return await cmdRead();
        case 'write': return await cmdWrite();
        case 'roundtrip': return await cmdRoundtrip();
        default:
            console.log('Usage: npx tsx scripts/midi-sequence-tool.ts <list|monitor|inquiry|probe|read|write|roundtrip> [--port <name>] [--timeout <sec>] [--seconds <sec>]');
            process.exit(1);
    }
})();
