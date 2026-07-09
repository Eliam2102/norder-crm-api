import 'dotenv/config';
import prisma from '../lib/prisma.js';
import axios from 'axios';

const CALCOM_API_URL = 'https://api.cal.com/v2';
const CALCOM_API_VERSION = '2024-08-13';

export const getSlots = async (req, res) => {
  try {
    const { eventTypeId, startTime, endTime } = req.query;

    if (!eventTypeId || !startTime || !endTime) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (eventTypeId, startTime, endTime)' });
    }

    const response = await axios.get(`${CALCOM_API_URL}/slots/available`, {
      params: {
        eventTypeId,
        startTime: startTime,
        endTime: endTime,
        timeZone: 'America/Merida',
      },
      headers: {
        Authorization: `Bearer ${process.env.CALCOM_API_KEY}`,
        'cal-api-version': CALCOM_API_VERSION,
      },
    });

    // En API v2 las respuestas vienen envueltas en { status: 'success', data: ... }
    const responseData = response.data?.data || response.data;
    res.json(responseData);
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
    const nameClean = name || `${paciente.nombre} ${paciente.apellido || ''}`.trim();
    const emailClean = email || paciente.email || 'noreply@norder.mx';

    // Formato de payload V2 de Cal.com
    const bookingPayload = {
      eventTypeId: Number(eventTypeId),
      start: fecha,
      attendee: {
        name: nameClean,
        email: emailClean,
        phoneNumber: phoneClean,
        timeZone: 'America/Merida',
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
          'cal-api-version': CALCOM_API_VERSION,
          'Content-Type': 'application/json'
        }
      });
      // V2 wrap: { status: 'success', data: { id: ... } }
      bookingData = bookingResponse.data?.data || bookingResponse.data?.booking || bookingResponse.data;
      console.log('[agendarCita] Cal.com respondió OK. bookingId:', bookingData?.id);
    } catch (calcomErr) {
      const calcomError = calcomErr.response?.data || calcomErr.message;
      console.error('[agendarCita] ERROR de Cal.com:', JSON.stringify(calcomError));
      return res.status(500).json({
        error: 'Cal.com rechazó la solicitud de reserva',
        details: calcomError
      });
    }

    // 3. Guardar en BD local
    const cita = await prisma.cita.create({
      data: {
        pacienteId,
        ...(valoracionId && { valoracionId }),
        fecha: new Date(fecha),
        modalidad,
        calcomBookingId: String(bookingData.id),
        calcomEventTypeId: Number(eventTypeId)
      }
    });

    console.log('[agendarCita] Cita guardada en BD:', cita.id);
    res.json({ ok: true, cita, calcom: bookingData });

  } catch (error) {
    console.error('[agendarCita] Error inesperado:', error.message, error.stack);
    res.status(500).json({
      error: 'Error inesperado al procesar el agendamiento',
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
