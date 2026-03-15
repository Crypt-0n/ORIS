const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../db');
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
        const taskInfo = await db('tasks').where({ id: req.params.taskId }).select('case_id').first();
        if (taskInfo && !await canAccessCase(req.user.id, taskInfo.case_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const rows = await db('comments')
            .join('user_profiles', 'comments.author_id', 'user_profiles.id')
            .where('comments.task_id', req.params.taskId)
            .select('comments.*', 'user_profiles.full_name as author_full_name')
            .orderBy('comments.created_at', 'asc');

        let attachmentMap = {};
        if (rows.length > 0) {
            const commentIds = rows.map(r => r.id);
            const allAttachments = await db('comment_attachments')
                .whereIn('comment_id', commentIds)
                .select('id', 'comment_id', 'file_name', 'file_size', 'content_type', 'storage_path');
            for (const att of allAttachments) {
                if (!attachmentMap[att.comment_id]) attachmentMap[att.comment_id] = [];
                attachmentMap[att.comment_id].push(att);
            }
        }

        const comments = rows.map(r => ({
            ...r, parent_id: r.parent_id || null,
            author: { full_name: r.author_full_name },
            attachments: attachmentMap[r.id] || [],
        }));

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

        const taskInfo = await db('tasks').where({ id: task_id }).select('case_id').first();
        if (taskInfo && !await canAccessCase(req.user.id, taskInfo.case_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const id = crypto.randomUUID();
        const author_id = req.user.id;

        await db('comments').insert({ id, task_id, author_id, content, parent_id: parent_id || null });

        const task = await db('tasks').where({ id: task_id }).select('case_id', 'title').first();
        if (task) {
            logAudit(task.case_id, author_id, 'comment_added', 'task', task_id, { task_title: task.title, comment_id: id });
        }

        // Parse @mentions and create notifications
        try {
            const { createNotification } = require('./notifications');
            const author = await db('user_profiles').where({ id: author_id }).select('full_name').first();
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
                const placeholders = namesArray.map(() => 'LOWER(?)').join(',');
                const mentionedUsers = await db('user_profiles')
                    .whereRaw(`LOWER(full_name) IN (${placeholders})`, namesArray)
                    .select('id');

                for (const mentionedUser of mentionedUsers) {
                    if (mentionedUser.id !== author_id) {
                        const link = task ? `/cases/${task.case_id}?task=${task_id}&tab=comments&target=${id}` : null;
                        createNotification(mentionedUser.id, 'mention', `${authorName} vous a mentionné`,
                            task ? `Dans la tâche "${task.title}"` : 'Dans un commentaire', link);
                    }
                }
            }

            if (/@case\b/i.test(plainContent) && task) {
                const caseData = await db('cases').where({ id: task.case_id }).select('title', 'author_id').first();
                const assigned = await db('case_assignments').where({ case_id: task.case_id }).select('user_id');
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
                const taskFull = await db('tasks').where({ id: task_id }).select('assigned_to', 'title').first();
                if (taskFull && taskFull.assigned_to && taskFull.assigned_to !== author_id) {
                    const author = await db('user_profiles').where({ id: author_id }).select('full_name').first();
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
                await db('comment_attachments').insert({
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

        const comment = await db('comments').where({ id: req.params.id }).select('author_id', 'task_id').first();
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        if (comment.author_id !== req.user.id) {
            const userRole = await db('user_profiles').where({ id: req.user.id }).select('role').first();
            if (!isAdmin(userRole?.role)) {
                const task = comment.task_id && await db('tasks').where({ id: comment.task_id }).select('case_id').first();
                const caseRow = task && await db('cases').where({ id: task.case_id }).select('beneficiary_id').first();
                if (!caseRow?.beneficiary_id || !await isTeamLeadForBeneficiary(req.user.id, caseRow.beneficiary_id)) {
                    return res.status(403).json({ error: 'Unauthorized' });
                }
            }
        }

        await db('comments').where({ id: req.params.id }).update({ content });

        if (comment.task_id) {
            const task = await db('tasks').where({ id: comment.task_id }).select('case_id', 'title').first();
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
        const comment = await db('comments').where({ id: req.params.id }).select('author_id', 'task_id').first();
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        if (comment.author_id !== req.user.id) {
            const userRole = await db('user_profiles').where({ id: req.user.id }).select('role').first();
            if (!isAdmin(userRole?.role)) {
                const task = comment.task_id && await db('tasks').where({ id: comment.task_id }).select('case_id').first();
                const caseRow = task && await db('cases').where({ id: task.case_id }).select('beneficiary_id').first();
                if (!caseRow?.beneficiary_id || !await isTeamLeadForBeneficiary(req.user.id, caseRow.beneficiary_id)) {
                    return res.status(403).json({ error: 'Unauthorized' });
                }
            }
        }

        if (comment.task_id) {
            const task = await db('tasks').where({ id: comment.task_id }).select('case_id', 'title').first();
            if (task) logAudit(task.case_id, req.user.id, 'comment_removed', 'task', comment.task_id, { task_title: task.title });
        }

        const attachments = await db('comment_attachments').where({ comment_id: req.params.id }).select('storage_path');
        for (const att of attachments) {
            const filePath = path.join(UPLOADS_DIR, att.storage_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        await db('comment_attachments').where({ comment_id: req.params.id }).del();
        await db('comments').where({ id: req.params.id }).del();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
