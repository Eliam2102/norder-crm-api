import http from 'http';

function requestAPI(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) { reject(e); }
      });
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  try {
    // 0. LOGIN (EYDER)
    const loginRes = await requestAPI('POST', '/api/admin/login', { email: 'eyder@norder.mx', password: 'Norder2026!' });
    const token = loginRes.body.data.token;
    console.log("✅ 0. Login Exitoso. Rol:", loginRes.body.data.user.rol);

    // 1. PACIENTE: Creación
    const pacData = {
      nombre: "Test Atleta", apellido: "Prueba Flujo", email: "atleta@example.com", telefono: "9998887766",
      fechaNacimiento: "1995-05-15", sexo: "M", estatura: 180, peso: 80, nivelMembresia: "premium"
    };
    const pacRes = await requestAPI('POST', '/api/pacientes', pacData, token);
    const pacienteId = pacRes.body.data.id;
    console.log(`✅ 1. Paciente Creado: ${pacienteId} (${pacRes.body.data.nombre})`);

    // 2. PACIENTE: Historia / Antecedentes
    const antData = {
      alergias: "Ninguna", patologia: "Ninguna", cicloMenstrual: "N/A", tabaco: "No", consumoAlcohol: "Ocasional",
      alimentosNoGustan: "Brócoli", alimentosGustan: "Pollo, Arroz"
    };
    await requestAPI('PUT', `/api/pacientes/${pacienteId}/antecedentes`, antData, token);
    console.log("✅ 2. Antecedentes Guardados");

    // 3. PACIENTE: Datos Ejercicio
    const ejData = {
      objetivo: "Ganancia Muscular", disciplina: "CrossFit y Pesas",
      frecuencia: "5-6 días por semana", tiempo: "90 min",
      nivelActividad: "Intenso", gimnasioOrigen: "Gym Central",
      porcentajeSedentario: 10, porcentajeLeve: 15, porcentajeModerado: 25, porcentajeIntenso: 50
    };
    await requestAPI('PUT', `/api/pacientes/${pacienteId}/datos-ejercicio`, ejData, token);
    console.log("✅ 3. Ejercicio y Distribución Actividad Guardados");

    // REPORTE DEL PERFIL ACTUAL
    const finalPacRes = await requestAPI('GET', `/api/pacientes/${pacienteId}`, null, token);
    console.log("-----------------------------------------");
    console.log("MÓDULO ONBOARDING (TEST COMPLETADO)");
    console.log("RESUMEN DE VARIABLES DEL PACIENTE: ", {
      Nombre: finalPacRes.body.data.nombre,
      EdadF: finalPacRes.body.data.fechaNacimiento,
      NivelMembresia: finalPacRes.body.data.nivelMembresia,
      Gimnasio: finalPacRes.body.data.datosEjercicio?.gymOrigen,
      Alergias: finalPacRes.body.data.antecedentes?.alergias
    });
    console.log("-----------------------------------------");
  } catch(e) {
    console.error("Test Fail:", e);
  }
}
runTest();
