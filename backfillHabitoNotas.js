import prisma from './src/lib/prisma.js';

// Combina los campos legacy ayer/usualmente en notas, igual que el frontend (src/lib/recall24.ts::legacyNotas).
// No borra ayer/usualmente. Solo llena notas donde aún esté vacío.
const rows = await prisma.habitoAlimentario.findMany({
  where: { notas: null },
  select: { id: true, ayer: true, usualmente: true },
});

console.log(`Filas a backfillear: ${rows.length}`);

let updated = 0;
for (const row of rows) {
  const notas = [row.ayer, row.usualmente].filter(Boolean).join(' / ');
  if (!notas) continue;
  await prisma.habitoAlimentario.update({
    where: { id: row.id },
    data: { notas },
  });
  updated++;
}

console.log(`Filas actualizadas con notas: ${updated}`);
await prisma.$disconnect();
