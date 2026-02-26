import jwt from 'jsonwebtoken';
import { error } from '../utils/response.js';

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return error(res, 'No autorizado: Token faltante', 401);
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return error(res, 'No autorizado: Token inválido o expirado', 401);
    }
};

export default authMiddleware;
