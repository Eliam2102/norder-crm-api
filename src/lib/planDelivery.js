const enabledUnlessFalse = (value) => value !== false && value !== 'false';

export const normalizeDeliveryChannels = (body = {}) => {
    const requested = body?.canales && typeof body.canales === 'object' ? body.canales : {};
    return {
        email: enabledUnlessFalse(requested.email),
        whatsapp: enabledUnlessFalse(requested.whatsapp),
    };
};

export const normalizeOrchestratorChannelStatus = (responseData, channel, fallback) => {
    if (!responseData || typeof responseData !== 'object') return fallback;
    const status = responseData[channel];
    return typeof status === 'string' ? status.toLocaleLowerCase('es-MX') : fallback;
};
