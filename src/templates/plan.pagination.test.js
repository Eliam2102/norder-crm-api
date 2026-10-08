import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import ejs from 'ejs';
import puppeteer from 'puppeteer';
import { aggregatePdfMealEquivalences } from '../lib/pdfEquivalencias.js';
import { makePlanPdfFixture } from './plan.fixture.js';

let browser;
before(async () => { browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }); });
after(async () => { await browser?.close(); });

for (const scenario of [
    { name: 'un menú corto', menuCount: 1, mealCount: 1, ingredientCount: 2 },
    { name: 'dos menús con seis tiempos y extras', extras: true },
    { name: 'nueve tiempos en dos menús', mealCount: 9 },
    { name: 'un tiempo mayor que una página', mealCount: 1, ingredientCount: 60 },
    { name: 'un tiempo muy largo en una sola columna', menuCount: 1, mealCount: 1, ingredientCount: 60 },
    { name: 'dos columnas con distinta cantidad de alimentos', mealCount: 1, ingredientCount: 60, asymmetric: true },
    { name: 'menús de equivalencias con alimentos libres', equivalents: true },
]) {
    test(`conserva texto y letra legible sin desbordes: ${scenario.name}`, async () => {
        const fixture = makePlanPdfFixture(scenario);
        if (scenario.asymmetric) fixture.plan.menus[0].tiemposComida[0].ingredientes.splice(2);
        if (scenario.equivalents) {
            fixture.plan.menus.forEach(menu => menu.tiemposComida.forEach(time => {
                time.ingredientes.push({ descripcion: 'Alimento libre de prueba', cantidad: 1, unidad: 'PZA', equivalencias: [] });
            }));
        }
        const html = await ejs.renderFile('src/templates/plan.ejs', { ...fixture, aggregatePdfMealEquivalences });
        const page = await browser.newPage();
        try {
            // QA reproducible sin descargar fuentes ni consultar sistemas externos.
            await page.setRequestInterception(true);
            page.on('request', request => request.url().startsWith('data:') ? request.continue() : request.abort());
            await page.emulateMediaType('print');
            await page.setContent(html);
            const before = await page.$$eval('.menu-item', nodes => nodes.map(node => node.textContent.trim()));
            const result = await page.evaluate(() => window.__NORDER_PAGINATE_PDF__());
            assert.deepEqual(result.overflow, []);
            assert.deepEqual(await page.$$eval('.menu-item', nodes => nodes.map(node => node.textContent.trim()).sort()), before.sort());
            const layout = await page.evaluate(() => {
                const clipped = [];
                for (const col of document.querySelectorAll('.menu-col')) {
                    const colRect = col.getBoundingClientRect();
                    const page = col.closest('.page');
                    const limit = page.getBoundingClientRect().bottom - parseFloat(getComputedStyle(page).paddingBottom);
                    if (colRect.bottom > limit + 1 || col.scrollWidth > col.clientWidth + 1) clipped.push(col.textContent.trim().slice(0, 60));
                }
                const sizes = Array.from(document.querySelectorAll('.menu-item, .menu-item span, .menu-supl, .menu-supl span, .menu-water, .extras-page td')).map(node => parseFloat(getComputedStyle(node).fontSize));
                return { clipped, minFont: Math.min(...sizes), pages: document.querySelectorAll('.menu-page').length };
            });
            assert.deepEqual(layout.clipped, []);
            assert.ok(layout.minFont >= 13.5, `Letra mínima: ${layout.minFont}px`);
            if ((scenario.mealCount || 6) > 3 || scenario.ingredientCount === 60) assert.ok(layout.pages > 1);
            assert.match(await page.$eval('body', node => node.textContent), /Próxima sesión/);
        } finally { await page.close(); }
    });
}
