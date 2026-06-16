import { buscarEquivalencias, buscarAporteNutrmental } from '../services/vectorService.js';
import { buscarPesoSMAE } from '../services/smaeService.js';

// ─── Declarations (sent to Gemini) ────────────────────────────────────────────

export const TOOL_DECLARATIONS = [
    {
        functionDeclarations: [
            {
                name: 'buscarEquivalencias',
                description: 'Busca equivalencias NORDER para cualquier alimento. SIEMPRE llama esta herramienta primero antes de dar cualquier equivalencia.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        query: { type: 'STRING', description: 'Nombre del alimento (ej: "arroz cocido", "aguacate", "pollo a la plancha")' }
                    },
                    required: ['query']
                }
            },
            {
                name: 'buscarAporteNutrmental',
                description: 'Consulta el aporte nutricional (proteína, grasa, CHO) por equivalente de cada grupo NORDER. Úsala para cálculos con tablas nutricionales de productos procesados o cuando necesites el perfil macro de un grupo.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        query: { type: 'STRING', description: 'Nombre del grupo NORDER o alimento procesado (ej: "AOA moderado", "barra de proteína")' }
                    },
                    required: ['query']
                }
            },
            {
                name: 'buscarPesoSMAE',
                description: 'Busca el peso neto en gramos de un alimento NATURAL según el Sistema Mexicano de Alimentos Equivalentes (SMAE). Úsala cuando buscarEquivalencias no devuelva resultados para un alimento natural.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        alimento: { type: 'STRING', description: 'Nombre del alimento natural (ej: "mango", "naranja", "nopal")' }
                    },
                    required: ['alimento']
                }
            }
        ]
    }
];

// ─── Executor ─────────────────────────────────────────────────────────────────

const TOOL_HANDLERS = {
    buscarEquivalencias: async ({ query }) => {
        const result = await buscarEquivalencias(query);
        return result || 'Sin resultados para ese alimento en NORDER. Prueba con buscarPesoSMAE si es alimento natural.';
    },

    buscarAporteNutrmental: async ({ query }) => {
        const result = await buscarAporteNutrmental(query);
        return result || 'Sin resultados de aporte nutrimental.';
    },

    buscarPesoSMAE: async ({ alimento }) => {
        const result = await buscarPesoSMAE(alimento);
        return result || 'No encontrado en la base de datos SMAE. Usa tu conocimiento del libro SMAE 4ta edición para determinar el peso neto.';
    },
};

/**
 * Executes a single tool call and returns a string result.
 * Never throws — errors are returned as strings so the agent can handle them gracefully.
 */
export const executeTool = async (name, args) => {
    const handler = TOOL_HANDLERS[name];
    if (!handler) return `Herramienta "${name}" no disponible.`;

    try {
        return await handler(args);
    } catch (err) {
        console.error(`[agent/tools] Error en ${name}:`, err.message);
        return `Error al consultar ${name}. Usa tu conocimiento interno como respaldo.`;
    }
};
