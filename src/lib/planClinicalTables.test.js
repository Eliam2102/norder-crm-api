import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBioquimicaTable, buildDinamicaDeportivaTable } from './planClinicalTables.js';

test('arma la tabla bioquímica con resultados antiguos y filas nuevas', () => {
    assert.deepEqual(buildBioquimicaTable({
        glucosa: 0,
        bioquimicosOtrosDetalle: [{ nombre: 'Vitamina D', valor: '35 ng/mL' }],
    }), [
        { nombre: 'Glucosa', valor: '0 mg/dL' },
        { nombre: 'Vitamina D', valor: '35 ng/mL' },
    ]);
});

test('la pausa general suspende todas las disciplinas sin borrar la pausa individual', () => {
    assert.deepEqual(buildDinamicaDeportivaTable({
        dinamicaDeportiva: {
            activo: false,
            disciplinas: [
                { disciplina: 'Pesas', frecuencia: '3 días', tiempo: '60 min', activo: true },
                { disciplina: 'Correr', frecuencia: '2 días', tiempo: '30 min', activo: false },
            ],
        },
    }), {
        activo: false,
        rows: [
            { disciplina: 'Pesas', frecuencia: '3 días', duracion: '60 min', activo: false },
            { disciplina: 'Correr', frecuencia: '2 días', duracion: '30 min', activo: false },
        ],
    });
});
