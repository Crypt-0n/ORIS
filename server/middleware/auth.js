const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
try { require('dotenv').config(); } catch (e) { }

const JWT_SECRET = process.env.JWT_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: JWT_SECRET environment variable is required in production.');
        process.exit(1);
    }
    return 'dev_secret_oris_key';
})();

async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const cookieToken = req.cookies && req.cookies.oris_jwt;
    const isFileRoute = req.path.startsWith('/download') || req.path.startsWith('/api/files');
    const token = cookieToken || (authHeader && authHeader.split(' ')[1]) || (isFileRoute ? req.query.token : null);

    if (!token) return res.status(401).json({ error: 'Access token missing or invalid' });

    // Try JWT first
    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
        decoded = null;
    }

    if (decoded) {
        try {
            const userRepo = new BaseRepository(getDb(), 'user_profiles');
            const dbUser = await userRepo.findById(decoded.id);
            if (!dbUser || !dbUser.is_active) return res.status(403).json({ error: 'Account disabled' });
            
            // On injecte les données fraîches de la DB (notamment les rôles à jour)
            // plutôt que de se fier uniquement au token pour éviter une 2e vérif RBAC
            req.user = { id: dbUser._key || dbUser.id, email: dbUser.email, role: dbUser.role };
            return next();
        } catch (dbErr) {
            console.error('JWT activity check error:', dbErr);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // JWT failed/expired — check API token
    try {
        const configRepo = new BaseRepository(getDb(), 'system_config');
        const config = await configRepo.findById('allow_api_tokens');
        if (config && config.value === 'false') return res.status(401).json({ error: 'Invalid token or API tokens disabled' });

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        const tokenRepo = new BaseRepository(getDb(), 'api_tokens');
        const aql = `
            FOR t IN api_tokens
                FILTER t.token_hash == @tokenHash
                LET u = DOCUMENT('user_profiles', t.user_id)
                RETURN MERGE(t, { email: u.email, role: u.role, is_active: u.is_active })
        `;
        const tokens = await tokenRepo.query(aql, { tokenHash });
        const apiToken = tokens[0];

        if (!apiToken) return res.status(401).json({ error: 'Invalid token' });
        if (!apiToken.is_active) return res.status(403).json({ error: 'Account disabled' });

        await tokenRepo.update(apiToken.id, { last_used_at: new Date().toISOString() });

        req.user = {
            id: apiToken.user_id,
            email: apiToken.email,
            role: JSON.parse(apiToken.role || '["user"]'),
        };
        next();
    } catch (dbErr) {
        console.error('API token verification error:', dbErr);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = authenticateToken;
