import axios from 'axios';

export async function sendPlanWhatsApp(telefono, nombrePaciente, pdfBuffer, pdfFilename) {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const token = process.env.EVOLUTION_API_TOKEN;
    const instance = process.env.EVOLUTION_INSTANCE;

    if (!baseUrl || !token || !instance) {
        console.warn('[WhatsApp] Variables de Evolution API no configuradas — omitiendo envío.');
        return;
    }

    if (!telefono) {
        console.warn(`[WhatsApp] Paciente ${nombrePaciente} sin teléfono — omitiendo.`);
        return;
    }

    // Limpiar número: solo dígitos, sin +, sin espacios
    const numeroLimpio = telefono.replace(/\D/g, '');

    const base64 = pdfBuffer.toString('base64');

    await axios.post(
        `${baseUrl}/message/sendMedia/${instance}`,
        {
            number: numeroLimpio,
            mediatype: 'document',
            mimetype: 'application/pdf',
            caption: `Hola ${nombrePaciente}, aquí está tu plan alimenticio de NORER Health. 🥗`,
            media: base64,
            fileName: pdfFilename || 'plan-alimenticio.pdf'
        },
        {
            headers: { apikey: token },
            timeout: 30000
        }
    );

    console.log(`[WhatsApp] Enviado a ${numeroLimpio}`);
}
