import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregatePdfMealEquivalences } from './pdfEquivalencias.js';

test('renders every multigroup equivalence as its own PDF row', () => {
    const result = aggregatePdfMealEquivalences([{
        descripcion: 'Prueba multigrupo',
        equivalencias: [
            { cantidad: 1, grupo: 'Cereal c/grasa' },
            { cantidad: 0.5, grupo: 'Leguminosas' },
            { cantidad: 2, grupo: 'C y T sin grasa' },
        ],
    }]);

    assert.deepEqual(result.lines, [
        { amount: 1, group: 'Cereal c/grasa' },
        { amount: 0.5, group: 'Leguminosas' },
        { amount: 2, group: 'C y T sin grasa' },
    ]);
});

test('sums repeated canonical groups across different foods', () => {
    const result = aggregatePdfMealEquivalences([
        { equivalencias: [{ cantidad: 0.5, grupo: 'Leguminosas' }] },
        { eqCantidad: 0.5, eqGrupo: 'leguminosas' },
        { equivalencias: [{ cantidad: 1, grupo: 'C y T sin grasa' }] },
        { equivalencias: [{ cantidad: 1, grupo: 'Cereal s/grasa' }] },
    ]);

    assert.deepEqual(result.lines, [
        { amount: 1, group: 'Leguminosas' },
        { amount: 2, group: 'C y T sin grasa' },
    ]);
});

test('keeps free ingredients outside the numeric equivalence rows', () => {
    const free = { descripcion: 'Vegetales al gusto', equivalencias: [{ cantidad: 1, grupo: 'Libre' }] };
    const result = aggregatePdfMealEquivalences([free]);

    assert.deepEqual(result.lines, []);
    assert.deepEqual(result.freeIngredients, [free]);
});
