import test from 'node:test';
import assert from 'node:assert/strict';
import { mapBioimpedancia, optionalNumber } from './bioimpedancia.js';

test('mapea los cuatro resultados actuales de bioimpedancia', () => {
    assert.deepEqual(mapBioimpedancia({
        'Grasa %': '24.3',
        'Agua %': 52.1,
        'Músculo (kg)': '31.8',
        'Energía (kcal)': '1450',
    }), {
        bioGrasa: 24.3,
        bioAgua: 52.1,
        bioMusculo: 31.8,
        bioEnergia: 1450,
    });
});

test('conserva compatibilidad, ceros y limpieza explícita', () => {
    assert.equal(mapBioimpedancia({ 'Músculo %': '30' }).bioMusculo, 30);
    assert.equal(mapBioimpedancia({ 'Grasa %': null }).bioGrasa, null);
    assert.equal(optionalNumber(0), 0);
    assert.equal(optionalNumber(null), null);
    assert.equal(optionalNumber('dato inválido'), undefined);
});
