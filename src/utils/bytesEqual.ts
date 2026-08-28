export const bytesEqual = (left: Uint8Array, right: Uint8Array) => {
    if (left.length !== right.length) return false
    for (let byteIndex = 0; byteIndex < left.length; byteIndex++) {
        if (left[byteIndex] !== right[byteIndex]) return false
    }
    return true
}
