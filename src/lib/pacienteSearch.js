// Cada palabra puede estar en nombre o apellido, conservando búsquedas parciales.
export const buildPacienteSearchFilter = (buscar) => {
    const query = typeof buscar === 'string' ? buscar.trim() : '';
    if (!query) return {};

    return {
        OR: [
            {
                AND: query.split(/\s+/).map(term => ({
                    OR: [
                        { nombre: { contains: term, mode: 'insensitive' } },
                        { apellido: { contains: term, mode: 'insensitive' } },
                    ],
                })),
            },
            { telefono: { contains: query } },
        ],
    };
};
