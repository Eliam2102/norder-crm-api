export const optionalNumber = (value) => {
    if (value === undefined || value === '') return undefined;
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const firstPresent = (source, keys) => {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
    }
    return undefined;
};

export const mapBioimpedancia = (bioimpedancia = {}) => ({
    bioGrasa: optionalNumber(firstPresent(bioimpedancia, ['Grasa %', 'grasa'])),
    bioAgua: optionalNumber(firstPresent(bioimpedancia, ['Agua %', 'agua'])),
    // Compatibilidad con payloads anteriores que etiquetaban músculo como %.
    bioMusculo: optionalNumber(firstPresent(bioimpedancia, ['Músculo (kg)', 'Músculo %', 'musculo'])),
    bioEnergia: optionalNumber(firstPresent(bioimpedancia, ['Energía (kcal)', 'energia'])),
});
