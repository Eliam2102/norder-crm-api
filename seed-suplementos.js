import prisma from './src/lib/prisma.js';

async function main() {
  console.log('🚀 Creando paciente paciente con historial desde Nov 2025...');
  
  // Limpiar primero para evitar duplicados si corren el script varias veces:
  const oldUser = await prisma.paciente.findFirst({
    where: { email: 'juan.historial@ejemplo.com' }
  });
  if (oldUser) {
    console.log('Borrando paciente previamente creado para limpiar el estado...');
    await prisma.paciente.delete({ where: { id: oldUser.id }});
  }

  // 1. Crear Paciente
  const paciente = await prisma.paciente.create({
    data: {
      nombre: 'Historial',
      apellido: 'De Suplementos',
      telefono: '9988776655', // Teléfono único
      email: 'juan.historial@ejemplo.com',
      fechaNacimiento: new Date('1990-05-15'),
      sexo: 'M',
      estatura: 1.75,
      peso: 80.5
    }
  });

  console.log(`👤 Paciente creado exitosamente: ${paciente.id}`);

  // Helpers para IDs únicos (timestamp en texto)
  // Las fechas están calculadas usando el primer día inicial de cada mes
  const wheyId = new Date('2025-11-15T10:00:00Z').getTime().toString();
  const creatinaId = new Date('2025-12-15T10:00:00Z').getTime().toString();
  const omegaId = new Date('2026-01-15T10:00:00Z').getTime().toString();
  const magId = new Date('2026-02-15T10:00:00Z').getTime().toString();
  const zincId = new Date('2026-03-15T10:00:00Z').getTime().toString(); // Actual
  
  const historyData = [
    {
      mes: 'Nov 2025',
      fecha: '2025-11-15T10:00:00Z',
      peso: 80.5,
      imc: 26.2,
      suplementos: [
        { id: wheyId, nombre: 'Proteína Whey', indicaciones: '1 scoop post-entreno', fechaInicio: '2025-11-15T10:00:00Z', activo: true }
      ]
    },
    {
      mes: 'Dic 2025',
      fecha: '2025-12-15T10:00:00Z',
      peso: 79.0,
      imc: 25.8,
      suplementos: [
        { id: wheyId, nombre: 'Proteína Whey', indicaciones: '1 scoop post-entreno', fechaInicio: '2025-11-15T10:00:00Z', activo: true },
        { id: creatinaId, nombre: 'Creatina', indicaciones: '5g todos los días, sin asco', fechaInicio: '2025-12-15T10:00:00Z', activo: true }
      ]
    },
    {
      mes: 'Ene 2026',
      fecha: '2026-01-15T10:00:00Z',
      peso: 77.5,
      imc: 25.3,
      suplementos: [
        { id: wheyId, nombre: 'Proteína Whey', indicaciones: '1 scoop post-entreno (cambio de sabor)', fechaInicio: '2025-11-15T10:00:00Z', activo: true },
        { id: creatinaId, nombre: 'Creatina', indicaciones: '5g todos los días', fechaInicio: '2025-12-15T10:00:00Z', activo: true },
        { id: omegaId, nombre: 'Omega 3', indicaciones: '1 cápsula con comida', fechaInicio: '2026-01-15T10:00:00Z', activo: true }
      ]
    },
    {
      mes: 'Feb 2026',
      fecha: '2026-02-15T10:00:00Z',
      peso: 76.0,
      imc: 24.8,
      suplementos: [
        { id: wheyId, nombre: 'Proteína Whey', indicaciones: '1 scoop post-entreno', fechaInicio: '2025-11-15T10:00:00Z', activo: true },
        { id: creatinaId, nombre: 'Creatina', indicaciones: 'Me dio asco, la quitamos', fechaInicio: '2025-12-15T10:00:00Z', activo: false }, // <-- Desactivado
        { id: omegaId, nombre: 'Omega 3', indicaciones: '1 cápsula con la cena preferentemente', fechaInicio: '2026-01-15T10:00:00Z', activo: true },
        { id: magId, nombre: 'Citrato de Magnesio', indicaciones: '2 cápsulas 30 min antes de dormir', fechaInicio: '2026-02-15T10:00:00Z', activo: true }
      ]
    },
    {
      mes: 'Mar 2026 (Actual)',
      fecha: new Date().toISOString(), // Marzo al dia de hoy
      peso: 75.2,
      imc: 24.5,
      suplementos: [
        { id: wheyId, nombre: 'Proteína Whey', indicaciones: 'Se le acabó el bote. Esperar.', fechaInicio: '2025-11-15T10:00:00Z', activo: false }, // <-- Desactivado
        { id: creatinaId, nombre: 'Creatina', indicaciones: '5g', fechaInicio: '2025-12-15T10:00:00Z', activo: false }, // Histórico previo off
        { id: omegaId, nombre: 'Omega 3', indicaciones: '1 cápsula (mantener)', fechaInicio: '2026-01-15T10:00:00Z', activo: true },
        { id: magId, nombre: 'Citrato de Magnesio', indicaciones: '2 cápsulas 30 min antes de dormir', fechaInicio: '2026-02-15T10:00:00Z', activo: true },
        { id: zincId, nombre: 'Picolinato de Zinc', indicaciones: '1 caps al día', fechaInicio: new Date().toISOString(), activo: true }
      ]
    }
  ];

  for (let i = 0; i < historyData.length; i++) {
    const d = historyData[i];
    
    // 2. Crear Valoracion
    const valoracion = await prisma.valoracion.create({
      data: {
        pacienteId: paciente.id,
        fecha: new Date(d.fecha),
        numeroValoracion: i + 1,
        pesoActual: d.peso,
        estatura: 1.75, // misma
        imc: d.imc,
        suplementosDetalle: d.suplementos
      }
    });

    console.log(`✅ [${d.mes}]: Valoración creada con ${d.suplementos.length} suples (Activos: ${d.suplementos.filter(s=>s.activo).length})`);

    // 3. Crear Plan
    await prisma.plan.create({
       data: {
         pacienteId: paciente.id,
         valoracionId: valoracion.id,
         fechaCreacion: new Date(d.fecha),
         nombre: `Plan de Entrenamiento - ${d.mes}`,
         tipoPlan: 'Balanceada',
         calorias: 2200,
         proteinasPct: 35, carbohidratosPct: 40, grasasPct: 25,
         suplementosDetalle: d.suplementos, // Misma data compartida al plan
         estado: i === historyData.length - 1 ? 'activo' : 'archivado', // Sólo el más reciente activo
         estadoEnvio: 'enviado'
       }
    });
  }

  console.log('🎉 ¡Paciente y su historial creados con éxito!');
  console.log(`Inicia sesión en el frontend y busca al paciente "Historial De Suplementos" (${paciente.email})`);
}

main()
  .catch(e => {
    console.error('❌ Error creando el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
