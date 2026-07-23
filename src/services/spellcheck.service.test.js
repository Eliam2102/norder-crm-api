import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import ejs from 'ejs';
import { collectPlanSpellingIssues } from './spellcheck.service.js';

test('detecta errores del contenido del plan sin modificarlo', () => {
    const plan = {
        notasClinicasRecientes: 'Lacteos y azucar',
        menus: [{
            nombre: 'Menú 1',
            tiemposComida: [{
                nombre: 'Desayuno',
                ingredientes: [{ descripcion: 'vegetales komo estos' }]
            }]
        }]
    };
    const before = JSON.stringify(plan);
    const issues = collectPlanSpellingIssues(plan);
    const words = issues.map(issue => issue.word.toLocaleLowerCase('es-MX'));

    assert.ok(words.includes('lacteos'));
    assert.ok(words.includes('azucar'));
    assert.ok(words.includes('komo'));
    assert.equal(JSON.stringify(plan), before);
});

test('acepta cacahuate como palabra válida en español de México', () => {
    const issues = collectPlanSpellingIssues({
        menus: [{
            tiemposComida: [{
                ingredientes: [{ descripcion: 'Crema de cacahuate y cacahuates' }]
            }]
        }]
    });

    assert.equal(issues.some(issue => issue.word.toLocaleLowerCase('es-MX').startsWith('cacahuat')), false);
});

test('ignora el nombre y los apellidos del paciente', () => {
    const issues = collectPlanSpellingIssues({
        nombre: 'Plan de Ximena Tzec',
        paciente: { nombre: 'Ximena', apellido: 'Tzec' },
        notasClinicasRecientes: 'vegetales komo estos'
    });
    const words = issues.map(issue => issue.word.toLocaleLowerCase('es-MX'));

    assert.equal(words.includes('ximena'), false);
    assert.equal(words.includes('tzec'), false);
    assert.equal(words.includes('komo'), true);
});

test('incluye las marcas solo en el HTML de preview', async () => {
    const paciente = { nombre: 'Paciente', apellido: 'Prueba' };
    const plan = {
        paciente,
        menus: [],
        suplementosTabla: [],
        suplementacionReciente: [],
        evitarReciente: ['Lacteos'],
        competenciaReciente: null,
        pdfCustomMeta: {
            showPageHistorial: false,
            showPageMenus: false,
            showPageIntercambio: false,
            showPageExtras: true,
            showDistribucionPorciones: false
        }
    };
    const render = () => ejs.renderFile(path.resolve('src/templates/plan.ejs'), {
        plan,
        paciente,
        config: {},
        valoraciones: [],
        tiposCuerpoImg: null,
        logoMenuImg: null
    });

    plan.spellingPreviewIssues = collectPlanSpellingIssues(plan);
    const previewHtml = await render();
    assert.match(previewHtml, /const issueWords = \["Lacteos"\]/);
    assert.match(previewHtml, /header-info proper-name/);
    assert.match(previewHtml, /\.proper-name, \.spelling-preview-error/);

    delete plan.spellingPreviewIssues;
    const officialHtml = await render();
    assert.doesNotMatch(officialHtml, /const issueWords =/);
});
