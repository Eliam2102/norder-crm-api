import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import ejs from 'ejs';
import { makePlanPdfFixture } from './plan.fixture.js';

const renderHistory = (valoraciones, consultaEnLinea = false, metodoComposicion, mostrarBioimpedancia = true) => {
    const paciente = { nombre: 'Paciente', apellido: 'Prueba' };
    const plan = {
        paciente,
        consultaEnLinea,
        metodoComposicion,
        mostrarBioimpedancia,
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

test('solo admite tamaños de letra conocidos y usa estándar como valor inicial', async () => {
    for (const [size, expected] of [[undefined, 11], [11, 11], [12, 12], [13.5, 13.5], [99, 11], ['13.5px; color:red', 11]]) {
        const fixture = makePlanPdfFixture({ mealCount: 2 });
        fixture.plan.pdfCustomMeta.menuFontSize = size;
        const html = await ejs.renderFile(path.resolve('src/templates/plan.ejs'), fixture);
        assert.ok(html.includes(`--menu-font-size: ${expected}px;`));
        assert.doesNotMatch(html, /13\.5px; color:red/);
    }
});

test('fija las columnas de suplementos y conserva bordes uniformes en filas suspendidas', async () => {
    const fixture = makePlanPdfFixture({ extras: true });
    fixture.plan.historialSuplementos = [{ nombre: 'Ejemplo previo', indicaciones: 'Texto de prueba', activo: false, estado: 'Suspendido' }];
    const html = await ejs.renderFile(path.resolve('src/templates/plan.ejs'), fixture);
    assert.match(html, /supl-table supl-table-norder">\s*<colgroup><col style="width:26%"><col style="width:44%"><col style="width:14%"><col style="width:16%">/);
    assert.match(html, /supl-table supl-table-historial">\s*<colgroup><col style="width:28%"><col style="width:54%"><col style="width:18%">/);
    assert.doesNotMatch(html, /\.supl-row-suspended\s*\{[^}]*opacity/);
    assert.match(html, /\.supl-table-norder th \{ background: #e5e5e5; color: #111; \}/);
});

const renderClinicalExtras = (bioquimicaTabla, dinamicaDeportivaTabla) => {
    const paciente = { nombre: 'Paciente', apellido: 'Prueba' };
    const plan = {
        paciente,
        menus: [],
        bioquimicaTabla,
        dinamicaDeportivaTabla,
        suplementosTabla: [],
        suplementacionReciente: [],
        evitarReciente: [],
        lineamientosRecientes: [],
        notasGenerales: '',
        notasClinicasRecientes: '',
        notasLibresRecientes: '',
        temarioReciente: [],
        pdfCustomMeta: {
            showPageHistorial: false,
            showPageMenus: false,
            showPageIntercambio: false,
            showPageExtras: true,
            showAlimentosEvitar: false,
        },
    };
    return ejs.renderFile(path.resolve('src/templates/plan.ejs'), {
        plan, paciente, config: {}, valoraciones: [], tiposCuerpoImg: null, logoMenuImg: null,
    });
};

test('muestra bioquímica y pausas deportivas en tablas del PDF', async () => {
    const html = await renderClinicalExtras(
        [{ nombre: 'Vitamina D', valor: '35 ng/mL' }],
        { activo: true, rows: [{ disciplina: 'Pesas', frecuencia: '3 días', duracion: '60 min', activo: false }] },
    );
    assert.match(html, /Bioquímica · Resultados de laboratorio/);
    assert.match(html, /Vitamina D/);
    assert.match(html, /35 ng\/mL/);
    assert.match(html, /Dinámica deportiva · Estado general: ACTIVO/);
    assert.match(html, /Pesas/);
    assert.match(html, /PAUSADA/);
});

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

test('oculta bioimpedancia en el PDF solo cuando la valoración la tiene desactivada', async () => {
    const html = await renderHistory([{
        id: 'valoracion-1',
        fecha: new Date('2026-07-27T12:00:00Z'),
        bioGrasa: 24.3,
        bioAgua: 52.1,
    }], false, 'BIOIMPEDANCIA', false);

    assert.doesNotMatch(html, /Resultados de Bioimpedancia/);
    assert.match(html, /Resultados Antropométricos/);
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

test('habilita paginación dinámica en historial, menús y extras', async () => {
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
    assert.match(html, /data-pdf-flow-page="menus"/);
    assert.match(html, /data-pdf-flow-root="menus"/);
    assert.doesNotMatch(html, /data-pdf-flow-page="intercambio"/);
});


test('una valoración con bioimpedancia oculta no aporta resultados al histórico de otra consulta', async () => {
    const html = await renderHistory([
        { id: 'nueva', fecha: new Date('2026-10-31T12:00:00Z'), bioGrasa: 25.7, bioAgua: 51.2 },
        { id: 'anterior', fecha: new Date('2026-09-03T12:00:00Z'), bioGrasa: 24.3, bioAgua: 52.1,
          medicionesEstado: { mostrarBioimpedancia: false } },
    ], false, 'BIOIMPEDANCIA');
    assert.match(html, /Resultados de Bioimpedancia/);
    assert.match(html, />25\.7</);
    assert.doesNotMatch(html, />24\.3<|>52\.1</);
});


test('no hereda la ocultación de una valoración anterior cuando el plan no declara método', async () => {
    const html = await renderHistory([{
        id: 'anterior', fecha: new Date('2026-09-03T12:00:00Z'), bioGrasa: 24.3,
        medicionesEstado: { mostrarBioimpedancia: false },
    }]);
    assert.doesNotMatch(html, /Resultados de Bioimpedancia/);
});
