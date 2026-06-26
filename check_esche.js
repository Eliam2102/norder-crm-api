import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Buscar valoraciones con esqueHidratacion
    const valWithEsque = await prisma.valoracion.findFirst({
        where: { esqueHidratacion: { not: null } },
        select: { id: true, esqueHidratacion: true, numeroValoracion: true, pacienteId: true }
    });
    console.log('Valoracion con esqueHidratacion:', JSON.stringify(valWithEsque, null, 2));

    const total = await prisma.valoracion.count({ where: { esqueHidratacion: { not: null } } });
    console.log('Total con esqueHidratacion:', total);
    
    // Mostrar las últimas 3 valoraciones con sus campos relevantes
    const latest = await prisma.valoracion.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { id: true, numeroValoracion: true, esqueHidratacion: true, notasLibres: true, createdAt: true }
    });
    console.log('Últimas 3 valoraciones:', JSON.stringify(latest, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
