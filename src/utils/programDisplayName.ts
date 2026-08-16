export const programDisplayName = (
    slot: number,
    matchedProgramNo: number | null,
    editorName: string,
    storedName = '',
) => (matchedProgramNo === slot ? editorName : storedName).trim();
