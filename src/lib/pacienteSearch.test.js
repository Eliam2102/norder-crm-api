import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPacienteSearchFilter } from './pacienteSearch.js';

const termFilter = term => ({ OR: [
    { nombre: { contains: term, mode: 'insensitive' } },
    { apellido: { contains: term, mode: 'insensitive' } },
] });

for (const query of ['Roxana', 'Alpuche', 'Roxana Alpuche', 'Alpuche Roxana', 'María del Carmen Pérez López', 'Rox Alpu']) {
    test(`busca todas las palabras entre nombre y apellido: ${query}`, () => {
        assert.deepEqual(buildPacienteSearchFilter(query), {
            OR: [{ AND: query.split(' ').map(termFilter) }, { telefono: { contains: query } }],
        });
    });
}

test('normaliza espacios repetidos y conserva búsqueda por teléfono', () => {
    assert.deepEqual(buildPacienteSearchFilter('  Roxana   Alpuche\t ').OR[0], buildPacienteSearchFilter('Roxana Alpuche').OR[0]);
    assert.deepEqual(buildPacienteSearchFilter('9991234567').OR[1], { telefono: { contains: '9991234567' } });
});

test('una búsqueda vacía no filtra pacientes ni procesa valores que no son texto', () => {
    for (const value of ['', ' \t ', undefined, null, ['Roxana']]) {
        assert.deepEqual(buildPacienteSearchFilter(value), {});
    }
});
