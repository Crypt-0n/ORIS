import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import { DashboardService } from '../services/DashboardService';
import authenticateToken from '../middleware/auth';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user.id;
        const data = await DashboardService.getDashboardData(userId);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
