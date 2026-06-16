import prisma from '../lib/prisma.js';

/**
 * Busca el peso neto (g) de un alimento en la tabla AlimentoSMAE.
 * Primero intenta coincidencia exacta, luego contains, luego startsWith.
 * Devuelve null si no encuentra (Gemini usa su conocimiento interno del SMAE como fallback).
 */
export const buscarPesoSMAE = async (alimento) => {
    if (!alimento?.trim()) return null;

    const nombre = alimento.trim().toLowerCase();

    try {
        const resultado = await prisma.alimentoSMAE.findFirst({
            where: {
                nombre: { contains: nombre, mode: 'insensitive' }
            },
            select: {
                nombre: true,
                grupo: true,
                pesoGramos: true,
                unidadBase: true,
                porcionCasera: true,
                cantidadPorcion: true,
                unidadPorcion: true,
                equivalentesBase: true,
                notas: true,
            }
        });

        if (!resultado) return null;

        const partes = [
            `${resultado.nombre} (${resultado.grupo})`,
            `Peso neto: ${resultado.pesoGramos} ${resultado.unidadBase} = ${resultado.equivalentesBase} EQ`,
        ];
        if (resultado.porcionCasera) {
            partes.push(`Porción casera: ${resultado.cantidadPorcion} ${resultado.unidadPorcion} (${resultado.porcionCasera})`);
        }
        if (resultado.notas) partes.push(`Nota: ${resultado.notas}`);

        return partes.join('\n');
    } catch (err) {
        console.error('[smaeService] Error buscando SMAE:', err.message);
        return null;
    }
};
