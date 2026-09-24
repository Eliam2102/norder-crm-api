export const buildBioquimicaTable = (valoracion) => {
    if (!valoracion) return [];
    const fields = [
        ['Glucosa', valoracion.glucosa],
        ['Triglicéridos', valoracion.trigliceridos],
        ['Colesterol', valoracion.colesterol],
        ['Creatinina', valoracion.creatinina],
        ['Ácido úrico', valoracion.acidoUrico],
    ];
    const rows = fields
        .filter(([, value]) => value != null && value !== '')
        .map(([nombre, value]) => ({ nombre, valor: `${value} mg/dL` }));

    if (Array.isArray(valoracion.bioquimicosOtrosDetalle)) {
        rows.push(...valoracion.bioquimicosOtrosDetalle
            .filter(item => item && String(item.nombre || '').trim() && String(item.valor || '').trim())
            .map(item => ({ nombre: String(item.nombre).trim(), valor: String(item.valor).trim() })));
    } else if (valoracion.otrosBioquimicos?.trim()) {
        rows.push({ nombre: 'Otros', valor: valoracion.otrosBioquimicos.trim() });
    }
    return rows;
};

export const buildDinamicaDeportivaTable = (valoracion) => {
    const snapshot = valoracion?.dinamicaDeportiva;
    if (!snapshot || !Array.isArray(snapshot.disciplinas)) return null;
    const activo = snapshot.activo !== false;
    const rows = snapshot.disciplinas
        .filter(item => item && String(item.disciplina || '').trim())
        .map(item => ({
            disciplina: String(item.disciplina).trim(),
            frecuencia: String(item.frecuencia || '').trim() || '-',
            duracion: String(item.tiempo || '').trim() || '-',
            activo: activo && item.activo !== false,
        }));
    return { activo, rows };
};
