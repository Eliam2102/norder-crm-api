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
    const { pacienteId, fecha, modalidad, eventTypeId, name, email, phone } = req.body;

    if (!pacienteId || !fecha || !modalidad || !eventTypeId) {
      return res.status(400).json({ error: 'Faltan datos para agendar la cita' });
    }

    // 1. Obtener datos del paciente (por si acaso no vienen del front)
    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId }
    });

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

    // 2. Crear reserva en Cal.com
    const bookingResponse = await axios.post(`${CALCOM_API_URL}/bookings`, {
      eventTypeId: Number(eventTypeId),
      start: fecha,
      responses: {
        name: name || `${paciente.nombre} ${paciente.apellido || ''}`.trim(),
        email: email || paciente.email || 'noreply@norder.mx',
        attendeePhoneNumber: cleanPhone(phone || paciente.telefono),
      },
      // location REMOVED as it conflicts with 'responses' in some event type configs
      timeZone: 'America/Merida',
      language: 'es',
      metadata: {
        pacienteId: paciente.id
      }
    }, {
      params: {
        apiKey: process.env.CALCOM_API_KEY
      },
      headers: {
        Authorization: `Bearer ${process.env.CALCOM_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const bookingData = bookingResponse.data?.booking || bookingResponse.data;

    // 3. Guardar en la BD local
    const cita = await prisma.cita.create({
      data: {
        pacienteId,
        fecha: new Date(fecha),
        modalidad,
        calcomBookingId: String(bookingData.id),
        calcomEventTypeId: Number(eventTypeId)
      }
    });

    res.json({ ok: true, cita, calcom: bookingData });
  } catch (error) {
    console.error('Error al agendar en Cal.com:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Error al procesar el agendamiento',
      details: error.response?.data || error.message 
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
