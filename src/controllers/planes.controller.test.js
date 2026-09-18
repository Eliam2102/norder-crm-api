import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getMenuPersistenceData,
    resolveBioEnergiaForPdf,
    resolveMasaMagraForPdf
} from './planes.controller.js';

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

test('conserva la energía explícita de bioimpedancia sobre el barrido', () => {
    assert.equal(resolveBioEnergiaForPdf(1425, 1150), 1425);
});

test('usa las kcal del barrido cuando la energía de la valoración está vacía', () => {
    assert.equal(resolveBioEnergiaForPdf(null, 1150), 1150);
});

test('mantiene vacía la energía cuando no existe en valoración ni barrido', () => {
    assert.equal(resolveBioEnergiaForPdf(null, null), null);
});

test('conserva la masa magra explícita sobre el cálculo de dos componentes', () => {
    assert.equal(resolveMasaMagraForPdf(52.88, 52.8825), 52.88);
});

test('usa kg de masa magra de dos componentes para valoraciones históricas', () => {
    assert.equal(resolveMasaMagraForPdf(null, 53.702), 53.702);
});

test('mantiene vacía la masa magra cuando ninguna fuente tiene datos', () => {
    assert.equal(resolveMasaMagraForPdf(null, null), null);
});
