const jwt = require('jsonwebtoken');
const db = require('../db');
const crypto = require('crypto');
try { require('dotenv').config(); } catch (e) { }

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_oris_key';

async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const isFileRoute = req.path.startsWith('/download') || req.path.startsWith('/api/files');
    const token = (authHeader && authHeader.split(' ')[1]) || (isFileRoute ? req.query.token : null);

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
            const dbUser = await db('user_profiles').where({ id: decoded.id }).select('is_active').first();
            if (!dbUser || !dbUser.is_active) return res.status(403).json({ error: 'Account disabled' });
            req.user = decoded;
            return next();
        } catch (dbErr) {
            console.error('JWT activity check error:', dbErr);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // JWT failed/expired — check API token
    try {
        const config = await db('system_config').where({ key: 'allow_api_tokens' }).select('value').first();
        if (config && config.value === 'false') return res.status(401).json({ error: 'Invalid token or API tokens disabled' });

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const apiToken = await db('api_tokens as t')
            .join('user_profiles as u', 't.user_id', 'u.id')
            .where('t.token_hash', tokenHash)
            .select('t.*', 'u.email', 'u.role', 'u.is_active')
            .first();

        if (!apiToken) return res.status(401).json({ error: 'Invalid token' });
        if (!apiToken.is_active) return res.status(403).json({ error: 'Account disabled' });

        await db('api_tokens').where({ id: apiToken.id }).update({ last_used_at: new Date().toISOString() });

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
