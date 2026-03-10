/**
 * Seed SMAE Completo — ~290 alimentos del Sistema Mexicano de Alimentos Equivalentes
 * Ejecutar con: node prisma/seed-smae.js
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const alimentos = [

// ══════════════ VERDURAS (0 kcal/eq) ══════════════
{ nombre:"Acelgas", grupo:"verduras", pesoGramos:240, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 tazas crudas" },
{ nombre:"Apio", grupo:"verduras", pesoGramos:240, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 ramas grandes" },
{ nombre:"Berros", grupo:"verduras", pesoGramos:240, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 tazas" },
{ nombre:"Brócoli", grupo:"verduras", pesoGramos:200, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 tazas cocido" },
{ nombre:"Cebolla", grupo:"verduras", pesoGramos:150, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Chile poblano", grupo:"verduras", pesoGramos:150, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Coliflor", grupo:"verduras", pesoGramos:200, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 tazas crudas" },
{ nombre:"Ejotes", grupo:"verduras", pesoGramos:200, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 tazas" },
{ nombre:"Espárragos", grupo:"verduras", pesoGramos:200, cantidadPorcion:10, unidadPorcion:"pieza", porcionCasera:"10 piezas medianas" },
{ nombre:"Espinacas", grupo:"verduras", pesoGramos:240, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 tazas crudas" },
{ nombre:"Hongos/Champiñones", grupo:"verduras", pesoGramos:200, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 tazas" },
{ nombre:"Jícama", grupo:"verduras", pesoGramos:200, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza en cubos" },
{ nombre:"Jitomate", grupo:"verduras", pesoGramos:200, cantidadPorcion:2, unidadPorcion:"pieza", porcionCasera:"2 piezas medianas" },
{ nombre:"Lechuga", grupo:"verduras", pesoGramos:290, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 tazas picada" },
{ nombre:"Nopal", grupo:"verduras", pesoGramos:200, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 tazas cocido" },
{ nombre:"Pepino", grupo:"verduras", pesoGramos:300, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 tazas en rodajas" },
{ nombre:"Pimiento morrón", grupo:"verduras", pesoGramos:150, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Rábano", grupo:"verduras", pesoGramos:200, cantidadPorcion:10, unidadPorcion:"pieza", porcionCasera:"10 piezas" },
{ nombre:"Tomate verde (tomatillo)", grupo:"verduras", pesoGramos:200, cantidadPorcion:4, unidadPorcion:"pieza", porcionCasera:"4 piezas medianas" },
{ nombre:"Verdolagas", grupo:"verduras", pesoGramos:240, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 tazas" },
{ nombre:"Zanahoria", grupo:"verduras", pesoGramos:100, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Alcachofa", grupo:"verduras", pesoGramos:120, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Betabel", grupo:"verduras", pesoGramos:100, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza cocido" },
{ nombre:"Calabacita", grupo:"verduras", pesoGramos:200, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza cocida" },
{ nombre:"Chayote", grupo:"verduras", pesoGramos:200, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza chica" },
{ nombre:"Col (repollo)", grupo:"verduras", pesoGramos:200, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 tazas rallada" },
{ nombre:"Flor de calabaza", grupo:"verduras", pesoGramos:100, cantidadPorcion:10, unidadPorcion:"pieza", porcionCasera:"10 flores" },
{ nombre:"Nabo", grupo:"verduras", pesoGramos:200, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza cocido" },
{ nombre:"Poro (puerro)", grupo:"verduras", pesoGramos:150, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza picado" },
{ nombre:"Quelites", grupo:"verduras", pesoGramos:200, cantidadPorcion:2, unidadPorcion:"taza", porcionCasera:"2 tazas" },

// ══════════════ FRUTAS (60 kcal/eq) ══════════════
{ nombre:"Capulín", grupo:"frutas", pesoGramos:90, cantidadPorcion:20, unidadPorcion:"pieza", porcionCasera:"20 piezas" },
{ nombre:"Cereza", grupo:"frutas", pesoGramos:90, cantidadPorcion:12, unidadPorcion:"pieza", porcionCasera:"12 piezas" },
{ nombre:"Ciruela", grupo:"frutas", pesoGramos:90, cantidadPorcion:2, unidadPorcion:"pieza", porcionCasera:"2 piezas medianas" },
{ nombre:"Chabacano/Damasco", grupo:"frutas", pesoGramos:90, cantidadPorcion:3, unidadPorcion:"pieza", porcionCasera:"3 piezas" },
{ nombre:"Durazno", grupo:"frutas", pesoGramos:130, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Frambuesa", grupo:"frutas", pesoGramos:120, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza" },
{ nombre:"Fresa", grupo:"frutas", pesoGramos:140, cantidadPorcion:8, unidadPorcion:"pieza", porcionCasera:"8 fresas medianas" },
{ nombre:"Granada roja", grupo:"frutas", pesoGramos:80, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ pieza" },
{ nombre:"Guanábana", grupo:"frutas", pesoGramos:80, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Guayaba", grupo:"frutas", pesoGramos:90, cantidadPorcion:2, unidadPorcion:"pieza", porcionCasera:"2 piezas medianas" },
{ nombre:"Higo", grupo:"frutas", pesoGramos:80, cantidadPorcion:2, unidadPorcion:"pieza", porcionCasera:"2 piezas medianas" },
{ nombre:"Jícama (fruta)", grupo:"frutas", pesoGramos:200, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza en cubos" },
{ nombre:"Kiwi", grupo:"frutas", pesoGramos:110, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza grande" },
{ nombre:"Lima", grupo:"frutas", pesoGramos:150, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Limón (zumo)", grupo:"frutas", pesoGramos:100, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza de jugo" },
{ nombre:"Mamey", grupo:"frutas", pesoGramos:80, cantidadPorcion:1, unidadPorcion:"rebanada", porcionCasera:"1 rebanada mediana" },
{ nombre:"Mandarina", grupo:"frutas", pesoGramos:120, cantidadPorcion:2, unidadPorcion:"pieza", porcionCasera:"2 piezas medianas" },
{ nombre:"Mango Manila", grupo:"frutas", pesoGramos:100, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ pieza" },
{ nombre:"Mango Petacón", grupo:"frutas", pesoGramos:100, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ pieza" },
{ nombre:"Manzana", grupo:"frutas", pesoGramos:130, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Melón cantaloupe", grupo:"frutas", pesoGramos:200, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza en cubos" },
{ nombre:"Membrillo", grupo:"frutas", pesoGramos:130, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Naranja", grupo:"frutas", pesoGramos:150, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Nectarina", grupo:"frutas", pesoGramos:130, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Papaya", grupo:"frutas", pesoGramos:190, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza en cubos" },
{ nombre:"Pera", grupo:"frutas", pesoGramos:130, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Piña", grupo:"frutas", pesoGramos:130, cantidadPorcion:1, unidadPorcion:"rebanada", porcionCasera:"1 rebanada mediana" },
{ nombre:"Pitaya", grupo:"frutas", pesoGramos:100, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza" },
{ nombre:"Plátano dominico", grupo:"frutas", pesoGramos:60, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza chica" },
{ nombre:"Plátano macho cocido", grupo:"frutas", pesoGramos:50, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Plátano tabasco", grupo:"frutas", pesoGramos:75, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza" },
{ nombre:"Sandía", grupo:"frutas", pesoGramos:300, cantidadPorcion:1, unidadPorcion:"rebanada", porcionCasera:"1 rebanada" },
{ nombre:"Tamarindo", grupo:"frutas", pesoGramos:30, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza" },
{ nombre:"Toronja", grupo:"frutas", pesoGramos:200, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ pieza" },
{ nombre:"Tuna", grupo:"frutas", pesoGramos:120, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Uva", grupo:"frutas", pesoGramos:90, cantidadPorcion:17, unidadPorcion:"pieza", porcionCasera:"17 uvas" },
{ nombre:"Zapote negro", grupo:"frutas", pesoGramos:80, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ pieza" },

// ══════════════ CEREALES SIN GRASA (70 kcal/eq) ══════════════
{ nombre:"Arroz blanco cocido", grupo:"cerealSinGr", pesoGramos:70, cantidadPorcion:0.25, unidadPorcion:"taza", porcionCasera:"¼ taza" },
{ nombre:"Arroz integral cocido", grupo:"cerealSinGr", pesoGramos:70, cantidadPorcion:0.25, unidadPorcion:"taza", porcionCasera:"¼ taza" },
{ nombre:"Avena cocida", grupo:"cerealSinGr", pesoGramos:120, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Avena cruda", grupo:"cerealSinGr", pesoGramos:20, cantidadPorcion:3, unidadPorcion:"cucharada", porcionCasera:"3 cucharadas" },
{ nombre:"Bolillo (sin migajón)", grupo:"cerealSinGr", pesoGramos:25, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ bolillo" },
{ nombre:"Camote amarillo cocido", grupo:"cerealSinGr", pesoGramos:80, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ pieza" },
{ nombre:"Cebada cocida", grupo:"cerealSinGr", pesoGramos:70, cantidadPorcion:0.25, unidadPorcion:"taza", porcionCasera:"¼ taza" },
{ nombre:"Cereal de caja (sin azúcar)", grupo:"cerealSinGr", pesoGramos:20, cantidadPorcion:0.75, unidadPorcion:"taza", porcionCasera:"¾ taza" },
{ nombre:"Elote desgranado", grupo:"cerealSinGr", pesoGramos:50, cantidadPorcion:0.25, unidadPorcion:"taza", porcionCasera:"¼ taza" },
{ nombre:"Elote en mazorca", grupo:"cerealSinGr", pesoGramos:50, cantidadPorcion:0.5, unidadPorcion:"mazorca", porcionCasera:"½ mazorca" },
{ nombre:"Fideos cocidos", grupo:"cerealSinGr", pesoGramos:60, cantidadPorcion:0.25, unidadPorcion:"taza", porcionCasera:"¼ taza" },
{ nombre:"Galleta Marías", grupo:"cerealSinGr", pesoGramos:20, cantidadPorcion:3, unidadPorcion:"pieza", porcionCasera:"3 piezas" },
{ nombre:"Harina de maíz (masa)", grupo:"cerealSinGr", pesoGramos:20, cantidadPorcion:2, unidadPorcion:"cucharada", porcionCasera:"2 cucharadas" },
{ nombre:"Maicena", grupo:"cerealSinGr", pesoGramos:10, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },
{ nombre:"Maíz palomero (palomitas sin grasa)", grupo:"cerealSinGr", pesoGramos:15, cantidadPorcion:3, unidadPorcion:"taza", porcionCasera:"3 tazas" },
{ nombre:"Malanga cocida", grupo:"cerealSinGr", pesoGramos:80, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ pieza" },
{ nombre:"Pan de caja integral", grupo:"cerealSinGr", pesoGramos:25, cantidadPorcion:1, unidadPorcion:"rebanada", porcionCasera:"1 rebanada" },
{ nombre:"Pan de caja blanco", grupo:"cerealSinGr", pesoGramos:25, cantidadPorcion:1, unidadPorcion:"rebanada", porcionCasera:"1 rebanada" },
{ nombre:"Papa cocida con cáscara", grupo:"cerealSinGr", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza chica" },
{ nombre:"Pasta cocida (espagueti)", grupo:"cerealSinGr", pesoGramos:60, cantidadPorcion:0.25, unidadPorcion:"taza", porcionCasera:"¼ taza" },
{ nombre:"Pinole", grupo:"cerealSinGr", pesoGramos:20, cantidadPorcion:2, unidadPorcion:"cucharada", porcionCasera:"2 cucharadas" },
{ nombre:"Quinoa cocida", grupo:"cerealSinGr", pesoGramos:70, cantidadPorcion:0.25, unidadPorcion:"taza", porcionCasera:"¼ taza" },
{ nombre:"Sopa de pasta seca", grupo:"cerealSinGr", pesoGramos:20, cantidadPorcion:0.25, unidadPorcion:"taza", porcionCasera:"¼ taza seca" },
{ nombre:"Tamal (solo masa)", grupo:"cerealSinGr", pesoGramos:45, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza chica s/relleno" },
{ nombre:"Tortilla de maíz", grupo:"cerealSinGr", pesoGramos:30, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 tortilla" },
{ nombre:"Tortilla de trigo chica", grupo:"cerealSinGr", pesoGramos:30, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 tortilla 6\"" },
{ nombre:"Yuca cocida", grupo:"cerealSinGr", pesoGramos:60, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },

// ══════════════ CEREALES CON GRASA (115 kcal/eq) ══════════════
{ nombre:"Croissant", grupo:"cerealConGr", pesoGramos:20, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ pieza pequeña" },
{ nombre:"Dona", grupo:"cerealConGr", pesoGramos:25, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ pieza chica" },
{ nombre:"Galleta con mantequilla", grupo:"cerealConGr", pesoGramos:20, cantidadPorcion:2, unidadPorcion:"pieza", porcionCasera:"2 piezas" },
{ nombre:"Galleta salada tipo Ritz", grupo:"cerealConGr", pesoGramos:20, cantidadPorcion:6, unidadPorcion:"pieza", porcionCasera:"6 piezas" },
{ nombre:"Granola", grupo:"cerealConGr", pesoGramos:30, cantidadPorcion:0.25, unidadPorcion:"taza", porcionCasera:"¼ taza" },
{ nombre:"Maíz palomero con mantequilla", grupo:"cerealConGr", pesoGramos:30, cantidadPorcion:3, unidadPorcion:"taza", porcionCasera:"3 tazas" },
{ nombre:"Muffin inglés", grupo:"cerealConGr", pesoGramos:35, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ pieza" },
{ nombre:"Pan dulce (concha)", grupo:"cerealConGr", pesoGramos:35, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ pieza" },
{ nombre:"Papa frita (chips)", grupo:"cerealConGr", pesoGramos:15, cantidadPorcion:15, unidadPorcion:"pieza", porcionCasera:"15 chips" },
{ nombre:"Tostadas de maíz horneadas", grupo:"cerealConGr", pesoGramos:22, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza" },
{ nombre:"Waffles", grupo:"cerealConGr", pesoGramos:35, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza chica" },
{ nombre:"Churro", grupo:"cerealConGr", pesoGramos:25, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza" },
{ nombre:"Hot cake", grupo:"cerealConGr", pesoGramos:35, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Pan de dulce (cuernito)", grupo:"cerealConGr", pesoGramos:30, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ pieza" },

// ══════════════ LEGUMINOSAS (120 kcal/eq) ══════════════
{ nombre:"Alubias cocidas", grupo:"leguminosas", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Frijoles negros cocidos", grupo:"leguminosas", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Frijoles pintos cocidos", grupo:"leguminosas", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Frijoles bayos cocidos", grupo:"leguminosas", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Garbanzo cocido", grupo:"leguminosas", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Habas secas cocidas", grupo:"leguminosas", pesoGramos:80, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Lenteja cocida", grupo:"leguminosas", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Soya cocida", grupo:"leguminosas", pesoGramos:80, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Frijoles refritos (sin grasa)", grupo:"leguminosas", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Edamame cocido", grupo:"leguminosas", pesoGramos:80, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Alubia negra", grupo:"leguminosas", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },

// ══════════════ AOA MUY BAJO EN GRASA (40 kcal/eq) ══════════════
{ nombre:"Atún en agua (drenado)", grupo:"aoaMuyBajo", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"lata", porcionCasera:"½ lata pequeña", notas:"Peso neto drenado" },
{ nombre:"Calamar cocido", grupo:"aoaMuyBajo", pesoGramos:100, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Camarón cocido", grupo:"aoaMuyBajo", pesoGramos:120, cantidadPorcion:6, unidadPorcion:"pieza", porcionCasera:"6 camarones grandes" },
{ nombre:"Cangrejo cocido", grupo:"aoaMuyBajo", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza desmenuzado" },
{ nombre:"Clara de huevo", grupo:"aoaMuyBajo", pesoGramos:100, cantidadPorcion:3, unidadPorcion:"pieza", porcionCasera:"3 claras" },
{ nombre:"Lenguado cocido", grupo:"aoaMuyBajo", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"filete", porcionCasera:"1 filete chico" },
{ nombre:"Mejillón cocido", grupo:"aoaMuyBajo", pesoGramos:90, cantidadPorcion:6, unidadPorcion:"pieza", porcionCasera:"6 piezas" },
{ nombre:"Ostión cocido", grupo:"aoaMuyBajo", pesoGramos:90, cantidadPorcion:6, unidadPorcion:"pieza", porcionCasera:"6 piezas medianas" },
{ nombre:"Pechuga de pavo cocida", grupo:"aoaMuyBajo", pesoGramos:90, cantidadPorcion:3, unidadPorcion:"rebanada", porcionCasera:"3 rebanadas", notas:"Sin piel" },
{ nombre:"Pechuga de pollo cocida", grupo:"aoaMuyBajo", pesoGramos:120, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana", notas:"Sin piel, horneada/cocida" },
{ nombre:"Pulpo cocido", grupo:"aoaMuyBajo", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Queso cottage sin grasa", grupo:"aoaMuyBajo", pesoGramos:120, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Surimi (imitación de cangrejo)", grupo:"aoaMuyBajo", pesoGramos:80, cantidadPorcion:2, unidadPorcion:"pieza", porcionCasera:"2 piezas" },

// ══════════════ AOA BAJO EN GRASA (55 kcal/eq) ══════════════
{ nombre:"Bacalao cocido", grupo:"aoaBajo", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"trozo", porcionCasera:"1 trozo mediano" },
{ nombre:"Huevo entero", grupo:"aoaBajo", pesoGramos:50, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza mediana" },
{ nombre:"Jamón de pavo bajo en grasa", grupo:"aoaBajo", pesoGramos:45, cantidadPorcion:2, unidadPorcion:"rebanada", porcionCasera:"2 rebanadas" },
{ nombre:"Mojarra cocida", grupo:"aoaBajo", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 trozo mediano" },
{ nombre:"Muslo de pollo sin piel cocido", grupo:"aoaBajo", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza", notas:"Sin piel" },
{ nombre:"Queso cottage bajo en grasa", grupo:"aoaBajo", pesoGramos:100, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Salmón ahumado", grupo:"aoaBajo", pesoGramos:45, cantidadPorcion:3, unidadPorcion:"rebanada", porcionCasera:"3 rebanadas" },
{ nombre:"Sardina en agua", grupo:"aoaBajo", pesoGramos:90, cantidadPorcion:3, unidadPorcion:"pieza", porcionCasera:"3 piezas medianas", notas:"Drenada" },
{ nombre:"Tilapia cocida", grupo:"aoaBajo", pesoGramos:100, cantidadPorcion:1, unidadPorcion:"filete", porcionCasera:"1 filete chico" },
{ nombre:"Trucha cocida", grupo:"aoaBajo", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"trozo", porcionCasera:"1 trozo mediano" },
{ nombre:"Queso requesón", grupo:"aoaBajo", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },

// ══════════════ AOA MODERADO EN GRASA (75 kcal/eq) ══════════════
{ nombre:"Carne de res magra cocida", grupo:"aoaModerado", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"trozo", porcionCasera:"1 trozo bistec" },
{ nombre:"Costilla de cerdo magra", grupo:"aoaModerado", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza chica" },
{ nombre:"Jamón de pierna", grupo:"aoaModerado", pesoGramos:45, cantidadPorcion:2, unidadPorcion:"rebanada", porcionCasera:"2 rebanadas" },
{ nombre:"Lomo de cerdo cocido", grupo:"aoaModerado", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"trozo", porcionCasera:"1 trozo mediano" },
{ nombre:"Queso panela", grupo:"aoaModerado", pesoGramos:45, cantidadPorcion:1, unidadPorcion:"rebanada", porcionCasera:"1 rebanada gruesa" },
{ nombre:"Queso ricotta", grupo:"aoaModerado", pesoGramos:60, cantidadPorcion:0.25, unidadPorcion:"taza", porcionCasera:"¼ taza" },
{ nombre:"Salmón fresco cocido", grupo:"aoaModerado", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"filete", porcionCasera:"1 filete chico" },
{ nombre:"Tofu firme", grupo:"aoaModerado", pesoGramos:120, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza en cubos" },
{ nombre:"Venado cocido", grupo:"aoaModerado", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"trozo", porcionCasera:"1 trozo mediano" },
{ nombre:"Cordero magro cocido", grupo:"aoaModerado", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"trozo", porcionCasera:"1 trozo mediano" },
{ nombre:"Ternera cocida", grupo:"aoaModerado", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"trozo", porcionCasera:"1 trozo mediano" },

// ══════════════ AOA ALTO EN GRASA (100 kcal/eq) ══════════════
{ nombre:"Carne molida regular cocida", grupo:"aoaAlto", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Cecina de res", grupo:"aoaAlto", pesoGramos:45, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza chica" },
{ nombre:"Chorizo de cerdo", grupo:"aoaAlto", pesoGramos:45, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza" },
{ nombre:"Costilla de cerdo grasa", grupo:"aoaAlto", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza" },
{ nombre:"Fajita de res", grupo:"aoaAlto", pesoGramos:90, cantidadPorcion:1, unidadPorcion:"trozo", porcionCasera:"1 trozo" },
{ nombre:"Longaniza", grupo:"aoaAlto", pesoGramos:45, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza chica" },
{ nombre:"Queso amarillo americano", grupo:"aoaAlto", pesoGramos:45, cantidadPorcion:1, unidadPorcion:"rebanada", porcionCasera:"1 rebanada" },
{ nombre:"Queso asadero", grupo:"aoaAlto", pesoGramos:45, cantidadPorcion:1, unidadPorcion:"rebanada", porcionCasera:"1 rebanada" },
{ nombre:"Queso cheddar", grupo:"aoaAlto", pesoGramos:45, cantidadPorcion:1, unidadPorcion:"rebanada", porcionCasera:"1 rebanada" },
{ nombre:"Queso gouda", grupo:"aoaAlto", pesoGramos:45, cantidadPorcion:1, unidadPorcion:"rebanada", porcionCasera:"1 rebanada" },
{ nombre:"Queso manchego", grupo:"aoaAlto", pesoGramos:45, cantidadPorcion:1, unidadPorcion:"rebanada", porcionCasera:"1 rebanada" },
{ nombre:"Salchicha de cerdo", grupo:"aoaAlto", pesoGramos:45, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza" },
{ nombre:"Tocino cocido", grupo:"aoaAlto", pesoGramos:20, cantidadPorcion:1, unidadPorcion:"rebanada", porcionCasera:"1 rebanada" },

// ══════════════ LECHE DESCREMADA (95 kcal/eq) ══════════════
{ nombre:"Leche descremada líquida", grupo:"lecheDesc", pesoGramos:240, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza / 1 vaso" },
{ nombre:"Leche descremada en polvo", grupo:"lecheDesc", pesoGramos:25, cantidadPorcion:3, unidadPorcion:"cucharada", porcionCasera:"3 cucharadas" },
{ nombre:"Yogur natural descremado", grupo:"lecheDesc", pesoGramos:245, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza" },
{ nombre:"Jocoque seco descremado", grupo:"lecheDesc", pesoGramos:60, cantidadPorcion:0.25, unidadPorcion:"taza", porcionCasera:"¼ taza" },

// ══════════════ LECHE SEMIDESCREMADA (110 kcal/eq) ══════════════
{ nombre:"Leche semidescremada (light)", grupo:"lecheSemi", pesoGramos:240, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza" },
{ nombre:"Yogur natural bajo en grasa", grupo:"lecheSemi", pesoGramos:245, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza" },
{ nombre:"Kéfir bajo en grasa", grupo:"lecheSemi", pesoGramos:240, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza" },

// ══════════════ LECHE ENTERA (150 kcal/eq) ══════════════
{ nombre:"Leche entera líquida", grupo:"lecheEntera", pesoGramos:240, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza / 1 vaso" },
{ nombre:"Leche entera en polvo", grupo:"lecheEntera", pesoGramos:30, cantidadPorcion:3, unidadPorcion:"cucharada", porcionCasera:"3 cucharadas" },
{ nombre:"Yogur natural entero", grupo:"lecheEntera", pesoGramos:245, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza" },
{ nombre:"Jocoque seco entero", grupo:"lecheEntera", pesoGramos:60, cantidadPorcion:0.25, unidadPorcion:"taza", porcionCasera:"¼ taza" },
{ nombre:"Leche de cabra", grupo:"lecheEntera", pesoGramos:240, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza" },

// ══════════════ LECHE CON AZÚCAR (200 kcal/eq) ══════════════
{ nombre:"Leche con chocolate (sabor)", grupo:"lecheAz", pesoGramos:240, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza" },
{ nombre:"Yogur con fruta endulzado", grupo:"lecheAz", pesoGramos:245, cantidadPorcion:1, unidadPorcion:"taza", porcionCasera:"1 taza" },
{ nombre:"Leche condensada", grupo:"lecheAz", pesoGramos:40, cantidadPorcion:2, unidadPorcion:"cucharada", porcionCasera:"2 cucharadas" },
{ nombre:"Leche evaporada", grupo:"lecheAz", pesoGramos:120, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },

// ══════════════ GRASAS SIN PROTEÍNA (45 kcal/eq) ══════════════
{ nombre:"Aceite de canola", grupo:"grasaSinProt", pesoGramos:5, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Aceite de coco", grupo:"grasaSinProt", pesoGramos:5, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Aceite de girasol", grupo:"grasaSinProt", pesoGramos:5, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Aceite de maíz", grupo:"grasaSinProt", pesoGramos:5, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Aceite de oliva extra virgen", grupo:"grasaSinProt", pesoGramos:5, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Aceite de soya", grupo:"grasaSinProt", pesoGramos:5, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Aderezo cremoso bajo en grasa", grupo:"grasaSinProt", pesoGramos:15, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },
{ nombre:"Aguacate", grupo:"grasaSinProt", pesoGramos:30, cantidadPorcion:2, unidadPorcion:"cucharada", porcionCasera:"2 cucharadas / 1/8 pieza", notas:"Peso neto sin hueso ni cáscara" },
{ nombre:"Betún/mantequilla vegetal", grupo:"grasaSinProt", pesoGramos:5, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Crema ácida", grupo:"grasaSinProt", pesoGramos:15, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },
{ nombre:"Crema para café (media crema)", grupo:"grasaSinProt", pesoGramos:15, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },
{ nombre:"Mantequilla", grupo:"grasaSinProt", pesoGramos:5, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Margarina", grupo:"grasaSinProt", pesoGramos:5, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Mayonesa regular", grupo:"grasaSinProt", pesoGramos:5, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Mayonesa light", grupo:"grasaSinProt", pesoGramos:10, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Queso crema light", grupo:"grasaSinProt", pesoGramos:15, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },
{ nombre:"Semillas de ajonjolí", grupo:"grasaSinProt", pesoGramos:8, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },
{ nombre:"Semillas de girasol", grupo:"grasaSinProt", pesoGramos:10, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },
{ nombre:"Semillas de linaza", grupo:"grasaSinProt", pesoGramos:10, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },
{ nombre:"Tahini (pasta de ajonjolí)", grupo:"grasaSinProt", pesoGramos:8, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Vinagreta", grupo:"grasaSinProt", pesoGramos:15, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },

// ══════════════ GRASAS CON PROTEÍNA (70 kcal/eq) ══════════════
{ nombre:"Almendras", grupo:"grasaConProt", pesoGramos:15, cantidadPorcion:7, unidadPorcion:"pieza", porcionCasera:"7 piezas" },
{ nombre:"Avellanas", grupo:"grasaConProt", pesoGramos:15, cantidadPorcion:5, unidadPorcion:"pieza", porcionCasera:"5 piezas" },
{ nombre:"Cacahuate entero", grupo:"grasaConProt", pesoGramos:15, cantidadPorcion:8, unidadPorcion:"pieza", porcionCasera:"8 cacahuates" },
{ nombre:"Mantequilla de almendra", grupo:"grasaConProt", pesoGramos:8, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Mantequilla de cacahuate natural", grupo:"grasaConProt", pesoGramos:8, cantidadPorcion:1, unidadPorcion:"cucharadita", porcionCasera:"1 cucharadita" },
{ nombre:"Nuez de Castilla", grupo:"grasaConProt", pesoGramos:15, cantidadPorcion:2, unidadPorcion:"mitad", porcionCasera:"2 mitades" },
{ nombre:"Nuez de la India (anacardo)", grupo:"grasaConProt", pesoGramos:15, cantidadPorcion:5, unidadPorcion:"pieza", porcionCasera:"5 piezas" },
{ nombre:"Piñón", grupo:"grasaConProt", pesoGramos:15, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },
{ nombre:"Pistache", grupo:"grasaConProt", pesoGramos:15, cantidadPorcion:15, unidadPorcion:"pieza", porcionCasera:"15 piezas" },
{ nombre:"Queso crema regular", grupo:"grasaConProt", pesoGramos:20, cantidadPorcion:2, unidadPorcion:"cucharada", porcionCasera:"2 cucharadas" },

// ══════════════ AZÚCARES SIN GRASA (40 kcal/eq) ══════════════
{ nombre:"Azúcar blanca", grupo:"azSinGr", pesoGramos:10, cantidadPorcion:2, unidadPorcion:"cucharadita", porcionCasera:"2 cucharaditas" },
{ nombre:"Azúcar morena", grupo:"azSinGr", pesoGramos:12, cantidadPorcion:2, unidadPorcion:"cucharadita", porcionCasera:"2 cucharaditas" },
{ nombre:"Cajeta de leche", grupo:"azSinGr", pesoGramos:12, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharadita" },
{ nombre:"Dulce de membrillo", grupo:"azSinGr", pesoGramos:20, cantidadPorcion:1, unidadPorcion:"trozo", porcionCasera:"1 trozo chico" },
{ nombre:"Gelatina de agua", grupo:"azSinGr", pesoGramos:100, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza" },
{ nombre:"Jarabe de maple", grupo:"azSinGr", pesoGramos:15, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },
{ nombre:"Mermelada regular", grupo:"azSinGr", pesoGramos:14, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },
{ nombre:"Miel de abeja", grupo:"azSinGr", pesoGramos:15, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },
{ nombre:"Miel de maíz (karo)", grupo:"azSinGr", pesoGramos:15, cantidadPorcion:1, unidadPorcion:"cucharada", porcionCasera:"1 cucharada" },
{ nombre:"Piloncillo", grupo:"azSinGr", pesoGramos:10, cantidadPorcion:1, unidadPorcion:"trozo", porcionCasera:"1 trozo" },
{ nombre:"Refresco", grupo:"azSinGr", pesoGramos:90, cantidadPorcion:0.5, unidadPorcion:"taza", porcionCasera:"½ taza / 90ml" },
{ nombre:"Stevia (referencia 0 kcal)", grupo:"azSinGr", pesoGramos:1, cantidadPorcion:1, unidadPorcion:"sobre", porcionCasera:"1 sobre / 0 kcal reales", notas:"Endulzante no calórico, se incluye por referencia" },

// ══════════════ AZÚCARES CON GRASA (85 kcal/eq) ══════════════
{ nombre:"Chocolate oscuro 70%", grupo:"azConGr", pesoGramos:15, cantidadPorcion:1, unidadPorcion:"cuadrito", porcionCasera:"1 cuadrito" },
{ nombre:"Chocolate con leche", grupo:"azConGr", pesoGramos:15, cantidadPorcion:1, unidadPorcion:"cuadrito", porcionCasera:"1 cuadrito" },
{ nombre:"Galleta de chocolate (tipo Oreo)", grupo:"azConGr", pesoGramos:20, cantidadPorcion:2, unidadPorcion:"pieza", porcionCasera:"2 piezas" },
{ nombre:"Galleta con crema rellena", grupo:"azConGr", pesoGramos:25, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza" },
{ nombre:"Helado de crema", grupo:"azConGr", pesoGramos:60, cantidadPorcion:1, unidadPorcion:"bola", porcionCasera:"1 bola chica" },
{ nombre:"Brownie", grupo:"azConGr", pesoGramos:15, cantidadPorcion:0.5, unidadPorcion:"pieza", porcionCasera:"½ pieza chica" },
{ nombre:"Nieve de crema", grupo:"azConGr", pesoGramos:60, cantidadPorcion:1, unidadPorcion:"bola", porcionCasera:"1 bola" },
{ nombre:"Pastel de chocolate rebanada", grupo:"azConGr", pesoGramos:20, cantidadPorcion:0.25, unidadPorcion:"rebanada", porcionCasera:"¼ de rebanada mediana" },
{ nombre:"Flan", grupo:"azConGr", pesoGramos:60, cantidadPorcion:1, unidadPorcion:"porción", porcionCasera:"1 porción chica" },
{ nombre:"Buñuelo", grupo:"azConGr", pesoGramos:25, cantidadPorcion:1, unidadPorcion:"pieza", porcionCasera:"1 pieza chica" },

];

async function main() {
    const existing = await prisma.alimentoSMAE.count({ where: { esPersonalizado: false } });
    const custom   = await prisma.alimentoSMAE.count({ where: { esPersonalizado: true } });

    console.log(`📊 Alimentos SMAE oficiales en DB: ${existing}`);
    console.log(`📊 Alimentos personalizados (conservar): ${custom}`);

    if (existing > 0) {
        console.log('🗑  Borrando alimentos oficiales para re-insertar versión completa...');
        await prisma.alimentoSMAE.deleteMany({ where: { esPersonalizado: false } });
    }

    const data = alimentos.map(a => ({ ...a, esPersonalizado: false }));
    const result = await prisma.alimentoSMAE.createMany({ data });

    console.log(`✅ ${result.count} alimentos SMAE oficiales insertados.`);
    console.log(`📊 Total en DB: ${result.count + custom} (${custom} personalizados conservados).`);
}

main()
    .catch(e => {
        console.error('❌ Error en seed SMAE:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());

