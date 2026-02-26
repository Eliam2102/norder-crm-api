import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';

export const getAll = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        const requerimientos = await prisma.requerimiento.findMany({
            where: { pacienteId },
            orderBy: { creadoEn: 'desc' }
        });
        return ok(res, requerimientos);
    } catch (err) {
        next(err);
    }
};

export const create = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        const { id, pacienteId: _p, creadoEn, actualizadoEn, ...data } = req.body;
        const req_data = await prisma.requerimiento.create({
            data: {
                ...data,
                pacienteId
            }
        });
        return ok(res, req_data, 201);
    } catch (err) {
        next(err);
    }
};

export const getById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const req_data = await prisma.requerimiento.findUniqueOrThrow({
            where: { id }
        });
        return ok(res, req_data);
    } catch (err) {
        next(err);
    }
};

export const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { id: _id, pacienteId, creadoEn, actualizadoEn, ...data } = req.body;
        const updated = await prisma.requerimiento.update({
            where: { id },
            data
        });
        return ok(res, updated);
    } catch (err) {
        next(err);
    }
};
