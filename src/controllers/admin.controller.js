import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';

// Permisos por defecto para cada rol
const PERMISOS_DEFAULT = {
    admin: {
        dashboard: { read: true, write: true, delete: true },
        pacientes: { read: true, write: true, delete: true },
        planes:    { read: true, write: true, delete: true },
        smae:      { read: true, write: true, delete: true },
        admin:     { read: true, write: true, delete: true },
    },
    practicante: {
        dashboard: { read: true, write: false, delete: false },
        pacientes: { read: true, write: false, delete: false },
        planes:    { read: true, write: true,  delete: true  },
        smae:      { read: true, write: true,  delete: false },
        admin:     { read: false, write: false, delete: false },
    }
};

export const loginUsuario = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // 1. Primero verificar las credenciales hardcodeadas del super-admin (Eyder)
        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            const token = jwt.sign(
                {
                    id: 'super-admin',
                    email,
                    nombre: process.env.ADMIN_NAME || 'Administrador',
                    rol: 'admin',
                    permisos: PERMISOS_DEFAULT.admin,
                    isSuperAdmin: true
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN }
            );
            return ok(res, {
                token,
                user: { id: 'super-admin', email, nombre: process.env.ADMIN_NAME || 'Administrador', rol: 'admin', permisos: PERMISOS_DEFAULT.admin }
            });
        }

        // 2. Buscar en la tabla de usuarios de la BD
        const usuario = await prisma.user.findUnique({ where: { email } });
        if (!usuario || !usuario.activo) return error(res, 'Credenciales inválidas', 401);

        const valido = await bcrypt.compare(password, usuario.passwordHash);
        if (!valido) return error(res, 'Credenciales inválidas', 401);

        const permisos = typeof usuario.permisos === 'object' && Object.keys(usuario.permisos).length > 0
            ? usuario.permisos
            : PERMISOS_DEFAULT[usuario.rol] || PERMISOS_DEFAULT.practicante;

        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, permisos },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        return ok(res, {
            token,
            user: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, permisos }
        });
    } catch (err) {
        next(err);
    }
};

// ─── Gestión de Usuarios (solo admin) ────────────────────────────────────────

export const listarUsuarios = async (req, res, next) => {
    try {
        const usuarios = await prisma.user.findMany({
            select: { id: true, nombre: true, email: true, rol: true, permisos: true, activo: true, telefono: true, creadoEn: true }
        });
        return ok(res, usuarios);
    } catch (err) { next(err); }
};

export const crearUsuario = async (req, res, next) => {
    try {
        const { nombre, email, password, rol = 'practicante', permisos, telefono } = req.body;

        if (!nombre || !email || !password) return error(res, 'Nombre, email y contraseña son requeridos', 400);

        const existe = await prisma.user.findUnique({ where: { email } });
        if (existe) return error(res, 'Ya existe un usuario con ese email', 409);

        const passwordHash = await bcrypt.hash(password, 12);
        const permisosFinales = permisos || PERMISOS_DEFAULT[rol] || PERMISOS_DEFAULT.practicante;

        const nuevo = await prisma.user.create({
            data: { nombre, email, passwordHash, rol, permisos: permisosFinales, telefono },
            select: { id: true, nombre: true, email: true, rol: true, permisos: true, activo: true, telefono: true, creadoEn: true }
        });

        return ok(res, nuevo, 201);
    } catch (err) { next(err); }
};

export const actualizarUsuario = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { nombre, email, password, rol, permisos, activo, telefono } = req.body;

        const data = {};
        if (nombre !== undefined) data.nombre = nombre;
        if (email !== undefined) data.email = email;
        if (telefono !== undefined) data.telefono = telefono;
        if (rol !== undefined) data.rol = rol;
        if (permisos !== undefined) data.permisos = permisos;
        if (activo !== undefined) data.activo = activo;
        if (password) data.passwordHash = await bcrypt.hash(password, 12);

        const actualizado = await prisma.user.update({
            where: { id },
            data,
            select: { id: true, nombre: true, email: true, rol: true, permisos: true, activo: true, telefono: true }
        });

        return ok(res, actualizado);
    } catch (err) { next(err); }
};

export const eliminarUsuario = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.user.delete({ where: { id } });
        return ok(res, { message: 'Usuario eliminado' });
    } catch (err) { next(err); }
};

// ─── Perfil propio ────────────────────────────────────────────────────────────

export const miPerfil = async (req, res, next) => {
    try {
        const { id, email, isSuperAdmin } = req.user;

        if (isSuperAdmin || email === process.env.ADMIN_EMAIL) {
            return ok(res, {
                id: 'super-admin',
                nombre: process.env.ADMIN_NAME || 'Administrador',
                email: process.env.ADMIN_EMAIL,
                rol: 'admin',
                isSuperAdmin: true
            });
        }

        const usuario = await prisma.user.findUnique({
            where: { id },
            select: { id: true, nombre: true, email: true, rol: true, permisos: true, activo: true, telefono: true }
        });

        return ok(res, usuario);
    } catch (err) { next(err); }
};

export const actualizarMiPerfil = async (req, res, next) => {
    try {
        const { id, isSuperAdmin } = req.user;
        const { nombre, telefono, passwordActual, passwordNuevo } = req.body;

        // El super-admin no está en BD, solo se puede cambiar via .env
        if (isSuperAdmin) {
            return ok(res, { message: 'Super-admin actualizado (recarga el servidor para aplicar cambios de .env)' });
        }

        const usuario = await prisma.user.findUniqueOrThrow({ where: { id } });

        if (passwordNuevo) {
            if (!passwordActual) return error(res, 'Debes proporcionar tu contraseña actual', 400);
            const valido = await bcrypt.compare(passwordActual, usuario.passwordHash);
            if (!valido) return error(res, 'Contraseña actual incorrecta', 401);
        }

        const data = {};
        if (nombre) data.nombre = nombre;
        if (telefono !== undefined) data.telefono = telefono;
        if (passwordNuevo) data.passwordHash = await bcrypt.hash(passwordNuevo, 12);

        const actualizado = await prisma.user.update({
            where: { id },
            data,
            select: { id: true, nombre: true, email: true, rol: true, permisos: true, telefono: true }
        });

        return ok(res, actualizado);
    } catch (err) { next(err); }
};

