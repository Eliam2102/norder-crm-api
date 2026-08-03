import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';
import { normalizeName } from '../lib/normalizeName.js';
import { resolveIngredienteContraSmae, normalizarNombre } from '../utils/resolveIngredienteSmae.js';

// Resuelve los ingredientes de cada platillo contra el catálogo AlimentoSMAE vigente,
// para que la biblioteca siempre muestre datos frescos aunque el catálogo haya cambiado
// después de que el platillo fue creado. Ver plan: declarative-wibbling-matsumoto.
const resolverPlatillos = async (platillos) => {
    const catalogo = await prisma.alimentoSMAE.findMany();
    const byId = new Map(catalogo.map((a) => [a.id, a]));
    const byNombre = new Map();
    for (const a of catalogo) {
        const key = normalizarNombre(a.nombre);
        if (!byNombre.has(key)) byNombre.set(key, []);
        byNombre.get(key).push(a);
    }

    const healUpdates = [];
    const resultado = platillos.map((p) => {
        let healedSomething = false;
        const nuevosIngs = (p.ingredientes || []).map((ing) => {
            const { ingrediente, healedId } = resolveIngredienteContraSmae(ing, byId, byNombre);
            if (healedId) healedSomething = true;
            return ingrediente;
        });
        if (healedSomething) healUpdates.push({ platilloId: p.id, ingredientes: nuevosIngs });
        return { ...p, ingredientes: nuevosIngs };
    });

    // Self-healing perezoso: persiste en background los alimentoSmaeId recién resueltos
    // por nombre, sin bloquear ni fallar la respuesta si algo sale mal.
    if (healUpdates.length > 0) {
        Promise.all(
            healUpdates.map((u) =>
                prisma.platillo.update({ where: { id: u.platilloId }, data: { ingredientes: u.ingredientes } })
            )
        ).catch((err) => console.error('[platillos] self-heal alimentoSmaeId falló:', err));
    }

    return resultado;
};

export const getAll = async (req, res, next) => {
    try {
        const { categoria } = req.query;
        const where = categoria ? { categoria } : {};
        const platillos = await prisma.platillo.findMany({
            where,
            orderBy: { nombre: 'asc' }
        });
        const resueltos = await resolverPlatillos(platillos);
        return ok(res, resueltos);
    } catch (err) {
        next(err);
    }
};

export const getById = async (req, res, next) => {
    try {
        const platillo = await prisma.platillo.findUniqueOrThrow({
            where: { id: req.params.id }
        });
        const [resuelto] = await resolverPlatillos([platillo]);
        return ok(res, resuelto);
    } catch (err) {
        next(err);
    }
};

export const create = async (req, res, next) => {
    try {
        const { nombre, categoria, ingredientes } = req.body;

        // Anti-duplicado robusto: ignora acentos/mayúsculas/espacios extra, no solo
        // coincidencia exacta de texto (evita "Huevo a la Mexicana" vs "huevo a la  mexicana").
        const normalizado = normalizeName(nombre);
        const existentes = await prisma.platillo.findMany({ select: { id: true, nombre: true } });
        const duplicado = existentes.find(p => normalizeName(p.nombre) === normalizado);
        if (duplicado) {
            return error(res, `Ya existe un platillo con este nombre: "${duplicado.nombre}"`, 409);
        }

        const nuevo = await prisma.platillo.create({
            data: { nombre, categoria, ingredientes }
        });
        return ok(res, nuevo, 201);
    } catch (err) {
        next(err);
    }
};

export const update = async (req, res, next) => {
    try {
        const { nombre, categoria, ingredientes } = req.body;
        const actualizado = await prisma.platillo.update({
            where: { id: req.params.id },
            data: { nombre, categoria, ingredientes }
        });
        return ok(res, actualizado);
    } catch (err) {
        next(err);
    }
};

export const remove = async (req, res, next) => {
    try {
        await prisma.platillo.delete({
            where: { id: req.params.id }
        });
        return ok(res, { message: 'Platillo eliminado logicamente' });
    } catch (err) {
        next(err);
    }
};
