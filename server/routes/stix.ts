import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import authenticateToken from '../middleware/auth';
import { StixCoreService } from '../services/StixCoreService';

const router = express.Router();
router.use(authenticateToken);

router.get('/objects/by-case/:caseId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const objects = await StixCoreService.getObjectsByCaseId((req.params.caseId as string), req.user.id);
        res.json(objects);
    } catch (err: any) {
        console.error('STIX getObjectsByCaseId error:', err);
        if (err.message === 'Access denied') {
            res.status(403).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/objects/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const obj = await StixCoreService.getObjectById((req.params.id as string));
        if (!obj) {
            res.status(404).json({ error: 'Object not found' });
            return;
        }
        res.json(obj.data);
    } catch (err) {
        console.error('STIX getObjectById error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const createStixSchema = z.object({
    case_id: z.string().min(1),
}).passthrough();

router.post('/objects', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = createStixSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'Missing case_id' });
            return;
        }
        
        const { case_id, ...stixData } = validation.data;
        const result = await StixCoreService.createObject(case_id as string, stixData, req.user.id);
        res.json(result);
    } catch (err: any) {
        console.error('STIX createObject error:', err);
        if (err.message === 'Access denied') {
            res.status(403).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

const updateStixSchema = z.record(z.string(), z.any());

router.put('/objects/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = updateStixSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'Invalid body' });
            return;
        }
        const result = await StixCoreService.updateObject((req.params.id as string), validation.data, req.user.id);
        res.json(result);
    } catch (err: any) {
        console.error('STIX updateObject error:', err);
        if (err.message === 'Object not found') {
            res.status(404).json({ error: err.message });
            return;
        }
        if (err.message === 'Access denied') {
            res.status(403).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.patch('/objects/:id/visual', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = updateStixSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'Invalid body' });
            return;
        }
        await StixCoreService.updateVisuals((req.params.id as string), validation.data, req.user.id);
        res.json({ success: true });
    } catch (err: any) {
        console.error('STIX patchVisual error:', err);
        if (err.message === 'Object not found') {
            res.status(404).json({ error: err.message });
            return;
        }
        if (err.message === 'Access denied' || err.message === 'No valid visual properties provided') {
            res.status(err.message === 'Access denied' ? 403 : 400).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/objects/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        await StixCoreService.deleteObject((req.params.id as string), req.user.id);
        res.json({ success: true });
    } catch (err: any) {
        console.error('STIX deleteObject error:', err);
        if (err.message === 'Object not found') {
            res.status(404).json({ error: err.message });
            return;
        }
        if (err.message === 'Access denied') {
            res.status(403).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/relationships/by-case/:caseId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const rels = await StixCoreService.getRelationshipsByCaseId((req.params.caseId as string), req.user.id);
        res.json(rels);
    } catch (err: any) {
        console.error('STIX getRelationshipsByCaseId error:', err);
        if (err.message === 'Access denied') {
            res.status(403).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/relationships', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = createStixSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'Missing case_id' });
            return;
        }
        const { case_id, ...relData } = validation.data;
        const result = await StixCoreService.createRelationship(case_id as string, relData, req.user.id);
        res.json(result);
    } catch (err: any) {
        console.error('STIX createRelationship error:', err);
        if (err.message === 'Access denied') {
            res.status(403).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/relationships/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        await StixCoreService.deleteRelationship((req.params.id as string));
        res.json({ success: true });
    } catch (err) {
        console.error('STIX deleteRelationship error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/bundle/:caseId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const bundle = await StixCoreService.getBundleForCase((req.params.caseId as string), req.user.id);
        res.json(bundle);
    } catch (err: any) {
        console.error('STIX getBundleForCase error:', err);
        if (err.message === 'Access denied') {
            res.status(403).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/diamond/:caseId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const data = await StixCoreService.getDiamondData((req.params.caseId as string), req.user.id);
        res.json(data);
    } catch (err: any) {
        console.error('STIX getDiamondData error:', err);
        if (err.message === 'Access denied') {
            res.status(403).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/lateral/:caseId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const data = await StixCoreService.getLateralMovements((req.params.caseId as string), req.user.id);
        res.json(data);
    } catch (err: any) {
        console.error('STIX getLateralMovements error:', err);
        if (err.message === 'Access denied') {
            res.status(403).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/sync/:caseId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const result = await StixCoreService.syncCaseToGraph((req.params.caseId as string), req.user.id);
        res.json(result);
    } catch (err: any) {
        console.error('STIX sync error:', err);
        if (err.message === 'Access denied') {
            res.status(403).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
