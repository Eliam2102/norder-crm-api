import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const p = await prisma.paciente.findFirst({
        where: { id: 'de0be377-0c15-4795-bfc8-0d80db44234d' }, // Gustavo from the log
        include: { datosEjercicio: true }
    });
    console.log("Ejercicio obj:", p?.datosEjercicio?.objetivo);
}
main().catch(console.error).finally(() => prisma.$disconnect());
