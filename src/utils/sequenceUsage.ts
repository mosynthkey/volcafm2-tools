export const formatSequenceUsagePill = (displaySlots: number[]): string => {
    if (displaySlots.length === 0) return '';
    const parts: string[] = [];
    let runStart = displaySlots[0];
    let runEnd = displaySlots[0];
    for (const sequenceNo of displaySlots.slice(1)) {
        if (sequenceNo === runEnd + 1) {
            runEnd = sequenceNo;
            continue;
        }
        parts.push(runStart === runEnd ? String(runStart) : `${runStart}–${runEnd}`);
        runStart = runEnd = sequenceNo;
    }
    parts.push(runStart === runEnd ? String(runStart) : `${runStart}–${runEnd}`);
    return `(Seq ${parts.join(', ')})`;
};

export const formatSequenceUsageList = (displaySlots: number[]): string =>
    displaySlots.map(sequenceNo => `Seq ${sequenceNo}`).join(', ');
