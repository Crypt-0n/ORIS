const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const TaskRepository = require('../repositories/TaskRepository');
const authenticateToken = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { isAdmin, getUserRole } = require('../utils/access');

const router = express.Router();
router.use(authenticateToken);

// Create task
router.post('/', async (req, res) => {
    try {
        const { case_id, title, description, result_id, system_id, malware_id, is_osint, assigned_to, initial_investigation_status } = req.body;
        const id = crypto.randomUUID();
        const created_by = req.user.id;

        const taskRepo = new TaskRepository();
        await taskRepo.create({
            id, case_id, title, description, result_id, system_id, malware_id,
            is_osint: is_osint ? 1 : 0, assigned_to, created_by,
            status: 'open',
            initial_investigation_status: initial_investigation_status || null,
        });

        logAudit(case_id, created_by, 'task_created', 'task', id, { title });

        if (assigned_to && assigned_to !== created_by) {
            try {
                const { createNotification } = require('./notifications');
                const userRepo = new BaseRepository(getDb(), 'user_profiles');
                const actor = await userRepo.findById(created_by);
                const actorName = actor?.full_name || 'Quelqu\'un';
                createNotification(assigned_to, 'assignment',
                    `${actorName} vous a assigné une tâche`,
                    `Tâche : "${title}"`,
                    `/cases/${case_id}?task=${id}`
                );
            } catch (e) { console.error('Notification error:', e); }
        }

        res.json({ id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all tasks for a given case
router.get('/by-case/:caseId', async (req, res) => {
    try {
        const taskRepo = new TaskRepository();
        const tasks = await taskRepo.findAllByCaseId(req.params.caseId);

        res.json(tasks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get my tasks
router.get('/my-tasks', async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 0;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);

        const currentUserRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUser = await currentUserRepo.findById(userId);
        const userIsAdmin = currentUser && isAdmin(currentUser.role);

        const taskRepo = new TaskRepository();
        const result = await taskRepo.findMyTasks(userId, userIsAdmin, page, limit);

        if (page <= 0) return res.json({ assigned: result.assigned, unassigned: result.unassigned });

        const offset = (page - 1) * limit;
        res.json({
            assigned: result.assigned,
            unassigned: result.unassigned,
            pagination: {
                page, limit,
                totalAssigned: result.totalAssigned, totalUnassigned: result.totalUnassigned,
                totalPages: Math.ceil(Math.max(result.totalAssigned, result.totalUnassigned) / limit),
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a single task
router.get('/:id', async (req, res) => {
    try {
        const taskRepo = new TaskRepository();
        const r = await taskRepo.findByIdWithDetails(req.params.id);
        if (!r) return res.status(404).json({ error: 'Task not found' });

        const caseRepo = new BaseRepository(getDb(), 'cases');
        const caseObj = await caseRepo.findById(r.case_id);
        const { userHasTypeAccessForBeneficiary, isAdmin } = require('../utils/access');
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUserRole = await userRepo.findById(req.user.id);
        
        let can_edit_task = false;
        if (currentUserRole && isAdmin(currentUserRole.role)) {
            can_edit_task = true;
        } else if (caseObj && caseObj.author_id === req.user.id) {
            can_edit_task = true;
        } else if (r.assigned_to === req.user.id || r.created_by === req.user.id) {
            can_edit_task = true;
        } else if (caseObj && caseObj.beneficiary_id) {
            can_edit_task = await userHasTypeAccessForBeneficiary(req.user.id, caseObj.beneficiary_id, caseObj.type || 'case', 'analyst');
        }

        res.json({ ...r, can_edit_task });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update task
router.put('/:id', async (req, res) => {
    try {
        const { title, description, result_id, assigned_to, status, closure_comment, closed_at, closed_by, closure_comment_modified_by, closure_comment_modified_at, initial_investigation_status, investigation_status } = req.body;

        const updateData = { updated_at: new Date().toISOString() };
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (result_id !== undefined) updateData.result_id = result_id;
        if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
        if (status !== undefined) updateData.status = status;
        if (closure_comment !== undefined) updateData.closure_comment = closure_comment;
        if (closed_at !== undefined) updateData.closed_at = closed_at;
        if (closed_by !== undefined) updateData.closed_by = closed_by;
        if (closure_comment_modified_by !== undefined) updateData.closure_comment_modified_by = closure_comment_modified_by;
        if (closure_comment_modified_at !== undefined) updateData.closure_comment_modified_at = closure_comment_modified_at;
        if (initial_investigation_status !== undefined) updateData.initial_investigation_status = initial_investigation_status;
        if (investigation_status !== undefined) updateData.investigation_status = investigation_status;

        const taskRepo = new TaskRepository();
        const oldTask = await taskRepo.findById(req.params.id);
        if (!oldTask) return res.status(404).json({ error: 'Task not found' });

        const caseRepo = new BaseRepository(getDb(), 'cases');
        const caseObj = await caseRepo.findById(oldTask.case_id);
        const { userHasTypeAccessForBeneficiary, isAdmin } = require('../utils/access');
        
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUserRole = await userRepo.findById(req.user.id);
        
        let can_edit_task = false;
        if (currentUserRole && isAdmin(currentUserRole.role)) {
            can_edit_task = true;
        } else if (caseObj && caseObj.author_id === req.user.id) {
            can_edit_task = true;
        } else if (oldTask.assigned_to === req.user.id || oldTask.created_by === req.user.id) {
            can_edit_task = true;
        } else if (caseObj && caseObj.beneficiary_id) {
            can_edit_task = await userHasTypeAccessForBeneficiary(req.user.id, caseObj.beneficiary_id, caseObj.type || 'case', 'analyst');
        }

        if (!can_edit_task) {
            return res.status(403).json({ error: 'Forbidden: you must be an analyst, the creator, the assignee, or a team leader to edit this task.' });
        }

        await taskRepo.update(req.params.id, updateData);

        // Auto-sync system investigation_status when task has a linked system
        const effectiveStatus = investigation_status ?? initial_investigation_status;
        if (effectiveStatus !== undefined && oldTask?.system_id) {
            const sysRepo = new BaseRepository(getDb(), 'case_systems');
            await sysRepo.update(oldTask.system_id, {
                investigation_status: effectiveStatus, updated_at: new Date().toISOString()
            });
        }

        const task = await taskRepo.findById(req.params.id);
        if (task && oldTask) {
            const changes = [];
            if (title !== undefined && oldTask.title !== task.title) changes.push('title');
            if (description !== undefined && oldTask.description !== task.description) changes.push('description');
            if (assigned_to !== undefined && oldTask.assigned_to !== task.assigned_to) changes.push('assigned_to');
            if (status !== undefined && oldTask.status !== task.status) changes.push('status');

            if (changes.length > 0) {
                logAudit(task.case_id, req.user.id, 'task_updated', 'task', req.params.id, { title: task.title, changes: changes.join(', ') });
            }

            try {
                const { createNotification } = require('./notifications');
                const actor = await userRepo.findById(req.user.id);
                const actorName = actor?.full_name || 'Quelqu\'un';
                const link = `/cases/${task.case_id}?task=${req.params.id}`;

                if (assigned_to !== undefined && oldTask.assigned_to !== task.assigned_to && task.assigned_to && task.assigned_to !== req.user.id) {
                    createNotification(task.assigned_to, 'assignment', `${actorName} vous a assigné une tâche`, `Tâche : "${task.title}"`, link);
                }
                if (status !== undefined && oldTask.status !== task.status && task.assigned_to && task.assigned_to !== req.user.id) {
                    const statusLabel = task.status === 'closed' ? 'fermée' : 'réouverte';
                    createNotification(task.assigned_to, 'task_status', `Tâche ${statusLabel} par ${actorName}`, `Tâche : "${task.title}"`, link);
                }
            } catch (notifErr) { console.error('Notification error:', notifErr); }

            if (oldTask.status === 'closed' && task.status === 'open') {
                logAudit(task.case_id, req.user.id, 'task_reopened', 'task', req.params.id, { title: task.title });
                const userProfile = await userRepo.findById(req.user.id);
                const userName = userProfile ? userProfile.full_name : 'Unknown User';
                const now = new Date();
                const dateStr = now.toLocaleDateString('fr-FR');
                const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                const commentContent = `<p><strong>Tâche réouverte</strong> par ${userName} le ${dateStr} à ${timeStr}.</p>`;
                const commentId = crypto.randomUUID();
                
                const commentRepo = new BaseRepository(getDb(), 'comments');
                await commentRepo.create({ id: commentId, task_id: req.params.id, author_id: req.user.id, content: commentContent });
                
                logAudit(task.case_id, req.user.id, 'comment_added', 'task', req.params.id, { task_title: task.title, comment_id: commentId });
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Close task
router.post('/:id/close', async (req, res) => {
    try {
        const { closure_comment, investigation_status } = req.body;
        const taskRepo = new TaskRepository();
        const task = await taskRepo.findById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });

        await taskRepo.update(req.params.id, {
            status: 'closed', closure_comment, closed_by: req.user.id,
            closed_at: new Date().toISOString(),
            investigation_status: investigation_status || null,
        });
        
        if (task.system_id && investigation_status) {
            const sysRepo = new BaseRepository(getDb(), 'case_systems');
            await sysRepo.update(task.system_id, {
                investigation_status
            });
        }

        logAudit(task.case_id, req.user.id, 'task_closed', 'task', req.params.id, { title: task.title || '' });

        // Notify the assignee that their task was closed (if closed by someone else)
        if (task.assigned_to && task.assigned_to !== req.user.id) {
            try {
                const { createNotification } = require('./notifications');
                const userRepo = new BaseRepository(getDb(), 'user_profiles');
                const actor = await userRepo.findById(req.user.id);
                const actorName = actor?.full_name || 'Quelqu\'un';
                createNotification(task.assigned_to, 'task_status',
                    `Tâche fermée par ${actorName}`,
                    `Tâche : "${task.title}"`,
                    `/cases/${task.case_id}?task=${req.params.id}`);
            } catch (notifErr) { console.error('Notification error:', notifErr); }
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete task
router.delete('/:id', async (req, res) => {
    try {
        const taskRepo = new TaskRepository();
        const task = await taskRepo.findById(req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });

        const caseRepo = new BaseRepository(getDb(), 'cases');
        const caseObj = await caseRepo.findById(task.case_id);
        const { userHasTypeAccessForBeneficiary, isAdmin } = require('../utils/access');
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUserRole = await userRepo.findById(req.user.id);
        
        let can_edit_task = false;
        if (currentUserRole && isAdmin(currentUserRole.role)) {
            can_edit_task = true;
        } else if (caseObj && caseObj.author_id === req.user.id) {
            can_edit_task = true;
        } else if (task.assigned_to === req.user.id || task.created_by === req.user.id) {
            can_edit_task = true;
        } else if (caseObj && caseObj.beneficiary_id) {
            can_edit_task = await userHasTypeAccessForBeneficiary(req.user.id, caseObj.beneficiary_id, caseObj.type || 'case', 'analyst');
        }

        if (!can_edit_task) {
            return res.status(403).json({ error: 'Forbidden: you must be an analyst, the creator, the assignee, or a team leader to delete this task.' });
        }

        await taskRepo.delete(req.params.id);
        logAudit(task.case_id, req.user.id, 'task_deleted', 'task', req.params.id, { title: task.title });
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
