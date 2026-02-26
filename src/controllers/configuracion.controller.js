import prisma from '../lib/prisma.js';
import { ok } from '../utils/response.js';

export const get = async (req, res, next) => {
    try {
        const config = await prisma.configuracion.findUnique({
            where: { id: 'singleton' }
        });
        return ok(res, config || {});
    } catch (err) {
        next(err);
    }
};

export const update = async (req, res, next) => {
    try {
        const { id, updatedAt, ...rest } = req.body;
        const config = await prisma.configuracion.upsert({
            where: { id: 'singleton' },
            create: { ...rest, id: 'singleton' },
            update: rest
        });
        return ok(res, config);
    } catch (err) {
        next(err);
    }
};
