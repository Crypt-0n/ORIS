const express = require('express');
const crypto = require('crypto');
const authenticateToken = require('../middleware/auth');
const db = require('../db');
const { requireAdmin } = require('../utils/access');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

const AVAILABLE_EVENTS = [
    'case_created', 'case_closed', 'case_reopened', 'case_updated',
    'task_created', 'task_closed', 'task_reopened', 'task_updated',
    'comment_added', 'assignment_added', 'assignment_removed',
];

router.get('/', async (req, res) => {
    try {
        const webhooks = await db('webhooks').orderBy('created_at', 'desc');
        res.json({ webhooks, availableEvents: AVAILABLE_EVENTS });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

router.post('/', async (req, res) => {
    try {
        const { name, url, events, secret } = req.body;
        if (!name || !url) return res.status(400).json({ error: 'Name and URL required' });
        const id = crypto.randomUUID();
        await db('webhooks').insert({ id, name, url, events: JSON.stringify(events || ['*']), secret: secret || null });
        const webhook = await db('webhooks').where({ id }).first();
        res.status(201).json(webhook);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Create failed' }); }
});

router.put('/:id', async (req, res) => {
    try {
        const { name, url, events, secret, enabled } = req.body;
        const existing = await db('webhooks').where({ id: req.params.id }).first();
        if (!existing) return res.status(404).json({ error: 'Not found' });

        await db('webhooks').where({ id: req.params.id }).update({
            name: name || existing.name,
            url: url || existing.url,
            events: events ? JSON.stringify(events) : existing.events,
            secret: secret !== undefined ? (secret || null) : existing.secret,
            enabled: enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        });
        const updated = await db('webhooks').where({ id: req.params.id }).first();
        res.json(updated);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Update failed' }); }
});

router.delete('/:id', async (req, res) => {
    try {
        const deleted = await db('webhooks').where({ id: req.params.id }).del();
        if (deleted === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Delete failed' }); }
});

router.post('/:id/test', async (req, res) => {
    try {
        const wh = await db('webhooks').where({ id: req.params.id }).first();
        if (!wh) return res.status(404).json({ error: 'Not found' });

        const body = JSON.stringify({ event: 'test', timestamp: new Date().toISOString(), data: { message: 'Test webhook from ORIS' } });
        const headers = { 'Content-Type': 'application/json', 'X-ORIS-Event': 'test' };
        if (wh.secret) {
            headers['X-ORIS-Signature'] = `sha256=${crypto.createHmac('sha256', wh.secret).update(body).digest('hex')}`;
        }

        const response = await fetch(wh.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
        await db('webhooks').where({ id: wh.id }).update({ last_triggered_at: new Date().toISOString() });
        res.json({ success: true, status: response.status, statusText: response.statusText });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Test failed' }); }
});

module.exports = router;
