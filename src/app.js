import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import errorHandler from './middlewares/errorHandler.js';

// BigInt serialization fix for JSON
BigInt.prototype.toJSON = function() {
    return this.toString();
};

// Routes imports
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import pacienteRoutes from './routes/pacientes.routes.js';
import valoracionRoutes from './routes/valoraciones.routes.js';
import revisionRoutes from './routes/revisiones.routes.js';
import planRoutes from './routes/planes.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import configuracionRoutes from './routes/configuracion.routes.js';
import barridoRoutes from './routes/barrido.routes.js';
import alimentosSMAERoutes from './routes/alimentosSmae.routes.js';
import platillosRoutes from './routes/platillos.routes.js';
import citasRoutes from './routes/citas.routes.js';

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Regular body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static PDFs from /tmp
app.use('/temp', express.static('/tmp'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'norder HEALTH API' }));

// Middlewares de protección (Cargado en cada ruta)
import { authMiddleware, requireAdmin, requirePermiso } from './middlewares/auth.middleware.js';

// API Routes
app.use('/api/auth', authRoutes); // Login/Auth no requiere protección JWT

// Todas las rutas siguientes requieren autenticación
app.use('/api/admin', adminRoutes); // El middleware está dentro para no bloquear el login
app.use('/api/pacientes', authMiddleware, requirePermiso('pacientes', 'read'), pacienteRoutes);
app.use('/api/planes', authMiddleware, requirePermiso('planes', 'read'), planRoutes);
app.use('/api/dashboard', authMiddleware, requirePermiso('dashboard', 'read'), dashboardRoutes);
app.use('/api/alimentos-smae', authMiddleware, requirePermiso('smae', 'read'), alimentosSMAERoutes);
app.use('/api/platillos', authMiddleware, platillosRoutes);
app.use('/api/citas', authMiddleware, citasRoutes);

// Opcionales o específicos
app.use('/api/configuracion', authMiddleware, configuracionRoutes);
app.use('/api/pacientes/:pacienteId/valoraciones/:valoracionId/barrido', authMiddleware, requirePermiso('pacientes', 'write'), barridoRoutes);

// 404 Handler for undefined routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
    });
});

// Error Handler
app.use(errorHandler);


export default app;
