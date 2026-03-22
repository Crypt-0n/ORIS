const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const authenticateToken = require('../middleware/auth');
const { sendPushToUser } = require('../utils/push');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
    try {
        const repo = new BaseRepository(getDb(), 'notifications');
        const notifications = await repo.findWhere({ user_id: req.user.id }, { sort: '-created_at', limit: 50 });
        res.json(notifications);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/unread-count', async (req, res) => {
    try {
        const db = getDb();
        const cursor = await db.query(`
            FOR n IN notifications
            FILTER n.user_id == @userId AND n.is_read == 0
            COLLECT WITH COUNT INTO length
            RETURN length
        `, { userId: req.user.id });
        const count = await cursor.next();
        res.json({ count });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id/read', async (req, res) => {
    try {
        const db = getDb();
        await db.query(`
            FOR n IN notifications
            FILTER n._key == @id AND n.user_id == @userId
            UPDATE n WITH { is_read: 1 } IN notifications
        `, { id: req.params.id, userId: req.user.id });
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/read-all', async (req, res) => {
    try {
        const db = getDb();
        await db.query(`
            FOR n IN notifications
            FILTER n.user_id == @userId AND n.is_read == 0
            UPDATE n WITH { is_read: 1 } IN notifications
        `, { userId: req.user.id });
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/all', async (req, res) => {
    try {
        const db = getDb();
        await db.query(`
            FOR n IN notifications
            FILTER n.user_id == @userId
            REMOVE n IN notifications
        `, { userId: req.user.id });
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        await db.query(`
            FOR n IN notifications
            FILTER n._key == @id AND n.user_id == @userId
            REMOVE n IN notifications
        `, { id: req.params.id, userId: req.user.id });
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/subscribe', async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        if (!endpoint || !keys || !keys.p256dh || !keys.auth) return res.status(400).json({ error: 'Invalid subscription' });
        
        const db = getDb();
        await db.query(`
            FOR s IN push_subscriptions
            FILTER s.endpoint == @endpoint
            REMOVE s IN push_subscriptions
        `, { endpoint });

        const id = crypto.randomUUID();
        const repo = new BaseRepository(db, 'push_subscriptions');
        await repo.create({ id, user_id: req.user.id, endpoint, keys_p256dh: keys.p256dh, keys_auth: keys.auth });
        
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (endpoint) {
            const db = getDb();
            await db.query(`
                FOR s IN push_subscriptions
                FILTER s.endpoint == @endpoint AND s.user_id == @userId
                REMOVE s IN push_subscriptions
            `, { endpoint, userId: req.user.id });
        }
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/vapid-public-key', async (req, res) => {
    try {
        const repo = new BaseRepository(getDb(), 'system_config');
        const rows = await repo.findWhere({ key: 'vapid_public_key' });
        if (rows.length === 0) return res.status(404).json({ error: 'VAPID keys not configured' });
        res.json({ publicKey: rows[0].value });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/preferences', async (req, res) => {
    try {
        const repo = new BaseRepository(getDb(), 'user_profiles');
        const user = await repo.findById(req.user.id);
        const prefs = JSON.parse(user?.notification_preferences || '{}');
        const defaults = { mention: true, assignment: true, task_status: true, task_comment: true, case_status: true };
        res.json({ ...defaults, ...prefs });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/preferences', async (req, res) => {
    try {
        const repo = new BaseRepository(getDb(), 'user_profiles');
        await repo.update(req.user.id, { notification_preferences: JSON.stringify(req.body) });
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

async function getUserNotificationPreferences(userId) {
    try {
        const repo = new BaseRepository(getDb(), 'user_profiles');
        const user = await repo.findById(userId);
        const prefs = JSON.parse(user?.notification_preferences || '{}');
        const defaults = { mention: true, assignment: true, task_status: true, task_comment: true, case_status: true };
        return { ...defaults, ...prefs };
    } catch {
        return { mention: true, assignment: true, task_status: true, task_comment: true, case_status: true };
    }
}

async function createNotification(userId, type, title, body, link) {
    const prefs = await getUserNotificationPreferences(userId);
    if (prefs[type] === false) return null;
    const id = crypto.randomUUID();
    const repo = new BaseRepository(getDb(), 'notifications');
    await repo.create({ id, user_id: userId, type, title, body, link, is_read: 0, created_at: new Date().toISOString() });
    sendPushToUser(userId, { title, body, link }).catch(err => console.error('Push notification error:', err.message));
    return id;
}

module.exports = router;
module.exports.createNotification = createNotification;
