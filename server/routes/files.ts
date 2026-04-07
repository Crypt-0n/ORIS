import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { getDb } from '../db-arango';
import BaseRepository from '../repositories/BaseRepository';
import authenticateToken from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { canAccessCase, isAdmin } from '../utils/access';

const router = express.Router();

const UPLOADS_DIR = process.env.DB_PATH
    ? path.join(path.dirname(process.env.DB_PATH), 'uploads')
    : path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Allowed MIME types for better security
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/json',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];


router.post('/upload', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            res.status(400).json({ error: 'No files were uploaded.' });
            return;
        }

        const { caseId, taskId } = req.body;
        if (!caseId || !taskId) {
            res.status(400).json({ error: 'caseId and taskId are required' });
            return;
        }

        if (!await canAccessCase(req.user.id, caseId)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const uploadedFile = req.files.file;

        // SEC-04: Validate real MIME type via magic bytes, not client-declared header
        const fileType = require('file-type');
        const detectedType = fileType(uploadedFile.data);
        const effectiveMime = detectedType?.mime || uploadedFile.mimetype;

        if (!ALLOWED_MIME_TYPES.includes(effectiveMime)) {
            res.status(400).json({ error: `File type not allowed (detected: ${effectiveMime})` });
            return;
        }

        const uploadPath = path.join(UPLOADS_DIR, caseId, taskId);
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

        const ext = path.extname(uploadedFile.name);
        const fileName = crypto.randomUUID() + ext;
        const storagePath = `${caseId}/${taskId}/${fileName}`;
        const finalPath = path.join(uploadPath, fileName);

        await uploadedFile.mv(finalPath);
        const fileId = crypto.randomUUID();

        const repo = new BaseRepository(getDb(), 'task_files');
        await repo.create({
            id: fileId, task_id: taskId, case_id: caseId, file_name: uploadedFile.name,
            file_size: uploadedFile.size, content_type: effectiveMime,
            storage_path: storagePath, uploaded_by: req.user.id,
            created_at: new Date().toISOString()
        });

        const taskRepo = new BaseRepository(getDb(), 'tasks');
        const task = await taskRepo.findById(taskId);
        logAudit(caseId, req.user.id, 'file_added', 'task', taskId, {
            task_title: task ? (task as any).title : 'Unknown Task', file_name: uploadedFile.name,
        });

        res.status(201).json({ id: fileId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/download', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { storagePath } = req.query;
        if (!storagePath || typeof storagePath !== 'string') {
            res.status(400).json({ error: 'storagePath is required' });
            return;
        }

        const repo = new BaseRepository(getDb(), 'task_files');
        const files = await repo.findWhere({ storage_path: storagePath });
        const fileRecord = files.length > 0 ? files[0] : null;
        
        if (fileRecord && !await canAccessCase(req.user.id, fileRecord.case_id)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const normalizedPath = path.normalize(storagePath).replace(/^(\.\.([/\\]|$))+/, '');
        const absolutePath = path.join(UPLOADS_DIR, normalizedPath);
        
        if (!absolutePath.startsWith(UPLOADS_DIR) || !fs.existsSync(absolutePath)) {
            res.status(404).json({ error: 'File not found' });
            return;
        }
        
        res.sendFile(absolutePath);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/task/:taskId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const taskRepo = new BaseRepository(getDb(), 'tasks');
        const task = await taskRepo.findById((req.params.taskId as string));
        if (task && !await canAccessCase(req.user.id, task.case_id)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const db = getDb();
        const cursor = await db.query(`
            FOR tf IN task_files
            FILTER tf.task_id == @taskId
            LET up = (FOR u IN user_profiles FILTER u._key == tf.uploaded_by RETURN u)[0]
            SORT tf.created_at DESC
            RETURN MERGE(tf, { id: tf._key, uploader_name: up.full_name })
        `, { taskId: (req.params.taskId as string) });
        
        const files = await cursor.all();
        res.json(files);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const repo = new BaseRepository(getDb(), 'task_files');
        const file = await repo.findById((req.params.id as string));
        if (!file) {
            res.status(404).json({ error: 'File not found' });
            return;
        }

        if (file.uploaded_by !== req.user.id) {
            const userRepo = new BaseRepository(getDb(), 'user_profiles');
            const currentUser = await userRepo.findById(req.user.id);
            if (!isAdmin(currentUser?.role)) {
                res.status(403).json({ error: 'Forbidden' });
                return;
            }
        }

        const absolutePath = path.join(UPLOADS_DIR, file.storage_path);
        if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);

        const taskRepo = new BaseRepository(getDb(), 'tasks');
        const task = await taskRepo.findById(file.task_id);
        logAudit(file.case_id, req.user.id, 'file_removed', 'task', file.task_id, {
            task_title: task ? (task as any).title : 'Unknown Task', file_name: file.file_name,
        });

        await repo.delete((req.params.id as string));
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
