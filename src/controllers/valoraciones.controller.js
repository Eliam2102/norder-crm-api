import prisma from '../lib/prisma.js';
import { ok } from '../utils/response.js';

export const getAll = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        const valoraciones = await prisma.valoracion.findMany({
            where: { pacienteId },
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
                    } catch (e) {}
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
            vData.bioGrasa = bioimpedancia["Grasa %"] ? parseFloat(bioimpedancia["Grasa %"]) : undefined;
            vData.bioMusculo = bioimpedancia["Músculo %"] ? parseFloat(bioimpedancia["Músculo %"]) : undefined;
            vData.bioAgua = bioimpedancia["Agua %"] ? parseFloat(bioimpedancia["Agua %"]) : undefined;
            vData.masaVisceral = bioimpedancia["Grasa Visceral"] ? parseFloat(bioimpedancia["Grasa Visceral"]) : undefined;
            vData.edadMetabolica = bioimpedancia["Edad Metabólica"] ? parseFloat(bioimpedancia["Edad Metabólica"]) : undefined;
        }

        // Bioquimicos mappings (ensure numbers)
        if (bioquimicos) {
            vData.trigliceridos = bioquimicos.Tag ? parseFloat(bioquimicos.Tag) : undefined;
            vData.glucosa = bioquimicos.Glu ? parseFloat(bioquimicos.Glu) : undefined;
            vData.colesterol = bioquimicos.Col ? parseFloat(bioquimicos.Col) : undefined;
            vData.acidoUrico = bioquimicos.Urico ? parseFloat(bioquimicos.Urico) : undefined;
            vData.creatinina = bioquimicos.Creat ? parseFloat(bioquimicos.Creat) : undefined;
        }

        // Create
        const valoracion = await prisma.valoracion.create({
            data: {
                ...vData,
                pacienteId,
                numeroValoracion,
                fecha: req.body.fecha ? new Date(req.body.fecha) : new Date(),
                hora: req.body.hora || new Date().toLocaleTimeString('en-US', { hour12: false }),
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
                paciente: true,
                temarioConsulta: true,
                revisiones: true,
                planes: { 
                    include: { 
                        menus: { 
                            include: { 
                                tiemposComida: { 
                                    include: { 
                                        ingredientes: true 
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
                "Músculo %": rest.bioMusculo,
                "Agua %": rest.bioAgua,
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
            // Bio
            bioGrasa, bioAgua, bioMusculo, bioEnergia,
            // Bioq
            glucosa, trigliceridos, colesterol, creatinina, acidoUrico,
            // Aliases
            deficitMuscular, talla,
            createdAt, updatedAt,
            suplementosDetalle,
            ...rest 
        } = req.body;

        const pesoVal = rest.pesoActual ?? (rest.peso ? parseFloat(rest.peso) : undefined);
        const pctGrasaVal = rest.pctGrasa2comp ?? (rest.pctGrasa ? parseFloat(rest.pctGrasa) : undefined);

        const vData = { ...rest };
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

        // Bio & Bioq
        vData.bioGrasa = bioGrasa ?? vData.bioGrasa;
        vData.bioAgua = bioAgua ?? vData.bioAgua;
        vData.bioMusculo = bioMusculo ?? vData.bioMusculo;
        vData.bioEnergia = bioEnergia ?? vData.bioEnergia;
        vData.glucosa = glucosa ?? vData.glucosa;
        vData.trigliceridos = trigliceridos ?? vData.trigliceridos;
        vData.colesterol = colesterol ?? vData.colesterol;
        vData.creatinina = creatinina ?? vData.creatinina;
        vData.acidoUrico = acidoUrico ?? vData.acidoUrico;

        const updated = await prisma.valoracion.update({
            where: { id },
            data: vData
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
