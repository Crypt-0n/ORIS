import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import authenticateToken from '../middleware/auth';
import { NotificationService } from '../services/NotificationService';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const notifications = await NotificationService.getNotifications(req.user.id);
        res.json(notifications);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/unread-count', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const count = await NotificationService.getUnreadCount(req.user.id);
        res.json({ count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id/read', async (req: AuthenticatedRequest, res: Response) => {
    try {
        await NotificationService.markAsRead((req.params.id as string), req.user.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/read-all', async (req: AuthenticatedRequest, res: Response) => {
    try {
        await NotificationService.markAllAsRead(req.user.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/all', async (req: AuthenticatedRequest, res: Response) => {
    try {
        await NotificationService.deleteAll(req.user.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        await NotificationService.delete((req.params.id as string), req.user.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const pushSubSchema = z.object({
    endpoint: z.string().min(1),
    keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1)
    })
});

router.post('/subscribe', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = pushSubSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'Invalid subscription' });
            return;
        }
        await NotificationService.subscribeToPush(req.user.id, validation.data.endpoint, validation.data.keys);
        res.json({ success: true });
    } catch (err: any) {
        console.error(err);
        if (err.message === 'Invalid subscription') {
            res.status(400).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

const unsubSchema = z.object({
    endpoint: z.string().optional()
});

router.post('/unsubscribe', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = unsubSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'Invalid body' });
            return;
        }
        await NotificationService.unsubscribeFromPush(req.user.id, validation.data.endpoint || '');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/vapid-public-key', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const key = await NotificationService.getVapidPublicKey();
        res.json({ publicKey: key });
    } catch (err: any) {
        console.error(err);
        if (err.message === 'VAPID keys not configured') {
            res.status(404).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/preferences', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const prefs = await NotificationService.getPreferences(req.user.id);
        res.json(prefs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/preferences', async (req: AuthenticatedRequest, res: Response) => {
    try {
        await NotificationService.updatePreferences(req.user.id, req.body);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Backward compatibility for commonJS requires
export const createNotification = async (userId: string, type: string, title: string, body: string, link?: string) => {
    return await NotificationService.createNotification(userId, type, title, body, link);
};

module.exports = router;
module.exports.createNotification = createNotification;
