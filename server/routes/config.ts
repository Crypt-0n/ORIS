import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import authenticateToken from '../middleware/auth';
import { setHttpCache } from '../middleware/cache';
import { AdminService } from '../services/AdminService';

const router = express.Router();
router.use(authenticateToken);

router.get('/', setHttpCache(300), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const configMap = await AdminService.getPublicConfig();
    res.json(configMap);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
