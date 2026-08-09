import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';
import { normalizeName } from '../lib/normalizeName.js';

// El formulario manda cantidadPorcion como null (no undefined) cuando queda
// vacío — parseFloat(null) da NaN, que Prisma escribe tal cual en la columna
// Float y corrompe la fila. Mismo riesgo late en pesoGramos/equivalentesBase.
const numOrNull = (v) => {
    if (v === '' || v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

export const getAll = async (req, res, next) => {
    try {
        const { q, grupo } = req.query;

        const where = {};

        if (grupo) {
            where.grupo = grupo;
        }

        if (q) {
            where.nombre = { contains: q, mode: 'insensitive' };
        }

        const alimentos = await prisma.alimentoSMAE.findMany({
            where,
            orderBy: [{ grupo: 'asc' }, { nombre: 'asc' }]
        });

        return ok(res, alimentos);
    } catch (err) {
        next(err);
    }
};

export const create = async (req, res, next) => {
    try {
        const {
            nombre, grupo, equivalentesBase, pesoGramos, unidadBase,
            porcionCasera, cantidadPorcion, unidadPorcion, notas, equivalencias
        } = req.body;

        const pesoGramosNum = numOrNull(pesoGramos);
        if (!nombre || !grupo || pesoGramosNum === null) {
            return error(res, 'Campos requeridos: nombre, grupo, pesoGramos', 400);
        }

        // Anti-duplicado robusto: ignora acentos/mayúsculas/espacios extra, no solo
        // coincidencia exacta de texto (evita "Clara de Huevo" vs "clara de  huevo").
        const normalizado = normalizeName(nombre);
        const existentes = await prisma.alimentoSMAE.findMany({ select: { id: true, nombre: true } });
        const duplicado = existentes.find(a => normalizeName(a.nombre) === normalizado);
        if (duplicado) {
            return error(res, `Ya existe un alimento con este nombre: "${duplicado.nombre}"`, 409);
        }

        const alimento = await prisma.alimentoSMAE.create({
            data: {
                nombre: nombre.trim(),
                grupo,
                equivalentesBase: numOrNull(equivalentesBase) ?? 1,
                pesoGramos: pesoGramosNum,
                unidadBase: unidadBase?.trim() || 'g',
                porcionCasera: porcionCasera?.trim() || null,
                cantidadPorcion: numOrNull(cantidadPorcion),
                unidadPorcion: unidadPorcion?.trim() || null,
                notas: notas?.trim() || null,
                equivalencias: Array.isArray(equivalencias) ? equivalencias : null,
                esPersonalizado: true  // Los creados vía API siempre son personalizados
            }
        });

        return ok(res, alimento, 201);
    } catch (err) {
        next(err);
    }
};

export const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            nombre, grupo, equivalentesBase, pesoGramos, unidadBase,
            porcionCasera, cantidadPorcion, unidadPorcion, notas, equivalencias
        } = req.body;

        const dataToUpdate = {};
        if (nombre !== undefined)            dataToUpdate.nombre           = nombre.trim();
        if (grupo !== undefined)             dataToUpdate.grupo            = grupo;
        if (equivalentesBase !== undefined)  dataToUpdate.equivalentesBase = numOrNull(equivalentesBase) ?? 1;
        if (pesoGramos !== undefined) {
            const pesoGramosNum = numOrNull(pesoGramos);
            if (pesoGramosNum === null) {
                return error(res, 'pesoGramos debe ser un número válido', 400);
            }
            dataToUpdate.pesoGramos = pesoGramosNum;
        }
        if (unidadBase !== undefined)      dataToUpdate.unidadBase      = unidadBase?.trim() || 'g';
        if (porcionCasera !== undefined)   dataToUpdate.porcionCasera   = porcionCasera?.trim() || null;
        if (cantidadPorcion !== undefined) dataToUpdate.cantidadPorcion = numOrNull(cantidadPorcion);
        if (unidadPorcion !== undefined)   dataToUpdate.unidadPorcion   = unidadPorcion?.trim() || null;
        if (notas !== undefined)           dataToUpdate.notas           = notas?.trim() || null;
        if (equivalencias !== undefined)   dataToUpdate.equivalencias   = Array.isArray(equivalencias) ? equivalencias : null;

        const alimento = await prisma.alimentoSMAE.update({
            where: { id },
            data: dataToUpdate
        });

        return ok(res, alimento);
    } catch (err) {
        if (err.code === 'P2025') {
            return error(res, 'Alimento no encontrado', 404);
        }
        next(err);
    }
};

export const remove = async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.alimentoSMAE.delete({ where: { id } });

        return ok(res, { message: 'Alimento eliminado correctamente' });
    } catch (err) {
        if (err.code === 'P2025') {
            return error(res, 'Alimento no encontrado', 404);
        }
        next(err);
    }
};
