const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const authenticateToken = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const OTPAuth = require('otpauth');
const QRCode = require('qrcode');
const { getRoles, isAdmin } = require('../utils/access');

const isTest = process.env.NODE_ENV === 'test';
const bypassLimiter = (req, res, next) => next();

const loginLimiter = isTest ? bypassLimiter : rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' });
const registerLimiter = isTest ? bypassLimiter : rateLimit({ windowMs: 60 * 60 * 1000, max: 50, message: 'Trop de créations de comptes. Réessayez dans 1 heure.' });
const totpLimiter = isTest ? bypassLimiter : rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Trop de tentatives 2FA. Réessayez dans 15 minutes.' });
const verifyLimiter = isTest ? bypassLimiter : rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Trop de tentatives de vérification. Réessayez dans 15 minutes.' });

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
        const loginRepo = new BaseRepository(getDb(), 'login_history');
        await loginRepo.create({
            id: crypto.randomUUID(), user_id: userId, ip_address: ip, user_agent: userAgent, success: success ? 1 : 0,
            created_at: new Date().toISOString()
        });
    } catch (e) {
        console.error('Error logging connection:', e);
    }
}

router.get('/config/allow-api-tokens', async (req, res) => {
    try {
        const configRepo = new BaseRepository(getDb(), 'system_config');
        const rows = await configRepo.findWhere({ key: 'allow_api_tokens' });
        const config = rows.length > 0 ? rows[0] : null;
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

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const db = getDb();
        const countCursor = await db.query(`RETURN LENGTH(user_profiles)`);
        const userCount = await countCursor.next();
        
        if (userCount > 0) {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) return res.status(401).json({ error: 'Authentication required to create users' });
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                const requester = await userRepo.findById(decoded.id);
                if (!requester) return res.status(401).json({ error: 'Invalid token' });
                if (!isAdmin(requester.role)) return res.status(403).json({ error: 'Admin access required to create users' });
            } catch (tokenErr) {
                return res.status(401).json({ error: `Invalid or expired token: ${tokenErr.message}` });
            }
        }
        email = email.trim().toLowerCase();

        const existing = await userRepo.findWhere({ email });
        if (existing.length > 0) return res.status(409).json({ error: 'User already exists' });

        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        const id = crypto.randomUUID();
        const rolesStr = JSON.stringify(roles || ['user']);

        await userRepo.create({
            id, email, full_name: fullName || full_name, role: rolesStr, password_hash, is_active: 1, created_at: new Date().toISOString()
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

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const users = await userRepo.findWhere({ email });
        const user = users.length > 0 ? users[0] : null;
        
        if (!user || !user.password_hash) {
            console.error(`LOGIN FAIL PROBE: user lookup returned null for [${email}] or missing password_hash`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            console.error(`LOGIN FAIL PROBE: bcrypt compare failed for [${email}] against hash [${user.password_hash}]`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
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
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const user = await userRepo.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const has_pin = !!user.pin_hash;
        delete user.pin_hash;
        user.role = getRoles(user.role);

        const globalRoles = user.role;
        const isAdminUser = globalRoles.includes('admin');
        const isTeamLead = globalRoles.includes('team_leader');

        let canSeeCases = isAdminUser || isTeamLead;
        let canSeeAlerts = isAdminUser || isTeamLead;

        if (!canSeeCases || !canSeeAlerts) {
            const memberRepo = new BaseRepository(getDb(), 'beneficiary_members');
            const memberships = await memberRepo.findWhere({ user_id: req.user.id });
            for (const m of memberships) {
                try {
                    const roles = typeof m.role === 'string' ? JSON.parse(m.role) : (m.role || []);
                    if (!canSeeCases && roles.some(r => r.startsWith('case_'))) canSeeCases = true;
                    if (!canSeeAlerts && roles.some(r => r.startsWith('alert_'))) canSeeAlerts = true;
                } catch (e) { }
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

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const user = await userRepo.findById(req.user.id);
        if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Le mot de passe actuel est incorrect' });

        const new_password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await userRepo.update(req.user.id, { password_hash: new_password_hash });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/users', authenticateToken, async (req, res) => {
    try {
        const db = getDb();
        const query = `
            FOR u IN user_profiles
            FILTER u.is_active == 1
            SORT u.full_name ASC
            RETURN { id: u._key, email: u.email, full_name: u.full_name, role: u.role, is_active: u.is_active }
        `;
        const cursor = await db.query(query);
        const users = await cursor.all();
        const mappedUsers = users.map(u => ({
            id: u.id, email: u.email, fullName: u.full_name, full_name: u.full_name, role: getRoles(u.role), is_active: u.is_active
        }));
        res.json(mappedUsers);
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

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const existing = await userRepo.findById(req.user.id);
        if (existing && existing.avatar_url) {
            const oldPath = path.join(AVATARS_DIR, path.basename(existing.avatar_url.split('?')[0]));
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        const ext = path.extname(avatar.name) || '.jpg';
        const fileName = `${req.user.id}${ext}`;
        const filePath = path.join(AVATARS_DIR, fileName);
        await avatar.mv(filePath);

        const avatarUrl = `/api/auth/avatar/${req.user.id}?v=${Date.now()}`;
        await userRepo.update(req.user.id, { avatar_url: avatarUrl });
        res.json({ success: true, avatar_url: avatarUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/avatar', authenticateToken, async (req, res) => {
    try {
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const user = await userRepo.findById(req.user.id);
        if (user && user.avatar_url) {
            const files = fs.readdirSync(AVATARS_DIR).filter(f => f.startsWith(req.user.id));
            files.forEach(f => {
                const fp = path.join(AVATARS_DIR, f);
                if (fs.existsSync(fp)) fs.unlinkSync(fp);
            });
        }
        await userRepo.update(req.user.id, { avatar_url: null });
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

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const user = await userRepo.findById(req.user.id);
        if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid password' });

        if (remove) {
            await userRepo.update(req.user.id, { pin_hash: null });
            return res.json({ success: true, has_pin: false });
        }

        if (!pin || !/^\d{4,6}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4-6 digits' });
        const pin_hash = await bcrypt.hash(pin, SALT_ROUNDS);
        await userRepo.update(req.user.id, { pin_hash });
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

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const user = await userRepo.findById(req.user.id);
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

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const user = await userRepo.findById(req.user.id);
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
        const db = getDb();
        const cursor = await db.query(`FOR u IN user_profiles FILTER u.is_active == 1 SORT u.full_name ASC RETURN { id: u._key, full_name: u.full_name }`);
        const users = await cursor.all();
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/api-tokens', authenticateToken, async (req, res) => {
    try {
        const tokenRepo = new BaseRepository(getDb(), 'api_tokens');
        const tokens = await tokenRepo.findWhere({ user_id: req.user.id }, { sort: '-created_at' });
        res.json(tokens.map(t => ({ id: t.id, name: t.name, created_at: t.created_at, last_used_at: t.last_used_at })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api-tokens', authenticateToken, async (req, res) => {
    try {
        const configRepo = new BaseRepository(getDb(), 'system_config');
        const rows = await configRepo.findWhere({ key: 'allow_api_tokens' });
        const config = rows.length > 0 ? rows[0] : null;
        if (config && config.value === 'false') return res.status(403).json({ error: 'API tokens are globally disabled' });

        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const rawToken = 'oris_tk_' + crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const id = crypto.randomUUID();

        const tokenRepo = new BaseRepository(getDb(), 'api_tokens');
        await tokenRepo.create({
            id, user_id: req.user.id, name, token_hash: tokenHash, created_at: new Date().toISOString()
        });
        res.status(201).json({ id, name, token: rawToken });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/api-tokens/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDb();
        await db.query(`FOR t IN api_tokens FILTER t._key == @id AND t.user_id == @userId REMOVE t IN api_tokens`, { id: req.params.id, userId: req.user.id });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const user = await userRepo.findById(req.user.id);
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
        const db = getDb();
        const cursor = await db.query(`FOR l IN login_history FILTER l.user_id == @userId SORT l.created_at DESC LIMIT @limit RETURN { id: l._key, ip_address: l.ip_address, user_agent: l.user_agent, success: l.success, created_at: l.created_at }`, { userId: req.user.id, limit });
        const rows = await cursor.all();
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/login-history/all', authenticateToken, async (req, res) => {
    try {
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUser = await userRepo.findById(req.user.id);
        if (!currentUser || !isAdmin(currentUser.role)) return res.status(403).json({ error: 'Admin only' });
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        
        const db = getDb();
        const aql = `
            FOR lh IN login_history
                SORT lh.created_at DESC
                LIMIT ${limit}
                LET u = DOCUMENT('user_profiles', lh.user_id)
                RETURN {
                    id: lh._key, user_id: lh.user_id, ip_address: lh.ip_address, 
                    user_agent: lh.user_agent, success: lh.success, created_at: lh.created_at,
                    full_name: u.full_name, email: u.email
                }
        `;
        const cursor = await db.query(aql);
        const rows = await cursor.all();
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

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const user = await userRepo.findById(decoded.id);
        if (!user || !user.totp_secret || !user.totp_enabled) return res.status(400).json({ error: '2FA non configuré' });

        const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totp_secret), algorithm: 'SHA1', digits: 6, period: 30 });
        const delta = totp.validate({ token: code.replace(/\\s/g, ''), window: 1 });
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
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const user = await userRepo.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.totp_enabled) return res.status(400).json({ error: '2FA déjà activé' });

        const secret = new OTPAuth.Secret();
        const totp = new OTPAuth.TOTP({ issuer: 'ORIS', label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret });
        await userRepo.update(req.user.id, { totp_secret: secret.base32 });

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

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const user = await userRepo.findById(req.user.id);
        if (!user || !user.totp_secret) return res.status(400).json({ error: "2FA non configuré. Appelez /2fa/setup d'abord." });
        if (user.totp_enabled) return res.status(400).json({ error: '2FA déjà activé' });

        const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totp_secret), algorithm: 'SHA1', digits: 6, period: 30 });
        const delta = totp.validate({ token: code.replace(/\\s/g, ''), window: 1 });
        if (delta === null) return res.status(401).json({ error: 'Code invalide. Vérifiez votre application.' });

        await userRepo.update(req.user.id, { totp_enabled: 1 });
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

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const user = await userRepo.findById(req.user.id);
        if (!user || !user.totp_enabled) return res.status(400).json({ error: '2FA non activé' });

        const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.totp_secret), algorithm: 'SHA1', digits: 6, period: 30 });
        const delta = totp.validate({ token: code.replace(/\\s/g, ''), window: 1 });
        if (delta === null) return res.status(401).json({ error: 'Code invalide' });

        await userRepo.update(req.user.id, { totp_enabled: 0, totp_secret: null });
        res.json({ success: true, message: '2FA désactivé' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
