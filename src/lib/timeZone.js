export const MEXICO_CITY_TIME_ZONE = 'America/Mexico_City';
export const MERIDA_TIME_ZONE = 'America/Merida';

const partsInTimeZone = (value, timeZone = MEXICO_CITY_TIME_ZONE) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);

    return Object.fromEntries(parts
        .filter(part => part.type !== 'literal')
        .map(part => [part.type, part.value]));
};

const offsetAt = (date, timeZone) => {
    const parts = partsInTimeZone(date, timeZone);
    if (!parts) return NaN;
    const representedAsUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
    );
    return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
};

/**
 * Convierte una fecha y hora de pared de Ciudad de México a un instante UTC.
 * Así el resultado no depende de la zona horaria del servidor de Railway.
 */
export const mexicoCityDateTimeToUtc = (
    dateValue,
    timeValue = '00:00',
    timeZone = MEXICO_CITY_TIME_ZONE
) => {
    const dateMatch = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = String(timeValue || '00:00').match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!dateMatch || !timeMatch) return null;

    const [, year, month, day] = dateMatch;
    const [, hour, minute, second = '00'] = timeMatch;
    const wallClockUtc = Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
    );

    const firstGuess = new Date(wallClockUtc);
    const firstOffset = offsetAt(firstGuess, timeZone);
    if (!Number.isFinite(firstOffset)) return null;

    let result = new Date(wallClockUtc - firstOffset);
    const correctedOffset = offsetAt(result, timeZone);
    if (Number.isFinite(correctedOffset) && correctedOffset !== firstOffset) {
        result = new Date(wallClockUtc - correctedOffset);
    }

    const resultParts = partsInTimeZone(result, timeZone);
    const isSameWallClock = resultParts
        && resultParts.year === year
        && resultParts.month === month
        && resultParts.day === day
        && resultParts.hour === hour
        && resultParts.minute === minute;

    return isSameWallClock ? result : null;
};

/**
 * Normaliza un instante recibido desde Cal.com a UTC. Si un cliente antiguo
 * manda una fecha sin offset, se interpreta explícitamente como hora de México.
 */
export const normalizeBookingStart = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;

    if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)) {
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const localMatch = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/);
    if (localMatch) {
        return mexicoCityDateTimeToUtc(
            localMatch[1],
            `${localMatch[2]}:${localMatch[3] || '00'}`
        );
    }

    return null;
};

export const getMexicoCityDateTimeParts = (value) => {
    const parts = partsInTimeZone(value);
    if (!parts) return null;
    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        time: `${parts.hour}:${parts.minute}`
    };
};

export const getMeridaTime = (value = new Date()) => {
    const parts = partsInTimeZone(value, MERIDA_TIME_ZONE);
    if (!parts) return null;
    return `${parts.hour}:${parts.minute}:${parts.second}`;
};

export const formatMexicoCityDateTime = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('es-MX', {
        timeZone: MEXICO_CITY_TIME_ZONE,
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(date);
};
