import test from 'node:test';
import assert from 'node:assert/strict';
import { recordChatOutcome, getChatHealth, __resetChatHealthForTests } from './chatHealth.js';

test('reporta healthy sin muestras', () => {
    __resetChatHealthForTests();
    assert.deepEqual(getChatHealth(), { healthy: true, failureRate: 0, sampleSize: 0 });
});

test('reporta healthy con pocas muestras aunque todas fallen', () => {
    __resetChatHealthForTests();
    recordChatOutcome(false);
    recordChatOutcome(false);
    const health = getChatHealth();
    assert.equal(health.healthy, true);
    assert.equal(health.sampleSize, 2);
});

test('reporta unhealthy cuando la tasa de fallo supera el 50% con muestra suficiente', () => {
    __resetChatHealthForTests();
    recordChatOutcome(false);
    recordChatOutcome(false);
    recordChatOutcome(false);
    recordChatOutcome(true);
    const health = getChatHealth();
    assert.equal(health.healthy, false);
    assert.equal(health.sampleSize, 4);
    assert.equal(health.failureRate, 0.75);
});

test('mantiene healthy cuando la mayoría de intentos recientes tienen éxito', () => {
    __resetChatHealthForTests();
    for (let i = 0; i < 8; i += 1) recordChatOutcome(true);
    recordChatOutcome(false);
    const health = getChatHealth();
    assert.equal(health.healthy, true);
});

test('solo conserva la ventana de las últimas 20 muestras', () => {
    __resetChatHealthForTests();
    for (let i = 0; i < 15; i += 1) recordChatOutcome(true);
    for (let i = 0; i < 10; i += 1) recordChatOutcome(false);
    const health = getChatHealth();
    assert.equal(health.sampleSize, 20);
});
