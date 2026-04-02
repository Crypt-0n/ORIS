import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db-arango';
import BaseRepository from '../repositories/BaseRepository';
import { InvestigationService } from '../services/InvestigationService';
import authenticateToken from '../middleware/auth';
import { setHttpCache } from '../middleware/cache';
import { canAccessCase } from '../utils/access';

const router = express.Router();
router.use(authenticateToken);

// ─── Timeline (STIX-native, read-only) ─────────────────────────
router.get('/timeline/:caseId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!await canAccessCase(req.user.id, (req.params.caseId as string))) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const timeline = await InvestigationService.getTimeline((req.params.caseId as string));
        res.json(timeline);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Audit log ──────────────────────────────────────────────────
const auditRouter = express.Router({ mergeParams: true });
auditRouter.get('/by-case/:caseId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!await canAccessCase(req.user.id, (req.params.caseId as string))) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const items = await InvestigationService.getAuditLogByCaseId((req.params.caseId as string));
        res.json(items);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.use('/audit', auditRouter);

// ─── STIX Objects per Task (Unified API) ────────────────────────

router.get('/stix/by-task/:taskId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const taskRepo = new BaseRepository(getDb(), 'tasks');
        const task = await taskRepo.findById((req.params.taskId as string));
        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        if (!await canAccessCase(req.user.id, task.case_id)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const objects = await InvestigationService.getStixObjectsByTaskId((req.params.taskId as string));
        res.json(objects);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/stix/by-case/:caseId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!await canAccessCase(req.user.id, (req.params.caseId as string))) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const objects = await InvestigationService.getStixObjectsByCaseId((req.params.caseId as string));
        res.json(objects);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const stixCreationSchema = z.object({
    case_id: z.string().min(1),
    task_id: z.string().min(1),
    stix_type: z.enum(['infrastructure', 'user-account', 'malware', 'ipv4-addr', 'domain-name', 'url']),
    data: z.any()
});

router.post('/stix', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = stixCreationSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
            return;
        }
        const { case_id, task_id, stix_type, data } = validation.data;
        
        if (!await canAccessCase(req.user.id, case_id)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        
        const objects = await InvestigationService.createStixEntity(case_id, task_id, stix_type, data, req.user.id);
        res.status(201).json({ objects });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const stixUpdateSchema = z.object({
    case_id: z.string().min(1),
    stix_type: z.string().min(1),
    data: z.any()
});

router.put('/stix/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = stixUpdateSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
            return;
        }
        const { case_id, stix_type, data } = validation.data;
        
        if (!await canAccessCase(req.user.id, case_id)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        
        const updated = await InvestigationService.updateStixEntity((req.params.id as string), case_id, stix_type, data, req.user.id);
        res.status(200).json(updated);
    } catch (err: any) {
        console.error(err);
        if (err.message === 'STIX object not found') {
            res.status(404).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/stix/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const obj = await InvestigationService.getStixObjectById((req.params.id as string));
        if (!obj) {
            res.status(404).json({ error: 'STIX object not found' });
            return;
        }
        if (!await canAccessCase(req.user.id, obj.case_id)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        
        await InvestigationService.deleteStixEntity((req.params.id as string), req.user.id);
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Reference data ─────────────────────────────────────────────

router.get('/severities', setHttpCache(86400), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const rows = await InvestigationService.getSeverities();
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/tlp', setHttpCache(86400), (req: AuthenticatedRequest, res: Response) => {
    res.json([
        { id: 'RED', code: 'RED', label: 'TLP:RED', description: 'Restreint aux participants', color: '#FF2B2B' },
        { id: 'AMBER', code: 'AMBER', label: 'TLP:AMBER', description: 'Restreint aux organisations', color: '#FFC000' },
        { id: 'AMBER+STRICT', code: 'AMBER+STRICT', label: 'TLP:AMBER+STRICT', description: "Restreint à l'organisation", color: '#FFC000' },
        { id: 'GREEN', code: 'GREEN', label: 'TLP:GREEN', description: 'Restreint à la communauté', color: '#33FF00' },
        { id: 'CLEAR', code: 'CLEAR', label: 'TLP:CLEAR', description: 'Public', color: '#FFFFFF' },
    ]);
});

router.get('/pap', setHttpCache(86400), (req: AuthenticatedRequest, res: Response) => {
    res.json([
        { id: 'RED', code: 'RED', label: 'PAP:RED', description: 'Action non détectable sur le réseau', color: '#FF2B2B' },
        { id: 'AMBER', code: 'AMBER', label: 'PAP:AMBER', description: 'Recherche passive sur source payante', color: '#FFC000' },
        { id: 'GREEN', code: 'GREEN', label: 'PAP:GREEN', description: 'Recherche passive', color: '#33FF00' },
        { id: 'CLEAR', code: 'CLEAR', label: 'PAP:CLEAR', description: 'Aucune restriction', color: '#FFFFFF' },
    ]);
});

module.exports = router;
