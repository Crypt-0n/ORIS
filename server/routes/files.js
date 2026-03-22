const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const authenticateToken = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
const { canAccessCase, isAdmin } = require('../utils/access');
const UPLOADS_DIR = process.env.DB_PATH
    ? path.join(path.dirname(process.env.DB_PATH), 'uploads')
    : path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

router.post('/upload', authenticateToken, async (req, res) => {
    try {
        if (!req.files || Object.keys(req.files).length === 0) return res.status(400).json({ error: 'No files were uploaded.' });
        const { caseId, taskId } = req.body;
        if (!caseId || !taskId) return res.status(400).json({ error: 'caseId and taskId are required' });
        if (!await canAccessCase(req.user.id, caseId)) return res.status(403).json({ error: 'Access denied' });

        const uploadedFile = req.files.file;
        const uploadPath = path.join(UPLOADS_DIR, caseId, taskId);
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

        const ext = path.extname(uploadedFile.name);
        const fileName = crypto.randomUUID() + ext;
        const finalPath = path.join(uploadPath, fileName);
        const storagePath = `${caseId}/${taskId}/${fileName}`;

        await uploadedFile.mv(finalPath);
        const fileId = crypto.randomUUID();

        const repo = new BaseRepository(getDb(), 'task_files');
        await repo.create({
            id: fileId, task_id: taskId, case_id: caseId, file_name: uploadedFile.name,
            file_size: uploadedFile.size, content_type: uploadedFile.mimetype,
            storage_path: storagePath, uploaded_by: req.user.id,
            created_at: new Date().toISOString()
        });

        const taskRepo = new BaseRepository(getDb(), 'tasks');
        const task = await taskRepo.findById(taskId);
        logAudit(caseId, req.user.id, 'file_added', 'task', taskId, {
            task_title: task ? task.title : 'Unknown Task', file_name: uploadedFile.name,
        });

        res.status(201).json({ id: fileId });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/download', authenticateToken, async (req, res) => {
    try {
        const { storagePath } = req.query;
        if (!storagePath) return res.status(400).json({ error: 'storagePath is required' });

        const repo = new BaseRepository(getDb(), 'task_files');
        const files = await repo.findWhere({ storage_path: storagePath });
        const fileRecord = files.length > 0 ? files[0] : null;
        if (fileRecord && !await canAccessCase(req.user.id, fileRecord.case_id)) return res.status(403).json({ error: 'Access denied' });

        const normalizedPath = path.normalize(storagePath).replace(/^(\.\.(\/|\\|$))+/, '');
        const absolutePath = path.join(UPLOADS_DIR, normalizedPath);
        if (!absolutePath.startsWith(UPLOADS_DIR) || !fs.existsSync(absolutePath)) return res.status(404).json({ error: 'File not found' });
        res.sendFile(absolutePath);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/task/:taskId', authenticateToken, async (req, res) => {
    try {
        const taskRepo = new BaseRepository(getDb(), 'tasks');
        const task = await taskRepo.findById(req.params.taskId);
        if (task && !await canAccessCase(req.user.id, task.case_id)) return res.status(403).json({ error: 'Access denied' });

        const db = getDb();
        const cursor = await db.query(`
            FOR tf IN task_files
            FILTER tf.task_id == @taskId
            LET up = (FOR u IN user_profiles FILTER u._key == tf.uploaded_by RETURN u)[0]
            SORT tf.created_at DESC
            RETURN MERGE(tf, { id: tf._key, uploader_name: up.full_name })
        `, { taskId: req.params.taskId });
        
        const files = await cursor.all();
        res.json(files);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const repo = new BaseRepository(getDb(), 'task_files');
        const file = await repo.findById(req.params.id);
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (file.uploaded_by !== req.user.id) {
            const userRepo = new BaseRepository(getDb(), 'user_profiles');
            const currentUser = await userRepo.findById(req.user.id);
            if (!isAdmin(currentUser?.role)) return res.status(403).json({ error: 'Forbidden' });
        }

        const absolutePath = path.join(UPLOADS_DIR, file.storage_path);
        if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);

        const taskRepo = new BaseRepository(getDb(), 'tasks');
        const task = await taskRepo.findById(file.task_id);
        logAudit(file.case_id, req.user.id, 'file_removed', 'task', file.task_id, {
            task_title: task ? task.title : 'Unknown Task', file_name: file.file_name,
        });

        await repo.delete(req.params.id);
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
