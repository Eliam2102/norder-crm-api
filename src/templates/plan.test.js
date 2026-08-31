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

const renderMenus = (menus) => {
    const paciente = { nombre: 'Paciente', apellido: 'Prueba' };
    const plan = {
        paciente,
        menus,
        evitarReciente: [],
        lineamientosRecientes: [],
        notasGenerales: '',
        notasClinicasRecientes: '',
        notasLibresRecientes: '',
        temarioReciente: [],
        pdfCustomMeta: {
            showPageHistorial: false,
            showPageMenus: true,
            showPageIntercambio: false,
            showPageExtras: false,
            showAlimentosEvitar: false,
        },
    };

    return ejs.renderFile(path.resolve('src/templates/plan.ejs'), {
        plan,
        paciente,
        config: {},
        valoraciones: [],
        tiposCuerpoImg: null,
        logoMenuImg: null,
    });
};

test('centra un único menú con contenido y no dibuja una segunda columna vacía', async () => {
    const html = await renderMenus([
        {
            nombre: 'Menú 1',
            tipoContenido: 'platillos',
            tiemposComida: [{
                nombre: 'Desayuno',
                ingredientes: [{ descripcion: 'Huevos', cantidad: 2, unidad: 'PZA', equivalencias: [] }],
            }],
        },
        {
            nombre: 'Menú 2',
            tipoContenido: 'platillos',
            tiemposComida: [{ nombre: 'Desayuno', ingredientes: [] }],
        },
    ]);

    assert.match(html, /class="menu-grid single-menu"/);
    assert.match(html, />MENÚ<\/div>/);
    assert.match(html, /Huevos/);
    assert.doesNotMatch(html, /MENÚ #2/);
});

test('mantiene las dos columnas cuando ambos menús tienen contenido', async () => {
    const html = await renderMenus([
        {
            nombre: 'Menú 1',
            tiemposComida: [{ nombre: 'Desayuno', ingredientes: [{ descripcion: 'Huevos' }] }],
        },
        {
            nombre: 'Menú 2',
            tiemposComida: [{ nombre: 'Desayuno', ingredientes: [{ descripcion: 'Avena' }] }],
        },
    ]);

    assert.match(html, />MENÚ #1<\/div>/);
    assert.match(html, />MENÚ #2<\/div>/);
    assert.doesNotMatch(html, /class="menu-grid single-menu"/);
});

test('muestra una sola fotografía destacada de la última consulta en línea', async () => {
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

    assert.match(html, /Última consulta en línea/);
    assert.match(html, /data:image\/png;base64,AAAA/);
    assert.match(html, /Peso/);
    assert.match(html, /68.5/);
    assert.doesNotMatch(html, /Talla \(cm\)/);
    assert.doesNotMatch(html, /Resultados Antropométricos/);
    assert.doesNotMatch(html, /Resultados de Bioimpedancia/);
    assert.doesNotMatch(html, /Somatotipo/);
    assert.doesNotMatch(html, /Energía\(kcal\)/);
    assert.doesNotMatch(html, /Brazo relajado|Brazo contraído|Cintura|Cadera/);
    assert.doesNotMatch(html, /Tipos de cuerpo/);
    assert.doesNotMatch(html, /class="online-photo-gallery"/);
});

test('ignora fotografías anteriores y usa sólo la principal de la consulta en línea más reciente', async () => {
    const html = await renderHistory([
        {
            id: 'valoracion-reciente',
            fecha: new Date('2026-07-27T12:00:00Z'),
            fotoPrincipal: 'data:image/png;base64,RECIENTE',
            pesoActual: 70,
        },
        {
            id: 'valoracion-anterior',
            fecha: new Date('2026-07-20T12:00:00Z'),
            fotoPrincipal: 'data:image/png;base64,ANTERIOR',
            pesoActual: 71,
        },
    ], true);

    assert.match(html, /data:image\/png;base64,RECIENTE/);
    assert.doesNotMatch(html, /data:image\/png;base64,ANTERIOR/);
    assert.equal((html.match(/Fotografía principal de la última consulta en línea/g) || []).length, 1);
});

test('muestra un estado vacío cuando la consulta en línea no tiene fotografía', async () => {
    const html = await renderHistory([{
        id: 'valoracion-1',
        fecha: new Date('2026-07-27T12:00:00Z'),
        pesoActual: 68.5,
    }], true);

    assert.match(html, /Sin fotografía registrada para esta consulta/);
    assert.match(html, /68.5 kg/);
});

test('no incluye fotografías en el historial presencial', async () => {
    const html = await renderHistory([{
        id: 'valoracion-1',
        fecha: new Date('2026-07-27T12:00:00Z'),
        fotoPrincipal: 'data:image/png;base64,AAAA',
        pesoActual: 68.5,
    }], false, 'ANTROPOMETRIA');

    assert.doesNotMatch(html, /Última consulta en línea/);
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

test('habilita paginación dinámica únicamente en historial y extras', async () => {
    const paciente = { nombre: 'Paciente', apellido: 'Prueba' };
    const plan = {
        paciente,
        menus: [{
            nombre: 'Menú 1',
            tiemposComida: [{
                nombre: 'Desayuno',
                ingredientes: [{ descripcion: 'Huevos', cantidad: 2, unidad: 'PZA' }],
            }],
        }],
        evitarReciente: [],
        lineamientosRecientes: [],
        notasGenerales: '',
        notasClinicasRecientes: '',
        notasLibresRecientes: '',
        temarioReciente: [],
        pdfCustomMeta: {
            showPageHistorial: true,
            showPageMenus: true,
            showPageIntercambio: true,
            showPageExtras: true,
            showAlimentosEvitar: false,
        },
    };

    const html = await ejs.renderFile(path.resolve('src/templates/plan.ejs'), {
        plan,
        paciente,
        config: {},
        valoraciones: [],
        tiposCuerpoImg: null,
        logoMenuImg: null,
    });

    assert.match(html, /data-pdf-flow-page="history"/);
    assert.match(html, /data-pdf-flow-root="history"/);
    assert.match(html, /data-pdf-flow-page="extras"/);
    assert.match(html, /data-pdf-flow-root="extras"/);
    assert.match(html, /window\.__NORDER_PAGINATE_PDF__/);
    assert.doesNotMatch(html, /data-pdf-flow-page="menus"/);
    assert.doesNotMatch(html, /data-pdf-flow-page="intercambio"/);
});
