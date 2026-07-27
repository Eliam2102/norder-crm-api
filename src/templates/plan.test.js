import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import ejs from 'ejs';

const renderHistory = (valoraciones, consultaEnLinea = false) => {
    const paciente = { nombre: 'Paciente', apellido: 'Prueba' };
    const plan = {
        paciente,
        consultaEnLinea,
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
    }], true);

    assert.match(html, /Foto principal/);
    assert.match(html, /data:image\/png;base64,AAAA/);
    assert.doesNotMatch(html, /class="online-photo-gallery"/);
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
    }]);

    assert.match(html, /Resultados de Bioimpedancia/);
    assert.match(html, /Grasa \(%\)/);
    assert.match(html, /Agua \(%\)/);
    assert.match(html, /Músculo \(kg\)/);
    assert.match(html, /Energía bio \(kcal\)/);
});
