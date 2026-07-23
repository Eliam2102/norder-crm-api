import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildBarridoPersistenceData,
    serializeBarrido
} from './barrido.controller.js';

test('serializa el barrido histórico como una sola variante', () => {
    const result = serializeBarrido({
        id: 'db-id',
        tiempos: JSON.stringify([{ id: 'des', nombre: 'Desayuno' }]),
        porciones: JSON.stringify({ frutas: 2 }),
        distribucion: JSON.stringify({ des: { frutas: 2 } }),
        kcalTotal: 120
    });
    assert.equal(result.variantes.length, 1);
    assert.equal(result.variantes[0].id, 'principal');
});

test('recupera dos variantes independientes desde el almacenamiento compatible', () => {
    const result = serializeBarrido({
        id: 'db-id',
        tiempos: JSON.stringify([{ id: 'des', nombre: 'Desayuno' }]),
        porciones: JSON.stringify({ frutas: 2 }),
        distribucion: JSON.stringify({
            des: { frutas: 2 },
            _variantes: [{
                id: 'segundo',
                nombre: 'Barrido 2',
                tiempos: [{ id: 'des', nombre: 'Desayuno' }],
                porciones: { cerealSinGr: 4 },
                distribucion: { des: { cerealSinGr: 4 } },
                kcalTotal: 280
            }]
        }),
        kcalTotal: 120
    });
    assert.deepEqual(result.variantes.map(item => item.id), ['principal', 'segundo']);
    assert.equal(result.variantes[1].distribucion.des.cerealSinGr, 4);
    assert.equal(result.variantes[1].kcalTotal, 280);
});

test('el payload de dos barridos sobrevive el ciclo guardar y volver a leer', () => {
    const payload = {
        tiempos: [{ id: 'des', nombre: 'Desayuno' }],
        porciones: { frutas: 2 },
        distribucion: { des: { frutas: 2 } },
        kcalTotal: 120,
        variantes: [
            {
                id: 'principal',
                nombre: 'Barrido 1',
                tiempos: [{ id: 'des', nombre: 'Desayuno' }],
                porciones: { frutas: 2 },
                distribucion: { des: { frutas: 2 } },
                kcalTotal: 120
            },
            {
                id: 'segundo',
                nombre: 'Barrido 2',
                tiempos: [{ id: 'des', nombre: 'Desayuno' }],
                porciones: { cerealSinGr: 4 },
                distribucion: { des: { cerealSinGr: 4 } },
                kcalTotal: 280
            }
        ]
    };
    const stored = buildBarridoPersistenceData(payload);
    const response = serializeBarrido({
        id: 'db-id',
        tiempos: JSON.stringify(stored.normalized.tiempos),
        porciones: JSON.stringify(stored.primaryPorciones),
        distribucion: JSON.stringify({
            ...stored.normalized.distribucion,
            _kcalManuales: stored.normalized.kcalManuales,
            _porcentajesManuales: stored.normalized.porcentajesManuales,
            _variantes: stored.extraVariants
        }),
        kcalTotal: stored.primaryKcal
    });

    assert.equal(response.variantes.length, 2);
    assert.equal(response.variantes[0].distribucion.des.frutas, 2);
    assert.equal(response.variantes[1].distribucion.des.cerealSinGr, 4);
    assert.equal(response.variantes[1].kcalTotal, 280);
});
