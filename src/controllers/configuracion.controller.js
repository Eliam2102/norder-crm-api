import prisma from '../lib/prisma.js';
import { ok } from '../utils/response.js';

export const get = async (req, res, next) => {
    try {
        const config = await prisma.configuracion.findUnique({
            where: { id: 'singleton' }
        });

        if (!config) return ok(res, {});

        // Nunca exponer el emailPassword al frontend
        const { emailPassword, ...safeConfig } = config;
        return ok(res, {
            ...safeConfig,
            tienePasswordConfigurada: !!emailPassword
        });
    } catch (err) {
        next(err);
    }
};

export const update = async (req, res, next) => {
    try {
        const { 
            id, updatedAt,
            passwordApp,      // alias que usa el frontend
            emailPassword: _ep, // ignorar si viene directamente (debe venir como passwordApp)
            ...rest 
        } = req.body;

        const dataToSave = { ...rest };

        // Solo actualizar la contraseña si el frontend mandó una nueva (no vacía)
        if (passwordApp && passwordApp.trim() !== '') {
            dataToSave.emailPassword = passwordApp.trim();
        }

        const config = await prisma.configuracion.upsert({
            where: { id: 'singleton' },
            create: { ...dataToSave, id: 'singleton' },
            update: dataToSave
        });

        // Devolver sin exponer la contraseña
        const { emailPassword, ...safeConfig } = config;
        return ok(res, {
            ...safeConfig,
            tienePasswordConfigurada: !!emailPassword
        });
    } catch (err) {
        next(err);
    }
};

