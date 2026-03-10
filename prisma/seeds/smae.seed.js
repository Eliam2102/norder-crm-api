/**
 * SMAE Seed — NORdER CRM
 * Fuente: Lista de Intercambio de Alimentos (Tabla en PDF del consultorio)
 * 
 * CÓMO CORRER:
 *   node prisma/seeds/smae.seed.js
 *
 * Carga los alimentos base conocidos del SMAE que Eyder usa.
 * Los campos clave:
 *   - grupo: clave interna (verduras | frutas | cerealSinGr | leguminosas | etc.)
 *   - pesoGramos: peso en gramos de 1 porción/equivalente
 *   - cantidadPorcion + unidadPorcion: descripción casera (ej. "1" "pz" = 1 pieza)
 *   - porcionCasera: texto completo de la porción (ej. "1 pz (106g)")
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const alimentos = [
  // ─── VERDURAS (porción libre = 1 taza = ~100g) ──────────────────────────────
  { nombre: 'Brócoli',       grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Calabaza',      grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Cebolla',       grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Chayote',       grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Tomate',        grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Jícama',        grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Pepino',        grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Zanahoria',     grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Espárrago',     grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Champiñón',     grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Lechuga',       grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Espinaca',      grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Nopal',         grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Col / Repollo', grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'taza' },
  { nombre: 'Chile poblano', grupo: 'verduras', pesoGramos: 100, porcionCasera: 'libre', cantidadPorcion: null, unidadPorcion: 'pieza' },

  // ─── FRUTAS ──────────────────────────────────────────────────────────────────
  { nombre: 'Manzana',             grupo: 'frutas', pesoGramos: 106, porcionCasera: '1 pz (106g)',   cantidadPorcion: 1,    unidadPorcion: 'pz' },
  { nombre: 'Pera',                grupo: 'frutas', pesoGramos: 77,  porcionCasera: '½ pz (77g)',    cantidadPorcion: 0.5,  unidadPorcion: 'pz' },
  { nombre: 'Naranja / Mandarina', grupo: 'frutas', pesoGramos: 150, porcionCasera: '2 pz (150g)',   cantidadPorcion: 2,    unidadPorcion: 'pz' },
  { nombre: 'Papaya',              grupo: 'frutas', pesoGramos: 140, porcionCasera: '1 tz (140g)',   cantidadPorcion: 1,    unidadPorcion: 'tz' },
  { nombre: 'Fresa',               grupo: 'frutas', pesoGramos: 204, porcionCasera: '1 tz (204g)',   cantidadPorcion: 1,    unidadPorcion: 'tz' },
  { nombre: 'Piña',                grupo: 'frutas', pesoGramos: 124, porcionCasera: '¾ tz (124g)',   cantidadPorcion: 0.75, unidadPorcion: 'tz' },
  { nombre: 'Uva',                 grupo: 'frutas', pesoGramos: 86,  porcionCasera: '18 pz (86g)',   cantidadPorcion: 18,   unidadPorcion: 'pz' },
  { nombre: 'Toronja',             grupo: 'frutas', pesoGramos: 62,  porcionCasera: '1 pz (62g)',    cantidadPorcion: 1,    unidadPorcion: 'pz' },
  { nombre: 'Plátano',             grupo: 'frutas', pesoGramos: 50,  porcionCasera: '½ pz (50g)',    cantidadPorcion: 0.5,  unidadPorcion: 'pz' },
  { nombre: 'Mango',               grupo: 'frutas', pesoGramos: 145, porcionCasera: '½ pz (145g)',   cantidadPorcion: 0.5,  unidadPorcion: 'pz' },
  { nombre: 'Melón',               grupo: 'frutas', pesoGramos: 200, porcionCasera: '1 tz (200g)',   cantidadPorcion: 1,    unidadPorcion: 'tz' },
  { nombre: 'Sandía',              grupo: 'frutas', pesoGramos: 200, porcionCasera: '1 tz (200g)',   cantidadPorcion: 1,    unidadPorcion: 'tz' },
  { nombre: 'Kiwi',                grupo: 'frutas', pesoGramos: 90,  porcionCasera: '1 pz (90g)',    cantidadPorcion: 1,    unidadPorcion: 'pz' },
  { nombre: 'Durazno',             grupo: 'frutas', pesoGramos: 100, porcionCasera: '1 pz (100g)',   cantidadPorcion: 1,    unidadPorcion: 'pz' },
  { nombre: 'Guayaba',             grupo: 'frutas', pesoGramos: 90,  porcionCasera: '1 pz (90g)',    cantidadPorcion: 1,    unidadPorcion: 'pz' },

  // ─── CEREALES SIN GRASA ──────────────────────────────────────────────────────
  { nombre: 'Arroz cocido',               grupo: 'cerealSinGr', pesoGramos: 50,  porcionCasera: '¼ tz (50g)',   cantidadPorcion: 0.25, unidadPorcion: 'tz' },
  { nombre: 'Avena cruda',                grupo: 'cerealSinGr', pesoGramos: 30,  porcionCasera: '1/3 tz (30g)', cantidadPorcion: 0.33, unidadPorcion: 'tz' },
  { nombre: 'Cereal bajo en azúcar',      grupo: 'cerealSinGr', pesoGramos: 20,  porcionCasera: '1/3 tz (20g)', cantidadPorcion: 0.33, unidadPorcion: 'tz' },
  { nombre: 'Elote desgranado',           grupo: 'cerealSinGr', pesoGramos: 80,  porcionCasera: '½ tz (80g)',   cantidadPorcion: 0.5,  unidadPorcion: 'tz' },
  { nombre: 'Pasta cocida',               grupo: 'cerealSinGr', pesoGramos: 20,  porcionCasera: '1/3 tz (20g)', cantidadPorcion: 0.33, unidadPorcion: 'tz' },
  { nombre: 'Palomitas sin grasa',        grupo: 'cerealSinGr', pesoGramos: 18,  porcionCasera: '2½ tz (18g)',  cantidadPorcion: 2.5,  unidadPorcion: 'tz' },
  { nombre: 'Papa cocida',                grupo: 'cerealSinGr', pesoGramos: 100, porcionCasera: '½ pz (100g)',  cantidadPorcion: 0.5,  unidadPorcion: 'pz' },
  { nombre: 'Camote cocido',              grupo: 'cerealSinGr', pesoGramos: 49,  porcionCasera: '1/7 pz (49g)', cantidadPorcion: 49,   unidadPorcion: 'g' },
  { nombre: 'Tortilla de maíz',           grupo: 'cerealSinGr', pesoGramos: 30,  porcionCasera: '1 pz (30g)',   cantidadPorcion: 1,    unidadPorcion: 'pz' },
  { nombre: 'Tortilla de nopal',          grupo: 'cerealSinGr', pesoGramos: 30,  porcionCasera: '2 pz (30g)',   cantidadPorcion: 2,    unidadPorcion: 'pz' },
  { nombre: 'Pan integral tipo baguette', grupo: 'cerealSinGr', pesoGramos: 30,  porcionCasera: '1 rebanada',   cantidadPorcion: 1,    unidadPorcion: 'reb' },
  { nombre: 'Galleta María',              grupo: 'cerealSinGr', pesoGramos: 20,  porcionCasera: '4 pz (20g)',   cantidadPorcion: 4,    unidadPorcion: 'pz' },
  { nombre: 'Quinoa cocida',              grupo: 'cerealSinGr', pesoGramos: 45,  porcionCasera: '¼ tz (45g)',   cantidadPorcion: 0.25, unidadPorcion: 'tz' },

  // ─── LEGUMINOSAS ─────────────────────────────────────────────────────────────
  { nombre: 'Frijol negro cocido',      grupo: 'leguminosas', pesoGramos: 80, porcionCasera: '½ tz (80g)',    cantidadPorcion: 0.5, unidadPorcion: 'tz' },
  { nombre: 'Habas cocidas',            grupo: 'leguminosas', pesoGramos: 80, porcionCasera: '½ tz (80g)',    cantidadPorcion: 0.5, unidadPorcion: 'tz' },
  { nombre: 'Lenteja cocida',           grupo: 'leguminosas', pesoGramos: 80, porcionCasera: '½ tz (80g)',    cantidadPorcion: 0.5, unidadPorcion: 'tz' },
  { nombre: 'Garbanzo cocido (hummus)', grupo: 'leguminosas', pesoGramos: 80, porcionCasera: '½ tz (80g)',    cantidadPorcion: 0.5, unidadPorcion: 'tz' },
  { nombre: 'Alubias cocidas',          grupo: 'leguminosas', pesoGramos: 80, porcionCasera: '½ tz (80g)',    cantidadPorcion: 0.5, unidadPorcion: 'tz' },
  { nombre: 'Soya cocida',             grupo: 'leguminosas', pesoGramos: 57, porcionCasera: '1/3 tz (57g)',  cantidadPorcion: 0.33, unidadPorcion: 'tz' },
  { nombre: 'Frijol bayo cocido',      grupo: 'leguminosas', pesoGramos: 80, porcionCasera: '½ tz (80g)',    cantidadPorcion: 0.5, unidadPorcion: 'tz' },

  // ─── LECHE ───────────────────────────────────────────────────────────────────
  { nombre: 'Leche Vaca Light',                  grupo: 'lecheDesc', pesoGramos: 240, porcionCasera: '240 ml',       cantidadPorcion: 240, unidadPorcion: 'ml' },
  { nombre: 'Leche de Coco (light)',             grupo: 'lecheDesc', pesoGramos: 240, porcionCasera: '240 ml',       cantidadPorcion: 240, unidadPorcion: 'ml' },
  { nombre: 'Leche de Almendra sin azúcar',      grupo: 'lecheDesc', pesoGramos: 240, porcionCasera: '240 ml',       cantidadPorcion: 240, unidadPorcion: 'ml' },
  { nombre: 'Leche de Soya sin azúcar',          grupo: 'lecheDesc', pesoGramos: 240, porcionCasera: '240 ml',       cantidadPorcion: 240, unidadPorcion: 'ml' },
  { nombre: 'Yogurt Natural sin azúcar (Vitalinea)', grupo: 'lecheDesc', pesoGramos: 180, porcionCasera: '¾ tz (180g)', cantidadPorcion: 180, unidadPorcion: 'g' },

  // ─── AOA MUY BAJO EN GRASA ───────────────────────────────────────────────────
  { nombre: 'Pechuga de pollo',           grupo: 'aoaMuyBajo', pesoGramos: 30, porcionCasera: '30 g',         cantidadPorcion: 30, unidadPorcion: 'g' },
  { nombre: 'Clara de huevo',             grupo: 'aoaMuyBajo', pesoGramos: 60, porcionCasera: '2 pz (2oz)',   cantidadPorcion: 2,  unidadPorcion: 'pz' },
  { nombre: 'Camarón cocido',             grupo: 'aoaMuyBajo', pesoGramos: 35, porcionCasera: '5 pz (35g)',   cantidadPorcion: 5,  unidadPorcion: 'pz' },
  { nombre: 'Pulpo cocido',               grupo: 'aoaMuyBajo', pesoGramos: 30, porcionCasera: '30 g',         cantidadPorcion: 30, unidadPorcion: 'g' },
  { nombre: 'Carne molida de pollo',      grupo: 'aoaMuyBajo', pesoGramos: 32, porcionCasera: '32 g',         cantidadPorcion: 32, unidadPorcion: 'g' },
  { nombre: 'Atún en agua',               grupo: 'aoaMuyBajo', pesoGramos: 33, porcionCasera: '33 g',         cantidadPorcion: 33, unidadPorcion: 'g' },
  { nombre: 'Pescado filete (blanco)',     grupo: 'aoaMuyBajo', pesoGramos: 40, porcionCasera: '40 g',         cantidadPorcion: 40, unidadPorcion: 'g' },
  { nombre: 'Salmón',                     grupo: 'aoaMuyBajo', pesoGramos: 40, porcionCasera: '40 g',         cantidadPorcion: 40, unidadPorcion: 'g' },
  { nombre: 'Queso cottage light',        grupo: 'aoaMuyBajo', pesoGramos: 50, porcionCasera: '3 cda (50g)',  cantidadPorcion: 3,  unidadPorcion: 'cda' },
  { nombre: 'Bistec magro 90/10',         grupo: 'aoaMuyBajo', pesoGramos: 30, porcionCasera: '30 g',         cantidadPorcion: 30, unidadPorcion: 'g' },

  // ─── AOA BAJO EN GRASA ───────────────────────────────────────────────────────
  { nombre: 'Cerdo (lomo / pierna)',    grupo: 'aoaBajo', pesoGramos: 40, porcionCasera: '40 g',       cantidadPorcion: 40, unidadPorcion: 'g' },
  { nombre: 'Res (pulpa / milanesa)',   grupo: 'aoaBajo', pesoGramos: 30, porcionCasera: '30 g',       cantidadPorcion: 30, unidadPorcion: 'g' },
  { nombre: 'Jamón de pavo',            grupo: 'aoaBajo', pesoGramos: 42, porcionCasera: '2 reb (42g)',cantidadPorcion: 2,  unidadPorcion: 'reb' },
  { nombre: 'Pollo con piel',           grupo: 'aoaBajo', pesoGramos: 30, porcionCasera: '30 g',       cantidadPorcion: 30, unidadPorcion: 'g' },
  { nombre: 'Queso panela',             grupo: 'aoaBajo', pesoGramos: 40, porcionCasera: '40 g',       cantidadPorcion: 40, unidadPorcion: 'g' },
  { nombre: 'Pavo (pechuga)',           grupo: 'aoaBajo', pesoGramos: 45, porcionCasera: '45 g',       cantidadPorcion: 45, unidadPorcion: 'g' },
  { nombre: 'Queso Oaxaca light',       grupo: 'aoaBajo', pesoGramos: 30, porcionCasera: '30 g',       cantidadPorcion: 30, unidadPorcion: 'g' },
  { nombre: 'Queso ricotta',            grupo: 'aoaBajo', pesoGramos: 45, porcionCasera: '45 g',       cantidadPorcion: 45, unidadPorcion: 'g' },
  { nombre: 'Tofu',                     grupo: 'aoaBajo', pesoGramos: 40, porcionCasera: '40 g',       cantidadPorcion: 40, unidadPorcion: 'g' },

  // ─── AOA MODERADO ────────────────────────────────────────────────────────────
  { nombre: 'Huevo entero',             grupo: 'aoaModerado', pesoGramos: 55, porcionCasera: '1 pz',         cantidadPorcion: 1,  unidadPorcion: 'pz' },
  { nombre: 'Salchicha de cerdo',       grupo: 'aoaModerado', pesoGramos: 45, porcionCasera: '1 pz',         cantidadPorcion: 1,  unidadPorcion: 'pz' },
  { nombre: 'Longaniza',                grupo: 'aoaModerado', pesoGramos: 45, porcionCasera: '45 g',         cantidadPorcion: 45, unidadPorcion: 'g' },
  { nombre: 'Queso mozzarella',         grupo: 'aoaModerado', pesoGramos: 30, porcionCasera: '30 g',         cantidadPorcion: 30, unidadPorcion: 'g' },
  { nombre: 'Queso parmesano rallado',  grupo: 'aoaModerado', pesoGramos: 55, porcionCasera: '3½ cda (55g)', cantidadPorcion: 3.5,unidadPorcion: 'cda' },
  { nombre: 'Queso tipo Monterrey',     grupo: 'aoaModerado', pesoGramos: 28, porcionCasera: '28 g',         cantidadPorcion: 28, unidadPorcion: 'g' },
  { nombre: 'Queso americano',          grupo: 'aoaModerado', pesoGramos: 30, porcionCasera: '30 g',         cantidadPorcion: 30, unidadPorcion: 'g' },
  { nombre: 'Salami de pavo',           grupo: 'aoaModerado', pesoGramos: 42, porcionCasera: '42 g',         cantidadPorcion: 42, unidadPorcion: 'g' },

  // ─── GRASAS SIN PROTEÍNA ─────────────────────────────────────────────────────
  { nombre: 'Aceite de oliva',          grupo: 'grasaSinProt', pesoGramos: 5,  porcionCasera: '1 cdita (5g)', cantidadPorcion: 1,  unidadPorcion: 'cdita' },
  { nombre: 'Aceite de aguacate',       grupo: 'grasaSinProt', pesoGramos: 5,  porcionCasera: '1 cdita (5g)', cantidadPorcion: 1,  unidadPorcion: 'cdita' },
  { nombre: 'Aceite de girasol',        grupo: 'grasaSinProt', pesoGramos: 5,  porcionCasera: '1 cdita (5g)', cantidadPorcion: 1,  unidadPorcion: 'cdita' },
  { nombre: 'Aderezo en general',       grupo: 'grasaSinProt', pesoGramos: 5,  porcionCasera: '1 cdita (5g)', cantidadPorcion: 1,  unidadPorcion: 'cdita' },
  { nombre: 'Aguacate',                 grupo: 'grasaSinProt', pesoGramos: 30, porcionCasera: '⅓ pz (30g)',   cantidadPorcion: 0.33,unidadPorcion: 'pz' },
  { nombre: 'Coco rallado',             grupo: 'grasaSinProt', pesoGramos: 20, porcionCasera: '1½ cda (20g)', cantidadPorcion: 1.5,unidadPorcion: 'cda' },
  { nombre: 'Mantequilla',              grupo: 'grasaSinProt', pesoGramos: 10, porcionCasera: '1½ cda',       cantidadPorcion: 1.5,unidadPorcion: 'cda' },
  { nombre: 'Margarina',                grupo: 'grasaSinProt', pesoGramos: 10, porcionCasera: '1 cda',        cantidadPorcion: 1,  unidadPorcion: 'cda' },
  { nombre: 'Tocino de pavo',           grupo: 'grasaSinProt', pesoGramos: 8,  porcionCasera: '1 reb (8g)',   cantidadPorcion: 1,  unidadPorcion: 'reb' },
  { nombre: 'Mayonesa light',           grupo: 'grasaSinProt', pesoGramos: 10, porcionCasera: '2 cditas',     cantidadPorcion: 2,  unidadPorcion: 'cdita' },

  // ─── GRASAS CON PROTEÍNA ─────────────────────────────────────────────────────
  { nombre: 'Almendra',             grupo: 'grasaConProt', pesoGramos: 15, porcionCasera: '10 pz',        cantidadPorcion: 10,  unidadPorcion: 'pz' },
  { nombre: 'Nuez de Castilla',     grupo: 'grasaConProt', pesoGramos: 9,  porcionCasera: '3 pz',         cantidadPorcion: 3,   unidadPorcion: 'pz' },
  { nombre: 'Nuez de la India',     grupo: 'grasaConProt', pesoGramos: 14, porcionCasera: '7 pz',         cantidadPorcion: 7,   unidadPorcion: 'pz' },
  { nombre: 'Cacahuate',            grupo: 'grasaConProt', pesoGramos: 20, porcionCasera: '7 pz (20g)',   cantidadPorcion: 7,   unidadPorcion: 'pz' },
  { nombre: 'Pepita de calabaza',   grupo: 'grasaConProt', pesoGramos: 20, porcionCasera: '4 cditas (20g)',cantidadPorcion: 4,  unidadPorcion: 'cdita' },
  { nombre: 'Semilla de girasol',   grupo: 'grasaConProt', pesoGramos: 20, porcionCasera: '4 cditas (20g)',cantidadPorcion: 4,  unidadPorcion: 'cdita' },
  { nombre: 'Chía',                 grupo: 'grasaConProt', pesoGramos: 12, porcionCasera: '5 cda (12g)',  cantidadPorcion: 5,   unidadPorcion: 'cda' },
  { nombre: 'Crema de cacahuate',   grupo: 'grasaConProt', pesoGramos: 11, porcionCasera: '2 cditas (11g)',cantidadPorcion: 2,  unidadPorcion: 'cdita' },
  { nombre: 'Linaza',               grupo: 'grasaConProt', pesoGramos: 10, porcionCasera: '2 cdas (10g)', cantidadPorcion: 2,   unidadPorcion: 'cda' },
  { nombre: 'Piñón',                grupo: 'grasaConProt', pesoGramos: 15, porcionCasera: '1 cda (15g)',  cantidadPorcion: 1,   unidadPorcion: 'cda' },
];

async function main() {
  console.log('🌱 Iniciando seed de AlimentoSMAE...');
  console.log(`   Total de alimentos a insertar: ${alimentos.length}`);

  let insertados = 0;
  let omitidos = 0;

  for (const a of alimentos) {
    const exists = await prisma.alimentoSMAE.findFirst({
      where: { nombre: a.nombre, grupo: a.grupo }
    });

    if (exists) {
      omitidos++;
      continue;
    }

    await prisma.alimentoSMAE.create({
      data: {
        nombre: a.nombre,
        grupo: a.grupo,
        pesoGramos: a.pesoGramos,
        porcionCasera: a.porcionCasera || null,
        cantidadPorcion: a.cantidadPorcion || null,
        unidadPorcion: a.unidadPorcion || null,
        esPersonalizado: false
      }
    });
    insertados++;
  }

  console.log(`✅ Seed completado:`);
  console.log(`   Insertados:  ${insertados}`);
  console.log(`   Ya existían: ${omitidos}`);
  console.log(`   Total en BD: ${await prisma.alimentoSMAE.count()}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
