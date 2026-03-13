import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log("Comprobando paciente Gustavo..");
    const p = await prisma.paciente.findFirst({
        where: { nombre: { contains: 'Gustavo' } },
        include: { 
            planes: { orderBy: { fechaCreacion: 'desc' } }, 
            valoraciones: { 
                include: { 
                    planes: { take: 1, orderBy: { fechaCreacion: 'desc' } } 
                } 
            } 
        }
    });
    if (p) {
        console.log("V.Planes[0] de sus vals:");
        p.valoraciones.forEach(v => {
            console.log(`Val ${v.id} -> Planes asociados explícitamente:`, v.planes.map(pl=>pl.id));
            const pAssoc = p.planes.find(pl => pl.valoracionId === v.id);
            console.log(`Val ${v.id} -> Plan buscado globalmente:`, pAssoc?.id);
        });
    } else {
        console.log("No encontrado Gustavo");
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
