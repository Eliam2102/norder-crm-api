import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import prisma from "../lib/prisma.js";
import ejs from "ejs";

const ASSETS_DIR = path.join(process.cwd(), "src", "assets");

// Carga una imagen como data URI base64 para embederla en el PDF sin dependencias de rutas
const loadImageAsBase64 = (filename) => {
    const imgPath = path.join(ASSETS_DIR, filename);
    if (!fs.existsSync(imgPath)) return null;
    const ext = path.extname(filename).replace('.', '').toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const data = fs.readFileSync(imgPath).toString('base64');
    return `data:${mime};base64,${data}`;
};

const renderHTML = async (plan, paciente, config, valoraciones = []) => {
    const templatePath = path.join(process.cwd(), "src", "templates", "plan.ejs");
    
    const html = await ejs.renderFile(templatePath, {
        plan,
        paciente,
        config,
        valoraciones,
        // Imágenes de activos embebidas como base64 para que Puppeteer las renderice correctamente
        tiposCuerpoImg: loadImageAsBase64("tipos_cuerpo.png"),
        logoMenuImg: loadImageAsBase64("logo-nrdr-menu.png"),
    });
    
    return html;
};

const launchBrowser = async () => {
    return puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
};

/**
 * Genera el PDF y lo guarda en /tmp. Devuelve la ruta del archivo.
 * Usado por el endpoint GET /planes/:id/pdf (streaming al browser).
 */
export const generarPlanPDF = async (plan, valoraciones = []) => {
    const { id, paciente } = plan;

    let config = await prisma.configuracion.findUnique({ where: { id: "singleton" } });
    if (!config) config = {};

    const html = await renderHTML(plan, paciente, config, valoraciones);

    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const filePath = path.join("/tmp", `plan-${id}.pdf`);
    await page.pdf({ path: filePath, format: "A4", landscape: true });

    await browser.close();
    return filePath;
};

/**
 * Genera el PDF en memoria como Buffer.
 * Usado por el endpoint POST /planes/:id/enviar (envío por email y WhatsApp).
 * @param {object} plan - Plan completo con menus
 * @param {object} paciente - Datos del paciente
 * @param {Array}  valoraciones - Últimas valoraciones para tabla de progreso
 */
export const generarPlanPDFBuffer = async (plan, paciente, valoraciones = []) => {
    let config = await prisma.configuracion.findUnique({ where: { id: "singleton" } });
    if (!config) config = {};

    const html = await renderHTML(plan, paciente, config, valoraciones);

    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({ format: "A4", landscape: true });

    await browser.close();
    return pdfBuffer;
};
