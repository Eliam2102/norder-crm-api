import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const p = await prisma.paciente.findFirst({ where: { nombre: { contains: 'Eliam' } } });
    const vals = await prisma.valoracion.findMany({ where: { pacienteId: p.id } });
    console.log("Val length", vals.length);
    vals.forEach(v => console.log(v.fecha, v.pesoActual));
}

main().catch(console.error).finally(() => prisma.$disconnect());
