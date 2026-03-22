const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const CommentRepository = require('../repositories/CommentRepository');
const authenticateToken = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
const { canAccessCase, getRoles, isAdmin, isTeamLeadForBeneficiary } = require('../utils/access');
const UPLOADS_DIR = process.env.DB_PATH
    ? path.join(path.dirname(process.env.DB_PATH), 'uploads')
    : path.join(__dirname, '..', 'uploads');
router.use(authenticateToken);

// Get comments for a task
router.get('/by-task/:taskId', async (req, res) => {
    try {
        const taskRepo = new BaseRepository(getDb(), 'tasks');
        const taskInfo = await taskRepo.findById(req.params.taskId);
        if (taskInfo && !await canAccessCase(req.user.id, taskInfo.case_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const commentRepo = new CommentRepository();
        const comments = await commentRepo.findByTaskId(req.params.taskId);

        res.json(comments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create comment
router.post('/', async (req, res) => {
    try {
        const { task_id, content, parent_id } = req.body;
        if (!task_id || !content) return res.status(400).json({ error: 'Missing fields' });

        const taskRepo = new BaseRepository(getDb(), 'tasks');
        const taskInfo = await taskRepo.findById(task_id);
        if (taskInfo && !await canAccessCase(req.user.id, taskInfo.case_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const id = crypto.randomUUID();
        const author_id = req.user.id;

        const commentRepo = new CommentRepository();
        await commentRepo.create({ id, task_id, author_id, content, parent_id: parent_id || null });

        const task = taskInfo;
        if (task) {
            logAudit(task.case_id, author_id, 'comment_added', 'task', task_id, { task_title: task.title, comment_id: id });
        }

        // Parse @mentions and create notifications
        try {
            const { createNotification } = require('./notifications');
            const userRepo = new BaseRepository(getDb(), 'user_profiles');
            const author = await userRepo.findById(author_id);
            const authorName = author?.full_name || 'Quelqu\'un';

            const plainContent = content.replace(/<[^>]+>/g, '');
            const mentionRegex = /@([A-ZÀ-Ü][a-zà-ü-]+(?:\s+[A-ZÀ-Ü][A-ZÀ-Üa-zà-ü-]*)+)/g;
            let match;
            const mentionedNames = new Set();
            while ((match = mentionRegex.exec(plainContent)) !== null) {
                mentionedNames.add(match[1].trim());
            }

            if (mentionedNames.size > 0) {
                const namesArray = Array.from(mentionedNames);
                const mentionedUsers = [];
                for (const name of namesArray) {
                    const u = await userRepo.findFirst({ full_name: name });
                    if (u) mentionedUsers.push(u);
                }

                for (const mentionedUser of mentionedUsers) {
                    if (mentionedUser.id !== author_id) {
                        const link = task ? `/cases/${task.case_id}?task=${task_id}&tab=comments&target=${id}` : null;
                        createNotification(mentionedUser.id, 'mention', `${authorName} vous a mentionné`,
                            task ? `Dans la tâche "${task.title}"` : 'Dans un commentaire', link);
                    }
                }
            }

            if (/@case\b/i.test(plainContent) && task) {
                const caseRepo = new BaseRepository(getDb(), 'cases');
                const caseData = await caseRepo.findById(task.case_id);
                const assignRepo = new BaseRepository(getDb(), 'case_assignments');
                const assigned = await assignRepo.findWhere({ case_id: task.case_id });
                const notifiedIds = new Set(assigned.map(a => a.user_id));
                if (caseData?.author_id) notifiedIds.add(caseData.author_id);
                notifiedIds.delete(author_id);
                const link = `/cases/${task.case_id}?task=${task_id}&tab=comments&target=${id}`;
                for (const userId of notifiedIds) {
                    createNotification(userId, 'mention', `${authorName} a notifié le dossier`,
                        `Dans la tâche "${task.title}" du dossier "${caseData?.title || ''}"`, link);
                }
            }
        } catch (mentionErr) { console.error('Error processing mentions:', mentionErr); }

        try {
            const { createNotification } = require('./notifications');
            if (task && task.case_id) {
                const taskFull = taskInfo;
                if (taskFull && taskFull.assigned_to && taskFull.assigned_to !== author_id) {
                    const userRepo = new BaseRepository(getDb(), 'user_profiles');
                    const author = await userRepo.findById(author_id);
                    const authorName = author?.full_name || 'Quelqu\'un';
                    createNotification(taskFull.assigned_to, 'task_comment',
                        `${authorName} a commenté votre tâche`,
                        `Tâche : "${taskFull.title}"`,
                        `/cases/${task.case_id}?task=${task_id}&tab=comments&target=${id}`);
                }
            }
        } catch (notifErr) { console.error('Comment notification error:', notifErr); }

        // Handle file attachments
        const attachments = [];
        if (req.files) {
            const files = Array.isArray(req.files.files) ? req.files.files : (req.files.files ? [req.files.files] : []);
            const uploadDir = path.join(UPLOADS_DIR, 'comments', id);
            if (files.length > 0 && !fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            for (const file of files) {
                const attachId = crypto.randomUUID();
                const ext = path.extname(file.name);
                const storedName = attachId + ext;
                const storagePath = `comments/${id}/${storedName}`;
                const dest = path.join(uploadDir, storedName);
                await file.mv(dest);
                const attRepo = new BaseRepository(getDb(), 'comment_attachments');
                await attRepo.create({
                    id: attachId, comment_id: id, file_name: file.name,
                    file_size: file.size, content_type: file.mimetype, storage_path: storagePath,
                });
                attachments.push({ id: attachId, file_name: file.name, file_size: file.size, content_type: file.mimetype, storage_path: storagePath });
            }
        }

        res.json({ success: true, id, attachments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update comment
router.put('/:id', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ error: 'Missing content' });

        const commentRepo = new CommentRepository();
        const comment = await commentRepo.findById(req.params.id);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        if (comment.author_id !== req.user.id) {
            const userRepo = new BaseRepository(getDb(), 'user_profiles');
            const userRole = await userRepo.findById(req.user.id);
            if (!isAdmin(userRole?.role)) {
                const taskRepo = new BaseRepository(getDb(), 'tasks');
                const task = comment.task_id && await taskRepo.findById(comment.task_id);
                const caseRepo = new BaseRepository(getDb(), 'cases');
                const caseRow = task && await caseRepo.findById(task.case_id);
                if (!caseRow?.beneficiary_id || !await isTeamLeadForBeneficiary(req.user.id, caseRow.beneficiary_id)) {
                    return res.status(403).json({ error: 'Unauthorized' });
                }
            }
        }

        await commentRepo.update(req.params.id, { content });

        if (comment.task_id) {
            const taskRepo = new BaseRepository(getDb(), 'tasks');
            const task = await taskRepo.findById(comment.task_id);
            if (task) {
                logAudit(task.case_id, req.user.id, 'comment_updated', 'task', comment.task_id, { task_title: task.title, comment_id: req.params.id });
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete comment
router.delete('/:id', async (req, res) => {
    try {
        const commentRepo = new CommentRepository();
        const comment = await commentRepo.findById(req.params.id);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const taskRepo = new BaseRepository(getDb(), 'tasks');
        const caseRepo = new BaseRepository(getDb(), 'cases');

        if (comment.author_id !== req.user.id) {
            const userRole = await userRepo.findById(req.user.id);
            if (!isAdmin(userRole?.role)) {
                const task = comment.task_id && await taskRepo.findById(comment.task_id);
                const caseRow = task && await caseRepo.findById(task.case_id);
                if (!caseRow?.beneficiary_id || !await isTeamLeadForBeneficiary(req.user.id, caseRow.beneficiary_id)) {
                    return res.status(403).json({ error: 'Unauthorized' });
                }
            }
        }

        if (comment.task_id) {
            const task = await taskRepo.findById(comment.task_id);
            if (task) logAudit(task.case_id, req.user.id, 'comment_removed', 'task', comment.task_id, { task_title: task.title });
        }

        const attRepo = new BaseRepository(getDb(), 'comment_attachments');
        const attachments = await attRepo.findWhere({ comment_id: req.params.id });
        for (const att of attachments) {
            const filePath = path.join(UPLOADS_DIR, att.storage_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            await attRepo.delete(att.id);
        }

        await commentRepo.delete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
