import prisma from '../lib/prisma.js';
import { mapBioimpedancia, optionalNumber } from '../lib/bioimpedancia.js';
import { getMeridaTime } from '../lib/timeZone.js';
import { ok } from '../utils/response.js';

// Todas las columnas Decimal/Int de Valoracion que create()/update() dejan
// pasar sin sanitizar vía el spread `...rest`. Ningún caller actual manda ""
// para estas, pero si alguno lo hiciera Prisma tronaría (igual que el bug de
// "estatura" en pacientes) y tumbaría el resto de la actualización con él.
// Se sanea justo antes de tocar Prisma, sin tocar el resto de la lógica.
const DECIMAL_FIELDS = [
    'pesoActual', 'estatura', 'imc',
    'pliegeTricep', 'pliegeBicep', 'pliegueSubescapular', 'pliegueCrestaIliaca',
    'pliegueSupraespinal', 'pliegueAbdominal', 'pliegueMusloFrontal', 'plieguePantorrilla', 'sumaPliegues',
    'perimetroMuneca', 'perimetroBrazoRelajado', 'perimetroBrazoContraido', 'perimetroPectoral', 'perimetroCintura',
    'perimetroAbdomen', 'perimetroCadera', 'perimetroMusloFrontal', 'perimetroPantorrilla',
    'brazoCorregido', 'piernaCorregida', 'pantorrillaCorregida',
    'diametroBiestiloideo', 'diametroBiepicondHumero', 'diametroBiepicondFemur',
    'bioGrasa', 'bioAgua', 'bioMusculo', 'bioEnergia',
    'glucosa', 'trigliceridos', 'colesterol', 'creatinina', 'acidoUrico',
    'pctGrasa2comp', 'kgGrasa2comp', 'kgMasaMagra2comp',
    'superficieCorporal', 'superficieCorp', 'pctGrasaCorporal4comp', 'pctGrasaCorp', 'masaGrasaReal',
    'pctGrasaIdeal', 'masaGrasaIdeal', 'masaVisceral', 'masaOsea', 'pctMasaOsea', 'pctMasaVisceral',
    'masaMuscular', 'pctMasaMuscular', 'pctMusculoIdeal', 'musculoIdeal', 'masaMagra',
    'deficitMusculo', 'deficitCalorico', 'pesoIdeal', 'pesoIdeal4comp', 'ptMin', 'ptMax', 'pesoAjustado',
    'sobrepeso', 'indiceProporcionalidad', 'endomorfico', 'mesomorfico', 'ectomorfico',
    'indicePonderal', 'complexion', 'densidad2comp', 'edadMetabolica',
];
const INT_FIELDS = ['numeroValoracion', 'frecuenciaCardiaca'];

const numOrNull = (v) => {
    if (v === '' || v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const sanitizeValoracionNumerics = (data) => {
    const out = { ...data };
    for (const field of DECIMAL_FIELDS) {
        if (typeof out[field] === 'string') out[field] = numOrNull(out[field]);
    }
    for (const field of INT_FIELDS) {
        if (typeof out[field] === 'string') {
            out[field] = out[field] === '' ? null : parseInt(out[field], 10);
            if (Number.isNaN(out[field])) out[field] = null;
        }
    }
    return out;
};

export const getAll = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        const valoraciones = await prisma.valoracion.findMany({
            where: { pacienteId, deletedAt: null },  // A1: excluir eliminadas
            include: {
                temarioConsulta: true,
                barrido: { select: { id: true, kcalTotal: true, porciones: true } },
                planes: {
                    select: {
                        id: true,
                        valoracionId: true,
                        tipoPlan: true,
                        estado: true,
                        estadoEnvio: true,
                        fechaCreacion: true
                    },
                    orderBy: { fechaCreacion: 'desc' }
                }
            },
            orderBy: [
                { fecha: 'desc' },
                { numeroValoracion: 'desc' }
            ]
        });

        return ok(res, valoraciones.map(v => {
            const { planes, barrido, ...rest } = v;
            // The plan for this specific valoracion is the one where valoracionId === v.id
            const specificPlan = planes.find(p => p.valoracionId === v.id);

            // Detección real de barrido
            let hasBarrido = false;
            if (barrido) {
                if ((barrido.kcalTotal || 0) > 0) hasBarrido = true;
                else {
                    try {
                        const pJson = JSON.parse(barrido.porciones || '{}');
                        hasBarrido = Object.values(pJson).some(val => Number(val) > 0);
                    } catch (e) { }
                }
            }

            // Estado de flujo
            let estadoFlujo = 'Enviado';
            if (!specificPlan) {
                estadoFlujo = hasBarrido ? 'Plan en Proceso' : 'Pendiente de plan';
            } else if (specificPlan.estadoEnvio === 'pendiente') {
                estadoFlujo = 'Listo para enviar';
            }

            return {
                ...rest,
                barrido,
                hasBarrido,
                estadoFlujo,
                plan: specificPlan || null,
                planId: specificPlan?.id || null
            };
        }));
    } catch (err) {
        next(err);
    }
};

export const create = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;

        const ultimaVal = await prisma.valoracion.findFirst({
            where: { pacienteId },
            orderBy: { numeroValoracion: 'desc' }
        });
        const numeroValoracion = (ultimaVal?.numeroValoracion || 0) + 1;

        const {
            id: _,
            pacienteId: __,
            temario, temarioConsulta,
            pliegues, perimetros,
            diametros, bioimpedancia, bioquimicos,
            // Aliases & calculated fields to exclude from top-level spread
            peso, deficitMuscular, talla,
            brazoCor, piernaCor, pantoCor,
            pesoTeoricoMin, pesoTeoricoMax,
            tmb, getSedentario, getLeve, getModerado, getIntenso,
            faoOmsRequerimiento, calcRapidoNormal, calcRapidoObeso, calcRapidoDesnutricion,
            tallaMin, tallaMax, resultadoImc, resultadoImic,
            createdAt, updatedAt,
            // Nuevo payload simplificado del frontend
            pctGrasa,       // frontend lo manda así → guardar como pctGrasa2comp
            masaMagra,      // campo a guardar directamente en el modelo
            suplementosDetalle,
            ...rest
        } = req.body;

        const pesoVal = rest.pesoActual ?? (peso ? parseFloat(peso) : undefined);
        const pctGrasaVal = pctGrasa !== undefined ? parseFloat(pctGrasa) : undefined;

        const vData = {
            ...rest,
            suplementosDetalle: suplementosDetalle || [],
            pesoActual: pesoVal,
            deficitMusculo: rest.deficitMusculo ?? deficitMuscular,
            estatura: rest.estatura ?? (talla ? parseFloat(talla) : undefined),
            // Mapeo y cálculo automático de compartimentos (2 Comp)
            ...(pctGrasaVal !== undefined && {
                pctGrasa2comp: pctGrasaVal,
                // Cálculo automático de kg de grasa si tenemos el peso
                ...(pesoVal && {
                    kgGrasa2comp: (pesoVal * pctGrasaVal) / 100,
                    kgMasaMagra2comp: pesoVal - ((pesoVal * pctGrasaVal) / 100)
                })
            }),
            ...(masaMagra !== undefined && { masaMagra: parseFloat(masaMagra) }),
        };

        // Pliegues
        if (pliegues) {
            vData.pliegeTricep = pliegues.tricep;
            vData.pliegeBicep = pliegues.bicep;
            vData.pliegueSubescapular = pliegues.subescapular;
            vData.pliegueCrestaIliaca = pliegues.crestaIliaca;
            vData.pliegueSupraespinal = pliegues.supraespinal;
            vData.pliegueAbdominal = pliegues.abdominal;
            vData.pliegueMusloFrontal = pliegues.musloFrontal;
            vData.plieguePantorrilla = pliegues.pantorrilla;
        }

        // Perimetros
        if (perimetros) {
            vData.perimetroMuneca = perimetros.muneca;
            vData.perimetroBrazoRelajado = perimetros.brazoRelajado;
            vData.perimetroBrazoContraido = perimetros.brazoContraido;
            vData.perimetroPectoral = perimetros.pectoral;
            vData.perimetroCintura = perimetros.cintura;
            vData.perimetroAbdomen = perimetros.abdomen;
            vData.perimetroCadera = perimetros.cadera;
            vData.perimetroMusloFrontal = perimetros.musloFrontal;
            vData.perimetroPantorrilla = perimetros.pantorrilla;
            vData.brazoCorregido = perimetros.brazoCor;
            vData.piernaCorregida = perimetros.piernaCor;
            vData.pantorrillaCorregida = perimetros.pantoCor;
        }

        // Diametros
        if (diametros) {
            vData.diametroBiestiloideo = diametros["Biestiloideo (Muñeca)"];
            vData.diametroBiepicondHumero = diametros["Biepicondilar Húmero"];
            vData.diametroBiepicondFemur = diametros["Biepicondilar Fémur"];
        }

        // Bioimpedancia mappings (ensure numbers)
        if (bioimpedancia) {
            Object.assign(vData, mapBioimpedancia(bioimpedancia));
            vData.masaVisceral = optionalNumber(bioimpedancia["Grasa Visceral"]);
            vData.edadMetabolica = optionalNumber(bioimpedancia["Edad Metabólica"]);
        }

        // Bioquimicos mappings (ensure numbers)
        if (bioquimicos) {
            vData.trigliceridos = bioquimicos.Tag ? parseFloat(bioquimicos.Tag) : undefined;
            vData.glucosa = bioquimicos.Glu ? parseFloat(bioquimicos.Glu) : undefined;
            vData.colesterol = bioquimicos.Col ? parseFloat(bioquimicos.Col) : undefined;
            vData.acidoUrico = bioquimicos.Urico ? parseFloat(bioquimicos.Urico) : undefined;
            vData.creatinina = bioquimicos.Creat ? parseFloat(bioquimicos.Creat) : undefined;
        }

        const safeVData = sanitizeValoracionNumerics(vData);

        const valoracion = await prisma.valoracion.create({
            data: {
                ...safeVData,
                pacienteId,
                numeroValoracion,
                fecha: req.body.fecha ? new Date(req.body.fecha) : new Date(),
                hora: req.body.hora || getMeridaTime(),
                temarioConsulta: (temario || temarioConsulta) ? {
                    create: (temario || temarioConsulta)
                        .filter(t => t.tema || t.detalle)
                        .map(t => ({
                            pacienteId,
                            tema: t.tema || 'Consulta General',
                            detalle: t.detalle,
                            orden: t.orden
                        }))
                } : undefined
            }
        });

        return ok(res, valoracion, 201);

    } catch (err) {
        next(err);
    }
};

export const getById = async (req, res, next) => {
    try {
        const valoracion = await prisma.valoracion.findUniqueOrThrow({
            where: { id: req.params.id },
            include: {
                paciente: {
                    include: {
                        citas: {
                            where: { valoracionId: req.params.id },
                            orderBy: { fecha: 'asc' }
                        }
                    }
                },
                temarioConsulta: true,
                revisiones: true,
                planes: {
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
                    },
                    orderBy: { fechaCreacion: 'desc' }
                }
            }
        });

        const { planes, ...rest } = valoracion;

        // El plan de esta valoración específica
        const specificPlan = planes.find(p => p.valoracionId === valoracion.id);

        // Mapear campos planos de vuelta a la estructura de objetos que espera el frontend
        const mapped = {
            ...rest,
            plan: specificPlan || null,
            // Reconstrucción de sub-objetos para que el frontend "vea" todos los datos originales
            pliegues: {
                tricep: rest.pliegeTricep,
                bicep: rest.pliegeBicep,
                subescapular: rest.pliegueSubescapular,
                crestaIliaca: rest.pliegueCrestaIliaca,
                supraespinal: rest.pliegueSupraespinal,
                abdominal: rest.pliegueAbdominal,
                musloFrontal: rest.pliegueMusloFrontal,
                pantorrilla: rest.plieguePantorrilla,
            },
            perimetros: {
                muneca: rest.perimetroMuneca,
                brazoRelajado: rest.perimetroBrazoRelajado,
                brazoContraido: rest.perimetroBrazoContraido,
                pectoral: rest.perimetroPectoral,
                cintura: rest.perimetroCintura,
                abdomen: rest.perimetroAbdomen,
                cadera: rest.perimetroCadera,
                musloFrontal: rest.perimetroMusloFrontal,
                pantorrilla: rest.perimetroPantorrilla,
                brazoCor: rest.brazoCorregido,
                piernaCor: rest.piernaCorregida,
                pantoCor: rest.pantorrillaCorregida,
            },
            diametros: {
                "Biestiloideo (Muñeca)": rest.diametroBiestiloideo,
                "Biepicondilar Húmero": rest.diametroBiepicondHumero,
                "Biepicondilar Fémur": rest.diametroBiepicondFemur,
            },
            bioimpedancia: {
                "Grasa %": rest.bioGrasa,
                "Agua %": rest.bioAgua,
                "Músculo (kg)": rest.bioMusculo,
                // Alias temporal para clientes anteriores.
                "Músculo %": rest.bioMusculo,
                "Grasa Visceral": rest.masaVisceral,
                "Edad Metabólica": rest.edadMetabolica,
                "Energía (kcal)": rest.bioEnergia,
            },
            bioquimicos: {
                Tag: rest.trigliceridos,
                Glu: rest.glucosa,
                Col: rest.colesterol,
                Urico: rest.acidoUrico,
                Creat: rest.creatinina,
            },
            // Aliases comunes
            peso: rest.pesoActual,
            talla: rest.estatura,
            deficitMuscular: rest.deficitMusculo,
            // Alias para nuevo formulario simplificado
            pctGrasa: rest.pctGrasa2comp,
        };

        return ok(res, mapped);
    } catch (err) {
        next(err);
    }
};

export const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            id: _id,
            temario, temarioConsulta,
            pliegues, perimetros,
            bioimpedancia,
            // Bio
            bioGrasa, bioAgua, bioMusculo, bioEnergia,
            // Bioq
            glucosa, trigliceridos, colesterol, creatinina, acidoUrico,
            // Aliases
            deficitMuscular, talla, peso,
            createdAt, updatedAt,
            suplementosDetalle,
            // Nuevo payload simplificado del frontend (no son columnas, se mapean abajo)
            pctGrasa,
            ...rest
        } = req.body;

        const pesoVal = rest.pesoActual ?? (peso ? parseFloat(peso) : undefined);
        const pctGrasaVal = rest.pctGrasa2comp ?? (pctGrasa !== undefined ? parseFloat(pctGrasa) : undefined);

        const vData = { ...rest };
        if (rest.fecha) {
            vData.fecha = new Date(rest.fecha);
        }
        if (suplementosDetalle !== undefined) vData.suplementosDetalle = suplementosDetalle || [];
        if (deficitMuscular) vData.deficitMusculo = deficitMuscular;
        if (talla) vData.estatura = talla;
        if (pesoVal) vData.pesoActual = pesoVal;

        // Cálculo automático en el update
        if (pctGrasaVal !== undefined) {
            vData.pctGrasa2comp = pctGrasaVal;
            if (vData.pesoActual) {
                vData.kgGrasa2comp = (vData.pesoActual * pctGrasaVal) / 100;
                vData.kgMasaMagra2comp = vData.pesoActual - vData.kgGrasa2comp;
            }
        }

        // Pliegues
        if (pliegues) {
            vData.pliegeTricep = pliegues.tricep;
            vData.pliegeBicep = pliegues.bicep;
            vData.pliegueSubescapular = pliegues.subescapular;
            vData.pliegueCrestaIliaca = pliegues.crestaIliaca;
            vData.pliegueSupraespinal = pliegues.supraespinal;
            vData.pliegueAbdominal = pliegues.abdominal;
            vData.pliegueMusloFrontal = pliegues.musloFrontal;
            vData.plieguePantorrilla = pliegues.pantorrilla;
        }

        // Perimetros
        if (perimetros) {
            vData.perimetroMuneca = perimetros.muneca;
            vData.perimetroBrazoRelajado = perimetros.brazoRelajado;
            vData.perimetroBrazoContraido = perimetros.brazoContraido;
            vData.perimetroPectoral = perimetros.pectoral;
            vData.perimetroCintura = perimetros.cintura;
            vData.perimetroAbdomen = perimetros.abdomen;
            vData.perimetroCadera = perimetros.cadera;
            vData.perimetroMusloFrontal = perimetros.musloFrontal;
            vData.perimetroPantorrilla = perimetros.pantorrilla;
            vData.brazoCorregido = perimetros.brazoCor;
            vData.piernaCorregida = perimetros.piernaCor;
            vData.pantorrillaCorregida = perimetros.pantoCor;
        }

        // Bio & Bioq. El objeto nuevo tiene prioridad, pero se conservan los
        // campos planos para compatibilidad con integraciones existentes.
        const bioMapped = bioimpedancia ? mapBioimpedancia(bioimpedancia) : {};
        if (bioMapped.bioGrasa !== undefined || bioGrasa !== undefined) vData.bioGrasa = bioMapped.bioGrasa !== undefined ? bioMapped.bioGrasa : optionalNumber(bioGrasa);
        if (bioMapped.bioAgua !== undefined || bioAgua !== undefined) vData.bioAgua = bioMapped.bioAgua !== undefined ? bioMapped.bioAgua : optionalNumber(bioAgua);
        if (bioMapped.bioMusculo !== undefined || bioMusculo !== undefined) vData.bioMusculo = bioMapped.bioMusculo !== undefined ? bioMapped.bioMusculo : optionalNumber(bioMusculo);
        if (bioMapped.bioEnergia !== undefined || bioEnergia !== undefined) vData.bioEnergia = bioMapped.bioEnergia !== undefined ? bioMapped.bioEnergia : optionalNumber(bioEnergia);
        // `??` no filtra "" (solo null/undefined) — un valor vacío explícito
        // llegaría crudo a un campo Decimal y tronaría igual que "estatura".
        if (glucosa !== undefined) vData.glucosa = numOrNull(glucosa);
        if (trigliceridos !== undefined) vData.trigliceridos = numOrNull(trigliceridos);
        if (colesterol !== undefined) vData.colesterol = numOrNull(colesterol);
        if (creatinina !== undefined) vData.creatinina = numOrNull(creatinina);
        if (acidoUrico !== undefined) vData.acidoUrico = numOrNull(acidoUrico);

        // Temario: el frontend manda el array completo en cada edición (incluye notas de
        // Competencia como ítem __COMPETENCIA_NOTES__). Antes se descartaba en el update
        // (solo create lo guardaba) — se reemplaza por completo (delete + recreate).
        const temarioItems = temario || temarioConsulta;
        if (Array.isArray(temarioItems)) {
            const { pacienteId } = req.params;
            vData.temarioConsulta = {
                deleteMany: {},
                create: temarioItems
                    .filter(t => t.tema || t.detalle)
                    .map(t => ({
                        pacienteId,
                        tema: t.tema || 'Consulta General',
                        detalle: t.detalle,
                        orden: t.orden
                    }))
            };
        }

        const safeVData = sanitizeValoracionNumerics(vData);

        const updated = await prisma.valoracion.update({
            where: { id },
            data: safeVData,
            include: { temarioConsulta: true }
        });
        return ok(res, updated);
    } catch (err) {
        next(err);
    }
};

export const comparar = async (req, res, next) => {
    try {
        const { v1, v2 } = req.query;
        const val1 = await prisma.valoracion.findUniqueOrThrow({ where: { id: v1 } });
        const val2 = await prisma.valoracion.findUniqueOrThrow({ where: { id: v2 } });
        return ok(res, { v1: val1, v2: val2 });
    } catch (err) {
        next(err);
    }
};

// A1: Soft delete — marca la valoración como eliminada sin borrar datos
export const softDelete = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Verificar que existe y no está ya eliminada
        const existing = await prisma.valoracion.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Valoración no encontrada' });
        if (existing.deletedAt) return res.status(409).json({ error: 'Ya fue eliminada' });

        const deleted = await prisma.valoracion.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
        return ok(res, { ok: true, deletedAt: deleted.deletedAt });
    } catch (err) {
        next(err);
    }
};

// B9: Restaurar valoración eliminada
export const restore = async (req, res, next) => {
    try {
        const { id } = req.params;
        const existing = await prisma.valoracion.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Valoración no encontrada' });
        if (!existing.deletedAt) return res.status(409).json({ error: 'No está eliminada' });

        const restored = await prisma.valoracion.update({
            where: { id },
            data: { deletedAt: null }
        });
        return ok(res, { ok: true, restoredAt: new Date() });
    } catch (err) {
        next(err);
    }
};

// B9: Listar valoraciones archivadas (deletedAt != null) del paciente
export const getArchivadas = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        const archivadas = await prisma.valoracion.findMany({
            where: { pacienteId, deletedAt: { not: null } },
            select: {
                id: true,
                numeroValoracion: true,
                fecha: true,
                pesoActual: true,
                deletedAt: true,
            },
            orderBy: { deletedAt: 'desc' }
        });
        return ok(res, archivadas);
    } catch (err) {
        next(err);
    }
};
