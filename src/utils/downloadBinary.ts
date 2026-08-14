const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const downloadBinary = (bytes: Uint8Array, filename: string) => {
    downloadBlob(new Blob([bytes], { type: 'application/octet-stream' }), filename);
};

export const downloadText = (text: string, filename: string, mimeType = 'application/json') => {
    downloadBlob(new Blob([text], { type: mimeType }), filename);
};
