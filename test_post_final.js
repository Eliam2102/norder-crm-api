import axios from 'axios';

async function run() {
  const token = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InN1cGVyLWFkbWluIiwiZW1haWwiOiJleWRlckBub3JkZXIubXgiLCJub21icmUiOiJFeWRlciBNw6luZGV6Iiwicm9sIjoiYWRtaW4iLCJwZXJtaXNvcyI6eyJkYXNoYm9hcmQiOnsicmVhZCI6dHJ1ZSwid3JpdGUiOnRydWUsImRlbGV0ZSI6dHJ1ZX0sInBhY2llbnRlcyI6eyJyZWFkIjp0cnVlLCJ3cml0ZSI6dHJ1ZSwiZGVsZXRlIjp0cnVlfSwicGxhbmVzIjp7InJlYWQiOnRydWUsIndyaXRlIjp0cnVlLCJkZWxldGUiOnRydWV9LCJzbWFlIjp7InJlYWQiOnRydWUsIndyaXRlIjp0cnVlLCJkZWxldGUiOnRydWV9LCJhZG1pbiI6eyJyZWFkIjp0cnVlLCJ3cml0ZSI6dHJ1ZSwiZGVsZXRlIjp0cnVlfX0sImlzU3VwZXJBZG1pbiI6dHJ1ZSwiaWF0IjoxNzc0ODM3NDY4LCJleHAiOjE3NzU0NDIyNjh9.OzspnDfC-f4Mkm-9NgmaoGj7TP7Er67rGray2kymmhQ';
  try {
     const pResp = await axios.get('http://localhost:3000/api/pacientes', { headers: { Authorization: token } });
     const pacs = pResp.data?.data || pResp.data;
     const p = pacs[0];

     if(!p) {
       console.log("No pacientes found from HTTP endpoint.");
       return;
     }

     const res = await axios.post('http://localhost:3000/api/citas/agendar', {
        pacienteId: p.id,
        name: 'Eyder Test',
        email: 'eyder@norder.mx',
        eventTypeId: 4418629,
        fecha: '2026-04-10T10:00:00.000Z',
        modalidad: 'presencial'
     }, {
       headers: { Authorization: token }
     });
     console.log("Success:", res.data);
  } catch(e) {
     console.log("Error status:", e.response?.status);
     console.log("Error data:", JSON.stringify(e.response?.data, null, 2));
  }
}
run();
