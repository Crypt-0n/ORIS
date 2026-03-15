const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { isAdmin, userHasTypeAccess, userHasTypeAccessForBeneficiary, isTeamLeadForCase } = require('../utils/access');
const { getTlpColor, getPapColor } = require('../utils/colors');

const router = express.Router();
router.use(authenticateToken);

// Get beneficiaries for current user
router.get('/my-beneficiaries', async (req, res) => {
    try {
        const beneficiaries = await db('beneficiaries as b')
            .join('beneficiary_members as m', 'b.id', 'm.beneficiary_id')
            .where('m.user_id', req.user.id)
            .select('b.*')
            .orderBy('b.name', 'asc');
        res.json(beneficiaries);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get members of a beneficiary (for responsible dropdown)
router.get('/beneficiary-members/:beneficiary_id', async (req, res) => {
    try {
        const members = await db('user_profiles as u')
            .join('beneficiary_members as m', 'u.id', 'm.user_id')
            .where('m.beneficiary_id', req.params.beneficiary_id)
            .select('u.id', 'u.full_name')
            .orderBy('u.full_name', 'asc');
        res.json(members);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create case or alert
router.post('/', async (req, res) => {
    try {
        const { title, description, severity_id, tlp_id, pap_id, tlp, pap, kill_chain_type, beneficiary_id, type, assigned_to } = req.body;
        const entityType = type === 'alert' ? 'alert' : 'case';

        if (!title || !description || !severity_id || !beneficiary_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!await userHasTypeAccessForBeneficiary(req.user.id, beneficiary_id, entityType, 'manager')) {
            return res.status(403).json({ error: `You do not have permission to create ${entityType}s for this beneficiary` });
        }

        const actualTlp = tlp_id || tlp || 'AMBER';
        const actualPap = pap_id || pap || 'GREEN';
        const actualKillChain = kill_chain_type || 'cyber_kill_chain';

        const id = crypto.randomUUID();
        const author_id = req.user.id;

        const isMember = await db('beneficiary_members').where({ beneficiary_id, user_id: author_id }).first();
        if (!isMember) {
            return res.status(403).json({ error: 'You must be a member of the beneficiary to create a case for it' });
        }

        const currentYear = new Date().getFullYear().toString();

        await db.transaction(async trx => {
            const prefix = `${currentYear}-`;
            const maxCase = await trx('cases')
                .where('case_number', 'like', `${prefix}%`)
                .orderBy('case_number', 'desc')
                .select('case_number')
                .first();

            let nextSeq = 1;
            if (maxCase && maxCase.case_number) {
                const parts = maxCase.case_number.split('-');
                if (parts.length === 2) {
                    nextSeq = parseInt(parts[1], 10) + 1;
                }
            }

            const case_number = `${currentYear}-${String(nextSeq).padStart(5, '0')}`;

            await trx('cases').insert({
                id, case_number, type: entityType, title, description, author_id,
                severity_id, tlp: actualTlp, pap: actualPap,
                kill_chain_type: actualKillChain, beneficiary_id,
            });

            if (entityType === 'alert' && assigned_to) {
                await trx('case_assignments').insert({ id: crypto.randomUUID(), case_id: id, user_id: assigned_to });
            }
        });

        const newCase = await db('cases').where({ id }).first();
        logAudit(id, req.user.id, entityType === 'alert' ? 'alert_created' : 'case_created', 'case', id, { title });
        res.json(newCase);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update case
router.put('/:id', async (req, res) => {
    try {
        const { title, description, severity_id, status, closure_summary, closed_at, closed_by, tlp, pap, attacker_utc_offset, kill_chain_type, beneficiary_id, author_id } = req.body;

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (severity_id !== undefined) updateData.severity_id = severity_id;
        if (status !== undefined) {
            if (status === 'closed') {
                if (!await isTeamLeadForCase(req.user.id, req.params.id)) {
                    return res.status(403).json({ error: 'Only team leads or admins can close cases' });
                }
            }
            updateData.status = status;
        }
        if (closure_summary !== undefined) updateData.closure_summary = closure_summary;
        if (closed_at !== undefined) updateData.closed_at = closed_at;
        if (closed_by !== undefined) updateData.closed_by = closed_by;
        if (tlp !== undefined) updateData.tlp = tlp;
        if (pap !== undefined) updateData.pap = pap;
        if (attacker_utc_offset !== undefined) updateData.attacker_utc_offset = attacker_utc_offset;
        if (kill_chain_type !== undefined) updateData.kill_chain_type = kill_chain_type;

        if (beneficiary_id !== undefined && beneficiary_id !== null) {
            const currentUserRole = await db('user_profiles').where({ id: req.user.id }).select('role').first();
            const isMember = await db('beneficiary_members').where({ beneficiary_id, user_id: req.user.id }).first();
            if (!isMember && !isAdmin(currentUserRole?.role)) {
                return res.status(403).json({ error: 'You must be a member of the beneficiary to assign it to a case' });
            }
            updateData.beneficiary_id = beneficiary_id;
        } else if (beneficiary_id === null) {
            return res.status(400).json({ error: 'beneficiary_id cannot be null' });
        }

        if (author_id !== undefined) {
            const currentUserRole = await db('user_profiles').where({ id: req.user.id }).select('role').first();
            if (currentUserRole && isAdmin(currentUserRole.role)) {
                updateData.author_id = author_id;
            }
        }

        if (Object.keys(updateData).length > 0) {
            const oldCase = await db('cases').where({ id: req.params.id }).select('attacker_utc_offset').first();
            await db('cases').where({ id: req.params.id }).update(updateData);

            if (attacker_utc_offset !== undefined && oldCase && String(oldCase.attacker_utc_offset) !== String(attacker_utc_offset)) {
                logAudit(req.params.id, req.user.id, 'timezone_changed', 'case', req.params.id, {
                    oldValue: oldCase.attacker_utc_offset, newValue: attacker_utc_offset,
                });
            }
        }

        res.json({ success: true, id: req.params.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all cases/alerts accessible to user
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 0;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const typeFilter = req.query.type === 'alert' ? 'alert' : 'case';

        const currentUser = await db('user_profiles').where({ id: req.user.id }).select('role').first();
        const hasAdminAccessGlobal = currentUser && isAdmin(currentUser.role);

        let query = db('cases')
            .leftJoin('severities', 'cases.severity_id', 'severities.id')
            .leftJoin('user_profiles', 'cases.author_id', 'user_profiles.id')
            .leftJoin('beneficiaries', 'cases.beneficiary_id', 'beneficiaries.id')
            .select(
                'cases.*',
                'severities.label as severity_label', 'severities.color as severity_color',
                'user_profiles.full_name as author_name', 'beneficiaries.name as beneficiary_name'
            )
            .whereRaw("COALESCE(cases.type, 'case') = ?", [typeFilter]);

        if (!hasAdminAccessGlobal) {
            query = query.andWhere(function() {
                this.where('cases.author_id', req.user.id)
                    .orWhereExists(db('case_assignments').whereRaw('case_assignments.case_id = cases.id').andWhere('case_assignments.user_id', req.user.id))
                    .orWhereExists(db('beneficiary_members').whereRaw('beneficiary_members.beneficiary_id = cases.beneficiary_id').andWhere('beneficiary_members.user_id', req.user.id));
            });
        }

        const countQuery = query.clone().clearSelect().count('* as count').first();
        const countObj = await countQuery;
        const total = parseInt(countObj.count || 0, 10);
        const totalPages = Math.ceil(total / limit);

        let rows;
        if (page > 0) {
            const offset = (page - 1) * limit;
            rows = await query.orderBy('cases.created_at', 'desc').limit(limit).offset(offset);
        } else {
            rows = await query.orderBy('cases.created_at', 'desc');
        }

        let assignments = [];
        const caseIds = rows.map(r => r.id);
        if (caseIds.length > 0) {
            assignments = await db('case_assignments as ca')
                .leftJoin('user_profiles as up', 'ca.user_id', 'up.id')
                .whereIn('ca.case_id', caseIds)
                .select('ca.case_id', 'ca.user_id', 'up.full_name');
        }

        // Check membership per beneficiary (batch)
        const userMemberships = await db('beneficiary_members').where({ user_id: req.user.id }).select('beneficiary_id');
        const memberBeneficiaryIds = new Set(userMemberships.map(m => m.beneficiary_id));

        const formatted = rows.map(r => {
            const isAssigned = r.author_id === req.user.id || assignments.some(a => a.case_id === r.id && a.user_id === req.user.id);
            const caseAssignments = assignments.filter(a => a.case_id === r.id).map(a => ({ user_id: a.user_id, full_name: a.full_name }));
            const isBeneficiaryMember = r.beneficiary_id && memberBeneficiaryIds.has(r.beneficiary_id);
            const hasAccess = isAssigned || isBeneficiaryMember;

            if (hasAccess) {
                return {
                    ...r, tlp_id: r.tlp, pap_id: r.pap,
                    author: { full_name: r.author_name },
                    severity: { label: r.severity_label, color: r.severity_color },
                    tlp: { code: r.tlp, label: `TLP:${r.tlp}`, color: getTlpColor(r.tlp) },
                    pap: r.pap ? { code: r.pap, label: `PAP:${r.pap}`, color: getPapColor(r.pap) } : null,
                    attacker_utc_offset: r.attacker_utc_offset,
                    beneficiary: { id: r.beneficiary_id, name: r.beneficiary_name },
                    case_assignments: caseAssignments,
                };
            } else if (hasAdminAccessGlobal) {
                return {
                    id: r.id, case_number: r.case_number, title: "Accès Restreint", description: "", status: r.status,
                    created_at: null, author_id: r.author_id, severity_id: r.severity_id,
                    tlp_id: "WHITE", pap_id: "WHITE",
                    author: { full_name: r.author_name },
                    severity: { label: "Restreint", color: "#6b7280" },
                    tlp: { code: "WHITE", label: "TLP:WHITE", color: getTlpColor("WHITE") },
                    pap: { code: "WHITE", label: "PAP:WHITE", color: getPapColor("WHITE") },
                    attacker_utc_offset: r.attacker_utc_offset,
                    beneficiary_id: r.beneficiary_id,
                    beneficiary: { id: r.beneficiary_id, name: "RESTRICTED" },
                    case_assignments: caseAssignments,
                };
            }
            return null;
        }).filter(r => r !== null);

        if (page <= 0) return res.json(formatted);

        res.json({ data: formatted, pagination: { page, limit, total, totalPages } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a single case
router.get('/:id', async (req, res) => {
    try {
        const r = await db('cases')
            .leftJoin('severities', 'cases.severity_id', 'severities.id')
            .leftJoin('user_profiles', 'cases.author_id', 'user_profiles.id')
            .leftJoin('user_profiles as closer', 'cases.closed_by', 'closer.id')
            .leftJoin('beneficiaries', 'cases.beneficiary_id', 'beneficiaries.id')
            .select(
                'cases.*',
                'severities.label as severity_label', 'severities.color as severity_color',
                'user_profiles.full_name as author_name', 'user_profiles.email as author_email',
                'closer.full_name as closed_by_user_name',
                'beneficiaries.name as beneficiary_name'
            )
            .where('cases.id', req.params.id)
            .first();

        if (!r) return res.status(404).json({ error: 'Case not found' });

        const assignments = await db('case_assignments as ca')
            .join('user_profiles as u', 'ca.user_id', 'u.id')
            .where('ca.case_id', req.params.id)
            .select('ca.id', 'ca.user_id', 'u.full_name', 'u.email');

        const isAssigned = r.author_id === req.user.id || assignments.some(a => a.user_id === req.user.id);
        const currentUser = await db('user_profiles').where({ id: req.user.id }).select('role').first();
        const hasAdminAccess = currentUser && isAdmin(currentUser.role);

        const isBeneficiaryAlert = r.type === 'alert' && r.beneficiary_id &&
            await db('beneficiary_members').where({ beneficiary_id: r.beneficiary_id, user_id: req.user.id }).first();
        const hasFullAccess = isAssigned || !!isBeneficiaryAlert;

        if (hasFullAccess) {
            res.json({
                ...r, tlp_id: r.tlp, pap_id: r.pap,
                author: { id: r.author_id, full_name: r.author_name, email: r.author_email },
                severity: { label: r.severity_label, color: r.severity_color },
                tlp: { code: r.tlp, label: `TLP:${r.tlp}`, color: getTlpColor(r.tlp) },
                pap: r.pap ? { code: r.pap, label: `PAP:${r.pap}`, color: getPapColor(r.pap) } : null,
                attacker_utc_offset: r.attacker_utc_offset,
                closed_by_user: r.closed_by_user_name ? { full_name: r.closed_by_user_name } : undefined,
                beneficiary: { id: r.beneficiary_id, name: r.beneficiary_name },
                case_assignments: assignments.map(a => ({ id: a.id, user: { id: a.user_id, full_name: a.full_name, email: a.email } })),
            });
        } else if (hasAdminAccess) {
            res.json({
                id: r.id, case_number: r.case_number, title: "Accès Restreint", description: "", status: r.status,
                created_at: null, closed_at: null, author_id: r.author_id, severity_id: r.severity_id,
                tlp_id: "WHITE", pap_id: "WHITE",
                author: { id: r.author_id, full_name: r.author_name, email: r.author_email },
                severity: { label: "Restreint", color: "#6b7280" },
                tlp: { code: "WHITE", label: "TLP:WHITE", color: getTlpColor("WHITE") },
                pap: { code: "WHITE", label: "PAP:WHITE", color: getPapColor("WHITE") },
                attacker_utc_offset: r.attacker_utc_offset,
                closed_by_user: r.closed_by_user_name ? { full_name: "RESTRICTED" } : undefined,
                beneficiary_id: r.beneficiary_id,
                beneficiary: { id: r.beneficiary_id, name: "RESTRICTED" },
                case_assignments: assignments.map(a => ({ id: a.id, user: { id: a.user_id, full_name: a.full_name, email: a.email } })),
            });
        } else {
            res.status(403).json({ error: 'Access denied: you are not assigned to this case' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:id/beneficiary-members', async (req, res) => {
    try {
        const caseRecord = await db('cases').where({ id: req.params.id }).select('author_id', 'beneficiary_id').first();
        if (!caseRecord) return res.status(404).json({ error: 'Case not found' });

        const assignments = await db('case_assignments').where({ case_id: req.params.id }).select('user_id');
        const isAssigned = caseRecord.author_id === req.user.id || assignments.some(a => a.user_id === req.user.id);

        const currentUser = await db('user_profiles').where({ id: req.user.id }).select('role').first();
        if (!isAssigned && (!currentUser || !isAdmin(currentUser.role))) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const members = await db('beneficiary_members as m')
            .join('user_profiles as u', 'm.user_id', 'u.id')
            .where('m.beneficiary_id', caseRecord.beneficiary_id)
            .select('u.id', 'u.full_name', 'u.email');
        res.json(members);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Convert alert to case
router.post('/:id/convert', async (req, res) => {
    try {
        const caseRecord = await db('cases').where({ id: req.params.id }).select('id', 'type', 'title', 'beneficiary_id').first();
        if (!caseRecord) return res.status(404).json({ error: 'Not found' });
        if (caseRecord.type !== 'alert') return res.status(400).json({ error: 'Only alerts can be converted to cases' });

        if (!await userHasTypeAccessForBeneficiary(req.user.id, caseRecord.beneficiary_id, 'case', 'user')) {
            return res.status(403).json({ error: 'case_analyst role or higher required to convert alerts' });
        }

        await db('cases').where({ id: req.params.id }).update({ type: 'case' });

        const assignedUsers = await db('case_assignments').where({ case_id: req.params.id }).select('id', 'user_id');
        
        if (assignedUsers.length > 0) {
            const userIds = assignedUsers.map(a => a.user_id);
            const profiles = await db('user_profiles').whereIn('id', userIds).select('id', 'role', 'full_name');
            const members = await db('beneficiary_members').whereIn('user_id', userIds).andWhere('beneficiary_id', caseRecord.beneficiary_id).select('user_id', 'role');
            
            const profileMap = new Map(profiles.map(p => [p.id, p]));
            const memberMap = new Map(members.map(m => [m.user_id, m]));

            const assignmentsToRemove = [];
            for (const assignment of assignedUsers) {
                const p = profileMap.get(assignment.user_id);
                const isGloballyAdmin = p && isAdmin(p.role);
                
                let hasAccess = isGloballyAdmin;
                if (!hasAccess) {
                    const m = memberMap.get(assignment.user_id);
                    if (m && m.role) {
                        const mRoles = Array.isArray(m.role) ? m.role : JSON.parse(m.role || '[]');
                        hasAccess = mRoles.some(r => r === 'case_analyst' || r === 'case_manager' || r === 'case_user' || r === 'case_viewer');
                    }
                }
                
                if (!hasAccess) assignmentsToRemove.push(assignment);
            }

            if (assignmentsToRemove.length > 0) {
                await db('case_assignments').whereIn('id', assignmentsToRemove.map(a => a.id)).del();
                for (const assignment of assignmentsToRemove) {
                    const removedUser = profileMap.get(assignment.user_id);
                    logAudit(req.params.id, req.user.id, 'member_removed', 'case_assignment', assignment.id, {
                        user_name: removedUser?.full_name || 'Inconnu',
                        reason: 'Accès insuffisant après conversion en dossier',
                    });
                }
            }
        }

        logAudit(req.params.id, req.user.id, 'alert_converted_to_case', 'case', req.params.id, { title: caseRecord.title });
        res.json({ success: true, id: req.params.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a case
router.delete('/:id', async (req, res) => {
    try {
        const caseRecord = await db('cases').where({ id: req.params.id }).select('type', 'beneficiary_id').first();
        if (!caseRecord) return res.status(404).json({ error: 'Not found' });

        if (!await userHasTypeAccessForBeneficiary(req.user.id, caseRecord.beneficiary_id, caseRecord.type || 'case', 'manager')) {
            return res.status(403).json({ error: 'Analyst role required to delete' });
        }

        await db('cases').where({ id: req.params.id }).del();
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
