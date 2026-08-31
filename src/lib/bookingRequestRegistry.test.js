import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildBookingRequestKey,
    createBookingRequestRegistry
} from './bookingRequestRegistry.js';

test('genera la misma llave para solicitudes equivalentes', () => {
    const input = {
        pacienteId: 'paciente-1',
        valoracionId: 'valoracion-1',
        fecha: '2026-10-19T17:30:00.000Z',
        eventTypeId: 4657665
    };

    assert.equal(buildBookingRequestKey(input), buildBookingRequestKey({ ...input }));
});

test('comparte una sola operación entre solicitudes concurrentes idénticas', async () => {
    const registry = createBookingRequestRegistry({ successTtlMs: 20 });
    let calls = 0;
    let release;
    const wait = new Promise((resolve) => { release = resolve; });
    const operation = async () => {
        calls += 1;
        await wait;
        return { bookingId: 'booking-1' };
    };

    const first = registry.run('same-booking', operation);
    const second = registry.run('same-booking', operation);
    release();

    assert.deepEqual(await first, { bookingId: 'booking-1' });
    assert.deepEqual(await second, { bookingId: 'booking-1' });
    assert.equal(calls, 1);
});

test('reutiliza temporalmente el resultado exitoso de una solicitud completada', async () => {
    const registry = createBookingRequestRegistry({ successTtlMs: 1_000 });
    let calls = 0;
    const operation = async () => {
        calls += 1;
        return { bookingId: 'booking-cached' };
    };

    const first = await registry.run('cached-booking', operation);
    const second = await registry.run('cached-booking', operation);

    assert.deepEqual(first, { bookingId: 'booking-cached' });
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
});

test('permite reintentar después de un fallo real', async () => {
    const registry = createBookingRequestRegistry();
    let calls = 0;

    await assert.rejects(
        registry.run('failed-booking', async () => {
            calls += 1;
            throw new Error('Cal.com no respondió');
        }),
        /Cal\.com no respondió/
    );

    const result = await registry.run('failed-booking', async () => {
        calls += 1;
        return { bookingId: 'booking-2' };
    });

    assert.deepEqual(result, { bookingId: 'booking-2' });
    assert.equal(calls, 2);
});
