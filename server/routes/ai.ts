import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import authenticateToken from '../middleware/auth';
import { requireAdmin } from '../utils/access';
import { AiService } from '../services/AiService';

const router = express.Router();
router.use(authenticateToken);

router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const status = await AiService.getStatus();
        res.json(status);
    } catch {
        res.json({ enabled: false, quick_prompts: [] });
    }
});

router.get('/providers', (req: AuthenticatedRequest, res: Response) => {
    res.json(AiService.getProviders());
});

router.get('/config', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const config = await AiService.getConfig();
        if (config.ai_api_key) config.ai_api_key = '••••••••';
        res.json(config);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const configUpdateSchema = z.record(z.string(), z.string());

router.put('/config', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = configUpdateSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'Invalid config values' });
            return;
        }
        await AiService.updateConfig(validation.data);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/test', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const result = await AiService.testConnection();
        res.json({ success: true, response: result });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Connection failed' });
    }
});

const chatSchema = z.object({
    messages: z.array(z.any()).min(1),
    context: z.string().optional()
});

router.post('/chat', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = chatSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'messages array is required' });
            return;
        }
        
        const result = await AiService.chat(validation.data.messages, validation.data.context);

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        });
        res.write(`data: ${JSON.stringify({ content: result })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (err: any) {
        console.error('[AI] Chat error:', err.message);
        if (!res.headersSent) {
            const status = err.message.includes('not enabled') ? 403 : 500;
            res.status(status).json({ error: err.message || 'AI request failed' });
        } else {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        }
    }
});

const suggestSchema = z.object({
    description: z.string().min(1),
    linkedObjects: z.string().optional()
});

router.post('/suggest-killchain', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = suggestSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'description is required' });
            return;
        }

        const result = await AiService.suggestKillchain(validation.data.description, validation.data.linkedObjects);
        res.json(result);
    } catch (err: any) {
        const status = err.message.includes('not enabled') ? 403 : 500;
        res.status(status).json({ error: err.message || 'AI request failed' });
    }
});

module.exports = router;
