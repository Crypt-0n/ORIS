import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import authenticateToken from '../middleware/auth';
import { getDb } from '../db-arango';
import BaseRepository from '../repositories/BaseRepository';
import { requireAdmin } from '../utils/access';

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

const AVAILABLE_EVENTS = [
    'case_created', 'case_closed', 'case_reopened', 'case_updated',
    'task_created', 'task_closed', 'task_reopened', 'task_updated',
    'comment_added', 'assignment_added', 'assignment_removed',
];

router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const repo = new BaseRepository(getDb(), 'webhooks');
        const webhooks = await repo.findWhere({}, { sort: '-created_at' });
        res.json({ webhooks, availableEvents: AVAILABLE_EVENTS });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal error' });
    }
});

router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { name, url, events, secret } = req.body;
        if (!name || !url) {
            res.status(400).json({ error: 'Name and URL required' });
            return;
        }
        const id = crypto.randomUUID();
        const repo = new BaseRepository(getDb(), 'webhooks');
        await repo.create({
            id, name, url,
            events: JSON.stringify(events || ['*']),
            secret: secret || null,
            created_at: new Date().toISOString()
        });
        const webhook = await repo.findById(id);
        res.status(201).json(webhook);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Create failed' });
    }
});

router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { name, url, events, secret, enabled } = req.body;
        const repo = new BaseRepository(getDb(), 'webhooks');
        const existing = await repo.findById((req.params.id as string));
        if (!existing) {
            res.status(404).json({ error: 'Not found' });
            return;
        }

        await repo.update((req.params.id as string), {
            name: name || existing.name,
            url: url || existing.url,
            events: events ? JSON.stringify(events) : existing.events,
            secret: secret !== undefined ? (secret || null) : existing.secret,
            enabled: enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        });
        const updated = await repo.findById((req.params.id as string));
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Update failed' });
    }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const repo = new BaseRepository(getDb(), 'webhooks');
        const existing = await repo.findById((req.params.id as string));
        if (!existing) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        await repo.delete((req.params.id as string));
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Delete failed' });
    }
});

router.post('/:id/test', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const repo = new BaseRepository(getDb(), 'webhooks');
        const wh = await repo.findById((req.params.id as string));
        if (!wh) {
            res.status(404).json({ error: 'Not found' });
            return;
        }

        const body = JSON.stringify({ event: 'test', timestamp: new Date().toISOString(), data: { message: 'Test webhook from ORIS' } });
        const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-ORIS-Event': 'test' };
        
        if (wh.secret) {
            const signature = crypto.createHmac('sha256', wh.secret).update(body).digest('hex');
            headers['X-ORIS-Signature'] = `sha256=${signature}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(wh.url, {
            method: 'POST',
            headers,
            body,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        await repo.update(wh.id, { last_triggered_at: new Date().toISOString() });
        res.json({ success: true, status: response.status, statusText: response.statusText });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Test failed', details: err.message });
    }
});

module.exports = router;
