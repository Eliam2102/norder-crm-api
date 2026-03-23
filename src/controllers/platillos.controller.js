import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';

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
