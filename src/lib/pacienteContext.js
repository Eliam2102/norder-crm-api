import prisma from './prisma.js';

export const normalizarTelefono = (tel) => {
    if (!tel) return null;
    return tel.replace(/\D/g, '').slice(-10);
};

const calcularEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return null;
    const hoy = new Date();
    const nac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
};

export const planATexto = (plan) => {
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

/**
 * Obtiene contexto completo del paciente incluyendo plan activo y validación de membresía.
 * @param {{ telefono?: string, email?: string, pacienteId?: string }} identificador
 * @returns {{ acceso: boolean, razon?: string, mensaje?: string, planTexto?: string, telefono?: string, pacienteId?: string }}
 */
export const getContextoPaciente = async ({ telefono, email, pacienteId }) => {
    let where = {};
    if (pacienteId) {
        where = { id: pacienteId };
    } else if (telefono) {
        const tel = normalizarTelefono(telefono);
        where = { telefono: { endsWith: tel } };
    } else if (email) {
        where = { email: { equals: email, mode: 'insensitive' } };
    } else {
        return { acceso: false, razon: 'parametro_requerido', mensaje: 'Se requiere identificador de paciente.' };
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
            portalActivo: true,
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
                                    ingredientes: { orderBy: { orden: 'asc' } }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!paciente) {
        return {
            acceso: false,
            razon: 'no_registrado',
            mensaje: 'No encontramos tu registro en el sistema. Contacta a tu nutriólogo para que te registre.'
        };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const tieneNivel = paciente.nivelMembresia && paciente.nivelMembresia !== 'ninguna';
    const tieneVigencia = paciente.suscripcionFin && new Date(paciente.suscripcionFin) >= hoy;

    // Tier gratuito: sin plan de pago nunca activado
    if (!tieneNivel) {
        const LIMITE_GRATIS = 5;
        const mensajesHoy = await prisma.mensajePortal.count({
            where: { pacienteId: paciente.id, rol: 'user', createdAt: { gte: hoy } }
        });
        if (mensajesHoy >= LIMITE_GRATIS) {
            return {
                acceso: false,
                razon: 'limite_gratis_diario',
                mensaje: `Has usado tus ${LIMITE_GRATIS} preguntas gratuitas de hoy. Actualiza tu membresía para acceso ilimitado.`
            };
        }
        return {
            acceso: true,
            nivelMembresia: 'gratis',
            preguntasHoy: mensajesHoy,
            preguntasRestantes: LIMITE_GRATIS - mensajesHoy,
            planTexto: 'Sin plan activo.',
            tienePlan: false,
            pacienteId: paciente.id,
            telefono: paciente.telefono,
            paciente: {
                id: paciente.id,
                nombre: `${paciente.nombre} ${paciente.apellido || ''}`.trim(),
                telefono: paciente.telefono,
            }
        };
    }

    // Plan de pago vencido
    if (!tieneVigencia) {
        const fechaVenc = new Date(paciente.suscripcionFin).toLocaleDateString('es-MX', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
        return {
            acceso: false,
            razon: 'membresia_vencida',
            mensaje: `Tu membresía ${paciente.nivelMembresia} venció el ${fechaVenc}. Contacta a tu nutriólogo para renovarla.`,
            suscripcionFin: paciente.suscripcionFin
        };
    }

    const esPremium = ['premium', 'norder_health'].includes(paciente.nivelMembresia);
    const planActivo = esPremium ? (paciente.planes[0] || null) : null;
    return {
        acceso: true,
        nivelMembresia: paciente.nivelMembresia,
        esPremium,
        suscripcionInicio: paciente.suscripcionInicio,
        suscripcionFin: paciente.suscripcionFin,
        planTexto: esPremium ? planATexto(planActivo) : 'Sin plan activo.',
        tienePlan: !!planActivo,
        pacienteId: paciente.id,
        telefono: paciente.telefono,
        paciente: {
            id: paciente.id,
            nombre: `${paciente.nombre} ${paciente.apellido || ''}`.trim(),
            sexo: paciente.sexo,
            edad: calcularEdad(paciente.fechaNacimiento),
            email: paciente.email,
            telefono: paciente.telefono,
        }
    };
};
