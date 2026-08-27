import bcrypt from 'bcryptjs';
import prisma from './src/lib/prisma.js';

const run = async () => {
    const localAdminPassword = process.env.LOCAL_ADMIN_PASSWORD;
    if (!localAdminPassword || localAdminPassword.length < 10) {
        throw new Error('Define LOCAL_ADMIN_PASSWORD con al menos 10 caracteres antes de ejecutar el seed local.');
    }

    const passwordHash = await bcrypt.hash(localAdminPassword, 12);
    const admin = await prisma.user.upsert({
        where: { email: 'eyder@norder.mx' },
        update: {},
        create: {
            nombre: 'Eyder Méndez',
            email: 'eyder@norder.mx',
            passwordHash,
            rol: 'admin',
            activo: true,
        },
    });
    console.log('Admin CRM local creado:', admin.email);

    const unAnio = new Date();
    unAnio.setFullYear(unAnio.getFullYear() + 1);

    const paciente = await prisma.paciente.upsert({
        where: { telefono: '9993657830' },
        update: {
            nivelMembresia: 'premium',
            portalActivo: true,
            suscripcionInicio: new Date(),
            suscripcionFin: unAnio,
        },
        create: {
            nombre: 'Paciente',
            apellido: 'Demo',
            telefono: '9993657830',
            email: 'demo@norder.mx',
            fechaNacimiento: new Date('1995-05-15'),
            sexo: 'F',
            estatura: 165,
            peso: 62,
            nivelMembresia: 'premium',
            portalActivo: true,
            suscripcionInicio: new Date(),
            suscripcionFin: unAnio,
        },
    });
    console.log('Paciente portal:', paciente.telefono, '/ 1995-05-15', '(nivel:', paciente.nivelMembresia + ')');

    // ── Eliam Cauich: paciente con plan completo, para validar la UX real ──
    const eliam = await prisma.paciente.upsert({
        where: { telefono: '9991112233' },
        update: {
            nivelMembresia: 'premium',
            portalActivo: true,
            suscripcionInicio: new Date(),
            suscripcionFin: unAnio,
        },
        create: {
            nombre: 'Eliam',
            apellido: 'Cauich',
            telefono: '9991112233',
            email: 'eliam.cauich@norder.mx',
            fechaNacimiento: new Date('1998-03-22'),
            suscripcionInicio: new Date(),
            suscripcionFin: unAnio,
            sexo: 'M',
            estatura: 178,
            peso: 82,
            nivelMembresia: 'premium',
            portalActivo: true,
        },
    });

    // Borra planes previos de este paciente para que el seed sea idempotente
    await prisma.plan.deleteMany({ where: { pacienteId: eliam.id } });

    const TIEMPOS = [
        {
            nombre: 'DESAYUNO',
            bebida: 'Café negro o té sin azúcar',
            ingredientes: [
                { descripcion: 'Claras de huevo', cantidad: 4, unidad: 'pza', eqGrupo: 'AOA', eqCantidad: 2 },
                { descripcion: 'Huevo entero', cantidad: 1, unidad: 'pza', eqGrupo: 'AOA', eqCantidad: 1 },
                { descripcion: 'Tortilla de maíz', cantidad: 2, unidad: 'pza', eqGrupo: 'Cereal', eqCantidad: 2 },
                { descripcion: 'Aguacate', cantidad: 30, unidad: 'g', eqGrupo: 'Grasa', eqCantidad: 1 },
                { descripcion: 'Papaya', cantidad: 200, unidad: 'g', eqGrupo: 'Fruta', eqCantidad: 2 },
            ],
        },
        {
            nombre: 'COLACIÓN 1',
            ingredientes: [
                { descripcion: 'Yogur griego natural', cantidad: 150, unidad: 'g', eqGrupo: 'AOA', eqCantidad: 1 },
                { descripcion: 'Almendras', cantidad: 10, unidad: 'g', eqGrupo: 'Grasa', eqCantidad: 1 },
                { descripcion: 'Manzana', cantidad: 130, unidad: 'g', eqGrupo: 'Fruta', eqCantidad: 1 },
            ],
        },
        {
            nombre: 'COMIDA',
            bebida: 'Agua natural o agua de jamaica sin azúcar',
            ingredientes: [
                { descripcion: 'Pechuga de pollo a la plancha', cantidad: 150, unidad: 'g', eqGrupo: 'AOA', eqCantidad: 4 },
                { descripcion: 'Arroz integral cocido', cantidad: 130, unidad: 'g', eqGrupo: 'Cereal', eqCantidad: 3 },
                { descripcion: 'Frijol negro', cantidad: 90, unidad: 'g', eqGrupo: 'Leguminosa', eqCantidad: 1 },
                { descripcion: 'Ensalada verde mixta', cantidad: 150, unidad: 'g', eqGrupo: 'Verdura', eqCantidad: 2 },
                { descripcion: 'Aceite de oliva', cantidad: 10, unidad: 'ml', eqGrupo: 'Grasa', eqCantidad: 2 },
            ],
        },
        {
            nombre: 'COLACIÓN 2',
            ingredientes: [
                { descripcion: 'Jícama con limón y chile', cantidad: 200, unidad: 'g', eqGrupo: 'Verdura', eqCantidad: 1 },
                { descripcion: 'Nueces', cantidad: 10, unidad: 'g', eqGrupo: 'Grasa', eqCantidad: 1 },
            ],
        },
        {
            nombre: 'CENA',
            bebida: 'Té de manzanilla',
            ingredientes: [
                { descripcion: 'Salmón al horno', cantidad: 120, unidad: 'g', eqGrupo: 'AOA', eqCantidad: 3 },
                { descripcion: 'Verduras al vapor (brócoli, calabaza)', cantidad: 200, unidad: 'g', eqGrupo: 'Verdura', eqCantidad: 2 },
                { descripcion: 'Tortilla de maíz', cantidad: 1, unidad: 'pza', eqGrupo: 'Cereal', eqCantidad: 1 },
                { descripcion: 'Aguacate', cantidad: 30, unidad: 'g', eqGrupo: 'Grasa', eqCantidad: 1 },
            ],
        },
    ];

    const plan = await prisma.plan.create({
        data: {
            pacienteId: eliam.id,
            nombre: 'Plan Recomposición Corporal',
            tipoPlan: 'Recomposición corporal',
            calorias: 2400,
            proteinasPct: 30,
            carbohidratosPct: 40,
            grasasPct: 30,
            proteinasGr: 180,
            carbohidratosGr: 240,
            grasasGr: 80,
            notasGenerales: 'Prioriza hidratación (2.5-3L de agua al día) y respeta los horarios de comida cada 3 horas. Ajustamos porciones la próxima consulta según tu progreso de composición corporal.',
            proximaSesion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            estado: 'activo',
            estadoEnvio: 'enviado',
            menus: {
                create: [
                    {
                        nombre: 'Menú principal',
                        orden: 1,
                        tiemposComida: {
                            create: TIEMPOS.map((t, i) => ({
                                nombre: t.nombre,
                                orden: i + 1,
                                bebida: t.bebida ?? null,
                                ingredientes: {
                                    create: t.ingredientes.map((ing, j) => ({
                                        descripcion: ing.descripcion,
                                        cantidad: ing.cantidad,
                                        unidad: ing.unidad,
                                        eqCantidad: ing.eqCantidad,
                                        eqGrupo: ing.eqGrupo,
                                        orden: j + 1,
                                    })),
                                },
                            })),
                        },
                    },
                ],
            },
        },
    });

    console.log('Paciente portal:', eliam.telefono, '/ 1998-03-22', `(${eliam.nombre} ${eliam.apellido}, plan: ${plan.nombre})`);
};

run()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
