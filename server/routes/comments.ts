import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import { z } from 'zod';
import authenticateToken from '../middleware/auth';
import { CommentService } from '../services/CommentService';

const router = express.Router();
router.use(authenticateToken);


router.get('/by-task/:taskId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const comments = await CommentService.getCommentsByTaskId((req.params.taskId as string), req.user.id);
    res.json(comments);
  } catch (err: any) {
    console.error(err);
    if (err.message === 'Access denied') {
      res.status(403).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

const createCommentSchema = z.object({
  task_id: z.string().min(1),
  content: z.string().min(1),
  parent_id: z.string().optional().nullable(),
});

router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = createCommentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Missing fields', details: validation.error.format() });
      return;
    }

    const result = await CommentService.createComment(validation.data, req.files, req.user.id);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error(err);
    if (err.message === 'Access denied') {
      res.status(403).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

const updateCommentSchema = z.object({
  content: z.string().min(1),
});

router.put('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validation = updateCommentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Missing content' });
      return;
    }

    await CommentService.updateComment((req.params.id as string), validation.data.content, req.user.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    if (err.message === 'Comment not found') {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err.message === 'Unauthorized') {
      res.status(403).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await CommentService.deleteComment((req.params.id as string), req.user.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    if (err.message === 'Comment not found') {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err.message === 'Unauthorized') {
      res.status(403).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
