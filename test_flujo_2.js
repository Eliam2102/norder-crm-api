import http from 'http';

function requestAPI(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = { hostname: 'localhost', port: 3000, path, method, headers: { 'Content-Type': 'application/json' } };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  const loginRes = await requestAPI('POST', '/api/admin/login', { email: 'eyder@norder.mx', password: 'Norder2026!' });
  const token = loginRes.body.data.token;
  const pacienteId = '747d6bf8-68e2-413a-912e-ff0d56fb2617';

  // 1. VALORACIÓN: Creación con datos ISAK completos (Ajustado al schema)
  const valData = {
    pesoActual: 80, estatura: 180, 
    pliegeTricep: 12, pliegeBicep: 5, pliegueSubescapular: 14, pliegueCrestaIliaca: 18,
    pliegueSupraespinal: 10, pliegueAbdominal: 20, pliegueMusloFrontal: 15, plieguePantorrilla: 8,
    perimetroBrazoRelajado: 32, perimetroBrazoContraido: 35, perimetroCintura: 85, perimetroCadera: 98,
    perimetroPantorrilla: 38, diametroBiestiloideo: 5.5, diametroBiepicondHumero: 6.5, diametroBiepicondFemur: 9.5
  };
  
  const valRes = await requestAPI('POST', `/api/pacientes/${pacienteId}/valoraciones`, valData, token);
  console.log("-----------------------------------------");
  console.log("MÓDULO VALORACIÓN (TEST COMPLETADO)");
  const v = valRes.body.data;
  if (!v) {
      console.log("ERROR CREANDO VALORACION:", valRes.body);
      return;
  }
  
  console.log("ID VALORACIÓN:", v.id);
  console.log("CÁLCULOS MOTORIZADOS:");
  console.log("- IMC:", v.imc, "(" + v.clasificacionImc + ")");
  console.log("- Porcentaje Grasa (4Comp):", v.pctGrasaCorp, "%");
  console.log("- Masa Grasa Real:", v.masaGrasaReal, "kg");
  console.log("- Masa Muscular:", v.masaMuscular, "kg");
  console.log("- Masa Ósea:", v.masaOsea, "kg");
  console.log("- Masa Visceral:", v.masaVisceral, "kg");
  console.log("- Somatotipo (Endo-Meso-Ecto):", v.endomorfico, v.mesomorfico, v.ectomorfico);
  console.log("- Déficit Muscular Calculado:", v.deficitMusculo, "kg");
  console.log("-----------------------------------------");
}
runTest();
