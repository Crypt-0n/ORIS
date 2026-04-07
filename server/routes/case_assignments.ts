import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import authenticateToken from '../middleware/auth';
import { CaseAssignmentService } from '../services/CaseAssignmentService';

const router = express.Router();
router.use(authenticateToken);

const assignSchema = z.object({
    case_id: z.string().min(1),
    user_id: z.string().min(1)
});

router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = assignSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'Missing case_id or user_id' });
            return;
        }

        const id = await CaseAssignmentService.assignUser(validation.data.case_id, validation.data.user_id, req.user.id);
        res.status(201).json({ success: true, id });
    } catch (err: any) {
        console.error('[ERROR] POST /case_assignments:', err.message);
        if (err.message === 'Case not found') {
            res.status(404).json({ error: err.message });
            return;
        }
        if (err.message.includes('authorized') || err.message.includes('not a member')) {
            const status = err.message.includes('authorized') ? 403 : 400;
            res.status(status).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        await CaseAssignmentService.removeAssignment((req.params.id as string), req.user.id);
        res.json({ success: true });
    } catch (err: any) {
        console.error(err);
        if (err.message === 'Assignment not found') {
            res.status(404).json({ error: err.message });
            return;
        }
        if (err.message.includes('authorized')) {
            res.status(403).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
