import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import { getDb } from '../db-arango';
import BaseRepository from '../repositories/BaseRepository';
import authenticateToken from '../middleware/auth';
import { canAccessCase } from '../utils/access';

const router = express.Router();
router.use(authenticateToken);

router.get('/case/:caseId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!await canAccessCase(req.user.id, (req.params.caseId as string))) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const auditRepo = new BaseRepository(getDb(), 'case_audit_log');
        const items = await auditRepo.findWhere(
            { case_id: (req.params.caseId as string) },
            { sort: '-created_at' }
        );

        const parsed = items.map((item: any) => ({
            ...item,
            details: typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {}),
        }));

        res.json(parsed);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
