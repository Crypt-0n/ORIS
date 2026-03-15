const express = require('express');
const crypto = require('crypto');
const db = require('../db');
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

        await db('tasks').insert({
            id, case_id, title, description, result_id, system_id, malware_id,
            is_osint: is_osint ? 1 : 0, assigned_to, created_by,
            initial_investigation_status: initial_investigation_status || null,
        });

        logAudit(case_id, created_by, 'task_created', 'task', id, { title });

        if (assigned_to && assigned_to !== created_by) {
            try {
                const { createNotification } = require('./notifications');
                const actor = await db('user_profiles').where({ id: created_by }).select('full_name').first();
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
        const rows = await db('tasks')
            .leftJoin('task_results', 'tasks.result_id', 'task_results.id')
            .leftJoin('user_profiles as c', 'tasks.created_by', 'c.id')
            .leftJoin('user_profiles as a', 'tasks.assigned_to', 'a.id')
            .leftJoin('case_systems as sys', 'tasks.system_id', 'sys.id')
            .leftJoin('case_malware_tools as mal', 'tasks.malware_id', 'mal.id')
            .where('tasks.case_id', req.params.caseId)
            .select(
                'tasks.*',
                'task_results.label as result_label', 'task_results.color as result_color',
                'c.full_name as created_by_full_name', 'c.email as created_by_email',
                'a.full_name as assigned_to_full_name', 'a.email as assigned_to_email',
                'sys.name as sys_name', 'sys.system_type as sys_type',
                'mal.file_name as mal_file_name', 'mal.is_malicious as mal_is_malicious'
            )
            .orderBy('tasks.created_at', 'desc');

        const tasks = rows.map(r => ({
            ...r,
            result: r.result_id ? { label: r.result_label, color: r.result_color } : null,
            created_by_user: { id: r.created_by, full_name: r.created_by_full_name, email: r.created_by_email },
            assigned_to_user: r.assigned_to ? { id: r.assigned_to, full_name: r.assigned_to_full_name, email: r.assigned_to_email } : null,
            system: r.system_id ? { id: r.system_id, name: r.sys_name, system_type: r.sys_type } : null,
            malware: r.malware_id ? { id: r.malware_id, file_name: r.mal_file_name, is_malicious: r.mal_is_malicious } : null,
            is_osint: r.is_osint === 1,
        }));

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

        const formatTask = r => ({
            ...r,
            result: r.result_id ? { label: r.result_label, color: r.result_color } : null,
            created_by_user: { full_name: r.created_by_full_name },
            assigned_to_user: r.assigned_to ? { full_name: r.assigned_to_full_name } : null,
            case: {
                id: r.case_id, case_number: r.case_number, title: r.case_title, status: r.case_status,
                severity: r.severity_label ? { label: r.severity_label, color: r.severity_color } : null,
            },
            system: r.system_id ? { id: r.system_id, name: r.sys_name, system_type: r.sys_type } : null,
            malware: r.malware_id ? { id: r.malware_id, file_name: r.mal_file_name, is_malicious: r.mal_is_malicious } : null,
        });

        const userRoleStr = await getUserRole(req.user.id);
        const userIsAdmin = isAdmin(userRoleStr);

        let assignedQuery = db('tasks')
            .leftJoin('task_results', 'tasks.result_id', 'task_results.id')
            .leftJoin('user_profiles as c', 'tasks.created_by', 'c.id')
            .leftJoin('user_profiles as a', 'tasks.assigned_to', 'a.id')
            .leftJoin('cases as case_obj', 'tasks.case_id', 'case_obj.id')
            .leftJoin('severities as sev', 'case_obj.severity_id', 'sev.id')
            .leftJoin('case_systems as sys', 'tasks.system_id', 'sys.id')
            .leftJoin('case_malware_tools as mal', 'tasks.malware_id', 'mal.id')
            .where('tasks.assigned_to', userId)
            .select(
                'tasks.*',
                'task_results.label as result_label', 'task_results.color as result_color',
                'c.full_name as created_by_full_name',
                'a.full_name as assigned_to_full_name',
                'case_obj.title as case_title', 'case_obj.status as case_status', 'case_obj.case_number',
                'sev.label as severity_label', 'sev.color as severity_color',
                'sys.name as sys_name', 'sys.system_type as sys_type',
                'mal.file_name as mal_file_name', 'mal.is_malicious as mal_is_malicious'
            )
            .orderBy('tasks.created_at', 'desc');

        if (!userIsAdmin) {
            assignedQuery = assignedQuery.andWhere(function() {
                this.where('case_obj.author_id', userId)
                    .orWhereExists(db('case_assignments').whereRaw('case_assignments.case_id = tasks.case_id').andWhere('case_assignments.user_id', userId))
                    .orWhereExists(db('beneficiary_members').whereRaw('beneficiary_members.beneficiary_id = case_obj.beneficiary_id').andWhere('beneficiary_members.user_id', userId));
            });
        }

        const assignedRows = await assignedQuery;

        let unassignedQuery = db('tasks')
            .leftJoin('task_results', 'tasks.result_id', 'task_results.id')
            .leftJoin('user_profiles as c', 'tasks.created_by', 'c.id')
            .leftJoin('cases as case_obj', 'tasks.case_id', 'case_obj.id')
            .leftJoin('severities as sev', 'case_obj.severity_id', 'sev.id')
            .leftJoin('case_systems as sys', 'tasks.system_id', 'sys.id')
            .leftJoin('case_malware_tools as mal', 'tasks.malware_id', 'mal.id')
            .whereNull('tasks.assigned_to')
            .select(
                'tasks.*',
                'task_results.label as result_label', 'task_results.color as result_color',
                'c.full_name as created_by_full_name',
                'case_obj.title as case_title', 'case_obj.status as case_status', 'case_obj.case_number',
                'sev.label as severity_label', 'sev.color as severity_color',
                'sys.name as sys_name', 'sys.system_type as sys_type',
                'mal.file_name as mal_file_name', 'mal.is_malicious as mal_is_malicious'
            )
            .orderBy('tasks.created_at', 'desc');

        if (!userIsAdmin) {
            unassignedQuery = unassignedQuery.andWhere(function() {
                this.where('case_obj.author_id', userId)
                    .orWhereExists(db('case_assignments').whereRaw('case_assignments.case_id = tasks.case_id').andWhere('case_assignments.user_id', userId))
                    .orWhereExists(db('beneficiary_members').whereRaw('beneficiary_members.beneficiary_id = case_obj.beneficiary_id').andWhere('beneficiary_members.user_id', userId));
            });
        }

        const unassignedRows = await unassignedQuery;

        const assigned = assignedRows.map(formatTask);
        const unassigned = unassignedRows.map(formatTask);

        if (page <= 0) return res.json({ assigned, unassigned });

        const offset = (page - 1) * limit;
        res.json({
            assigned: assigned.slice(offset, offset + limit),
            unassigned: unassigned.slice(offset, offset + limit),
            pagination: {
                page, limit,
                totalAssigned: assigned.length, totalUnassigned: unassigned.length,
                totalPages: Math.ceil(Math.max(assigned.length, unassigned.length) / limit),
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
        const r = await db('tasks')
            .leftJoin('task_results', 'tasks.result_id', 'task_results.id')
            .leftJoin('user_profiles as c', 'tasks.created_by', 'c.id')
            .leftJoin('user_profiles as a', 'tasks.assigned_to', 'a.id')
            .leftJoin('user_profiles as closed', 'tasks.closed_by', 'closed.id')
            .leftJoin('user_profiles as mod', 'tasks.closure_comment_modified_by', 'mod.id')
            .leftJoin('case_systems as sys', 'tasks.system_id', 'sys.id')
            .leftJoin('case_malware_tools as mal', 'tasks.malware_id', 'mal.id')
            .where('tasks.id', req.params.id)
            .select(
                'tasks.*',
                'task_results.label as result_label', 'task_results.color as result_color',
                'c.full_name as created_by_full_name', 'c.email as created_by_email',
                'a.full_name as assigned_to_full_name', 'a.email as assigned_to_email',
                'closed.full_name as closed_by_full_name', 'closed.email as closed_by_email',
                'mod.full_name as mod_by_full_name', 'mod.email as mod_by_email',
                'sys.name as sys_name', 'sys.system_type as sys_type',
                'mal.file_name as mal_file_name', 'mal.is_malicious as mal_is_malicious'
            )
            .first();

        if (!r) return res.status(404).json({ error: 'Task not found' });

        const caseObj = await db('cases').where({ id: r.case_id }).select('author_id', 'type', 'beneficiary_id').first();
        const { userHasTypeAccessForBeneficiary, isAdmin } = require('../utils/access');
        const currentUserRole = await db('user_profiles').where({ id: req.user.id }).select('role').first();
        
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

        res.json({
            ...r,
            can_edit_task,
            result: r.result_id ? { label: r.result_label, color: r.result_color } : null,
            created_by_user: { id: r.created_by, full_name: r.created_by_full_name, email: r.created_by_email },
            assigned_to_user: r.assigned_to ? { id: r.assigned_to, full_name: r.assigned_to_full_name, email: r.assigned_to_email } : null,
            closed_by_user: r.closed_by ? { id: r.closed_by, full_name: r.closed_by_full_name, email: r.closed_by_email } : null,
            closure_comment_modified_by_user: r.closure_comment_modified_by ? { id: r.closure_comment_modified_by, full_name: r.mod_by_full_name } : null,
            system: r.system_id ? { id: r.system_id, name: r.sys_name, system_type: r.sys_type } : null,
            malware: r.malware_id ? { id: r.malware_id, file_name: r.mal_file_name, is_malicious: r.mal_is_malicious } : null,
            is_osint: r.is_osint === 1,
        });
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

        const oldTask = await db('tasks').where({ id: req.params.id }).select('case_id', 'title', 'description', 'assigned_to', 'created_by', 'status', 'system_id', 'investigation_status').first();
        if (!oldTask) return res.status(404).json({ error: 'Task not found' });

        const caseObj = await db('cases').where({ id: oldTask.case_id }).select('author_id', 'type', 'beneficiary_id').first();
        const { userHasTypeAccessForBeneficiary, isAdmin } = require('../utils/access');
        const currentUserRole = await db('user_profiles').where({ id: req.user.id }).select('role').first();
        
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

        await db('tasks').where({ id: req.params.id }).update(updateData);

        // Auto-sync system investigation_status when task has a linked system
        const effectiveStatus = investigation_status ?? initial_investigation_status;
        if (effectiveStatus !== undefined && oldTask?.system_id) {
            await db('case_systems').where({ id: oldTask.system_id }).update({
                investigation_status: effectiveStatus, updated_at: new Date().toISOString(),
            });
        }

        const task = await db('tasks').where({ id: req.params.id }).select('case_id', 'title', 'description', 'assigned_to', 'status').first();
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
                const actor = await db('user_profiles').where({ id: req.user.id }).select('full_name').first();
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
                const userProfile = await db('user_profiles').where({ id: req.user.id }).select('full_name').first();
                const userName = userProfile ? userProfile.full_name : 'Unknown User';
                const now = new Date();
                const dateStr = now.toLocaleDateString('fr-FR');
                const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                const commentContent = `<p><strong>Tâche réouverte</strong> par ${userName} le ${dateStr} à ${timeStr}.</p>`;
                const commentId = crypto.randomUUID();
                await db('comments').insert({ id: commentId, task_id: req.params.id, author_id: req.user.id, content: commentContent });
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
        const task = await db('tasks').where({ id: req.params.id }).select('case_id', 'title', 'system_id').first();
        if (!task) return res.status(404).json({ error: 'Task not found' });

        await db.transaction(async trx => {
            await trx('tasks').where({ id: req.params.id }).update({
                status: 'closed', closure_comment, closed_by: req.user.id,
                closed_at: new Date().toISOString(),
                investigation_status: investigation_status || null,
                updated_at: new Date().toISOString(),
            });
            if (task.system_id && investigation_status) {
                await trx('case_systems').where({ id: task.system_id }).update({
                    investigation_status, updated_at: new Date().toISOString(),
                });
            }
        });

        logAudit(task.case_id, req.user.id, 'task_closed', 'task', req.params.id, { title: task.title || '' });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete task
router.delete('/:id', async (req, res) => {
    try {
        const task = await db('tasks').where({ id: req.params.id }).first();
        if (!task) return res.status(404).json({ error: 'Task not found' });

        const caseObj = await db('cases').where({ id: task.case_id }).select('author_id', 'type', 'beneficiary_id').first();
        const { userHasTypeAccessForBeneficiary, isAdmin } = require('../utils/access');
        const currentUserRole = await db('user_profiles').where({ id: req.user.id }).select('role').first();
        
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

        await db('tasks').where({ id: req.params.id }).del();
        logAudit(task.case_id, req.user.id, 'task_deleted', 'task', req.params.id, { title: task.title });
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
