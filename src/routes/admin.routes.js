import { Router } from 'express';
import * as admin from '../controllers/admin.controller.js';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// ─── Login unificado (admin + practicante) ───────────────────────────────────
router.post('/login', admin.loginUsuario);

// ─── Perfil propio (cualquier usuario autenticado) ──────────────────────────
router.get('/me',              authMiddleware, admin.miPerfil);
router.put('/me',              authMiddleware, admin.actualizarMiPerfil);

// ─── CRUD Usuarios (solo admin) ─────────────────────────────────────────────
router.get('/usuarios',        authMiddleware, requireAdmin, admin.listarUsuarios);
router.post('/usuarios',       authMiddleware, requireAdmin, admin.crearUsuario);
router.put('/usuarios/:id',    authMiddleware, requireAdmin, admin.actualizarUsuario);
router.delete('/usuarios/:id', authMiddleware, requireAdmin, admin.eliminarUsuario);

export default router;
