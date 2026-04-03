/**
 * Seed de Platillos — Extraídos de menús del paciente (3 imágenes)
 * Ejecutar con: node prisma/seeds/platillos.seed.js
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Helper para construir ingrediente
const ing = (orden, descripcion, unidad, cantidad, eqGrupo, eqCantidad) => ({
    orden, descripcion, unidad, cantidad, eqGrupo, eqCantidad,
});

const platillos = [
    // ══════════════ DESAYUNO ══════════════
    {
        nombre: 'Toast con Cottage',
        categoria: 'DESAYUNO',
        ingredientes: [
            ing(1, '2 claras de huevo', 'PZ', 2, 'AOA Muy Bajo', 1),
            ing(2, 'queso cottage', 'GR', 100, 'AOA Bajo', 2),
            ing(3, 'huevo estrellado', 'PZ', 2, 'AOA Moderado', 2),
            ing(4, 'tortitas de arroz inflado', 'PZ', 4, 'Cereal s/grasa', 2),
            ing(5, 'aguacate', 'GR', 30, 'Grasa s/prot', 1),
            ing(6, 'vegetales al gusto', '-', 1, 'Verduras', 0),
            ing(7, '1 taza papaya', 'TAZA', 1, 'Frutas', 1),
        ],
    },
    {
        nombre: 'Toast de Claras',
        categoria: 'DESAYUNO',
        ingredientes: [
            ing(1, '4 claras + 100 gr queso cottage bajo en grasa', '-', 1, 'AOA Muy Bajo', 4),
            ing(2, 'huevo entero', 'PZ', 1, 'AOA Moderado', 1),
            ing(3, 'tortitas de arroz inflado', 'PZ', 4, 'Cereal s/grasa', 2),
            ing(4, 'aceite', 'CDITA', 1, 'Grasa s/prot', 1),
            ing(5, 'alfalfa', '-', 1, 'Verduras', 0),
        ],
    },
    {
        nombre: 'Toast de Huevo',
        categoria: 'DESAYUNO',
        ingredientes: [
            ing(1, 'huevos estrellados', 'PZ', 5, 'AOA Moderado', 5),
            ing(2, 'tortitas de arroz inflado', 'PZ', 4, 'Cereal s/grasa', 2),
            ing(3, 'aceite + 30 g aguacate', 'CDITA', 1, 'Grasa s/prot', 2),
            ing(4, 'vegetales al gusto', '-', 1, 'Verduras', 0),
            ing(5, '1 taza melón + 2 cdita miel', 'TAZA', 1, 'Frutas', 2),
        ],
    },
    {
        nombre: 'Sándwich de Pavo',
        categoria: 'DESAYUNO',
        ingredientes: [
            ing(1, 'pechuga de pavo Kirkland', 'GR', 120, 'AOA Muy Bajo', 4),
            ing(2, 'queso manchego', 'GR', 30, 'AOA Moderado', 1),
            ing(3, 'rebanadas de pan', 'PZ', 2, 'Cereal s/grasa', 2),
            ing(4, 'aguacate', 'GR', 30, 'Grasa s/prot', 1),
            ing(5, 'espinaca, tomate y zanahoria', '-', 1, 'Verduras', 0),
        ],
    },
    {
        nombre: 'Sándwich de Pollo',
        categoria: 'DESAYUNO',
        ingredientes: [
            ing(1, 'pechuga de pollo', 'GR', 90, 'AOA Muy Bajo', 3),
            ing(2, 'panela', 'GR', 80, 'AOA Bajo', 2),
            ing(3, 'rebanadas de pan', 'PZ', 2, 'Cereal s/grasa', 2),
            ing(4, 'aguacate', 'GR', 60, 'Grasa s/prot', 2),
            ing(5, 'germinado alfalfa y zanahoria rallada', '-', 1, 'Verduras', 0),
            ing(6, '1 taza sandía picada', 'TAZA', 1, 'Frutas', 1),
        ],
    },

    // ══════════════ ALMUERZO ══════════════
    {
        nombre: 'Pechuga a la Yucateca',
        categoria: 'ALMUERZO',
        ingredientes: [
            ing(1, 'pechuga de pollo marinada con achiote', 'GR', 150, 'AOA Muy Bajo', 5),
            ing(2, 'tortillas de maíz', 'GR', 60, 'Cereal s/grasa', 2),
            ing(3, 'aceite', 'CDITA', 1, 'Grasa s/prot', 1),
            ing(4, 'vegetales al gusto', '-', 1, 'Verduras', 0),
        ],
    },
    {
        nombre: 'Atún con Arroz',
        categoria: 'ALMUERZO',
        ingredientes: [
            ing(1, 'atún en cubos', 'GR', 180, 'AOA Muy Bajo', 6),
            ing(2, 'arroz blanco con ajonjolí negro', 'GR', 150, 'Cereal s/grasa', 3),
            ing(3, 'aceite', 'CDITA', 2, 'Grasa s/prot', 2),
            ing(4, 'pimientos, cebolla blanca, brócoli', '-', 1, 'Verduras', 0),
        ],
    },
    {
        nombre: 'Pechuga de Pollo',
        categoria: 'ALMUERZO',
        ingredientes: [
            ing(1, 'pechuga de pollo', 'GR', 180, 'AOA Muy Bajo', 6),
            ing(2, 'tortilla de maíz', 'GR', 90, 'Cereal s/grasa', 3),
            ing(3, 'aceite', 'CDITA', 2, 'Grasa s/prot', 2),
            ing(4, 'vegetales al gusto', '-', 1, 'Verduras', 0),
        ],
    },

    // ══════════════ PRE-ENTRENO ══════════════
    {
        nombre: 'Plátano con Miel',
        categoria: 'PRE-ENTRENO',
        ingredientes: [
            ing(1, '1 plátano + 2 cdita miel', 'PZ', 1, 'Frutas', 3),
        ],
    },

    // ══════════════ POST-ENTRENO ══════════════
    {
        nombre: 'Yogurt Griego con Nueces',
        categoria: 'POST-ENTRENO',
        ingredientes: [
            ing(1, 'yogurt griego Chobani zero sugar', 'GR', 210, 'AOA Muy Bajo', 3),
            ing(2, 'nueces en mitades', 'PZ', 12, 'Grasa c/prot', 2),
        ],
    },
    {
        nombre: 'Yogurt Griego con Almendras',
        categoria: 'POST-ENTRENO',
        ingredientes: [
            ing(1, 'yogurt griego Chobani zero sugar', 'GR', 210, 'AOA Muy Bajo', 3),
            ing(2, 'almendras', 'GR', 24, 'Grasa c/prot', 2),
        ],
    },

    // ══════════════ COLACIÓN ══════════════
    {
        nombre: 'Licuado Proteína con Avena',
        categoria: 'COLACIÓN',
        ingredientes: [
            ing(1, 'proteína en polvo con agua', 'SERV', 1, 'AOA Muy Bajo', 3),
            ing(2, 'avena', 'GR', 30, 'Cereal s/grasa', 1),
            ing(3, '2 dátiles', 'PZ', 2, 'Frutas', 1),
        ],
    },
    {
        nombre: 'Licuado Proteína con Plátano',
        categoria: 'COLACIÓN',
        ingredientes: [
            ing(1, 'proteína en polvo con agua', 'SERV', 1, 'AOA Muy Bajo', 3),
            ing(2, 'plátano', 'PZ', 1, 'Frutas', 2),
        ],
    },
    {
        nombre: 'Bowl de Avena',
        categoria: 'COLACIÓN',
        ingredientes: [
            ing(1, 'avena hidratada con agua y canela', 'GR', 60, 'Cereal s/grasa', 2),
            ing(2, 'crema de cacahuate Kirkland', 'CDITA', 2, 'Grasa c/prot', 1),
        ],
    },
    {
        nombre: 'Galletas con Turín',
        categoria: 'COLACIÓN',
        ingredientes: [
            ing(1, 'galletas María', 'PZ', 10, 'Cereal s/grasa', 2),
            ing(2, 'Turín zero azúcar', 'PZ', 1, 'Grasa c/prot', 1),
        ],
    },
    {
        nombre: 'Galletas con Almendras',
        categoria: 'COLACIÓN',
        ingredientes: [
            ing(1, 'galletas María', 'PZ', 15, 'Cereal s/grasa', 3),
            ing(2, 'almendras', 'PZ', 20, 'Grasa c/prot', 2),
        ],
    },
    {
        nombre: 'Bowl de Yogurt con Fruta',
        categoria: 'COLACIÓN',
        ingredientes: [
            ing(1, 'yogurt griego cero', 'GR', 140, 'AOA Muy Bajo', 2),
            ing(2, '1 manzana verde rebanada + mango', 'PZ', 1, 'Frutas', 3),
        ],
    },
    {
        nombre: 'Bowl de Yogurt con Fresas',
        categoria: 'COLACIÓN',
        ingredientes: [
            ing(1, 'yogurt griego cero', 'GR', 140, 'AOA Muy Bajo', 2),
            ing(2, '1 taza fresas + 1 plátano', 'TAZA', 1, 'Frutas', 3),
        ],
    },

    // ══════════════ CENA ══════════════
    {
        nombre: 'Tostada de Pollo',
        categoria: 'CENA',
        ingredientes: [
            ing(1, 'pechuga en sancochada', 'GR', 120, 'AOA Muy Bajo', 4),
            ing(2, 'paquetes salmas', 'PAQUETE', 2, 'Cereal s/grasa', 2),
            ing(3, 'aguacate', 'GR', 30, 'Grasa s/prot', 1),
            ing(4, 'salsa y cebolla morada', '-', 1, 'Verduras', 0),
        ],
    },
    {
        nombre: 'Salmón con Papa',
        categoria: 'CENA',
        ingredientes: [
            ing(1, 'salmón', 'GR', 160, 'AOA Muy Bajo', 4),
            ing(2, 'papa', 'GR', 200, 'Cereal s/grasa', 2),
            ing(3, 'aceite', 'CDITA', 1, 'Grasa s/prot', 1),
            ing(4, 'vegetales salteados', '-', 1, 'Verduras', 0),
        ],
    },
    {
        nombre: 'Salmón con Arroz',
        categoria: 'CENA',
        ingredientes: [
            ing(1, 'salmón', 'GR', 280, 'AOA Muy Bajo', 7),
            ing(2, 'arroz blanco', 'GR', 200, 'Cereal s/grasa', 4),
            ing(3, 'aceite', 'CDITA', 2, 'Grasa s/prot', 2),
            ing(4, 'vegetales salteados', '-', 1, 'Verduras', 0),
        ],
    },
    {
        nombre: 'Tacos de Pollo con Salsa',
        categoria: 'CENA',
        ingredientes: [
            ing(1, 'pechuga de pollo', 'GR', 180, 'AOA Muy Bajo', 6),
            ing(2, 'tortilla de maíz', 'GR', 60, 'Cereal s/grasa', 2),
            ing(3, 'aceite', 'CDITA', 1, 'Grasa s/prot', 1),
            ing(4, 'salsa, cilantro, cebolla, limón', '-', 1, 'Verduras', 0),
        ],
    },
    {
        nombre: 'Sashimi de Atún',
        categoria: 'CENA',
        ingredientes: [
            ing(1, 'atún en láminas', 'GR', 180, 'AOA Muy Bajo', 6),
            ing(2, 'paquetes salmas', 'PAQUETE', 2, 'Cereal s/grasa', 2),
            ing(3, 'aceite', 'CDITA', 1, 'Grasa s/prot', 1),
            ing(4, 'habanero, limón, soya y tajín', '-', 1, 'Verduras', 0),
        ],
    },
];

async function main() {
    console.log('🌱 Iniciando seed de platillos...\n');

    const deleted = await prisma.platillo.deleteMany({
        where: { nombre: 'Desayuno Sándwich' },
    });
    if (deleted.count > 0) {
        console.log(`🗑  Eliminado "Desayuno Sándwich" → reemplazado por Sándwich de Pavo / Sándwich de Pollo\n`);
    }

    let creados = 0;
    let actualizados = 0;

    for (const p of platillos) {
        const existing = await prisma.platillo.findFirst({ where: { nombre: p.nombre } });
        if (existing) {
            await prisma.platillo.update({
                where: { id: existing.id },
                data: { categoria: p.categoria, ingredientes: p.ingredientes },
            });
            actualizados++;
            console.log(`♻️  Actualizado : ${p.nombre} [${p.categoria}]`);
        } else {
            await prisma.platillo.create({ data: p });
            creados++;
            console.log(`✅  Creado      : ${p.nombre} [${p.categoria}]`);
        }
    }

    console.log(`\n📊 Resumen final:`);
    console.log(`   ✅ Creados     : ${creados}`);
    console.log(`   ♻️  Actualizados: ${actualizados}`);
    console.log(`   🗑  Eliminados  : ${deleted.count}`);
    console.log('\n🎉 Seed de platillos completado.');
}

main()
    .catch(e => { console.error('❌ Error en seed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
