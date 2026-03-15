const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { sendPushToUser } = require('../utils/push');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
    try {
        const notifications = await db('notifications').where({ user_id: req.user.id })
            .orderBy('created_at', 'desc').limit(50);
        res.json(notifications);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/unread-count', async (req, res) => {
    try {
        const result = await db('notifications').where({ user_id: req.user.id, is_read: 0 }).count('* as count').first();
        res.json({ count: result.count });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id/read', async (req, res) => {
    try {
        await db('notifications').where({ id: req.params.id, user_id: req.user.id }).update({ is_read: 1 });
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/read-all', async (req, res) => {
    try {
        await db('notifications').where({ user_id: req.user.id, is_read: 0 }).update({ is_read: 1 });
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/all', async (req, res) => {
    try {
        await db('notifications').where({ user_id: req.user.id }).del();
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await db('notifications').where({ id: req.params.id, user_id: req.user.id }).del();
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/subscribe', async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        if (!endpoint || !keys || !keys.p256dh || !keys.auth) return res.status(400).json({ error: 'Invalid subscription' });
        await db('push_subscriptions').where({ endpoint }).del();
        const id = crypto.randomUUID();
        await db('push_subscriptions').insert({ id, user_id: req.user.id, endpoint, keys_p256dh: keys.p256dh, keys_auth: keys.auth });
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (endpoint) await db('push_subscriptions').where({ endpoint, user_id: req.user.id }).del();
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/vapid-public-key', async (req, res) => {
    try {
        const row = await db('system_config').where({ key: 'vapid_public_key' }).select('value').first();
        if (!row) return res.status(404).json({ error: 'VAPID keys not configured' });
        res.json({ publicKey: row.value });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/preferences', async (req, res) => {
    try {
        const user = await db('user_profiles').where({ id: req.user.id }).select('notification_preferences').first();
        const prefs = JSON.parse(user?.notification_preferences || '{}');
        const defaults = { mention: true, assignment: true, task_status: true, task_comment: true, case_status: true };
        res.json({ ...defaults, ...prefs });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/preferences', async (req, res) => {
    try {
        await db('user_profiles').where({ id: req.user.id }).update({ notification_preferences: JSON.stringify(req.body) });
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

async function getUserNotificationPreferences(userId) {
    try {
        const user = await db('user_profiles').where({ id: userId }).select('notification_preferences').first();
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
    await db('notifications').insert({ id, user_id: userId, type, title, body, link });
    sendPushToUser(userId, { title, body, link }).catch(err => console.error('Push notification error:', err.message));
    return id;
}

module.exports = router;
module.exports.createNotification = createNotification;
