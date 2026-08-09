import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';

// Debe coincidir 1:1 con los ids de GROUPS en Requirements.tsx (norer-health-hub).
// "cerealSinGr" -> "eqCerealSinGr", "aoaMuyBajo" -> "eqAoaMuyBajo", etc.
const EQUIV_GROUP_IDS = [
    'verduras', 'frutas', 'cerealSinGr', 'cerealConGr', 'leguminosas',
    'aoaMuyBajo', 'aoaBajo', 'aoaModerado', 'aoaAlto',
    'lecheDesc', 'lecheSemi', 'lecheEntera', 'lecheAz',
    'grasaSinProt', 'grasaConProt', 'azSinGr', 'azConGr',
];

const numOrNull = (v) => {
    if (v === '' || v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const intOrNull = (v) => {
    if (v === '' || v === undefined || v === null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
};

// Requirements.tsx manda el payload con nombres de variable de la UI
// (formula, actividad, macros, macroCalculos, equivalentes) que no coinciden
// con las columnas reales de Requerimiento. Mapear explícito en vez de un
// spread crudo de req.body evita que Prisma tire "Unknown argument" y tumbe
// toda la request (mismo tipo de bug que el de "estatura" en pacientes).
const buildRequerimientoData = (body) => {
    const {
        peso, talla, edad, sexo,
        formula, actividad, nivelActividad,
        tmb, get, ger, eta, af, deporte, gct,
        getSedentario, getLeve, getModerado, getIntenso, getSeleccionado,
        faoOmsRequerimiento,
        calcRapidoObeso, calcRapidoNormal, calcRapidoDesnutricion,
        macros = {}, macroCalculos = {},
        equivalentes = {},
        distribucionJson,
        comentarios,
        valoracionId,
    } = body;

    const data = {
        peso: numOrNull(peso),
        talla: numOrNull(talla),
        edad: intOrNull(edad),
        sexo: sexo || null,

        formulaTmb: formula || null,
        nivelActividad: nivelActividad || null,
        factorActividad: numOrNull(actividad),
        tmb: numOrNull(tmb),
        get: numOrNull(get),
        ger: numOrNull(ger),
        eta: numOrNull(eta),
        af: numOrNull(af),
        deporte: numOrNull(deporte),
        gct: numOrNull(gct),

        getSedentario: numOrNull(getSedentario),
        getLeve: numOrNull(getLeve),
        getModerado: numOrNull(getModerado),
        getIntenso: numOrNull(getIntenso),
        getSeleccionado: numOrNull(getSeleccionado),

        faoOmsRequerimiento: numOrNull(faoOmsRequerimiento),

        calcRapidoObeso: numOrNull(calcRapidoObeso),
        calcRapidoNormal: numOrNull(calcRapidoNormal),
        calcRapidoDesnutricion: numOrNull(calcRapidoDesnutricion),

        pctProteinas: numOrNull(macros.prot),
        pctCarbs: numOrNull(macros.carb),
        pctLipidos: numOrNull(macros.lip),

        kcalProteinas: numOrNull(macroCalculos.prot?.kcal),
        kcalCarbs: numOrNull(macroCalculos.carb?.kcal),
        kcalLipidos: numOrNull(macroCalculos.lip?.kcal),

        grProteinas: numOrNull(macroCalculos.prot?.g),
        grCarbs: numOrNull(macroCalculos.carb?.g),
        grLipidos: numOrNull(macroCalculos.lip?.g),

        grKgProteinas: numOrNull(macroCalculos.prot?.gkg),
        grKgCarbs: numOrNull(macroCalculos.carb?.gkg),
        grKgLipidos: numOrNull(macroCalculos.lip?.gkg),

        distribucionJson: distribucionJson || null,
        comentarios: comentarios || null,
    };

    for (const groupId of EQUIV_GROUP_IDS) {
        const column = `eq${groupId[0].toUpperCase()}${groupId.slice(1)}`;
        data[column] = numOrNull(equivalentes[groupId]);
    }

    if (valoracionId !== undefined) {
        data.valoracionId = valoracionId || null;
    }

    return data;
};

export const getAll = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        const requerimientos = await prisma.requerimiento.findMany({
            where: { pacienteId },
            orderBy: { creadoEn: 'desc' }
        });
        return ok(res, requerimientos);
    } catch (err) {
        next(err);
    }
};

export const create = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        const data = buildRequerimientoData(req.body);

        const req_data = await prisma.requerimiento.create({
            data: {
                ...data,
                pacienteId
            }
        });
        return ok(res, req_data, 201);
    } catch (err) {
        next(err);
    }
};

export const getById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const req_data = await prisma.requerimiento.findUniqueOrThrow({
            where: { id }
        });
        return ok(res, req_data);
    } catch (err) {
        next(err);
    }
};

export const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = buildRequerimientoData(req.body);

        const updated = await prisma.requerimiento.update({
            where: { id },
            data
        });
        return ok(res, updated);
    } catch (err) {
        next(err);
    }
};
