const normalizedText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const GROUP_ALIASES = {
    'c y t sin grasa': 'cereal sin grasa',
    'cereal s grasa': 'cereal sin grasa',
    'cereal sin grasa': 'cereal sin grasa',
    'c y t con grasa': 'cereal con grasa',
    'cereal c grasa': 'cereal con grasa',
    'cereal con grasa': 'cereal con grasa',
    'aoa mb': 'aoa muy bajo',
    'aoa muy bajo': 'aoa muy bajo',
    'grasa s prot': 'grasa sin proteina',
    'a y g sin proteina': 'grasa sin proteina',
    'grasa sin proteina': 'grasa sin proteina',
    'grasa c prot': 'grasa con proteina',
    'a y g con proteina': 'grasa con proteina',
    'grasa con proteina': 'grasa con proteina',
};

const groupKey = (group) => {
    const normalized = normalizedText(group);
    return GROUP_ALIASES[normalized] || normalized;
};

const validEquivalences = (ingredient) => {
    const fromArray = Array.isArray(ingredient?.equivalencias)
        ? ingredient.equivalencias.filter(item => item?.grupo && String(item.grupo).trim() && item.cantidad !== '' && item.cantidad != null)
        : [];
    if (fromArray.length > 0) return fromArray;
    return ingredient?.eqCantidad && ingredient?.eqGrupo
        ? [{ cantidad: ingredient.eqCantidad, grupo: ingredient.eqGrupo }]
        : [];
};

/**
 * Builds the compact "solo equivalencias" PDF summary for one meal.
 * Equal canonical groups are summed and each final group becomes one row.
 */
export const aggregatePdfMealEquivalences = (ingredients = []) => {
    const totals = new Map();
    const freeIngredients = [];

    ingredients.forEach((ingredient) => {
        const equivalences = validEquivalences(ingredient);
        let hasNumeric = false;
        let hasFree = false;

        equivalences.forEach((item) => {
            const group = String(item.grupo || '').trim();
            if (!group) return;
            if (normalizedText(group).includes('libre')) {
                hasFree = true;
                return;
            }

            const amount = Number(String(item.cantidad).replace(',', '.'));
            if (!Number.isFinite(amount) || amount <= 0) return;
            hasNumeric = true;

            const key = groupKey(group);
            const current = totals.get(key);
            if (current) current.amount += amount;
            else totals.set(key, { group, amount });
        });

        if (hasFree || (!hasNumeric && ingredient?.descripcion)) {
            freeIngredients.push(ingredient);
        }
    });

    const lines = Array.from(totals.values()).map(({ group, amount }) => ({
        group,
        amount: parseFloat(amount.toFixed(2)),
    }));

    return { lines, freeIngredients };
};
