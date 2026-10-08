import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../lib/prisma.js';
import { getAll } from './pacientes.controller.js';
import { buildPacienteSearchFilter } from '../lib/pacienteSearch.js';

test('el listado aplica nombre completo junto con membresía y conserva el formato de respuesta', async (t) => {
    const paciente = { id: 'paciente-prueba', nombre: 'Roxana', apellido: 'Alpuche', valoraciones: [], planes: [] };
    let receivedQuery;
    const original = prisma.paciente.findMany;
    t.after(() => { prisma.paciente.findMany = original; });
    prisma.paciente.findMany = async query => {
        receivedQuery = query;
        return [paciente];
    };
    let response;
    const res = { status() { return this; }, json(body) { response = body; } };
    await getAll({ query: { buscar: 'Roxana Alpuche', membresia: 'premium' } }, res, err => { throw err; });
    assert.deepEqual(receivedQuery.where, { ...buildPacienteSearchFilter('Roxana Alpuche'), nivelMembresia: 'premium' });
    assert.equal(response.success, true);
    assert.equal(response.data[0].id, paciente.id);
    assert.equal(response.data[0].ultimaValoracion, null);
});
