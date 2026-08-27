import prisma from '../lib/prisma.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcularEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return null;
    const hoy = new Date();
    const nac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
};

const normalizarTelefono = (tel) => {
    if (!tel) return null;
    return tel.replace(/\D/g, '').slice(-10); // Últimos 10 dígitos
};

const planATexto = (plan) => {
    if (!plan) return 'Sin plan nutricional activo.';

    const lineas = [
        `PLAN: ${plan.nombre || 'Sin nombre'} | ${plan.calorias} kcal | P:${plan.proteinasPct}% C:${plan.carbohidratosPct}% G:${plan.grasasPct}%`,
        `Macros: P ${plan.proteinasGr}g | C ${plan.carbohidratosGr}g | G ${plan.grasasGr}g`,
        plan.tipoPlan ? `TIPO: ${plan.tipoPlan}` : null,
        plan.notasGenerales ? `NOTAS: ${plan.notasGenerales}` : null,
        '',
    ].filter(l => l !== null);

    const esNota = (i) =>
        typeof i.descripcion === 'string' &&
        i.descripcion.toLowerCase().startsWith('nota:') &&
        !i.eqGrupo;

    for (const menu of (plan.menus || [])) {
        lineas.push(`=== ${menu.nombre?.toUpperCase() || 'MENÚ'} ===`);
        const tiempos = menu.tiemposComida || menu.tiempos || [];

        for (const tiempo of tiempos) {
            const ings = tiempo.ingredientes || [];
            const realIngs = ings.filter(i => !esNota(i));

            // Skip tiempos without real ingredients
            if (realIngs.length === 0) continue;

            // Index pseudo-notes by platillo
            const notasPorPlatillo = ings.filter(esNota).reduce((acc, n) => {
                const key = n.platillo || '';
                if (!acc[key]) acc[key] = [];
                acc[key].push(n.descripcion.replace(/^nota:\s*/i, '').trim());
                return acc;
            }, {});

            lineas.push(`\n${tiempo.nombre}:`);
            if (tiempo.nota || tiempo.notaPie) {
                lineas.push(`  (Nota: ${tiempo.nota || tiempo.notaPie})`);
            }

            // Group by platillo
            const platilloMap = new Map();
            for (const ing of realIngs) {
                const key = ing.platillo || '';
                if (!platilloMap.has(key)) platilloMap.set(key, []);
                platilloMap.get(key).push(ing);
            }

            for (const [platillo, platilloIngs] of platilloMap) {
                const notas = notasPorPlatillo[platillo] || [];
                if (platillo) {
                    const notaStr = notas.length > 0 ? ` (${notas.join('; ')})` : '';
                    lineas.push(`  [${platillo}]${notaStr}`);
                } else if (notas.length > 0) {
                    lineas.push(`  (Nota: ${notas.join('; ')})`);
                }

                for (const ing of platilloIngs) {
                    const cantidad = parseFloat(ing.cantidad);
                    if (!cantidad || ing.unidad === '-') {
                        lineas.push(`  - ${ing.descripcion} (libre)`);
                        continue;
                    }

                    let linea = `  - ${ing.descripcion} — ${cantidad} ${ing.unidad}`;

                    // Use equivalencias array if present, else scalar fields — never both (avoids duplication)
                    const eqs = Array.isArray(ing.equivalencias) && ing.equivalencias.length > 0
                        ? ing.equivalencias.filter(e => e.grupo && e.cantidad)
                        : (ing.eqCantidad && ing.eqGrupo
                            ? [{ grupo: ing.eqGrupo, cantidad: ing.eqCantidad }]
                            : []);

                    if (eqs.length > 0) {
                        linea += ` | ${eqs.map(e => `${e.cantidad} Eq ${e.grupo}`).join(' + ')}`;
                    }

                    if (ing.nota) linea += ` *(${ing.nota})*`;
                    lineas.push(linea);
                }
            }
        }
        lineas.push('');
    }

    return lineas.join('\n');
};


// ─── Middleware de API Key del Agente ─────────────────────────────────────────

export const agentKeyMiddleware = (req, res, next) => {
    const agentKey = process.env.AGENT_API_KEY;
    // Si no hay AGENT_API_KEY configurada en el env, saltamos la protección (dev mode)
    if (!agentKey) return next();

    const provided = req.headers['x-agent-key'];
    if (!provided || provided !== agentKey) {
        return res.status(401).json({
            acceso: false,
            razon: 'api_key_invalida',
            mensaje: 'Acceso no autorizado al servicio del agente.'
        });
    }
    next();
};

// ─── Endpoint Principal ───────────────────────────────────────────────────────

/**
 * GET /api/agent/contexto
 * 
 * Query params:
 *   - telefono: número del paciente (con o sin código de país)
 *   - email: email del paciente (alternativo)
 * 
 * Headers (opcional si AGENT_API_KEY está configurado):
 *   - X-Agent-Key: clave de API del agente
 * 
 * Respuesta:
 *   - { acceso: false, razon, mensaje } si no tiene acceso
 *   - { acceso: true, nivelMembresia, paciente, plan, planTexto } si tiene acceso
 */
export const getContexto = async (req, res) => {
    try {
        const { telefono, email } = req.query;

        if (!telefono && !email) {
            return res.status(400).json({
                acceso: false,
                razon: 'parametro_requerido',
                mensaje: 'Debes proporcionar un "telefono" o "email" para identificar al paciente.'
            });
        }

        // Construir el where según el identificador
        let where = {};
        if (telefono) {
            const tel = normalizarTelefono(telefono);
            // Buscar teléfonos que terminen en los últimos 10 dígitos
            where = { telefono: { endsWith: tel } };
        } else {
            where = { email: { equals: email, mode: 'insensitive' } };
        }

        const paciente = await prisma.paciente.findFirst({
            where,
            select: {
                id: true,
                nombre: true,
                apellido: true,
                sexo: true,
                fechaNacimiento: true,
                email: true,
                telefono: true,
                nivelMembresia: true,
                portalActivo: true,
                suscripcionInicio: true,
                suscripcionFin: true,
                planes: {
                    where: { estadoEnvio: 'enviado' },
                    orderBy: { fechaCreacion: 'desc' },
                    take: 1,
                    include: {
                        menus: {
                            orderBy: { orden: 'asc' },
                            include: {
                                tiemposComida: {
                                    orderBy: { orden: 'asc' },
                                    include: {
                                        ingredientes: {
                                            orderBy: { orden: 'asc' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Paciente no encontrado
        if (!paciente) {
            return res.status(200).json({
                acceso: false,
                razon: 'no_registrado',
                mensaje: 'No encontramos tu registro en el sistema. Contacta a tu nutriólogo para que te registre.'
            });
        }

        // Verificar acceso portal habilitado por el nutriólogo
        if (!paciente.portalActivo) {
            return res.status(200).json({
                acceso: false,
                razon: 'portal_inactivo',
                mensaje: 'Tu acceso al portal no está habilitado. Contacta a tu nutriólogo.'
            });
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const tieneNivel = paciente.nivelMembresia && paciente.nivelMembresia !== 'ninguna';
        // Sin fecha de fin registrada = sin vencimiento definido, no "vencido en 1970".
        const tieneVigencia = !paciente.suscripcionFin || new Date(paciente.suscripcionFin) >= hoy;

        // Tier gratuito — sin membresía de pago activa nunca
        if (!tieneNivel) {
            const LIMITE_GRATIS = 5;
            const mensajesHoy = await prisma.mensajePortal.count({
                where: { pacienteId: paciente.id, rol: 'user', createdAt: { gte: hoy } }
            });
            return res.status(200).json({
                acceso: true,
                nivelMembresia: 'gratis',
                preguntasHoy: mensajesHoy,
                preguntasRestantes: Math.max(0, LIMITE_GRATIS - mensajesHoy),
                paciente: {
                    id: paciente.id,
                    nombre: `${paciente.nombre} ${paciente.apellido || ''}`.trim(),
                    telefono: paciente.telefono
                },
                planTexto: 'Sin plan activo.',
                resumen_previo: null,
            });
        }

        // Plan de pago vencido
        if (!tieneVigencia) {
            const fechaVenc = new Date(paciente.suscripcionFin).toLocaleDateString('es-MX', {
                day: 'numeric', month: 'long', year: 'numeric'
            });
            return res.status(200).json({
                acceso: false,
                razon: 'membresia_vencida',
                mensaje: `Tu membresía ${paciente.nivelMembresia} venció el ${fechaVenc}. Contacta a tu nutriólogo para renovarla.`,
                suscripcionFin: paciente.suscripcionFin
            });
        }

        // Membresía de pago activa
        const esPremium = ['premium', 'norder_health'].includes(paciente.nivelMembresia);
        const planActivo = esPremium ? (paciente.planes[0] || null) : null;
        const planTexto = esPremium ? planATexto(planActivo) : 'Sin plan activo.';

        const resumenRecord = await prisma.resumenPaciente.findUnique({
            where: { pacienteId: paciente.id },
            select: { resumen: true, updatedAt: true }
        });

        return res.status(200).json({
            acceso: true,
            nivelMembresia: paciente.nivelMembresia,
            esPremium,
            suscripcionInicio: paciente.suscripcionInicio,
            suscripcionFin: paciente.suscripcionFin,
            paciente: {
                id: paciente.id,
                nombre: `${paciente.nombre} ${paciente.apellido || ''}`.trim(),
                sexo: paciente.sexo,
                edad: calcularEdad(paciente.fechaNacimiento),
                email: paciente.email,
                telefono: paciente.telefono
            },
            tienePlan: !!planActivo,
            planTexto,
            resumen_previo: resumenRecord?.resumen || null,
        });

    } catch (err) {
        console.error('[AgentController] Error en getContexto:', err);
        return res.status(500).json({
            acceso: false,
            razon: 'error_interno',
            mensaje: 'Ocurrió un error al consultar tu información. Intenta de nuevo.'
        });
    }
};

// ─── Historial reciente ───────────────────────────────────────────────────────

/**
 * GET /api/agent/historial?telefono=XXX&limite=20
 * Devuelve los últimos N mensajes del paciente para contexto histórico del agente.
 */
export const getHistorial = async (req, res) => {
    try {
        const { telefono } = req.query;
        const limite = Math.min(parseInt(req.query.limite) || 20, 50);

        if (!telefono) {
            return res.status(400).json({ error: 'Se requiere "telefono".' });
        }

        const tel = normalizarTelefono(telefono);
        const paciente = await prisma.paciente.findFirst({
            where: { telefono: { endsWith: tel } },
            select: { id: true }
        });

        if (!paciente) return res.json({ historial: [] });

        const mensajes = await prisma.mensajePortal.findMany({
            where: { pacienteId: paciente.id },
            orderBy: { createdAt: 'desc' },
            take: limite,
            select: { rol: true, contenido: true, createdAt: true }
        });

        return res.json({
            historial: mensajes.reverse().map(m => ({
                rol: m.rol,
                contenido: m.contenido,
                fecha: m.createdAt.toISOString(),
            }))
        });
    } catch (err) {
        console.error('[AgentController] getHistorial error:', err);
        return res.status(500).json({ error: 'Error al obtener historial.' });
    }
};

// ─── Guardar resumen de memoria ───────────────────────────────────────────────

/**
 * POST /api/agent/guardar-resumen
 * Body: { telefono: string, resumen: string }
 * N8N llama este endpoint después de cada intercambio para persistir los hechos extraídos.
 */
export const guardarResumen = async (req, res) => {
    try {
        const { telefono, resumen } = req.body;

        if (!telefono || !resumen?.trim()) {
            return res.status(400).json({ error: 'Se requieren "telefono" y "resumen".' });
        }

        const tel = normalizarTelefono(telefono);
        const paciente = await prisma.paciente.findFirst({
            where: { telefono: { endsWith: tel } },
            select: { id: true }
        });

        if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado.' });

        await prisma.resumenPaciente.upsert({
            where: { pacienteId: paciente.id },
            update: { resumen: resumen.trim() },
            create: { pacienteId: paciente.id, resumen: resumen.trim() },
        });

        return res.json({ ok: true });
    } catch (err) {
        console.error('[AgentController] guardarResumen error:', err);
        return res.status(500).json({ error: 'Error al guardar resumen.' });
    }
};

// ─── Actualizar memoria (N8N hace la extracción, backend solo guarda) ─────────

/**
 * POST /api/agent/actualizar-memoria
 * Body: { telefono, resumen }
 * N8N extrae los hechos con su propio Gemini y manda el resumen ya procesado.
 * Este endpoint solo guarda en ResumenPaciente — sin llamadas a Gemini aquí.
 */
export const actualizarMemoria = async (req, res) => {
    try {
        const { telefono, resumen, mensajeUsuario, respuestaEyder } = req.body;

        // Acepta formato nuevo { resumen } o formato viejo { mensajeUsuario, respuestaEyder }
        const textoFinal = resumen?.trim() ||
            (respuestaEyder?.trim()
                ? `U: ${(mensajeUsuario || '').trim()}\nE: ${respuestaEyder.trim()}`
                : null);

        if (!telefono || !textoFinal) {
            return res.status(400).json({ error: 'Se requieren telefono y resumen (o mensajeUsuario+respuestaEyder).' });
        }

        const tel = normalizarTelefono(telefono);
        const paciente = await prisma.paciente.findFirst({
            where: { telefono: { endsWith: tel } },
            select: { id: true }
        });

        if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado.' });

        await prisma.resumenPaciente.upsert({
            where: { pacienteId: paciente.id },
            update: { resumen: textoFinal },
            create: { pacienteId: paciente.id, resumen: textoFinal }
        });

        return res.json({ ok: true });
    } catch (err) {
        console.error('[AgentController] actualizarMemoria error:', err);
        return res.status(500).json({ error: 'Error al actualizar memoria.' });
    }
};
