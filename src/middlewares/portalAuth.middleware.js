import jwt from 'jsonwebtoken';
import { error } from '../utils/response.js';

export const portalAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return error(res, 'Token de portal faltante', 401);

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.type !== 'portal') return error(res, 'Token de tipo incorrecto', 401);
        req.paciente = { id: payload.sub, telefono: payload.telefono };
        next();
    } catch {
        return error(res, 'Token de portal inválido o expirado', 401);
    }
};
