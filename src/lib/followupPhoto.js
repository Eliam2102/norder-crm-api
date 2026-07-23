export const FOLLOWUP_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const parseFollowupPhotoDataUrl = (dataUrl) => {
    if (typeof dataUrl !== 'string') return null;
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return null;
    return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
};

export const hasValidImageSignature = (buffer, mimeType) => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
    if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
    return false;
};
