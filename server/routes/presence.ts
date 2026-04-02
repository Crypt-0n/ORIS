import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import authenticateToken from '../middleware/auth';
import { PresenceService } from '../services/PresenceService';

const router = express.Router();
router.use(authenticateToken);

const heartbeatSchema = z.object({
    caseId: z.string().min(1),
    taskId: z.string().optional()
});

router.post('/heartbeat', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = heartbeatSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'caseId required' });
            return;
        }
        await PresenceService.updatePresence(req.user.id, validation.data.caseId, validation.data.taskId);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/case/:caseId', (req: AuthenticatedRequest, res: Response) => {
    try {
        const active = PresenceService.getActiveOnCase((req.params.caseId as string), req.user.id);
        res.json(active);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/task/:taskId', (req: AuthenticatedRequest, res: Response) => {
    try {
        const active = PresenceService.getActiveOnTask((req.params.taskId as string), req.user.id);
        res.json(active);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
