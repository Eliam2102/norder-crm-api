import jwt from 'jsonwebtoken';
import { error } from '../utils/response.js';

/**
 * Verifica el JWT y añade req.user al request.
 */
export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return error(res, 'No autorizado: Token faltante', 401);

    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.type === 'portal') return error(res, 'No autorizado', 401);
        req.user = payload;
        next();
    } catch {
        return error(res, 'No autorizado: Token inválido o expirado', 401);
    }
};

/**
 * Solo permite el acceso a usuarios con rol 'admin'.
 * El super-admin (Eyder) siempre tiene acceso.
 */
export const requireAdmin = (req, res, next) => {
    if (!req.user) return error(res, 'No autenticado', 401);
    if (req.user.rol !== 'admin' && req.user.role !== 'admin') return error(res, 'Acceso denegado: se requiere rol de administrador', 403);
    next();
};

/**
 * Verifica permisos granulares por módulo y acción.
 * Uso: requirePermiso('planes', 'write')
 */
export const requirePermiso = (modulo, accion = 'read') => (req, res, next) => {
    if (!req.user) return error(res, 'No autenticado', 401);

    // El admin siempre tiene acceso total
    if (req.user.rol === 'admin' || req.user.role === 'admin') return next();

    const permisos = req.user.permisos || {};
    const moduloPermisos = permisos[modulo] || {};

    if (!moduloPermisos[accion]) {
        return error(res, `Acceso denegado: sin permiso "${accion}" en módulo "${modulo}"`, 403);
    }
    next();
};

export default authMiddleware;
