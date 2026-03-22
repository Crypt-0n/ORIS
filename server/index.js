// Enable TypeScript file imports (tsx register)
require('tsx/cjs/api').register();

const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');

process.on('uncaughtException', (err) => {
    try { fs.appendFileSync(path.join(process.env.LOG_PATH || '/tmp', 'crash.log'), new Date().toISOString() + ' ' + err.stack + '\n'); } catch (e) { }
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

try {
    require('dotenv').config();
} catch (e) {
    // In production, environment variables are provided by Docker
}

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
}));
app.use(express.json());
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

const PORT = process.env.PORT || 3001;

// Wait for migrations, then start services that depend on the database
const dbReady = require('./init_db');

async function start() {
    // Wait for database migrations to complete
    await dbReady;

    // Initialize VAPID keys for push notifications (requires system_config table)
    const { initVapid } = require('./utils/push');
    await initVapid().catch(e => console.error('[Push] VAPID init error:', e.message));

    // Start backup scheduler
    const { startScheduler } = require('./utils/backup');
    await startScheduler().catch(e => console.error('[Backup] Scheduler init error:', e.message));

    if (require.main === module) {
        app.listen(PORT, () => {
            console.log(`[Backend] Server listening on port ${PORT}`);
        });
    }
}

start().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});

module.exports = app;
