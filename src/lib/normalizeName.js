/**
 * Normaliza un nombre para comparación de duplicados: ignora acentos, mayúsculas
 * y diferencias de espaciado ("Tortilla  de maíz" === "tortilla de maiz").
 * Mismo patrón de normalización de acentos que ya usa el buscador SMAE del frontend.
 */
const DIACRITICS_RE = new RegExp(String.fromCharCode(91, 92, 117, 48, 51, 48, 48, 45, 92, 117, 48, 51, 54, 102, 93), 'g');

export const normalizeName = (value) => String(value || '')
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
