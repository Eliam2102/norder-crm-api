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
    assert.ok(receivedQuery.include);
});

test('el resumen consulta solo datos del listado y conserva estados, fechas y citas', async (t) => {
    const fecha = new Date('2026-10-29T00:00:00Z');
    const valoraciones = [
        { id: 'sin-plan', barrido: null },
        { id: 'con-barrido', barrido: { id: 'b1', kcalTotal: 2000, porciones: '{}' } },
        { id: 'con-porciones', barrido: { id: 'b2', kcalTotal: 0, porciones: '{"verduras":2}' } },
        { id: 'barrido-invalido', barrido: { id: 'b3', kcalTotal: 0, porciones: 'invalido' } },
        { id: 'listo', barrido: null },
        { id: 'enviado', barrido: null },
    ].map((v, i) => ({ ...v, fecha, numeroValoracion: i + 1, updatedAt: fecha,
        citas: i === 4 ? [{ id: 'cita', fecha }] : [],
        adjuntosJson: [{ dataUrl: 'data:image/png;base64,adjunto' }], notasLibres: 'nota clínica' }));
    const planes = ['listo', 'enviado'].map((id, i) => ({ id: `plan-${id}`, valoracionId: id,
        estadoEnvio: i ? 'enviado' : 'pendiente', fechaCreacion: fecha, updatedAt: fecha,
        proximaSesion: fecha, pdfCustomMeta: { texto: 'PDF' } }));
    const paciente = { id: 'paciente', nombre: 'Prueba', apellido: null, telefono: '0000000000', valoraciones, planes };
    const project = (record, select) => Object.fromEntries(Object.entries(select).map(([key, rule]) => [key,
        rule === true ? record[key] : Array.isArray(record[key])
            ? record[key].map(row => project(row, rule.select))
            : record[key] == null ? null : project(record[key], rule.select)]));
    const original = prisma.paciente.findMany;
    t.after(() => { prisma.paciente.findMany = original; });
    let summaryQuery;
    prisma.paciente.findMany = async query => {
        if (query.select) {
            summaryQuery = query;
            return [project(paciente, query.select)];
        }
        return [paciente];
    };
    const load = async query => {
        let response;
        await getAll({ query }, { status() { return this; }, json(body) { response = body.data; } }, err => { throw err; });
        return response[0];
    };
    const full = await load({});
    const summary = await load({ resumen: 'true', buscar: 'Prueba', membresia: 'premium' });
    assert.deepEqual(summaryQuery.where, { ...buildPacienteSearchFilter('Prueba'), nivelMembresia: 'premium' });
    assert.deepEqual(summaryQuery.select.valoraciones.where, { deletedAt: null });
    assert.deepEqual(summaryQuery.select.valoraciones.orderBy, [{ fecha: 'desc' }, { numeroValoracion: 'desc' }]);
    assert.deepEqual(Object.keys(summaryQuery.select.valoraciones.select).sort(), ['id', 'fecha', 'numeroValoracion', 'updatedAt', 'barrido', 'citas'].sort());
    assert.deepEqual(Object.keys(summaryQuery.select.planes.select).sort(), ['id', 'valoracionId', 'estadoEnvio', 'fechaCreacion', 'updatedAt', 'proximaSesion'].sort());
    const operational = v => [v.id, v.fecha, v.numeroValoracion, v.updatedAt, v.hasBarrido,
        v.estadoFlujo, v.planId, v.estadoEnvio, v.tieneCita, v.proximaCita];
    assert.deepEqual(summary.valoraciones.map(operational), full.valoraciones.map(operational));
    assert.deepEqual(summary.valoraciones.map(v => v.estadoFlujo), [
        'Pendiente de plan', 'Plan en Proceso', 'Plan en Proceso', 'Pendiente de plan', 'Listo para enviar', 'Enviado'
    ]);
    assert.equal(summary.valoraciones[4].tieneCita, true);
    assert.equal(summary.valoraciones[4].proximaCita, fecha);
    assert.equal(summary.ultimaValoracion, summary.valoraciones[0]);
    assert.equal(summary.ultimoPlan.proximaSesion, fecha);
    assert.ok(full.valoraciones[0].adjuntosJson);
    assert.ok(full.planes[0].pdfCustomMeta);
    for (const v of summary.valoraciones) {
        for (const field of ['adjuntosJson', 'notasLibres', 'barrido', 'citas']) assert.equal(field in v, false);
    }
    assert.equal('pdfCustomMeta' in summary.planes[0], false);
});

test('el resumen propaga errores sin devolver una lista vacía', async (t) => {
    const original = prisma.paciente.findMany;
    t.after(() => { prisma.paciente.findMany = original; });
    const failure = new Error('fallo de prueba');
    prisma.paciente.findMany = async () => { throw failure; };
    let received;
    await getAll({ query: { resumen: 'true' } }, {}, err => { received = err; });
    assert.equal(received, failure);
});
