const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
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

        await db('task_files').insert({
            id: fileId, task_id: taskId, case_id: caseId, file_name: uploadedFile.name,
            file_size: uploadedFile.size, content_type: uploadedFile.mimetype,
            storage_path: storagePath, uploaded_by: req.user.id,
        });

        const task = await db('tasks').where({ id: taskId }).select('title').first();
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

        const fileRecord = await db('task_files').where({ storage_path: storagePath }).select('case_id').first();
        if (fileRecord && !await canAccessCase(req.user.id, fileRecord.case_id)) return res.status(403).json({ error: 'Access denied' });

        const normalizedPath = path.normalize(storagePath).replace(/^(\.\.(\/|\\|$))+/, '');
        const absolutePath = path.join(UPLOADS_DIR, normalizedPath);
        if (!absolutePath.startsWith(UPLOADS_DIR) || !fs.existsSync(absolutePath)) return res.status(404).json({ error: 'File not found' });
        res.sendFile(absolutePath);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/task/:taskId', authenticateToken, async (req, res) => {
    try {
        const task = await db('tasks').where({ id: req.params.taskId }).select('case_id').first();
        if (task && !await canAccessCase(req.user.id, task.case_id)) return res.status(403).json({ error: 'Access denied' });

        const files = await db('task_files as tf')
            .leftJoin('user_profiles as up', 'tf.uploaded_by', 'up.id')
            .where('tf.task_id', req.params.taskId)
            .select('tf.*', 'up.full_name as uploader_name')
            .orderBy('tf.created_at', 'desc');
        res.json(files);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const file = await db('task_files').where({ id: req.params.id }).first();
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (file.uploaded_by !== req.user.id) {
            const currentUser = await db('user_profiles').where({ id: req.user.id }).select('role').first();
            if (!isAdmin(currentUser?.role)) return res.status(403).json({ error: 'Forbidden' });
        }

        const absolutePath = path.join(UPLOADS_DIR, file.storage_path);
        if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);

        const task = await db('tasks').where({ id: file.task_id }).select('title').first();
        logAudit(file.case_id, req.user.id, 'file_removed', 'task', file.task_id, {
            task_title: task ? task.title : 'Unknown Task', file_name: file.file_name,
        });

        await db('task_files').where({ id: req.params.id }).del();
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
