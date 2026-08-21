import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import errorHandler from './middlewares/errorHandler.js';

// BigInt serialization fix for JSON
BigInt.prototype.toJSON = function () {
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
import agentRoutes from './routes/agent.routes.js';
import webhooksRoutes from './routes/webhooks.routes.js';
import portalRoutes from './routes/portal.routes.js';
import { startNotificationWorker } from './jobs/notificationWorker.js';

const app = express();

// Stripe webhook — raw body BEFORE express.json()
app.use('/api/webhooks', webhooksRoutes);

// Security Middlewares
// crossOriginResourcePolicy se desactiva para permitir requests desde Vercel/otros orígenes
app.use(helmet({ crossOriginResourcePolicy: false }));

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true); // Permite herramientas locales y Postman

        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://127.0.0.1:5173',
        ];

        // Añadir orígenes desde variable de entorno (separados por coma)
        if (process.env.FRONTEND_URL) {
            allowedOrigins.push(
                ...process.env.FRONTEND_URL.split(',').map(u => u.trim().replace(/^"|"$/g, ''))
            );
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Permitir localhost dinámico en desarrollo
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
            return callback(null, true);
        }

        // Permitir previews de Vercel (*.vercel.app) como safety net
        if (origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }

        console.warn(`[CORS] Origin bloqueado: ${origin}`);
        return callback(new Error(`No permitido por CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    optionsSuccessStatus: 200, // Algunos browsers legacy usan 204 que falla
};

app.use(cors(corsOptions));
// Manejar explícitamente preflight OPTIONS antes de cualquier otra ruta
app.options('/{*splat}', cors(corsOptions));

// Regular body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Agente nutriólogo — sin JWT (protegido por X-Agent-Key opcional)
app.use('/api/agent', agentRoutes);

// Portal Norder Health — autenticación por paciente (JWT tipo 'portal')
app.use('/api/portal', portalRoutes);

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

// ─── Background Jobs ──────────────────────────────────────────────────────────
// NotificationWorker: reintenta planes en cola (OutboundMessageQueue) cada 5 min
startNotificationWorker();

export default app;
