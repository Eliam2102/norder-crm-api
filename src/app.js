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
import pacienteRoutes from './routes/pacientes.routes.js';
import valoracionRoutes from './routes/valoraciones.routes.js';
import revisionRoutes from './routes/revisiones.routes.js';
import planRoutes from './routes/planes.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import configuracionRoutes from './routes/configuracion.routes.js';

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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/planes', planRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/configuracion', configuracionRoutes);

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
