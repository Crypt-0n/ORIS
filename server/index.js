// Enable TypeScript file imports (tsx register)
require('tsx/cjs/api').register();

const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

process.on('uncaughtException', (err) => {
    try { fs.appendFileSync(path.join(process.env.LOG_PATH || '/tmp', 'crash.log'), new Date().toISOString() + ' ' + err.stack + '\n'); } catch (e) { }
    logger.fatal({ err }, 'Uncaught Exception');
    process.exit(1);
});

try {
    require('dotenv').config();
} catch (e) {
    // In production, environment variables are provided by Docker
}

const app = express();

// CORS : restreindre explicitement en production
const corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin && process.env.NODE_ENV === 'production') {
    logger.warn('[Security] CORS_ORIGIN is not set. Cross-origin requests will be rejected in production. Set CORS_ORIGIN to your frontend domain.');
}
app.use(cors({
    origin: corsOrigin || (process.env.NODE_ENV === 'production' ? false : true),
    credentials: true
}));

// Sécurité HTTP Headers
app.use(helmet());

// Cookies et JSON
app.use(cookieParser());
app.use(express.json());

// Limitation de requêtes (Global contre le brute force scraping)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // Limite à 2000 requêtes par IP via API (assez large pour l'utilisation normale)
    message: 'Trop de requêtes effectuées depuis cette IP, veuillez réessayer plus tard.',
    standardHeaders: true, 
    legacyHeaders: false,
});
app.use('/api/', globalLimiter);

app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    useTempFiles: true,
    tempFileDir: '/tmp/',
    abortOnLimit: true,
}));

// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'ORIS API running' });
});

// Swagger Documentation
const setupSwagger = require('./swagger');
setupSwagger(app);

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/investigation', require('./routes/investigation'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/files', require('./routes/files'));
app.use('/api/case_assignments', require('./routes/case_assignments'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/config', require('./routes/config'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/presence', require('./routes/presence'));
app.use('/api/search', require('./routes/search'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/stix', require('./routes/stix'));
app.use('/api/kb', require('./routes/kb'));

const PORT = process.env.PORT || 3001;

// Wait for migrations, then start services that depend on the database
const dbReady = require('./init_db');

async function start() {
    // Wait for database migrations to complete
    await dbReady;

    // Initialize VAPID keys for push notifications (requires system_config table)
    const { initVapid } = require('./utils/push');
    await initVapid().catch(e => logger.error({ err: e }, '[Push] VAPID init error'));

    // Start backup scheduler
    const { startScheduler } = require('./utils/backup');
    await startScheduler().catch(e => logger.error({ err: e }, '[Backup] Scheduler init error'));

    if (require.main === module) {
        app.listen(PORT, () => {
            logger.info(`[Backend] Server listening on port ${PORT}`);
        });
    }
}

start().catch(err => {
    logger.fatal({ err }, 'Fatal startup error');
    process.exit(1);
});

module.exports = app;
