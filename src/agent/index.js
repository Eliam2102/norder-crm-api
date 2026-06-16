import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt } from './prompt.js';
import { TOOL_DECLARATIONS } from './tools.js';
import { cargarHistorial, cargarResumen, actualizarResumen } from './memory.js';
import { runLoop } from './runner.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

/**
 * Main entry point for the Eyder agent.
 *
 * @param {{
 *   pacienteId: string,
 *   mensaje: string,
 *   imagen_base64?: string | null,
 *   contexto: {
 *     nivelMembresia: string,
 *     planTexto: string,
 *     tienePlan: boolean,
 *     paciente: { id, nombre, sexo, edad, telefono, email }
 *   }
 * }} opts
 * @returns {Promise<{ respuesta: string }>}
 */
export const run = async ({ pacienteId, mensaje, imagen_base64, contexto }) => {
    const { nivelMembresia, planTexto, paciente } = contexto;

    // 1. Load persistent memory
    const resumen_previo = await cargarResumen(pacienteId);

    // 2. Build system prompt with current patient context + time
    const systemPrompt = buildSystemPrompt({
        nivelMembresia,
        planTexto,
        resumen_previo,
        paciente,
        ahora: new Date().toISOString(),
    });

    // 3. Initialize model
    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        tools: TOOL_DECLARATIONS,
        systemInstruction: systemPrompt,
    });

    // 4. Load sliding-window history
    const history = await cargarHistorial(pacienteId);
    const chat = model.startChat({ history });

    // 5. Build user turn (text + optional image)
    let userTurn;
    if (imagen_base64) {
        userTurn = [
            { inlineData: { mimeType: 'image/jpeg', data: imagen_base64 } },
            { text: mensaje?.trim() || 'Analiza esta tabla nutricional y calcula las equivalencias NORDER.' }
        ];
    } else {
        userTurn = mensaje?.trim() || '';
        if (!userTurn) throw new Error('Mensaje vacío.');
    }

    // 6. Run ReAct loop
    const respuesta = await runLoop(chat, userTurn);

    // 7. Update persistent memory (async, never blocks response)
    actualizarResumen({
        pacienteId,
        nombrePaciente: paciente?.nombre || '',
        mensajeUsuario: mensaje || '[imagen]',
        respuestaEyder: respuesta,
        resumenPrevio: resumen_previo,
    });

    return { respuesta };
};
