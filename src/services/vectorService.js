import pg from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Separate pool for Vector norder DB (different from main Neon DB)
let vectorPool = null;
const getVectorPool = () => {
    if (!vectorPool) {
        vectorPool = new pg.Pool({ connectionString: process.env.VECTOR_DATABASE_URL });
    }
    return vectorPool;
};

const embedQuery = async (text, model) => {
    const embeddingModel = genAI.getGenerativeModel({ model });
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
};

const searchTable = async (tableName, query, embeddingModel, topK = 8) => {
    try {
        const vector = await embedQuery(query, embeddingModel);
        const vectorStr = `[${vector.join(',')}]`;

        const pool = getVectorPool();
        const result = await pool.query(
            `SELECT content FROM "${tableName}" ORDER BY embedding <=> $1::vector LIMIT $2`,
            [vectorStr, topK]
        );

        if (!result.rows.length) return 'Sin resultados.';
        return result.rows.map(r => r.content).join('\n\n');
    } catch (err) {
        console.error(`[vectorService] Error buscando en ${tableName}:`, err.message);
        return 'Sin resultados (error al consultar base de datos).';
    }
};

// equivalencias_norder uses gemini-embedding-2
export const buscarEquivalencias = (query) =>
    searchTable('equivalencias_norder', query, 'models/gemini-embedding-2', 8);

// aporte_nutrmental (typo is intentional — that's the real table name)
// uses gemini-embedding-2-preview
export const buscarAporteNutrmental = (query) =>
    searchTable('aporte_nutrmental', query, 'models/gemini-embedding-2-preview', 10);
