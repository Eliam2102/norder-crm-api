import { error } from '../utils/response.js';

const errorHandler = (err, req, res, next) => {
    console.error('Error Stack:', err.stack);

    // Prisma Errors
    if (err.code === 'P2002') {
        const target = err.meta?.target ? ` (${err.meta.target})` : '';
        return error(res, `Un registro con este campo único ya existe (Conflicto)${target}`, 409);
    }
    if (err.code === 'P2025') {
        return error(res, 'Registro no encontrado', 404);
    }

    // Default error
    const message = err.message || 'Error interno del servidor';
    const status = err.status || 500;
    
    return error(res, message, status);
};

export default errorHandler;
