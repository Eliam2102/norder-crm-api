import 'dotenv/config';
import prisma from '../lib/prisma.js';
import axios from 'axios';

const CALCOM_API_URL = 'https://api.cal.com/v1';

export const getSlots = async (req, res) => {
  try {
    const { eventTypeId, startTime, endTime } = req.query;

    if (!eventTypeId || !startTime || !endTime) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (eventTypeId, startTime, endTime)' });
    }

    const response = await axios.get(`${CALCOM_API_URL}/slots`, {
      params: {
        eventTypeId,
        startTime,
        endTime,
        timeZone: 'America/Merida',
        apiKey: process.env.CALCOM_API_KEY,
      },
      headers: {
        Authorization: `Bearer ${process.env.CALCOM_API_KEY}`,
      },
    });

    res.json(response.data);
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

    const bookingPayload = {
      eventTypeId: Number(eventTypeId),
      start: fecha,
      responses: {
        name: nameClean,
        email: emailClean,
        attendeePhoneNumber: phoneClean,
      },
      timeZone: 'America/Merida',
      language: 'es',
      metadata: {
        pacienteId: paciente.id,
        ...(valoracionId && { valoracionId })
      }
    };

    console.log('[agendarCita] Payload a Cal.com:', JSON.stringify(bookingPayload));

    // 2. Crear reserva en Cal.com
    let bookingData;
    try {
      const bookingResponse = await axios.post(`${CALCOM_API_URL}/bookings`, bookingPayload, {
        params: { apiKey: process.env.CALCOM_API_KEY },
        headers: {
          Authorization: `Bearer ${process.env.CALCOM_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      bookingData = bookingResponse.data?.booking || bookingResponse.data;
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
      details: error.message
    });
  }
};

export const getEventType = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${CALCOM_API_URL}/event-types/${id}`, {
      params: {
        apiKey: process.env.CALCOM_API_KEY,
      },
      headers: {
        Authorization: `Bearer ${process.env.CALCOM_API_KEY}`,
      },
    });

    res.json(response.data);
  } catch (err) {
    console.error('Error al obtener tipo de evento en Cal.com:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Error al obtener configuración del evento en Cal.com',
      details: err.response?.data || err.message
    });
  }
};
