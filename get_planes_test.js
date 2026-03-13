import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log("Comprobando planes del paciente..");
    const p = await prisma.paciente.findFirst({
        where: { nombre: { contains: 'Gustavo' } }, // El paciente fue llamado Gustavo ayer
        include: { planes: true, valoraciones: true }
    });
    if (p) {
        console.log("Planes:", p.planes.map(pl => ({id: pl.id, valId: pl.valoracionId, estadoEnvio: pl.estadoEnvio, fecha: pl.fechaCreacion.toISOString()})));
        console.log("Vals con Plan?:", p.valoraciones.map(v => {
             const hasPlan = p.planes.find(pl => pl.valoracionId === v.id);
             return { id: v.id, date: v.fecha.toISOString(), hasPlan: !!hasPlan, estadoEnvioPlan: hasPlan?.estadoEnvio };
        }));
    } else {
        console.log("No encontrado Gustavo");
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
