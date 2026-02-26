import prisma from '../lib/prisma.js';
import { ok } from '../utils/response.js';

export const getAll = async (req, res, next) => {
    try {
        const { buscar, membresia } = req.query;

        const where = {};
        if (buscar) {
            where.OR = [
                { nombre: { contains: buscar, mode: 'insensitive' } },
                { apellido: { contains: buscar, mode: 'insensitive' } },
                { telefono: { contains: buscar } }
            ];
        }
        if (membresia) {
            where.nivelMembresia = membresia;
        }

        const pacientes = await prisma.paciente.findMany({
            where,
            include: {
                valoraciones: {
                    orderBy: { fecha: 'desc' },
                    take: 1
                },
                planes: {
                    where: { estado: 'activo' },
                    orderBy: { fechaCreacion: 'desc' },
                    take: 1
                }
            },
            orderBy: { nombre: 'asc' }
        });

        return ok(res, pacientes);
    } catch (err) {
        next(err);
    }
};

export const create = async (req, res, next) => {
    try {
        const { nombre, apellido, telefono, email, fechaNacimiento, sexo, complexion } = req.body;
        const nuevo = await prisma.paciente.create({
            data: {
                nombre,
                apellido,
                telefono,
                email,
                fechaNacimiento: new Date(fechaNacimiento),
                sexo,
                complexion: complexion ? parseFloat(complexion) : null
            }
        });
        return ok(res, nuevo, 201);
    } catch (err) {
        next(err);
    }
};

export const getById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const paciente = await prisma.paciente.findUniqueOrThrow({
            where: { id },
            include: {
                datosEjercicio: true,
                consumoCalorico: true,
                antecedentes: true,
                valoraciones: { 
                    orderBy: { fecha: 'desc' }, 
                    include: { temarioConsulta: true, planes: { take: 1, orderBy: { fechaCreacion: 'desc' } } } 
                },
                planes: { orderBy: { fechaCreacion: 'desc' } },
                revisiones: { orderBy: { fecha: 'desc' } }
            }
        });

        const { datosEjercicio, consumoCalorico, antecedentes, valoraciones, ...rest } = paciente;
        
        // Map valoraciones to include a singular plan object
        const valoracionesMapped = valoraciones.map(v => {
            const { planes, ...vRest } = v;
            return { ...vRest, plan: planes[0] || null };
        });

        return ok(res, { 
            ...rest,
            ejercicio: datosEjercicio || {},
            antecedentes: antecedentes || {},
            habitos: consumoCalorico || {},
            valoraciones: valoracionesMapped,
            ultimaValoracion: valoracionesMapped[0] || null
        });
    } catch (err) {
        next(err);
    }
};

export const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { 
            id: _, 
            datosEjercicio, 
            consumoCalorico, 
            antecedentes, 
            valoraciones, 
            planes, 
            revisiones, 
            ejercicio,
            habitos,
            ocupacion,
            motivoConsulta,
            membresia,
            createdAt,
            updatedAt,
            ...data 
        } = req.body;

        if (data.fechaNacimiento) {
            data.fechaNacimiento = new Date(data.fechaNacimiento);
        }

        const updated = await prisma.paciente.update({
            where: { id },
            data
        });
        return ok(res, updated);
    } catch (err) {
        next(err);
    }
};

export const remove = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.paciente.delete({ where: { id } });
        return ok(res, { message: 'Paciente eliminado con éxito' });
    } catch (err) {
        next(err);
    }
};

export const getEjercicio = async (req, res, next) => {
    try {
        const data = await prisma.datosEjercicio.findUnique({
            where: { pacienteId: req.params.id }
        });
        return ok(res, data || {});
    } catch (err) {
        next(err);
    }
};

export const upsertEjercicio = async (req, res, next) => {
    try {
        const data = await prisma.datosEjercicio.upsert({
            where: { pacienteId: req.params.id },
            update: req.body,
            create: { ...req.body, pacienteId: req.params.id }
        });
        return ok(res, data);
    } catch (err) {
        next(err);
    }
};

export const getAntecedentes = async (req, res, next) => {
    try {
        const data = await prisma.antecedentes.findUnique({
            where: { pacienteId: req.params.id }
        });
        return ok(res, data || {});
    } catch (err) {
        next(err);
    }
};

export const upsertAntecedentes = async (req, res, next) => {
    try {
        const data = await prisma.antecedentes.upsert({
            where: { pacienteId: req.params.id },
            update: req.body,
            create: { ...req.body, pacienteId: req.params.id }
        });
        return ok(res, data);
    } catch (err) {
        next(err);
    }
};

export const getConsumo = async (req, res, next) => {
    try {
        const data = await prisma.consumoCalorico.findUnique({
            where: { pacienteId: req.params.id }
        });
        return ok(res, data || {});
    } catch (err) {
        next(err);
    }
};

export const upsertConsumo = async (req, res, next) => {
    try {
        const data = await prisma.consumoCalorico.upsert({
            where: { pacienteId: req.params.id },
            update: req.body,
            create: { ...req.body, pacienteId: req.params.id }
        });
        return ok(res, data);
    } catch (err) {
        next(err);
    }
};

export const updateMembresia = async (req, res, next) => {
    try {
        const { nivelMembresia, suscripcionInicio, suscripcionFin } = req.body;
        const data = { nivelMembresia };
        
        if (suscripcionInicio) data.suscripcionInicio = new Date(suscripcionInicio);
        if (suscripcionFin) data.suscripcionFin = new Date(suscripcionFin);

        const updated = await prisma.paciente.update({
            where: { id: req.params.id },
            data
        });
        return ok(res, updated);
    } catch (err) {
        next(err);
    }
};
