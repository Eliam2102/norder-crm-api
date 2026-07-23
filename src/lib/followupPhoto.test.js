import test from 'node:test';
import assert from 'node:assert/strict';
import { hasValidImageSignature, parseFollowupPhotoDataUrl } from './followupPhoto.js';

test('acepta un data URL JPEG permitido y valida su firma', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const parsed = parseFollowupPhotoDataUrl(`data:image/jpeg;base64,${jpeg.toString('base64')}`);
    assert.equal(parsed?.mimeType, 'image/jpeg');
    assert.equal(hasValidImageSignature(parsed.buffer, parsed.mimeType), true);
});

test('rechaza extensiones disfrazadas y firmas incorrectas', () => {
    assert.equal(parseFollowupPhotoDataUrl('data:image/gif;base64,R0lGODlh'), null);
    const fakePng = Buffer.from('not-a-real-png');
    assert.equal(hasValidImageSignature(fakePng, 'image/png'), false);
});
