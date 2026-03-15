const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const OTPAuth = require('otpauth');
const QRCode = require('qrcode');
const { getRoles, isAdmin } = require('../utils/access');

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 50, message: 'Trop de créations de comptes. Réessayez dans 1 heure.' });
const totpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Trop de tentatives 2FA. Réessayez dans 15 minutes.' });
const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Trop de tentatives de vérification. Réessayez dans 15 minutes.' });

const router = express.Router();

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] JWT_SECRET is not set! Using default secret is insecure in production.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_oris_key';
const SALT_ROUNDS = 10;
const AVATARS_DIR = process.env.DB_PATH
    ? path.join(path.dirname(process.env.DB_PATH), 'avatars')
    : path.join(__dirname, '..', 'avatars');

if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

async function logConnection(userId, req, success = true) {
    try {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        await db('login_history').insert({
            id: crypto.randomUUID(), user_id: userId, ip_address: ip, user_agent: userAgent, success: success ? 1 : 0,
        });
    } catch (e) {
        console.error('Error logging connection:', e);
    }
}

router.get('/config/allow-api-tokens', async (req, res) => {
    try {
        const config = await db('system_config').where({ key: 'allow_api_tokens' }).select('value').first();
        res.json({ allowApiTokens: config ? config.value === 'true' : true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/register', registerLimiter, async (req, res) => {
    try {
        let { email, password, full_name, roles, fullName } = req.body;
        if (!email || !password || !(full_name || fullName)) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const countResult = await db('user_profiles').count('* as count').first();
        const userCount = countResult.count;
        if (userCount > 0) {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) return res.status(401).json({ error: 'Authentication required to create users' });
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                const requester = await db('user_profiles').where({ id: decoded.id }).select('role').first();
                if (!requester) return res.status(401).json({ error: 'Invalid token' });
                if (!isAdmin(requester.role)) return res.status(403).json({ error: 'Admin access required to create users' });
            } catch (tokenErr) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
        }
        email = email.trim().toLowerCase();

        const existing = await db('user_profiles').where({ email }).select('id').first();
        if (existing) return res.status(409).json({ error: 'User already exists' });

        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        const id = crypto.randomUUID();
        const rolesStr = JSON.stringify(roles || ['user']);

        await db('user_profiles').insert({
            id, email, full_name: fullName || full_name, role: rolesStr, password_hash,
        });

        const token = jwt.sign({ id, email, role: JSON.parse(rolesStr) }, JWT_SECRET, { expiresIn: '7d' });
        logConnection(id, req);

        res.json({
            user: { id, email, user_metadata: { full_name: fullName || full_name, role: JSON.parse(rolesStr) } },
            session: { access_token: token }
        });
    } catch (err) {
        try { fs.appendFileSync(process.env.LOG_PATH || '/tmp/oris-error.log', new Date().toISOString() + ' ' + err.stack + '\n'); } catch (e) { }
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', loginLimiter, async (req, res) => {
    try {
        let { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
        email = email.trim().toLowerCase();

        const user = await db('user_profiles').where({ email })
            .select('id', 'email', 'full_name', 'role', 'password_hash', 'is_active', 'totp_enabled', 'totp_secret').first();
        if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });
        if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });

        if (user.totp_enabled) {
            const tempToken = jwt.sign({ id: user.id, purpose: '2fa' }, JWT_SECRET, { expiresIn: '5m' });
            return res.json({ requires_2fa: true, temp_token: tempToken });
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: getRoles(user.role) }, JWT_SECRET, { expiresIn: '7d' });
        logConnection(user.id, req);

        res.json({
            user: { id: user.id, email: user.email, user_metadata: { full_name: user.full_name, role: getRoles(user.role) } },
            session: { access_token: token }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await db('user_profiles').where({ id: req.user.id })
            .select('id', 'email', 'full_name', 'role', 'is_active', 'pin_hash', 'avatar_url', 'totp_enabled').first();
        if (!user) return res.status(404).json({ error: 'User not found' });
        const has_pin = !!user.pin_hash;
        delete user.pin_hash;
        user.role = getRoles(user.role);

        // Determine navigation capabilities from global roles + beneficiary memberships
        const globalRoles = user.role;
        const isAdminUser = globalRoles.includes('admin');
        const isTeamLead = globalRoles.includes('team_leader');

        let canSeeCases = isAdminUser || isTeamLead;
        let canSeeAlerts = isAdminUser || isTeamLead;

        if (!canSeeCases || !canSeeAlerts) {
            const memberships = await db('beneficiary_members').where({ user_id: req.user.id }).select('role');
            for (const m of memberships) {
                try {
                    const roles = typeof m.role === 'string' ? JSON.parse(m.role) : (m.role || []);
                    if (!canSeeCases && roles.some(r => r.startsWith('case_'))) canSeeCases = true;
                    if (!canSeeAlerts && roles.some(r => r.startsWith('alert_'))) canSeeAlerts = true;
                } catch (e) { /* ignore parse errors */ }
                if (canSeeCases && canSeeAlerts) break;
            }
        }

        res.json({ user: { ...user, has_pin, canSeeCases, canSeeAlerts } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing required fields' });

        const user = await db('user_profiles').where({ id: req.user.id }).first();
        if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Le mot de passe actuel est incorrect' });

        const new_password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await db('user_profiles').where({ id: req.user.id }).update({ password_hash: new_password_hash });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/users', authenticateToken, async (req, res) => {
    try {
        const users = await db('user_profiles').where({ is_active: 1 })
            .select('id', 'email', { fullName: 'full_name' }, 'full_name', 'role', 'is_active');
        users.forEach(u => u.role = getRoles(u.role));
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/avatar', authenticateToken, async (req, res) => {
    try {
        if (!req.files || !req.files.avatar) return res.status(400).json({ error: 'No avatar file uploaded' });
        const avatar = req.files.avatar;
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(avatar.mimetype)) return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are allowed' });
        if (avatar.size > 2 * 1024 * 1024) return res.status(400).json({ error: 'File size must be under 2 MB' });

        const existing = await db('user_profiles').where({ id: req.user.id }).select('avatar_url').first();
        if (existing && existing.avatar_url) {
            const oldPath = path.join(AVATARS_DIR, path.basename(existing.avatar_url));
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        const ext = path.extname(avatar.name) || '.jpg';
        const fileName = `${req.user.id}${ext}`;
        const filePath = path.join(AVATARS_DIR, fileName);
        await avatar.mv(filePath);

        const avatarUrl = `/api/auth/avatar/${req.user.id}?v=${Date.now()}`;
        await db('user_profiles').where({ id: req.user.id }).update({ avatar_url: avatarUrl });
        res.json({ success: true, avatar_url: avatarUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/avatar', authenticateToken, async (req, res) => {
    try {
        const user = await db('user_profiles').where({ id: req.user.id }).select('avatar_url').first();
        if (user && user.avatar_url) {
            const files = fs.readdirSync(AVATARS_DIR).filter(f => f.startsWith(req.user.id));
            files.forEach(f => {
                const fp = path.join(AVATARS_DIR, f);
                if (fs.existsSync(fp)) fs.unlinkSync(fp);
            });
        }
        await db('user_profiles').where({ id: req.user.id }).update({ avatar_url: null });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/avatar/:userId', (req, res) => {
    try {
        const files = fs.readdirSync(AVATARS_DIR).filter(f => f.startsWith(req.params.userId));
        if (files.length === 0) return res.status(404).json({ error: 'Avatar not found' });
        const filePath = path.join(AVATARS_DIR, files[0]);
        res.set('Cache-Control', 'public, max-age=300');
        res.sendFile(filePath);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/pin', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, pin, remove } = req.body;
        if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });

        const user = await db('user_profiles').where({ id: req.user.id }).first();
        if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid password' });

        if (remove) {
            await db('user_profiles').where({ id: req.user.id }).update({ pin_hash: null });
            return res.json({ success: true, has_pin: false });
        }

        if (!pin || !/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4-6 digits' });
        const pin_hash = await bcrypt.hash(pin, SALT_ROUNDS);
        await db('user_profiles').where({ id: req.user.id }).update({ pin_hash });
        res.json({ success: true, has_pin: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/verify-pin', authenticateToken, verifyLimiter, async (req, res) => {
    try {
        const { pin } = req.body;
        if (!pin) return res.status(400).json({ error: 'PIN is required' });

        const user = await db('user_profiles').where({ id: req.user.id }).select('pin_hash').first();
        if (!user || !user.pin_hash) return res.status(400).json({ error: 'No PIN set' });

        const match = await bcrypt.compare(pin, user.pin_hash);
        if (!match) return res.status(401).json({ error: 'Invalid PIN' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/verify-password', authenticateToken, verifyLimiter, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Password is required' });

        const user = await db('user_profiles').where({ id: req.user.id }).select('password_hash').first();
        if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid password' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/users-list', authenticateToken, async (req, res) => {
    try {
        const users = await db('user_profiles').where({ is_active: 1 }).select('id', 'full_name').orderBy('full_name', 'asc');
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api-tokens', authenticateToken, async (req, res) => {
    try {
        const tokens = await db('api_tokens').where({ user_id: req.user.id })
            .select('id', 'name', 'created_at', 'last_used_at').orderBy('created_at', 'desc');
        res.json(tokens);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api-tokens', authenticateToken, async (req, res) => {
    try {
        const config = await db('system_config').where({ key: 'allow_api_tokens' }).select('value').first();
        if (config && config.value === 'false') return res.status(403).json({ error: 'API tokens are globally disabled' });

        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const rawToken = 'oris_tk_' + crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const id = crypto.randomUUID();

        await db('api_tokens').insert({ id, user_id: req.user.id, name, token_hash: tokenHash });
        res.status(201).json({ id, name, token: rawToken });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/api-tokens/:id', authenticateToken, async (req, res) => {
    try {
        const deleted = await db('api_tokens').where({ id: req.params.id, user_id: req.user.id }).del();
        if (deleted === 0) return res.status(404).json({ error: 'Token not found or unauthorized' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        const user = await db('user_profiles').where({ id: req.user.id }).select('id', 'email', 'role', 'is_active').first();
        if (!user || !user.is_active) return res.status(401).json({ error: 'User not found or disabled' });
        const token = jwt.sign({ id: user.id, email: user.email, role: getRoles(user.role) }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ session: { access_token: token } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/login-history', authenticateToken, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const rows = await db('login_history').where({ user_id: req.user.id })
            .select('id', 'ip_address', 'user_agent', 'success', 'created_at')
            .orderBy('created_at', 'desc').limit(limit);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/login-history/all', authenticateToken, async (req, res) => {
    try {
        const currentUser = await db('user_profiles').where({ id: req.user.id }).select('role').first();
        if (!currentUser || !isAdmin(currentUser.role)) return res.status(403).json({ error: 'Admin only' });
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const rows = await db('login_history as lh')
            .leftJoin('user_profiles as u', 'lh.user_id', 'u.id')
            .select('lh.id', 'lh.user_id', 'lh.ip_address', 'lh.user_agent', 'lh.success', 'lh.created_at', 'u.full_name', 'u.email')
            .orderBy('lh.created_at', 'desc').limit(limit);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =============== TOTP 2FA ===============

router.post('/verify-2fa', totpLimiter, async (req, res) => {
    try {
        const { temp_token, code } = req.body;
        if (!temp_token || !code) return res.status(400).json({ error: 'Missing temp_token or code' });

        let decoded;
        try { decoded = jwt.verify(temp_token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Token expiré ou invalide. Veuillez vous reconnecter.' }); }
        if (decoded.purpose !== '2fa') return res.status(401).json({ error: 'Token invalide' });

        const user = await db('user_profiles').where({ id: decoded.id })
            .select('id', 'email', 'full_name', 'role', 'totp_secret', 'totp_enabled').first();
        if (!user || !user.totp_secret || !user.totp_enabled) return res.status(400).json({ error: '2FA non configuré' });

        const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totp_secret), algorithm: 'SHA1', digits: 6, period: 30 });
        const delta = totp.validate({ token: code.replace(/\s/g, ''), window: 1 });
        if (delta === null) return res.status(401).json({ error: 'Code invalide' });

        const token = jwt.sign({ id: user.id, email: user.email, role: getRoles(user.role) }, JWT_SECRET, { expiresIn: '7d' });
        logConnection(user.id, req);

        res.json({
            user: { id: user.id, email: user.email, user_metadata: { full_name: user.full_name, role: getRoles(user.role) } },
            session: { access_token: token }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/2fa/setup', authenticateToken, async (req, res) => {
    try {
        const user = await db('user_profiles').where({ id: req.user.id }).select('email', 'totp_enabled').first();
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.totp_enabled) return res.status(400).json({ error: '2FA déjà activé' });

        const secret = new OTPAuth.Secret();
        const totp = new OTPAuth.TOTP({ issuer: 'ORIS', label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret });
        await db('user_profiles').where({ id: req.user.id }).update({ totp_secret: secret.base32 });

        const uri = totp.toString();
        const qrCode = await QRCode.toDataURL(uri);
        res.json({ secret: secret.base32, qrCode, uri });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/2fa/enable', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Code requis' });

        const user = await db('user_profiles').where({ id: req.user.id }).select('totp_secret', 'totp_enabled').first();
        if (!user || !user.totp_secret) return res.status(400).json({ error: '2FA non configuré. Appelez /2fa/setup d\'abord.' });
        if (user.totp_enabled) return res.status(400).json({ error: '2FA déjà activé' });

        const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totp_secret), algorithm: 'SHA1', digits: 6, period: 30 });
        const delta = totp.validate({ token: code.replace(/\s/g, ''), window: 1 });
        if (delta === null) return res.status(401).json({ error: 'Code invalide. Vérifiez votre application.' });

        await db('user_profiles').where({ id: req.user.id }).update({ totp_enabled: 1 });
        res.json({ success: true, message: '2FA activé avec succès' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/2fa/disable', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Code requis' });

        const user = await db('user_profiles').where({ id: req.user.id }).select('totp_secret', 'totp_enabled').first();
        if (!user || !user.totp_enabled) return res.status(400).json({ error: '2FA non activé' });

        const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totp_secret), algorithm: 'SHA1', digits: 6, period: 30 });
        const delta = totp.validate({ token: code.replace(/\s/g, ''), window: 1 });
        if (delta === null) return res.status(401).json({ error: 'Code invalide' });

        await db('user_profiles').where({ id: req.user.id }).update({ totp_enabled: 0, totp_secret: null });
        res.json({ success: true, message: '2FA désactivé' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
