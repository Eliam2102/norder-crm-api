import test from 'node:test';
import assert from 'node:assert/strict';
import {
    formatMexicoCityDateTime,
    getMexicoCityDateTimeParts,
    mexicoCityDateTimeToUtc,
    normalizeBookingStart
} from './timeZone.js';

test('convierte las 9:30 de Ciudad de México a las 15:30 UTC', () => {
    const result = mexicoCityDateTimeToUtc('2026-09-14', '09:30');
    assert.equal(result?.toISOString(), '2026-09-14T15:30:00.000Z');
});

test('muestra el instante UTC de Regina como 09:30 en Ciudad de México', () => {
    const parts = getMexicoCityDateTimeParts('2026-09-14T15:30:00.000Z');
    assert.deepEqual(parts, { date: '2026-09-14', time: '09:30' });
    assert.match(formatMexicoCityDateTime('2026-09-14T15:30:00.000Z'), /9:30/);
});

test('conserva los instantes UTC recibidos desde Cal.com', () => {
    assert.equal(
        normalizeBookingStart('2026-09-14T15:30:00.000Z')?.toISOString(),
        '2026-09-14T15:30:00.000Z'
    );
});

test('interpreta clientes antiguos sin offset como hora de México', () => {
    assert.equal(
        normalizeBookingStart('2026-09-14T09:30:00')?.toISOString(),
        '2026-09-14T15:30:00.000Z'
    );
});
