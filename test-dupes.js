const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const list = await prisma.paciente.findMany({ select: { id: true, nombre: true, telefono: true }});
    console.log("Total pacientes:", list.length);
    const byTel = {};
    const dupes = [];
    list.forEach(p => {
        if (!p.telefono) return;
        const net = p.telefono.replace(/\\D/g, '').slice(-10);
        if (byTel[net]) dupes.push({ tel: p.telefono, net, id1: byTel[net].id, n1: byTel[net].nombre, id2: p.id, n2: p.nombre });
        else byTel[net] = p;
    });
    console.log("Duplicados encontrados:", dupes);
}
main().catch(console.error).finally(()=>prisma.$disconnect());
