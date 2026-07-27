import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import ejs from 'ejs';

const renderHistory = (valoraciones, consultaEnLinea = false, metodoComposicion) => {
    const paciente = { nombre: 'Paciente', apellido: 'Prueba' };
    const plan = {
        paciente,
        consultaEnLinea,
        metodoComposicion,
        menus: [],
        evitarReciente: [],
        lineamientosRecientes: [],
        notasGenerales: '',
        notasClinicasRecientes: '',
        notasLibresRecientes: '',
        temarioReciente: [],
        pdfCustomMeta: {
            showPageHistorial: true,
            showPageMenus: false,
            showPageIntercambio: false,
            showPageExtras: false,
            showAlimentosEvitar: false,
        },
    };

    return ejs.renderFile(path.resolve('src/templates/plan.ejs'), {
        plan,
        paciente,
        config: {},
        valoraciones,
        tiposCuerpoImg: null,
        logoMenuImg: null,
    });
};

test('muestra una fotografía principal en la columna de su consulta', async () => {
    const html = await renderHistory([{
        id: 'valoracion-1',
        fecha: new Date('2026-07-27T12:00:00Z'),
        fotoPrincipal: 'data:image/png;base64,AAAA',
        objetivo: 'Salud',
        pesoActual: 68.5,
        estatura: 170,
        pctGrasaCorp: 24.3,
        masaGrasaReal: 16.6,
        masaMagra: 51.9,
        bioGrasa: 24.3,
        bioAgua: 52.1,
        bioMusculo: 31.8,
        bioEnergia: 1450,
        somatotipo: '2-4-3',
        energia: 1800,
    }], true);

    assert.match(html, /Foto principal/);
    assert.match(html, /data:image\/png;base64,AAAA/);
    assert.match(html, /Peso/);
    assert.match(html, /68.5/);
    assert.doesNotMatch(html, /Talla \(cm\)/);
    assert.doesNotMatch(html, /Resultados Antropométricos/);
    assert.doesNotMatch(html, /Resultados de Bioimpedancia/);
    assert.doesNotMatch(html, /Somatotipo/);
    assert.doesNotMatch(html, /Energía\(kcal\)/);
    assert.doesNotMatch(html, /Brazo relajado|Brazo contraído|Cintura|Cadera/);
    assert.doesNotMatch(html, /class="online-photo-gallery"/);
});

test('no incluye fotografías en el historial presencial', async () => {
    const html = await renderHistory([{
        id: 'valoracion-1',
        fecha: new Date('2026-07-27T12:00:00Z'),
        fotoPrincipal: 'data:image/png;base64,AAAA',
        pesoActual: 68.5,
    }], false, 'ANTROPOMETRIA');

    assert.doesNotMatch(html, /Foto principal/);
    assert.doesNotMatch(html, /data:image\/png;base64,AAAA/);
});

test('incluye las cuatro filas de bioimpedancia sólo cuando existen resultados', async () => {
    const html = await renderHistory([{
        id: 'valoracion-1',
        fecha: new Date('2026-07-27T12:00:00Z'),
        metodoComposicion: 'BIOIMPEDANCIA',
        bioGrasa: 24.3,
        bioAgua: 52.1,
        bioMusculo: 31.8,
        bioEnergia: 1450,
        energia: 1450,
        somatotipo: 'Mesomorfo',
    }], false, 'BIOIMPEDANCIA');

    assert.match(html, /Resultados de Bioimpedancia/);
    assert.match(html, /Grasa \(%\)/);
    assert.match(html, /Agua \(%\)/);
    assert.match(html, /Músculo \(kg\)/);
    assert.match(html, /Energía bio \(kcal\)/);
    assert.doesNotMatch(html, /Resultados Antropométricos/);
    assert.doesNotMatch(html, /Somatotipo/);
    assert.doesNotMatch(html, /Energía\(kcal\)/);
    assert.doesNotMatch(html, /Mesomorfo/);
});

test('conserva somatotipo y energía del plan en antropometría', async () => {
    const html = await renderHistory([{
        id: 'valoracion-1',
        fecha: new Date('2026-07-27T12:00:00Z'),
        pctGrasaCorp: 24.3,
        masaGrasaReal: 16.6,
        masaMagra: 51.9,
        energia: 1800,
        somatotipo: 'Mesomorfo',
    }], false, 'ANTROPOMETRIA');

    assert.match(html, /Resultados Antropométricos/);
    assert.match(html, /Somatotipo/);
    assert.match(html, /Energía\(kcal\)/);
    assert.match(html, /Mesomorfo/);
    assert.doesNotMatch(html, /Resultados de Bioimpedancia/);
});
