import prisma from '../lib/prisma.js';
import { ok } from '../utils/response.js';

export const getAll = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        const revisiones = await prisma.revision.findMany({
            where: { pacienteId },
            orderBy: { fecha: 'desc' }
        });
        return ok(res, revisiones);
    } catch (err) {
        next(err);
    }
};

export const create = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        const revision = await prisma.revision.create({
            data: {
                ...req.body,
                pacienteId,
                fecha: req.body.fecha ? new Date(req.body.fecha) : new Date()
            }
        });

        return ok(res, revision, 201);
    } catch (err) {
        next(err);
    }
};

export const getById = async (req, res, next) => {
    try {
        const revision = await prisma.revision.findUniqueOrThrow({ where: { id: req.params.id } });
        return ok(res, revision);
    } catch (err) {
        next(err);
    }
};

export const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updated = await prisma.revision.update({
            where: { id },
            data: req.body
        });

        return ok(res, updated);
    } catch (err) {
        next(err);
    }
};
