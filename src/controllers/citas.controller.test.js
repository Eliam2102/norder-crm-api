import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCalcomSlots } from './citas.controller.js';

test('normaliza slots de Cal.com a instantes UTC para el frontend', () => {
    const result = normalizeCalcomSlots({
        '2026-09-14': [
            { start: '2026-09-14T09:30:00.000-06:00' },
            { start: '2026-09-14T10:00:00.000-06:00' }
        ]
    });

    assert.deepEqual(result, {
        '2026-09-14': [
            { time: '2026-09-14T15:30:00.000Z' },
            { time: '2026-09-14T16:00:00.000Z' }
        ]
    });
});
