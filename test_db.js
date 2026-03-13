import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const v = await prisma.valoracion.findFirst({
        include: { paciente: { include: { datosEjercicio: true } } }
    });
    console.log("Val obj:", Object.keys(v));
    console.log("Paciente Ejercicio:", Object.keys(v.paciente.datosEjercicio || {}));
}
main().catch(console.error).finally(() => prisma.$disconnect());
