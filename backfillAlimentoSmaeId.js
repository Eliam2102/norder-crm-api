// Backfill de datos legacy: para cada ingrediente de Platillo sin alimentoSmaeId,
// intenta resolverlo por nombre exacto contra el catálogo AlimentoSMAE.
// Idempotente (salta ingredientes que ya tienen alimentoSmaeId) y no destructivo
// (solo agrega el campo, nunca borra ni cambia otros valores).
// Uso: node backfillAlimentoSmaeId.js
import prisma from './src/lib/prisma.js';
import { normalizarNombre } from './src/utils/resolveIngredienteSmae.js';

async function main() {
    const catalogo = await prisma.alimentoSMAE.findMany();
    const byNombre = new Map();
    for (const a of catalogo) {
        const key = normalizarNombre(a.nombre);
        if (!byNombre.has(key)) byNombre.set(key, []);
        byNombre.get(key).push(a);
    }

    const platillos = await prisma.platillo.findMany();
    let actualizados = 0;

    for (const p of platillos) {
        let changed = false;
        const nuevosIngs = (p.ingredientes || []).map((ing) => {
            if (ing.alimentoSmaeId) return ing;
            const candidatos = byNombre.get(normalizarNombre(ing.descripcion)) || [];
            if (candidatos.length === 1) {
                changed = true;
                return { ...ing, alimentoSmaeId: candidatos[0].id };
            }
            if (candidatos.length > 1) {
                console.warn(`[AMBIGUO] Platillo "${p.nombre}" (${p.id}) ingrediente "${ing.descripcion}": ${candidatos.length} matches en catálogo.`);
            } else {
                console.warn(`[SIN MATCH] Platillo "${p.nombre}" (${p.id}) ingrediente "${ing.descripcion}": no existe en catálogo SMAE.`);
            }
            return ing;
        });
        if (changed) {
            await prisma.platillo.update({ where: { id: p.id }, data: { ingredientes: nuevosIngs } });
            actualizados++;
        }
    }

    console.log(`Backfill completo. Platillos actualizados: ${actualizados}/${platillos.length}`);
    await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
