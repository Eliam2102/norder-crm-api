import prisma from '../lib/prisma.js';
import { ok } from '../utils/response.js';

export const getAll = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        const valoraciones = await prisma.valoracion.findMany({
            where: { pacienteId },
            include: { 
                temarioConsulta: true,
                planes: {
                    select: {
                        id: true,
                        tipoPlan: true,
                        estado: true,
                        fechaCreacion: true
                    },
                    orderBy: { fechaCreacion: 'desc' }
                }
            },
            orderBy: { fecha: 'desc' }
        });

        return ok(res, valoraciones.map(v => {
            const { planes, ...rest } = v;
            return { 
                ...rest, 
                plan: planes[0] || null,
                planId: planes[0]?.id || null // Added for explicit frontend detection
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
            ...rest 
        } = req.body;

        const vData = { 
            ...rest,
            pesoActual: rest.pesoActual ?? (peso ? parseFloat(peso) : undefined),
            deficitMusculo: rest.deficitMusculo ?? deficitMuscular,
            estatura: rest.estatura ?? (talla ? parseFloat(talla) : undefined)
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

        // Clonar plan activo previo si existe
        const planPrevio = await prisma.plan.findFirst({
            where: { pacienteId, estado: 'activo' },
            include: {
                menus: {
                    include: {
                        tiemposComida: {
                            include: { ingredientes: true }
                        }
                    }
                }
            },
            orderBy: { fechaCreacion: 'desc' }
        });

        if (planPrevio) {
            // Clonar Plan
            const nuevoPlan = await prisma.plan.create({
                data: {
                    pacienteId,
                    valoracionId: valoracion.id,
                    tipoPlan: planPrevio.tipoPlan,
                    calorias: planPrevio.calorias,
                    proteinasPct: planPrevio.proteinasPct,
                    carbohidratosPct: planPrevio.carbohidratosPct,
                    grasasPct: planPrevio.grasasPct,
                    proteinasKcal: planPrevio.proteinasKcal,
                    carbohidratosKcal: planPrevio.carbohidratosKcal,
                    grasasKcal: planPrevio.grasasKcal,
                    proteinasGr: planPrevio.proteinasGr,
                    carbohidratosGr: planPrevio.carbohidratosGr,
                    grasasGr: planPrevio.grasasGr,
                    proteinasGrKg: planPrevio.proteinasGrKg,
                    carbohidratosGrKg: planPrevio.carbohidratosGrKg,
                    grasasGrKg: planPrevio.grasasGrKg,
                    notasGenerales: planPrevio.notasGenerales,
                    estado: 'activo'
                }
            });

            // Clonar Menus
            for (const menu of planPrevio.menus) {
                const nuevoMenu = await prisma.planMenu.create({
                    data: {
                        planId: nuevoPlan.id,
                        nombre: menu.nombre,
                        orden: menu.orden
                    }
                });

                for (const tiempo of menu.tiemposComida) {
                    const nuevoTiempo = await prisma.planTiempoComida.create({
                        data: {
                            menuId: nuevoMenu.id,
                            nombre: tiempo.nombre,
                            orden: tiempo.orden,
                            notaPie: tiempo.notaPie
                        }
                    });

                    for (const ing of tiempo.ingredientes) {
                        await prisma.planIngrediente.create({
                            data: {
                                tiempoComidaId: nuevoTiempo.id,
                                descripcion: ing.descripcion,
                                cantidad: ing.cantidad,
                                unidad: ing.unidad,
                                eqCantidad: ing.eqCantidad,
                                eqGrupo: ing.eqGrupo,
                                nota: ing.nota,
                                orden: ing.orden
                            }
                        });
                    }
                }
            }
            
            // Archivar el plan previo ahora que se clonó para esta valoración
            await prisma.plan.update({
                where: { id: planPrevio.id },
                data: { estado: 'archivado' }
            });
        }

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
                temarioConsulta: true,
                revisiones: true,
                planes: { include: { menus: { include: { tiemposComida: { include: { ingredientes: true } } } } } }
            }
        });
        const { planes, ...rest } = valoracion;
        return ok(res, { ...rest, plan: planes[0] || null });
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
            ...rest 
        } = req.body;

        const vData = { ...rest };
        if (deficitMuscular) vData.deficitMusculo = deficitMuscular;
        if (talla) vData.estatura = talla;

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
