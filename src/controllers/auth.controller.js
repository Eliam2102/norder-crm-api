import jwt from 'jsonwebtoken';
import { ok, error } from '../utils/response.js';

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            const token = jwt.sign(
                { 
                    email, 
                    nombre: process.env.ADMIN_NAME || 'Administrador',
                    role: 'admin' 
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN }
            );

            return ok(res, { 
                token, 
                user: { 
                    email, 
                    nombre: process.env.ADMIN_NAME || 'Administrador',
                    role: 'admin' 
                } 
            });
        }

        return error(res, 'Credenciales inválidas', 401);
    } catch (err) {
        next(err);
    }
};

export const me = async (req, res, next) => {
    try {
        // req.user has email from token
        const user = {
            ...req.user,
            nombre: process.env.ADMIN_NAME || 'Administrador'
        };
        return ok(res, { user });
    } catch (err) {
        next(err);
    }
};
