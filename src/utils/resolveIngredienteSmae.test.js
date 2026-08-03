import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIngredienteContraSmae } from './resolveIngredienteSmae.js';

const buildCatalog = (alimentos) => {
    const byId = new Map(alimentos.map((a) => [a.id, a]));
    const byNombre = new Map();
    for (const a of alimentos) {
        const key = a.nombre.toLowerCase();
        if (!byNombre.has(key)) byNombre.set(key, []);
        byNombre.get(key).push(a);
    }
    return { byId, byNombre };
};

test('SERV con equivalentesBase=3: 1 SERV = 3 EQ, ancla = 0.33 SERV/EQ', () => {
    const alimento = {
        id: 'prot-1', nombre: 'Proteína en polvo', grupo: 'aoaMuyBajo',
        pesoGramos: 1, equivalentesBase: 3, unidadBase: 'serv', unidadPorcion: 'SERV',
    };
    const { byId, byNombre } = buildCatalog([alimento]);

    const ing = { alimentoSmaeId: 'prot-1', descripcion: 'Proteína en polvo', cantidad: 3, unidad: 'SERV', eqCantidad: 3, eqGrupo: 'AOA Muy Bajo' };
    const { ingrediente } = resolveIngredienteContraSmae(ing, byId, byNombre);

    assert.ok(Math.abs(ingrediente.smaeGrPorEq - 1 / 3) < 1e-9);
    assert.equal(ingrediente.cantidad, 1); // 3 eq * (1/3) SERV/eq = 1 SERV, no 3
});

test('GR con equivalentesBase=1 (mayoría del catálogo): comportamiento sin cambios', () => {
    const alimento = {
        id: 'pollo-1', nombre: 'Pechuga de pollo', grupo: 'aoaMuyBajo',
        pesoGramos: 30, equivalentesBase: 1, unidadBase: 'g', unidadPorcion: 'GR',
    };
    const { byId, byNombre } = buildCatalog([alimento]);

    const ing = { alimentoSmaeId: 'pollo-1', descripcion: 'Pechuga de pollo', cantidad: 60, unidad: 'GR', eqCantidad: 2, eqGrupo: 'AOA Muy Bajo' };
    const { ingrediente } = resolveIngredienteContraSmae(ing, byId, byNombre);

    assert.equal(ingrediente.smaeGrPorEq, 30);
    assert.equal(ingrediente.cantidad, 60);
});

test('GR con equivalentesBase=4 (117g = 4 eq): ancla correcta es 29.25 g/eq', () => {
    const alimento = {
        id: 'x-1', nombre: 'Alimento X', grupo: 'cerealSinGr',
        pesoGramos: 117, equivalentesBase: 4, unidadBase: 'g', unidadPorcion: 'GR',
    };
    const { byId, byNombre } = buildCatalog([alimento]);

    const ing = { alimentoSmaeId: 'x-1', descripcion: 'Alimento X', cantidad: 58.5, unidad: 'GR', eqCantidad: 2, eqGrupo: 'Cereal s/grasa' };
    const { ingrediente } = resolveIngredienteContraSmae(ing, byId, byNombre);

    assert.equal(ingrediente.smaeGrPorEq, 29.25);
    assert.equal(ingrediente.cantidad, 58.5); // 2 eq * 29.25
});

test('PZ con equivalentesBase=2 (2 piezas = 2 eq): ancla correcta es 1 pz/eq', () => {
    const alimento = {
        id: 'huevo-1', nombre: 'Huevos enteros', grupo: 'aoaModerado',
        pesoGramos: 2, equivalentesBase: 2, unidadBase: 'pz', unidadPorcion: 'PZ',
    };
    const { byId, byNombre } = buildCatalog([alimento]);

    const ing = { alimentoSmaeId: 'huevo-1', descripcion: 'Huevos enteros', cantidad: 12, unidad: 'PZ', eqCantidad: 12, eqGrupo: 'AOA Moderado' };
    const { ingrediente } = resolveIngredienteContraSmae(ing, byId, byNombre);

    assert.equal(ingrediente.smaeGrPorEq, 1);
    assert.equal(ingrediente.cantidad, 12);
});

test('equivalentesBase ausente/0/null: cae al fallback de 1, sin NaN ni Infinity', () => {
    for (const equivalentesBase of [undefined, 0, null]) {
        const alimento = {
            id: 'y-1', nombre: 'Alimento Y', grupo: 'frutas',
            pesoGramos: 90, equivalentesBase, unidadBase: 'g', unidadPorcion: 'GR',
        };
        const { byId, byNombre } = buildCatalog([alimento]);
        const ing = { alimentoSmaeId: 'y-1', descripcion: 'Alimento Y', cantidad: 90, unidad: 'GR', eqCantidad: 1, eqGrupo: 'Frutas' };
        const { ingrediente } = resolveIngredienteContraSmae(ing, byId, byNombre);

        assert.equal(ingrediente.smaeGrPorEq, 90);
        assert.ok(Number.isFinite(ingrediente.cantidad));
    }
});

test('ingrediente no vinculado al catálogo (sin match): se devuelve intacto', () => {
    const { byId, byNombre } = buildCatalog([]);
    const ing = { descripcion: 'Alimento libre no catalogado', cantidad: 45, unidad: 'GR', eqCantidad: 1.5, eqGrupo: 'Verduras' };
    const { ingrediente, healedId } = resolveIngredienteContraSmae(ing, byId, byNombre);

    assert.deepEqual(ingrediente, ing);
    assert.equal(healedId, null);
});

test('ingrediente con 2+ candidatos por nombre ambiguo: se devuelve intacto', () => {
    const dup1 = { id: 'd-1', nombre: 'Ambiguo', grupo: 'verduras', pesoGramos: 100, equivalentesBase: 1, unidadBase: 'g' };
    const dup2 = { id: 'd-2', nombre: 'Ambiguo', grupo: 'frutas', pesoGramos: 50, equivalentesBase: 2, unidadBase: 'g' };
    const { byId, byNombre } = buildCatalog([dup1, dup2]);
    const ing = { descripcion: 'Ambiguo', cantidad: 100, unidad: 'GR', eqCantidad: 1, eqGrupo: 'Verduras' };
    const { ingrediente, healedId } = resolveIngredienteContraSmae(ing, byId, byNombre);

    assert.deepEqual(ingrediente, ing);
    assert.equal(healedId, null);
});

test('equivalencias extra (multi-grupo) no se recalculan, solo se preserva su valor', () => {
    const alimento = {
        id: 'multi-1', nombre: 'Alimento Multi', grupo: 'cerealSinGr',
        pesoGramos: 60, equivalentesBase: 2, unidadBase: 'g', unidadPorcion: 'GR',
    };
    const { byId, byNombre } = buildCatalog([alimento]);
    const ing = {
        alimentoSmaeId: 'multi-1', descripcion: 'Alimento Multi', cantidad: 30, unidad: 'GR',
        eqCantidad: 1, eqGrupo: 'Cereal s/grasa',
        equivalencias: [
            { cantidad: 1, grupo: 'Cereal s/grasa' },
            { cantidad: 0.5, grupo: 'Grasa s/prot' },
        ],
    };
    const { ingrediente } = resolveIngredienteContraSmae(ing, byId, byNombre);

    assert.equal(ingrediente.smaeGrPorEq, 30);
    assert.equal(ingrediente.cantidad, 30);
    assert.equal(ingrediente.equivalencias[1].cantidad, 0.5);
    assert.equal(ingrediente.equivalencias[1].grupo, 'Grasa s/prot');
});
