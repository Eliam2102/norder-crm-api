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
        return { acceso: false, razon, mensaje, suscripcionFin: paciente.suscripcionFin };
    }

    const planActivo = paciente.planes[0] || null;
    return {
        acceso: true,
        nivelMembresia: paciente.nivelMembresia,
        suscripcionInicio: paciente.suscripcionInicio,
        suscripcionFin: paciente.suscripcionFin,
        planTexto: planATexto(planActivo),
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
