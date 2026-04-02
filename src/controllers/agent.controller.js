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

/**
 * Serializa el plan activo a texto plano legible por el agente de IA.
 * Formato compacto que minimiza tokens pero conserva toda la información nutricional.
 */
const planATexto = (plan) => {
    if (!plan) return 'Sin plan nutricional activo.';

    const lineas = [
        `PLAN: ${plan.nombre || 'Sin nombre'} | ${plan.calorias} kcal | P:${plan.proteinasPct}% C:${plan.carbohidratosPct}% G:${plan.grasasPct}%`,
        plan.tipoPlan ? `TIPO: ${plan.tipoPlan}` : null,
        plan.notasGenerales ? `NOTAS GENERALES: ${plan.notasGenerales}` : null,
        '',
    ].filter(l => l !== null);

    for (const menu of (plan.menus || [])) {
        lineas.push(`=== ${menu.nombre?.toUpperCase() || 'MENÚ'} ===`);
        const tiempos = menu.tiemposComida || menu.tiempos || [];
        for (const tiempo of tiempos) {
            lineas.push(`\n${tiempo.nombre}:`);
            if (tiempo.nota || tiempo.notaPie) {
                lineas.push(`  (Nota: ${tiempo.nota || tiempo.notaPie})`);
            }
            const ings = tiempo.ingredientes || [];
            if (ings.length === 0) {
                lineas.push('  - (sin alimentos asignados)');
            } else {
                for (const ing of ings) {
                    let linea = `  - ${ing.descripcion} | ${ing.cantidad} ${ing.unidad}`;
                    if (ing.eqCantidad && ing.eqGrupo) {
                        linea += ` → ${ing.eqCantidad} Eq ${ing.eqGrupo}`;
                    }
                    if (Array.isArray(ing.equivalencias) && ing.equivalencias.length > 0) {
                        const extras = ing.equivalencias
                            .filter(e => e.grupo && e.cantidad)
                            .map(e => `${e.cantidad} Eq ${e.grupo}`)
                            .join(' + ');
                        if (extras) linea += ` + ${extras}`;
                    }
                    if (ing.platillo) linea += ` [en: ${ing.platillo}]`;
                    if (ing.nota) linea += ` *(${ing.nota})*`;
                    lineas.push(linea);
                }
            }
        }
        lineas.push('');
    }

    return lineas.join('\n');
};

/**
 * Formatea el plan para respuesta JSON estructurada al agente.
 */
const formatearPlan = (plan) => {
    if (!plan) return null;
    return {
        id: plan.id,
        nombre: plan.nombre,
        tipoPlan: plan.tipoPlan,
        calorias: plan.calorias,
        proteinasPct: plan.proteinasPct,
        carbohidratosPct: plan.carbohidratosPct,
        grasasPct: plan.grasasPct,
        proteinasGr: plan.proteinasGr,
        carbohidratosGr: plan.carbohidratosGr,
        grasasGr: plan.grasasGr,
        notasGenerales: plan.notasGenerales,
        menus: (plan.menus || []).map(m => ({
            nombre: m.nombre,
            tiempos: (m.tiemposComida || []).map(t => ({
                nombre: t.nombre,
                nota: t.notaPie || t.nota || null,
                ingredientes: (t.ingredientes || []).map(i => ({
                    descripcion: i.descripcion,
                    cantidad: parseFloat(i.cantidad) || 0,
                    unidad: i.unidad,
                    eqCantidad: i.eqCantidad ? parseFloat(i.eqCantidad) : null,
                    eqGrupo: i.eqGrupo || null,
                    equivalencias: Array.isArray(i.equivalencias) ? i.equivalencias : [],
                    platillo: i.platillo || null,
                    nota: i.nota || null,
                }))
            }))
        }))
    };
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
                suscripcionInicio: true,
                suscripcionFin: true,
                planes: {
                    where: { estado: 'activo' },
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

        // Verificar membresía activa
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const tieneNivel = paciente.nivelMembresia && paciente.nivelMembresia !== 'ninguna';
        const tieneVigencia = paciente.suscripcionFin && new Date(paciente.suscripcionFin) >= hoy;
        const membresiaActiva = tieneNivel && tieneVigencia;

        if (!membresiaActiva) {
            let razon = 'sin_membresia';
            let mensaje = 'No tienes una membresía activa. Contacta a tu nutriólogo para activar tu plan de seguimiento.';

            if (tieneNivel && !tieneVigencia) {
                razon = 'membresia_vencida';
                const fechaVenc = new Date(paciente.suscripcionFin).toLocaleDateString('es-MX', {
                    day: 'numeric', month: 'long', year: 'numeric'
                });
                mensaje = `Tu membresía ${paciente.nivelMembresia} venció el ${fechaVenc}. Contacta a tu nutriólogo para renovarla.`;
            }

            return res.status(200).json({
                acceso: false,
                razon,
                mensaje,
                suscripcionFin: paciente.suscripcionFin
            });
        }

        // Membresía activa — construir contexto completo
        const planActivo = paciente.planes[0] || null;
        const planFormateado = formatearPlan(planActivo);
        const planTexto = planATexto(planActivo);

        return res.status(200).json({
            acceso: true,
            nivelMembresia: paciente.nivelMembresia,
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
            plan: planFormateado,
            planTexto   // Para inyectar directamente en el system prompt del agente
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
