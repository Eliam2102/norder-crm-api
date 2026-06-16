import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../lib/prisma.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MEMORY_MODEL = 'gemini-2.0-flash-lite';

const HISTORY_LIMIT = 20;

// ─── Cargar historial ─────────────────────────────────────────────────────────

/**
 * Loads the last N messages from MensajePortal and converts to Gemini history format.
 * Gemini requires strictly alternating user/model roles.
 */
export const cargarHistorial = async (pacienteId) => {
    const mensajes = await prisma.mensajePortal.findMany({
        where: { pacienteId },
        orderBy: { createdAt: 'asc' },
        take: HISTORY_LIMIT,
        select: { rol: true, contenido: true },
    });

    const history = [];
    for (const m of mensajes) {
        const role = m.rol === 'user' ? 'user' : 'model';
        const last = history[history.length - 1];

        if (last && last.role === role) {
            last.parts[0].text += '\n' + m.contenido;
        } else {
            history.push({ role, parts: [{ text: m.contenido }] });
        }
    }

    // History passed to startChat must end on a model turn (next turn will be user)
    while (history.length > 0 && history[history.length - 1].role === 'user') {
        history.pop();
    }

    return history;
};

// ─── Cargar resumen persistente ───────────────────────────────────────────────

export const cargarResumen = async (pacienteId) => {
    const record = await prisma.resumenPaciente.findUnique({
        where: { pacienteId },
        select: { resumen: true },
    });
    return record?.resumen || null;
};

// ─── Actualizar resumen (fire-and-forget) ─────────────────────────────────────

/**
 * Extracts new patient facts from the latest exchange and merges with existing summary.
 * Uses a small/fast model (gemini-2.0-flash-lite) — runs async, never blocks the response.
 */
export const actualizarResumen = async ({ pacienteId, nombrePaciente, mensajeUsuario, respuestaEyder, resumenPrevio }) => {
    try {
        const model = genAI.getGenerativeModel({ model: MEMORY_MODEL });

        const prompt = `Eres un extractor de memoria clínica para un asistente de nutrición.

Paciente: ${nombrePaciente || 'Paciente'}
Resumen previo conocido:
${resumenPrevio || '(ninguno)'}

Último intercambio:
Usuario: ${mensajeUsuario}
Eyder: ${respuestaEyder}

Tu tarea:
1. Extrae SOLO hechos nuevos y concretos sobre el paciente: alimentos que consume habitualmente, preferencias, restricciones, intolerancias, metas mencionadas, o contexto relevante para futuros intercambios.
2. Combina con el resumen previo eliminando duplicados.
3. Si no hay información nueva relevante, devuelve el resumen previo exactamente sin cambios.
4. Máximo 150 palabras. Sin saludos ni metainfo.`;

        const result = await model.generateContent(prompt);
        const nuevoResumen = result.response.text().trim();

        if (!nuevoResumen) return;

        await prisma.resumenPaciente.upsert({
            where: { pacienteId },
            update: { resumen: nuevoResumen },
            create: { pacienteId, resumen: nuevoResumen },
        });
    } catch (err) {
        console.error('[agent/memory] actualizarResumen error (non-fatal):', err.message);
    }
};
