import test from 'node:test';
import assert from 'node:assert/strict';
import {
    attachLegacyBarridoToEmptyMenus,
    materializeMenuEquivalences
} from './menuEquivalencias.js';

test('materializa equivalencias por tiempo sin tocar el menú normal', () => {
    const plan = {
        menus: [
            {
                tipoContenido: 'equivalencias',
                barridoEquivalencias: {
                    tiempos: [{ id: 'des', nombre: 'Desayuno' }],
                    porciones: { frutas: 2 },
                    distribucion: { des: { frutas: 1.5, cerealSinGr: '2' } }
                },
                tiemposComida: [{ nombre: 'Desayuno', barridoTiempoId: 'des', ingredientes: [{ descripcion: 'Platillo guardado' }] }]
            },
            {
                tipoContenido: 'platillos',
                tiemposComida: [{ nombre: 'Cena', ingredientes: [{ descripcion: 'Cena normal' }] }]
            }
        ]
    };

    materializeMenuEquivalences(plan);

    assert.deepEqual(plan.menus[0].tiemposComida[0].ingredientes.map(i => i.equivalencias[0]), [
        { grupo: 'Frutas', cantidad: 1.5 },
        { grupo: 'C y T sin grasa', cantidad: 2 }
    ]);
    assert.equal(plan.menus[1].tiemposComida[0].ingredientes[0].descripcion, 'Cena normal');
});

test('muestra las porciones totales cuando todavía no hay distribución por tiempo', () => {
    const plan = {
        menus: [{
            tipoContenido: 'equivalencias',
            barridoEquivalencias: {
                tiempos: [{ id: 'des', nombre: 'Desayuno' }],
                porciones: { frutas: '3', verduras: 0 },
                distribucion: {}
            },
            tiemposComida: []
        }]
    };

    materializeMenuEquivalences(plan);

    assert.equal(plan.menus[0].tiemposComida[0].nombre, 'Porciones del día');
    assert.deepEqual(plan.menus[0].tiemposComida[0].ingredientes[0].equivalencias[0], {
        grupo: 'Frutas',
        cantidad: 3
    });
});

test('recupera el barrido de la valoración para un menú histórico vacío', () => {
    const plan = {
        menus: [{
            tipoContenido: 'platillos',
            barridoEquivalencias: null,
            tiemposComida: [{ nombre: 'Desayuno', ingredientes: [] }]
        }]
    };
    const barridoHistorico = {
        tiempos: JSON.stringify([{ id: 'des', nombre: 'Desayuno' }]),
        porciones: JSON.stringify({ frutas: 2 }),
        distribucion: JSON.stringify({ des: { frutas: 2 } }),
        kcalTotal: 120
    };

    attachLegacyBarridoToEmptyMenus(plan, barridoHistorico);
    materializeMenuEquivalences(plan);

    assert.equal(plan.menus[0].tipoContenido, 'equivalencias');
    assert.deepEqual(plan.menus[0].tiemposComida[0].ingredientes[0].equivalencias[0], {
        grupo: 'Frutas',
        cantidad: 2
    });
});

test('no reemplaza los platillos de un menú histórico que sí tiene ingredientes', () => {
    const plan = {
        menus: [{
            tipoContenido: 'platillos',
            barridoEquivalencias: null,
            tiemposComida: [{ nombre: 'Desayuno', ingredientes: [{ descripcion: 'Huevos' }] }]
        }]
    };

    attachLegacyBarridoToEmptyMenus(plan, {
        tiempos: [{ id: 'des', nombre: 'Desayuno' }],
        porciones: { frutas: 2 },
        distribucion: { des: { frutas: 2 } }
    });

    assert.equal(plan.menus[0].tipoContenido, 'platillos');
    assert.equal(plan.menus[0].tiemposComida[0].ingredientes[0].descripcion, 'Huevos');
});

test('el PDF materializa un barrido distinto para cada menú', () => {
    const plan = {
        menus: [
            {
                tipoContenido: 'equivalencias',
                barridoEquivalencias: {
                    id: 'principal',
                    tiempos: [{ id: 'des', nombre: 'Desayuno' }],
                    porciones: { frutas: 2 },
                    distribucion: { des: { frutas: 2 } }
                },
                tiemposComida: [{ nombre: 'Desayuno', ingredientes: [] }]
            },
            {
                tipoContenido: 'equivalencias',
                barridoEquivalencias: {
                    id: 'segundo',
                    tiempos: [{ id: 'des', nombre: 'Desayuno' }],
                    porciones: { cerealSinGr: 4 },
                    distribucion: { des: { cerealSinGr: 4 } }
                },
                tiemposComida: [{ nombre: 'Desayuno', ingredientes: [] }]
            }
        ]
    };

    materializeMenuEquivalences(plan);

    assert.deepEqual(plan.menus[0].tiemposComida[0].ingredientes[0].equivalencias[0], {
        grupo: 'Frutas',
        cantidad: 2
    });
    assert.deepEqual(plan.menus[1].tiemposComida[0].ingredientes[0].equivalencias[0], {
        grupo: 'C y T sin grasa',
        cantidad: 4
    });
});
