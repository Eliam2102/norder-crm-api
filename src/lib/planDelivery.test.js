import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDeliveryChannels, normalizeOrchestratorChannelStatus } from './planDelivery.js';

test('activa correo y WhatsApp por defecto para clientes anteriores', () => {
    assert.deepEqual(normalizeDeliveryChannels({}), { email: true, whatsapp: true });
});

test('respeta la selección individual de canales', () => {
    assert.deepEqual(
        normalizeDeliveryChannels({ canales: { email: false, whatsapp: true } }),
        { email: false, whatsapp: true },
    );
});

test('usa el estado individual informado por el orquestador', () => {
    assert.equal(normalizeOrchestratorChannelStatus({ email: 'error' }, 'email', 'ok'), 'error');
    assert.equal(normalizeOrchestratorChannelStatus({}, 'whatsapp', 'ok'), 'ok');
});
