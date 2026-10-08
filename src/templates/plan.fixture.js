// Datos ficticios para verificar legibilidad y paginación, sin consultar expedientes.
export const makePlanPdfFixture = ({ menuCount = 2, mealCount = 6, ingredientCount = 4, extras = false, equivalents = false } = {}) => {
    const paciente = { nombre: 'Paciente', apellido: 'de demostración - datos ficticios' };
    const mealNames = ['Desayuno', 'Colacion 1', 'Comida', 'Colacion 2', 'Cena', 'Pre Entreno'];
    const foods = ['Avena cocida', 'Leche descremada', 'Manzana en trozos', 'Almendras naturales'];
    const menus = Array.from({ length: menuCount }, (_, m) => ({
        nombre: `Menú ${m + 1}`,
        tipoContenido: equivalents ? 'equivalencias' : 'platillos',
        tiemposComida: Array.from({ length: mealCount }, (_, t) => ({
            nombre: mealNames[t] || `Colacion ${t + 1}`,
            ingredientes: Array.from({ length: ingredientCount }, (_, i) => ({
                descripcion: `${foods[i % foods.length]} [M${m + 1}T${t + 1}I${i + 1}]`,
                cantidad: i % 2 ? 1 : 100,
                unidad: i % 2 ? 'PZA' : 'GR',
                platillo: i < 2 ? 'Preparación de ejemplo' : '',
                equivalencias: [{ grupo: 'Cereal sin grasa', cantidad: 1 }],
            })),
            notaPie: 'Tomar agua simple durante el día.',
            bebida: 'Agua simple sin azúcar.',
            suplTiempo: t === 0 ? 'Suplemento de ejemplo' : '',
            suplNotas: 'Seguir las indicaciones de su profesional de nutrición.',
        })),
    }));
    const plan = {
        paciente, menus, evitarReciente: [], lineamientosRecientes: [],
        notasGenerales: '', notasClinicasRecientes: '', notasLibresRecientes: '', temarioReciente: [],
        esqueHidratacionReciente: 'Beber agua simple en pequeñas tomas a lo largo del día, conforme a las indicaciones de su profesional de nutrición. Muestra ficticia.',
        suplementosTabla: [{ nombre: 'Suplemento de ejemplo', indicaciones: 'Tomar únicamente si lo indica su profesional.', activo: true, estado: 'Activo', duracion: 'Por confirmar' }],
        pdfCustomMeta: {
            showPageHistorial: false, showPageMenus: true, showPageIntercambio: false,
            showPageExtras: extras, showAlimentosEvitar: false,
        },
    };
    return { plan, paciente, config: {}, valoraciones: [], tiposCuerpoImg: null, logoMenuImg: null };
};
