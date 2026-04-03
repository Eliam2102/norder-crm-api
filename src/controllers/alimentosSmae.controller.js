import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';

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
            nombre, grupo, pesoGramos, unidadBase,
            porcionCasera, cantidadPorcion, unidadPorcion, notas
        } = req.body;

        if (!nombre || !grupo || pesoGramos === undefined) {
            return error(res, 'Campos requeridos: nombre, grupo, pesoGramos', 400);
        }

        const alimento = await prisma.alimentoSMAE.create({
            data: {
                nombre: nombre.trim(),
                grupo,
                pesoGramos: parseFloat(pesoGramos),
                unidadBase: unidadBase?.trim() || 'g',
                porcionCasera: porcionCasera?.trim() || null,
                cantidadPorcion: cantidadPorcion !== undefined ? parseFloat(cantidadPorcion) : null,
                unidadPorcion: unidadPorcion?.trim() || null,
                notas: notas?.trim() || null,
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
            nombre, grupo, pesoGramos, unidadBase,
            porcionCasera, cantidadPorcion, unidadPorcion, notas
        } = req.body;

        const dataToUpdate = {};
        if (nombre !== undefined)          dataToUpdate.nombre          = nombre.trim();
        if (grupo !== undefined)           dataToUpdate.grupo           = grupo;
        if (pesoGramos !== undefined)      dataToUpdate.pesoGramos      = parseFloat(pesoGramos);
        if (unidadBase !== undefined)      dataToUpdate.unidadBase      = unidadBase?.trim() || 'g';
        if (porcionCasera !== undefined)   dataToUpdate.porcionCasera   = porcionCasera?.trim() || null;
        if (cantidadPorcion !== undefined) dataToUpdate.cantidadPorcion = parseFloat(cantidadPorcion);
        if (unidadPorcion !== undefined)   dataToUpdate.unidadPorcion   = unidadPorcion?.trim() || null;
        if (notas !== undefined)           dataToUpdate.notas           = notas?.trim() || null;

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
