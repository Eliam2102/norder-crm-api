import test from 'node:test';
import assert from 'node:assert/strict';
import { getMenuPersistenceData } from './planes.controller.js';

test('guarda el barrido seleccionado y el modo de cada menú', () => {
    const selected = {
        id: 'segundo',
        nombre: 'Barrido 2',
        tiempos: [{ id: 'des', nombre: 'Desayuno' }],
        porciones: { cerealSinGr: 4 },
        distribucion: { des: { cerealSinGr: 4 } },
        kcalTotal: 280
    };
    const result = getMenuPersistenceData({
        tipoContenido: 'equivalencias',
        barridoEquivalencias: selected
    });
    assert.equal(result.tipoContenido, 'equivalencias');
    assert.deepEqual(result.barridoEquivalencias, selected);
});

test('mantiene platillos como comportamiento predeterminado', () => {
    assert.deepEqual(getMenuPersistenceData({}), {
        tipoContenido: 'platillos',
        barridoEquivalencias: null
    });
});
