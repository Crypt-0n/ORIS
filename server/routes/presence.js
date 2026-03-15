const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const presenceMap = new Map();

const presenceCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of presenceMap) {
        if (now - entry.lastSeen > 20000) presenceMap.delete(key);
    }
}, 15000);
presenceCleanup.unref();

router.post('/heartbeat', async (req, res) => {
    try {
        const { caseId, taskId } = req.body;
        if (!caseId) return res.status(400).json({ error: 'caseId required' });

        const user = await db('user_profiles').where({ id: req.user.id }).select('full_name').first();
        presenceMap.set(req.user.id, {
            userId: req.user.id, fullName: user?.full_name || 'Inconnu',
            caseId, taskId: taskId || null, lastSeen: Date.now(),
        });
        res.json({ ok: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/case/:caseId', (req, res) => {
    try {
        const now = Date.now();
        const active = [];
        for (const [, entry] of presenceMap) {
            if (entry.caseId === req.params.caseId && now - entry.lastSeen < 20000 && entry.userId !== req.user.id) {
                active.push({ userId: entry.userId, fullName: entry.fullName, taskId: entry.taskId });
            }
        }
        res.json(active);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/task/:taskId', (req, res) => {
    try {
        const now = Date.now();
        const active = [];
        for (const [, entry] of presenceMap) {
            if (entry.taskId === req.params.taskId && now - entry.lastSeen < 20000 && entry.userId !== req.user.id) {
                active.push({ userId: entry.userId, fullName: entry.fullName });
            }
        }
        res.json(active);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
