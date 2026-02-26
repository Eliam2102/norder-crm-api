import prisma from '../lib/prisma.js';
import { ok } from '../utils/response.js';

export const getAll = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        const valoraciones = await prisma.valoracion.findMany({
            where: { pacienteId },
            include: { 
                temarioConsulta: true,
                planes: { take: 1, orderBy: { fechaCreacion: 'desc' } }
            },
            orderBy: { fecha: 'desc' }
        });
        return ok(res, valoraciones.map(v => {
            const { planes, ...rest } = v;
            return { ...rest, plan: planes[0] || null };
        }));
    } catch (err) {
        next(err);
    }
};

export const create = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        
        // Medicion Numero logic stays in backend
        const ultimaMedicion = await prisma.valoracion.findFirst({
            where: { pacienteId },
            orderBy: { medicionNumero: 'desc' }
        });
        const medicionNumero = (ultimaMedicion?.medicionNumero || 0) + 1;

        const { 
            id,
            temario,
            temarioConsulta, 
            composicion, 
            pliegues, 
            perimetros, 
            diametros, 
            bioimpedancia, 
            bioquimicos, 
            signosVitales,
            suplementacion,
            medicionNumero: _m,
            createdAt,
            updatedAt,
            ...vData 
        } = req.body;

        // Map composicion
        if (composicion) {
            if (composicion.pctGrasa !== undefined) vData.pctGrasa2comp = composicion.pctGrasa;
            if (composicion.kgGrasa !== undefined) vData.kgGrasa2comp = composicion.kgGrasa;
            if (composicion.kgMagra !== undefined) vData.kgMasaMagra2comp = composicion.kgMagra;
        }

        // Map pliegues (Accents and names from frontend)
        if (pliegues) {
            const p = pliegues;
            vData.pliegeTricep = p['Trícep'] ?? p['Tricep'] ?? p['tricep'];
            vData.pliegeBicep = p['Bícep'] ?? p['Bicep'] ?? p['bicep'];
            vData.pliegueSubescapular = p['Subescapular'] ?? p['subescapular'];
            vData.pliegueCrestaIliaca = p['Cresta Ilíaca'] ?? p['Cresta Iliaca'] ?? p['cresta_iliaca'];
            vData.pliegueSupraespinal = p['Supraespinal'] ?? p['supraespinal'];
            vData.pliegueAbdominal = p['Abdominal'] ?? p['abdominal'];
            vData.pliegueMusloFrontal = p['Muslo'] ?? p['Muslo Frontal'] ?? p['muslo_frontal'];
            vData.plieguePantorrilla = p['Pantorrilla'] ?? p['pantorrilla'];
        }

        // Map perimetros
        if (perimetros) {
            const p = perimetros;
            vData.perimetroMuneca = p['Muñeca'] ?? p['Muneca'] ?? p['muneca'];
            vData.perimetroBrazoRelajado = p['Brazo'] ?? p['Brazo Relajado'] ?? p['brazo_relajado'];
            vData.perimetroBrazoContraido = p['Brazo Contraído'] ?? p['Brazo Contraido'] ?? p['brazo_contraido'];
            vData.perimetroPectoral = p['Pectoral'] ?? p['pectoral'];
            vData.perimetroCintura = p['Cintura'] ?? p['cintura'];
            vData.perimetroAbdomen = p['Abdomen'] ?? p['abdomen'];
            vData.perimetroCadera = p['Cadera'] ?? p['cadera'];
            vData.perimetroMusloFrontal = p['Muslo'] ?? p['Muslo Frontal'] ?? p['muslo_frontal'];
            vData.perimetroPantorrilla = p['Pantorrilla'] ?? p['pantorrilla'];
        }

        // Map diametros
        if (diametros) {
            const d = diametros;
            vData.diametroBiestiloideo = d['Biestiloideo'] ?? d['Biestiloideo (Muñeca)'] ?? d['biestiloideo'];
            vData.diametroBiepicondHumero = d['Biepicondíleo Húmero'] ?? d['Biepicondilo Humero'] ?? d['Biepicondilar Húmero'] ?? d['biepicondilo_humero'];
            vData.diametroBiepicondFemur = d['Biepicondíleo Fémur'] ?? d['Biepicondilo Femur'] ?? d['Biepicondilar Fémur'] ?? d['biepicondilo_femur'];
        }

        // Map bioimpedancia
        if (bioimpedancia) {
            const b = bioimpedancia;
            vData.bioimpedanciaPctGrasa = b['% Grasa'] ?? b['porcentaje_grasa'];
            vData.bioimpedanciaPctAgua = b['% Agua'] ?? b['porcentaje_agua'];
            vData.bioimpedanciaKgMusculo = b['Kg Músculo'] ?? b['Kg Musculo'] ?? b['kg_musculo'];
            vData.bioimpedanciaEnergia = b['Energía'] ?? b['Energia'] ?? b['energia'];
        }

        // Map bioquimicos
        if (bioquimicos) {
            const b = bioquimicos;
            if (b.Glu) vData.bioquimicoGlucosa = parseFloat(b.Glu);
            if (b.Tag || b.Tri) vData.bioquimicoTrigliceridos = parseFloat(b.Tag || b.Tri);
            if (b.Col) vData.bioquimicoColesterol = parseFloat(b.Col);
            if (b.Creat) vData.bioquimicoCreatinina = parseFloat(b.Creat);
            if (b.Urico) vData.bioquimicoAcidoUrico = parseFloat(b.Urico);
        }

        // Map signosVitales
        if (signosVitales) {
            if (signosVitales.fc) vData.frecuenciaCardiaca = parseInt(signosVitales.fc);
            if (signosVitales.pa) vData.presionArterial = signosVitales.pa;
        }

        // Map suplementacion
        if (suplementacion !== undefined) vData.suplementacionProductos = String(suplementacion);

        // Crear Valoración with all data mapped
        const valoracion = await prisma.valoracion.create({
            data: {
                ...vData,
                pacienteId,
                medicionNumero,
                fecha: req.body.fecha ? new Date(req.body.fecha) : new Date(),
                temarioConsulta: temarioConsulta ? {
                    create: temarioConsulta.map(t => ({
                        pacienteId,
                        tema: t.tema,
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
            temario,
            temarioConsulta, 
            composicion, 
            pliegues, 
            perimetros, 
            diametros, 
            bioimpedancia, 
            bioquimicos, 
            signosVitales,
            suplementacion,
            medicionNumero: _m,
            createdAt,
            updatedAt,
            ...vData 
        } = req.body;

        if (composicion) {
            vData.pctGrasa2comp = composicion.pctGrasa;
            vData.kgGrasa2comp = composicion.kgGrasa;
            vData.kgMasaMagra2comp = composicion.kgMagra;
        }

        if (pliegues) {
            vData.pliegeTricep = pliegues['Trícep'] || pliegues['Tricep'];
            vData.pliegeBicep = pliegues['Bícep'] || pliegues['Bicep'];
            vData.pliegueSubescapular = pliegues['Subescapular'];
            vData.pliegueCrestaIliaca = pliegues['Cresta Ilíaca'] || pliegues['Cresta Iliaca'];
            vData.pliegueSupraespinal = pliegues['Supraespinal'];
            vData.pliegueAbdominal = pliegues['Abdominal'];
            vData.pliegueMusloFrontal = pliegues['Muslo'] || pliegues['Muslo Frontal'];
            vData.plieguePantorrilla = pliegues['Pantorrilla'];
        }

        if (perimetros) {
            vData.perimetroMuneca = perimetros['Muñeca'] || perimetros['Muneca'];
            vData.perimetroBrazoRelajado = perimetros['Brazo'] || perimetros['Brazo Relajado'];
            vData.perimetroBrazoContraido = perimetros['Brazo Contraído'] || perimetros['Brazo Contraido'];
            vData.perimetroCintura = perimetros['Cintura'];
            vData.perimetroAbdomen = perimetros['Abdomen'];
            vData.perimetroCadera = perimetros['Cadera'];
            vData.perimetroMusloFrontal = perimetros['Muslo'] || perimetros['Muslo Frontal'];
            vData.perimetroPantorrilla = perimetros['Pantorrilla'];
        }

        if (diametros) {
            vData.diametroBiestiloideo = diametros['Biestiloideo'];
            vData.diametroBiepicondHumero = diametros['Biepicondíleo Húmero'] || diametros['Biepicondilo Humero'];
            vData.diametroBiepicondFemur = diametros['Biepicondíleo Fémur'] || diametros['Biepicondilo Femur'];
        }

        if (bioimpedancia) {
            vData.bioimpedanciaPctGrasa = bioimpedancia['% Grasa'];
            vData.bioimpedanciaPctAgua = bioimpedancia['% Agua'];
            vData.bioimpedanciaKgMusculo = bioimpedancia['Kg Músculo'] || bioimpedancia['Kg Musculo'];
            vData.bioimpedanciaEnergia = bioimpedancia['Energía'] || bioimpedancia['Energia'];
        }

        if (bioquimicos) {
            if (bioquimicos.Glu) vData.bioquimicoGlucosa = parseFloat(bioquimicos.Glu);
            if (bioquimicos.Tri) vData.bioquimicoTrigliceridos = parseFloat(bioquimicos.Tri);
            if (bioquimicos.Col) vData.bioquimicoColesterol = parseFloat(bioquimicos.Col);
        }

        if (signosVitales) {
            if (signosVitales.fc && signosVitales.fc !== "") vData.frecuenciaCardiaca = parseInt(signosVitales.fc);
            if (signosVitales.pa) vData.presionArterial = signosVitales.pa;
        }

        if (suplementacion) vData.suplementacionProductos = suplementacion;

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
