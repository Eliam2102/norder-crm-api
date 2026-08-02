import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';
import { normalizeName } from '../lib/normalizeName.js';

export const getAll = async (req, res, next) => {
    try {
        const { categoria } = req.query;
        const where = categoria ? { categoria } : {};
        const platillos = await prisma.platillo.findMany({
            where,
            orderBy: { nombre: 'asc' }
        });
        return ok(res, platillos);
    } catch (err) {
        next(err);
    }
};

export const getById = async (req, res, next) => {
    try {
        const platillo = await prisma.platillo.findUniqueOrThrow({
            where: { id: req.params.id }
        });
        return ok(res, platillo);
    } catch (err) {
        next(err);
    }
};

export const create = async (req, res, next) => {
    try {
        const { nombre, categoria, ingredientes } = req.body;

        // Anti-duplicado robusto: ignora acentos/mayúsculas/espacios extra, no solo
        // coincidencia exacta de texto (evita "Huevo a la Mexicana" vs "huevo a la  mexicana").
        const normalizado = normalizeName(nombre);
        const existentes = await prisma.platillo.findMany({ select: { id: true, nombre: true } });
        const duplicado = existentes.find(p => normalizeName(p.nombre) === normalizado);
        if (duplicado) {
            return error(res, `Ya existe un platillo con este nombre: "${duplicado.nombre}"`, 409);
        }

        const nuevo = await prisma.platillo.create({
            data: { nombre, categoria, ingredientes }
        });
        return ok(res, nuevo, 201);
    } catch (err) {
        next(err);
    }
};

export const update = async (req, res, next) => {
    try {
        const { nombre, categoria, ingredientes } = req.body;
        const actualizado = await prisma.platillo.update({
            where: { id: req.params.id },
            data: { nombre, categoria, ingredientes }
        });
        return ok(res, actualizado);
    } catch (err) {
        next(err);
    }
};

export const remove = async (req, res, next) => {
    try {
        await prisma.platillo.delete({
            where: { id: req.params.id }
        });
        return ok(res, { message: 'Platillo eliminado logicamente' });
    } catch (err) {
        next(err);
    }
};
