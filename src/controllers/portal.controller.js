import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { normalizarTelefono, getContextoPaciente } from '../lib/pacienteContext.js';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginPortal = async (req, res) => {
    try {
        const { telefono, fechaNacimiento } = req.body;

        if (!telefono || !fechaNacimiento) {
            return res.status(400).json({ error: 'Teléfono y fecha de nacimiento son requeridos.' });
        }

        const tel = normalizarTelefono(telefono);
        const paciente = await prisma.paciente.findFirst({
            where: { telefono: { endsWith: tel } },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                telefono: true,
                fechaNacimiento: true,
                nivelMembresia: true,
                portalActivo: true,
            }
        });

        if (!paciente) {
            return res.status(401).json({ error: 'Teléfono o fecha de nacimiento incorrectos.', codigo: 'credenciales_invalidas' });
        }

        // Comparar fecha de nacimiento (timezone-safe)
        const dbDate = paciente.fechaNacimiento.toISOString().split('T')[0];
        if (dbDate !== fechaNacimiento) {
            return res.status(401).json({ error: 'Teléfono o fecha de nacimiento incorrectos.', codigo: 'credenciales_invalidas' });
        }

        if (!paciente.portalActivo) {
            return res.status(403).json({
                error: 'Tu portal no está activado aún. Contacta a tu nutriólogo.',
                codigo: 'portal_inactivo'
            });
        }

        const token = jwt.sign(
            { sub: paciente.id, telefono: paciente.telefono, type: 'portal' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.PORTAL_JWT_EXPIRES_IN || '30d' }
        );

        return res.json({
            token,
            paciente: {
                id: paciente.id,
                nombre: paciente.nombre,
                apellido: paciente.apellido,
                nivelMembresia: paciente.nivelMembresia,
            }
        });
    } catch (err) {
        console.error('[Portal] loginPortal error:', err);
        return res.status(500).json({ error: 'Error interno. Intenta de nuevo.' });
    }
};

// ─── Me ───────────────────────────────────────────────────────────────────────

export const getMe = async (req, res) => {
    try {
        const paciente = await prisma.paciente.findUnique({
            where: { id: req.paciente.id },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                nivelMembresia: true,
                suscripcionFin: true,
                portalActivo: true,
            }
        });

        if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado.' });

        return res.json(paciente);
    } catch (err) {
        console.error('[Portal] getMe error:', err);
        return res.status(500).json({ error: 'Error interno.' });
    }
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const chat = async (req, res) => {
    try {
        const { mensaje } = req.body;

        if (!mensaje?.trim()) {
            return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
        }

        // Validar membresía usando helper compartido
        const contexto = await getContextoPaciente({ pacienteId: req.paciente.id });

        if (!contexto.acceso) {
            return res.status(403).json({ error: contexto.mensaje, codigo: contexto.razon });
        }

        const webhookUrl = process.env.N8N_CHAT_WEBHOOK_URL;
        if (!webhookUrl) {
            console.error('[Portal] N8N_CHAT_WEBHOOK_URL no configurada');
            return res.status(503).json({ error: 'Servicio de chat no disponible temporalmente.' });
        }

        const { default: axios } = await import('axios');
        const n8nResponse = await axios.post(
            webhookUrl,
            {
                mensaje: mensaje.trim(),
                Numero_Telefono: contexto.telefono,
            },
            { timeout: 35_000 }
        );

        const respuesta =
            n8nResponse.data?.output ||
            n8nResponse.data?.message ||
            n8nResponse.data?.text ||
            (typeof n8nResponse.data === 'string' ? n8nResponse.data : null) ||
            'Sin respuesta del agente.';

        return res.json({ respuesta });
    } catch (err) {
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            return res.status(504).json({ error: 'El agente tardó demasiado en responder. Intenta de nuevo.' });
        }
        console.error('[Portal] chat error:', err);
        return res.status(500).json({ error: 'Error al comunicarse con el agente.' });
    }
};

// ─── Activar/Desactivar (staff) ───────────────────────────────────────────────

export const activarPortalManual = async (req, res) => {
    try {
        const { id } = req.params;
        const { activar, nivelMembresia, suscripcionFin } = req.body;

        const data = { portalActivo: Boolean(activar) };
        if (nivelMembresia) data.nivelMembresia = nivelMembresia;
        if (suscripcionFin) data.suscripcionFin = new Date(suscripcionFin);
        if (activar) {
            const actual = await prisma.paciente.findUnique({
                where: { id },
                select: { nivelMembresia: true, suscripcionFin: true }
            });
            // Asegurar nivel de membresía
            if (!nivelMembresia && (!actual?.nivelMembresia || actual.nivelMembresia === 'ninguna')) {
                data.nivelMembresia = 'norder_health';
            }
            // Si no tiene suscripcionFin o ya venció, poner +1 año por defecto
            const hoy = new Date();
            if (!suscripcionFin && (!actual?.suscripcionFin || new Date(actual.suscripcionFin) < hoy)) {
                const fin = new Date();
                fin.setFullYear(fin.getFullYear() + 1);
                data.suscripcionFin = fin;
                if (!data.suscripcionInicio) data.suscripcionInicio = hoy;
            }
        }

        const updated = await prisma.paciente.update({ where: { id }, data });
        return res.json({ ok: true, portalActivo: updated.portalActivo, nivelMembresia: updated.nivelMembresia });
    } catch (err) {
        console.error('[Portal] activarPortalManual error:', err);
        return res.status(500).json({ error: 'Error al actualizar portal.' });
    }
};
