import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import prisma from "../lib/prisma.js";

export const generarPlanPDF = async (plan) => {
  const { id, paciente, menus, proximaSesion } = plan;

  // Obtener configuración del nutricionista
  let config = await prisma.configuracion.findUnique({ where: { id: "singleton" } });
  if (!config) config = {};

  const fechaSesion = proximaSesion
    ? new Date(proximaSesion).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Pendiente";

  // HTML Template
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            @page { margin: 20mm; }
            body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; margin: 0; padding: 20px; }
            .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .header-logo { font-size: 24pt; font-weight: bold; }
            .header-logo span { font-size: 8pt; display: block; color: #666; letter-spacing: 3px; }
            .header-info { text-align: right; font-size: 8pt; line-height: 1.6; }
            .menus { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #000; }
            .menu { padding: 10px; border-right: 1px solid #000; }
            .menu:last-child { border-right: none; }
            .menu-titulo { font-weight: bold; text-align: center; font-size: 10pt; border-bottom: 1px solid #ccc; padding-bottom: 6px; margin-bottom: 8px; }
            .tiempo { margin-bottom: 10px; }
            .tiempo-nombre { font-weight: bold; text-transform: uppercase; font-size: 9pt; }
            .ingrediente { margin-left: 12px; font-size: 9pt; line-height: 1.5; }
            .ingrediente::before { content: "– "; }
            .nota-pie { font-size: 8.5pt; color: #333; margin-top: 4px; }
            .footer { margin-top: 16px; text-align: right; font-size: 10pt; border-top: 1px solid #ccc; padding-top: 8px; }
            .footer strong { font-size: 11pt; }
            .patient-header { margin-bottom: 15px; font-size: 10pt; }
        </style>
    </head>
    <body>
        <div class="header">
          <div class="header-logo">
            norder<span>THINK · EAT · LIVE</span>
          </div>
          <div class="header-info">
            ${config.nombre || process.env.NUTRICIONISTA_NOMBRE || "L.N. Eyder Méndez Gamboa"}<br>
            ${config.profesion || ""} ${config.cedula ? `| Cédula: ${config.cedula}` : ""}${config.universidad ? `<br>${config.universidad}` : ""}<br>
            ${config.certificacion || process.env.NUTRICIONISTA_CERTIFICACION || "Certificación ISAK Nivel 2"}<br>
            ${config.telefono || process.env.NUTRICIONISTA_TELEFONO || "999 365 7830"} | ${config.email || process.env.NUTRICIONISTA_EMAIL || "eyder@norder.mx"}<br>
            ${config.direccion || process.env.NUTRICIONISTA_DIRECCION || "Mérida, Yucatán, México"}
          </div>
        </div>

        <div class="patient-header">
            <p><strong>Paciente:</strong> ${paciente ? paciente.nombre : "Plantilla Base"} — <strong>Fecha Plan:</strong> ${new Date(plan.fechaCreacion).toLocaleDateString("es-MX")}</p>
        </div>

        <div class="menus">
          ${menus
            .map(
              (menu) => `
            <div class="menu">
              <div class="menu-titulo">${menu.nombre}</div>
              ${menu.tiemposComida
                .map(
                  (t) => `
                <div class="tiempo">
                  <div class="tiempo-nombre">${t.nombre}</div>
                  ${t.ingredientes
                    .map(
                      (i) => `
                    <div class="ingrediente">
                      ${i.descripcion}${i.cantidad ? ` ${i.cantidad}` : ""}${i.unidad ? ` ${i.unidad}` : ""}${i.eqCantidad ? ` – ${i.eqCantidad} eq ${i.eqGrupo || ""}` : ""}${i.nota ? ` (${i.nota})` : ""}
                    </div>
                  `,
                    )
                    .join("")}
                  ${t.notaPie ? `<div class="nota-pie">${t.notaPie}</div>` : ""}
                </div>
              `,
                )
                .join("")}
            </div>
          `,
            )
            .join("")}
        </div>
        <div class="footer">
          <strong>Próxima sesión: ${fechaSesion}</strong>
          ${plan.notasGenerales ? `<p style="font-size:8.5pt;color:#333;margin-top:6px;">${plan.notasGenerales}</p>` : ""}
        </div>
    </body>
    </html>
    `;

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html);

  const filePath = path.join("/tmp", `plan-${id}.pdf`);
  await page.pdf({ path: filePath, format: "A4" });

  await browser.close();
  return filePath;
};
