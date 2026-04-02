import axios from 'axios';

async function run() {
  try {
     const res = await axios.post('http://localhost:3000/api/citas/agendar', {
        pacienteId: 'test-id',
        name: 'Eyder Test',
        email: 'eyder@norder.mx',
        phone: '+529999999999',
        eventTypeId: 4418629,
        fecha: '2026-04-10T10:00:00.000Z',
        modalidad: 'presencial'
     });
     console.log("Success:", res.data);
  } catch(e) {
     console.log("Error status:", e.response?.status);
     console.log("Error data:", JSON.stringify(e.response?.data, null, 2));
  }
}
run();
