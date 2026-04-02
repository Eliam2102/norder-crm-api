import prisma from './src/lib/prisma.js';

async function main() {
    const citas = await prisma.cita.findMany({ where: { valoracionId: null } });
    console.log('Citas huerfanas:', citas.length);
    let ok = 0;
    for (const c of citas) {
        let val = await prisma.valoracion.findFirst({
            where: { pacienteId: c.pacienteId, createdAt: { lte: c.createdAt } },
            orderBy: { createdAt: 'desc' }
        });
        if (!val) {
            val = await prisma.valoracion.findFirst({
                where: { pacienteId: c.pacienteId },
                orderBy: { createdAt: 'asc' }
            });
        }
        if (!val) {
            console.log('Sin valoracion para paciente', c.pacienteId);
            continue;
        }
        await prisma.cita.update({ where: { id: c.id }, data: { valoracionId: val.id } });
        console.log('OK', c.id.slice(-8), String(c.fecha).split('T')[0], '->', val.id.slice(-8), String(val.fecha).split('T')[0]);
        ok++;
    }
    console.log('Done:', ok, 'citas actualizadas');
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });