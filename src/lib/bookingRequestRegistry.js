const DEFAULT_SUCCESS_TTL_MS = 5 * 60 * 1000;

export const buildBookingRequestKey = ({ pacienteId, valoracionId, fecha, eventTypeId }) => [
    pacienteId,
    valoracionId || 'sin-valoracion',
    new Date(fecha).toISOString(),
    String(eventTypeId)
].join(':');

export const createBookingRequestRegistry = ({ successTtlMs = DEFAULT_SUCCESS_TTL_MS } = {}) => {
    const requests = new Map();

    const run = (key, operation) => {
        const current = requests.get(key);
        if (current) return current;

        const request = Promise.resolve()
            .then(operation)
            .then((result) => {
                const cleanup = setTimeout(() => requests.delete(key), successTtlMs);
                cleanup.unref?.();
                return result;
            })
            .catch((error) => {
                requests.delete(key);
                throw error;
            });

        requests.set(key, request);
        return request;
    };

    return { run };
};

export const bookingRequestRegistry = createBookingRequestRegistry();
