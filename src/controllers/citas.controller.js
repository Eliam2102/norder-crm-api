import 'dotenv/config';
import prisma from '../lib/prisma.js';
import axios from 'axios';
import {
  MEXICO_CITY_TIME_ZONE,
  normalizeBookingStart
} from '../lib/timeZone.js';
import {
  bookingRequestRegistry,
  buildBookingRequestKey
} from '../lib/bookingRequestRegistry.js';

const CALCOM_API_URL = 'https://api.cal.com/v2';
const CALCOM_SLOTS_API_VERSION = '2024-09-04';
const CALCOM_BOOKINGS_API_VERSION = '2026-02-25';
// Los event types son del equipo "NORDER Health" (team slug: norder-health).
// Los team event types NO requieren el param 'username' — usan su propio scope.

export const normalizeCalcomSlots = (responseData) => {
  return Object.fromEntries(Object.entries(responseData || {}).map(([day, entries]) => [
    day,
    (Array.isArray(entries) ? entries : []).map(entry => {
      const instant = normalizeBookingStart(entry?.start || entry?.time);
      return instant ? { time: instant.toISOString() } : null;
    }).filter(Boolean)
  ]));
};

export const getSlots = async (req, res) => {
  try {
    const { eventTypeId, startTime, endTime } = req.query;

    if (!eventTypeId || !startTime || !endTime) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (eventTypeId, startTime, endTime)' });
    }

    const normalizedStart = normalizeBookingStart(startTime);
    const normalizedEnd = normalizeBookingStart(endTime);
    if (!normalizedStart || !normalizedEnd) {
      return res.status(400).json({ error: 'El rango de fechas debe incluir una zona horaria válida' });
    }

    const response = await axios.get(`${CALCOM_API_URL}/slots`, {
      params: {
        eventTypeId,
        start: normalizedStart.toISOString(),
        end: normalizedEnd.toISOString(),
        timeZone: MEXICO_CITY_TIME_ZONE,
        // Los event types son de equipo (NORDER Health) — no se pasa username
        // individual ya que el equipo tiene su propio calendario compartido.
      },
      headers: {
        Authorization: `Bearer ${process.env.CALCOM_API_KEY}`,
        'cal-api-version': CALCOM_SLOTS_API_VERSION,
      },
    });

    const responseData = response.data?.data || {};
    const slots = normalizeCalcomSlots(responseData);
    res.json({ slots });
  } catch (error) {
    console.error('Error al obtener slots de Cal.com:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Error al consultar disponibilidad en Cal.com',
      details: error.response?.data || error.message
    });
  }
};

export const agendarCita = async (req, res) => {
  try {
    const { pacienteId, valoracionId, fecha, modalidad, eventTypeId, name, email, phone } = req.body;

    console.log('[agendarCita] Body recibido:', JSON.stringify({ pacienteId, valoracionId, fecha, modalidad, eventTypeId, name, email, phone }));

    if (!pacienteId || !fecha || !modalidad || !eventTypeId) {
      return res.status(400).json({ error: 'Faltan datos para agendar la cita' });
    }

    // 1. Obtener datos del paciente
    const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId } });
    if (!paciente) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const cleanPhone = (p) => {
      if (!p) return '';
      const digits = p.replace(/\D/g, '');
      if (digits.length === 10) return `+52${digits}`;
      if (digits.length > 10 && !p.startsWith('+')) return `+${digits}`;
      return p;
    };

    const phoneClean = cleanPhone(phone || paciente.telefono) || '+520000000000';
    const pacienteFullName = `${paciente.nombre || ''} ${paciente.apellido || ''}`.trim();
    const requestedName = typeof name === 'string' ? name.trim() : '';
    const apellidoNormalizado = (paciente.apellido || '').trim().toLocaleLowerCase('es-MX');
    const requestedNameNormalizado = requestedName.toLocaleLowerCase('es-MX');
    // Compatibilidad con clientes anteriores que enviaban únicamente paciente.nombre.
    const nameClean = requestedName && (!apellidoNormalizado || requestedNameNormalizado.endsWith(apellidoNormalizado))
      ? requestedName
      : requestedName
        ? `${requestedName} ${paciente.apellido || ''}`.trim()
        : pacienteFullName;
    const emailClean = email || paciente.email || 'noreply@norder.mx';

    const requestedStart = normalizeBookingStart(fecha);
    if (!requestedStart) {
      return res.status(400).json({
        error: 'La fecha de la cita debe incluir una hora válida y zona horaria'
      });
    }

    const requestKey = buildBookingRequestKey({
      pacienteId,
      valoracionId,
      fecha: requestedStart,
      eventTypeId
    });

    const result = await bookingRequestRegistry.run(requestKey, async () => {
      const existingCita = await prisma.cita.findFirst({
        where: {
          pacienteId,
          ...(valoracionId && { valoracionId }),
          fecha: requestedStart,
          modalidad,
          calcomEventTypeId: Number(eventTypeId)
        },
        orderBy: { createdAt: 'desc' }
      });

      if (existingCita) {
        console.log('[agendarCita] Solicitud idempotente; se reutiliza cita:', existingCita.id);
        return { cita: existingCita, calcom: null, reused: true };
      }

      // Cal.com requiere el inicio como instante UTC ISO 8601.
      const bookingPayload = {
        eventTypeId: Number(eventTypeId),
        start: requestedStart.toISOString(),
        attendee: {
          name: nameClean,
          email: emailClean,
          phoneNumber: phoneClean,
          timeZone: MEXICO_CITY_TIME_ZONE,
          language: 'es'
        },
        metadata: {
          pacienteId: paciente.id,
          ...(valoracionId && { valoracionId })
        }
      };

      console.log('[agendarCita] Payload a Cal.com (v2):', JSON.stringify(bookingPayload));

      // 2. Crear reserva en Cal.com
      let bookingData;
      try {
        const bookingResponse = await axios.post(`${CALCOM_API_URL}/bookings`, bookingPayload, {
          headers: {
            Authorization: `Bearer ${process.env.CALCOM_API_KEY}`,
            'cal-api-version': CALCOM_BOOKINGS_API_VERSION,
            'Content-Type': 'application/json'
          }
        });
        // V2 wrap: { status: 'success', data: { id: ... } }
        bookingData = bookingResponse.data?.data || bookingResponse.data?.booking || bookingResponse.data;
        console.log('[agendarCita] Cal.com respondió OK. bookingId:', bookingData?.id);
      } catch (calcomErr) {
        const calcomError = calcomErr.response?.data || calcomErr.message;
        console.error('[agendarCita] ERROR de Cal.com:', JSON.stringify(calcomError));
        const bookingError = new Error('Cal.com rechazó la solicitud de reserva');
        bookingError.status = 500;
        bookingError.details = calcomError;
        throw bookingError;
      }

      // La respuesta de Cal.com es la fuente canónica. Si Cal.com normalizó el
      // instante, almacenamos exactamente ese valor en UTC.
      const confirmedStart = normalizeBookingStart(bookingData?.start)
        || requestedStart;

      // 3. Guardar en BD local
      const cita = await prisma.cita.create({
        data: {
          pacienteId,
          ...(valoracionId && { valoracionId }),
          fecha: confirmedStart,
          modalidad,
          calcomBookingId: String(bookingData.uid || bookingData.id),
          calcomEventTypeId: Number(eventTypeId)
        }
      });

      console.log('[agendarCita] Cita guardada en BD:', cita.id);
      return { cita, calcom: bookingData, reused: false };
    });

    res.json({ ok: true, ...result });

  } catch (error) {
    console.error('[agendarCita] Error inesperado:', error.message, error.stack);
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'Error inesperado al procesar el agendamiento',
      ...(error.details && { details: error.details })
    });
  }
};

export const getEventType = async (req, res) => {
  try {
    const { id } = req.params;
    // La API v2 no tiene endpoint directo para /v2/event-types/:id
    // Consultamos todos sin el header de versión (porque la versión 2024-08-13 oculta esta ruta).
    const response = await axios.get(`${CALCOM_API_URL}/event-types`, {
      headers: {
        Authorization: `Bearer ${process.env.CALCOM_API_KEY}`
      },
    });

    // La respuesta en v2 (sin header de versión específico) viene anidada en eventTypeGroups
    let eventTypes = [];
    const groups = response.data?.data?.eventTypeGroups || [];
    groups.forEach(group => {
      if (group.eventTypes && Array.isArray(group.eventTypes)) {
        eventTypes = [...eventTypes, ...group.eventTypes];
      }
    });

    const eventType = eventTypes.find(e => String(e.id) === String(id));

    if (!eventType) {
      return res.status(404).json({ error: 'Tipo de evento no encontrado en Cal.com' });
    }

    res.json(eventType);
  } catch (err) {
    console.error('Error al obtener tipo de evento en Cal.com:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Error al obtener configuración del evento en Cal.com',
      details: err.response?.data || err.message
    });
  }
};
