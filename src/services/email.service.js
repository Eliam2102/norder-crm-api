import nodemailer from 'nodemailer';
import prisma from '../lib/prisma.js';

export async function sendPlanEmail(paciente, pdfBuffer, nombrePlan) {
    let config = await prisma.configuracion.findUnique({ where: { id: 'singleton' } });
    if (!config) config = {};

    const emailUser = config.emailRemitente || process.env.EMAIL_REMITENTE;
    const emailPass = config.emailPassword || process.env.EMAIL_PASSWORD;

    if (!emailUser || !emailPass) {
        console.warn('[Email] Sin credenciales SMTP configuradas — omitiendo envío de correo.');
        return;
    }

    if (!paciente.email) {
        console.warn(`[Email] Paciente ${paciente.nombre} no tiene email — omitiendo.`);
        return;
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });

    await transporter.sendMail({
        from: `"${config.nombre || 'NORER Health'}" <${emailUser}>`,
        to: paciente.email,
        subject: config.asuntoCorreo || 'Tu plan alimenticio — NORER Health',
        html: `
            <p>Hola <strong>${paciente.nombre}</strong>,</p>
            <p>Adjunto encontrarás tu plan alimenticio personalizado de NORER Health.</p>
            <p>Cualquier duda, contáctanos.</p>
            <br>
            <p>${config.nombre || 'Tu nutricionista'}</p>
        `,
        attachments: [
            {
                filename: `plan-${nombrePlan || 'alimenticio'}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }
        ]
    });

    console.log(`[Email] Enviado a ${paciente.email}`);
}
