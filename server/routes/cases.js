const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const CaseRepository = require('../repositories/CaseRepository');
const authenticateToken = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { isAdmin, userHasTypeAccess, userHasTypeAccessForBeneficiary, isTeamLeadForCase } = require('../utils/access');
const { getTlpColor, getPapColor } = require('../utils/colors');

const router = express.Router();
router.use(authenticateToken);

// Get beneficiaries for current user
router.get('/my-beneficiaries', async (req, res) => {
    try {
        const caseRepo = new CaseRepository();
        const beneficiaries = await caseRepo.getBeneficiaries(req.user.id);
        res.json(beneficiaries);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get members of a beneficiary (for responsible dropdown)
router.get('/beneficiary-members/:beneficiary_id', async (req, res) => {
    try {
        const caseRepo = new CaseRepository();
        const members = await caseRepo.getBeneficiaryMembers(req.params.beneficiary_id);
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
        // case_number is always auto-generated — never accept it from the client
        const entityType = type === 'alert' ? 'alert' : 'case';

        if (!title || !description || !severity_id || !beneficiary_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!await userHasTypeAccessForBeneficiary(req.user.id, beneficiary_id, entityType, 'analyst')) {
            return res.status(403).json({ error: `You do not have permission to create ${entityType}s for this beneficiary` });
        }

        const actualTlp = tlp_id || tlp || 'AMBER';
        const actualPap = pap_id || pap || 'GREEN';
        const actualKillChain = kill_chain_type || 'cyber_kill_chain';

        const id = crypto.randomUUID();
        const author_id = req.user.id;

        const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
        const isMember = await memRepo.findFirst({ beneficiary_id, user_id: author_id });
        if (!isMember) {
            return res.status(403).json({ error: 'You must be a member of the beneficiary to create a case for it' });
        }

        const currentYear = new Date().getFullYear().toString();

        const caseRepo = new CaseRepository();
        const prefix = `${currentYear}-`;
        const aql = `
            FOR c IN cases
                FILTER c.case_number LIKE CONCAT(@prefix, '%')
                SORT c.case_number DESC
                LIMIT 1
                RETURN c.case_number
        `;
        const maxCases = await caseRepo.query(aql, { prefix });
        const maxCase = maxCases[0];

        let nextSeq = 1;
        if (maxCase) {
            const parts = maxCase.split('-');
            if (parts.length === 2) {
                nextSeq = parseInt(parts[1], 10) + 1;
            }
        }

        const case_number = `${currentYear}-${String(nextSeq).padStart(5, '0')}`;

        const newCaseId = await caseRepo.createWithAssignment({
            id, case_number, type: entityType, title, description, author_id,
            severity_id, tlp: actualTlp, pap: actualPap, status: 'open',
            kill_chain_type: actualKillChain, beneficiary_id,
        }, assigned_to);

        logAudit(id, req.user.id, entityType === 'alert' ? 'alert_created' : 'case_created', 'case', id, { title });
        
        const createdCase = await caseRepo.findById(newCaseId);
        res.json(createdCase);
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
            const userRepo = new BaseRepository(getDb(), 'user_profiles');
            const currentUserRole = await userRepo.findById(req.user.id);
            const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
            const isMember = await memRepo.findFirst({ beneficiary_id, user_id: req.user.id });
            if (!isMember && !isAdmin(currentUserRole?.role)) {
                return res.status(403).json({ error: 'You must be a member of the beneficiary to assign it to a case' });
            }
            updateData.beneficiary_id = beneficiary_id;
        } else if (beneficiary_id === null) {
            return res.status(400).json({ error: 'beneficiary_id cannot be null' });
        }

        if (author_id !== undefined) {
            const userRepo = new BaseRepository(getDb(), 'user_profiles');
            const currentUserRole = await userRepo.findById(req.user.id);
            if (currentUserRole && isAdmin(currentUserRole.role)) {
                updateData.author_id = author_id;
            }
        }

        if (Object.keys(updateData).length > 0) {
            const caseRepo = new CaseRepository();
            const oldCase = await caseRepo.findById(req.params.id);
            await caseRepo.update(req.params.id, updateData);

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

        const currentUserRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUser = await currentUserRepo.findById(req.user.id);
        const hasAdminAccessGlobal = currentUser && isAdmin(currentUser.role);
        
        const caseRepo = new CaseRepository();
        const result = await caseRepo.findAllAccessible(req.user.id, hasAdminAccessGlobal, typeFilter, page, limit);
        
        if (page <= 0) return res.json(result.rows);
        
        const totalPages = Math.ceil(result.total / limit);
        res.json({ data: result.rows, pagination: { page, limit, total: result.total, totalPages } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a single case
router.get('/:id', async (req, res) => {
    try {
        const currentUserRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUser = await currentUserRepo.findById(req.user.id);
        const hasAdminAccessGlobal = currentUser && isAdmin(currentUser.role);
        
        const caseRepo = new CaseRepository();
        const r = await caseRepo.findByIdAccessible(req.params.id, req.user.id, hasAdminAccessGlobal);
        
        if (r.notFound) return res.status(404).json({ error: 'Case not found' });
        if (!r.hasAccess) return res.status(403).json({ error: 'Access denied: you are not assigned to this case' });
        
        delete r.hasAccess;
        res.json(r);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:id/beneficiary-members', async (req, res) => {
    try {
        const caseRepo = new CaseRepository();
        const caseRecord = await caseRepo.findById(req.params.id);
        if (!caseRecord) return res.status(404).json({ error: 'Case not found' });
        
        const assignRepo = new BaseRepository(getDb(), 'case_assignments');
        const assignments = await assignRepo.findWhere({ case_id: req.params.id });
        const isAssigned = caseRecord.author_id === req.user.id || assignments.some(a => a.user_id === req.user.id);
        
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUser = await userRepo.findById(req.user.id);
        if (!isAssigned && (!currentUser || !isAdmin(currentUser.role))) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const members = await caseRepo.getBeneficiaryMembers(caseRecord.beneficiary_id);
        res.json(members);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Convert alert to case
router.post('/:id/convert', async (req, res) => {
    try {
        const caseRepo = new CaseRepository();
        const caseRecord = await caseRepo.findById(req.params.id);
        if (!caseRecord) return res.status(404).json({ error: 'Not found' });
        if (caseRecord.type !== 'alert') return res.status(400).json({ error: 'Only alerts can be converted to cases' });

        if (!await userHasTypeAccessForBeneficiary(req.user.id, caseRecord.beneficiary_id, 'case', 'user')) {
            return res.status(403).json({ error: 'case_analyst role or higher required to convert alerts' });
        }

        await caseRepo.update(req.params.id, { type: 'case' });

        const assignRepo = new BaseRepository(getDb(), 'case_assignments');
        const assignedUsers = await assignRepo.findWhere({ case_id: req.params.id });
        
        if (assignedUsers.length > 0) {
            const userIds = assignedUsers.map(a => a.user_id);
            const userRepo = new BaseRepository(getDb(), 'user_profiles');
            
            // Re-fetch users for role details. Better to just loop.
            const assignmentsToRemove = [];
            for (const assignment of assignedUsers) {
                const p = await userRepo.findById(assignment.user_id);
                const isGloballyAdmin = p && isAdmin(p.role);
                
                let hasAccess = isGloballyAdmin;
                if (!hasAccess) {
                    const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
                    const m = await memRepo.findFirst({ user_id: assignment.user_id, beneficiary_id: caseRecord.beneficiary_id });
                    if (m && m.role) {
                        const mRoles = Array.isArray(m.role) ? m.role : JSON.parse(m.role || '[]');
                        hasAccess = mRoles.some(r => r === 'case_analyst' || r === 'case_manager' || r === 'case_user' || r === 'case_viewer');
                    }
                }
                
                if (!hasAccess) {
                    assignmentsToRemove.push(assignment);
                    await assignRepo.delete(assignment.id);
                    logAudit(req.params.id, req.user.id, 'member_removed', 'case_assignment', assignment.id, {
                        user_name: p?.full_name || 'Inconnu',
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
        const caseRepo = new CaseRepository();
        const caseRecord = await caseRepo.findById(req.params.id);
        if (!caseRecord) return res.status(404).json({ error: 'Not found' });

        if (!await userHasTypeAccessForBeneficiary(req.user.id, caseRecord.beneficiary_id, caseRecord.type || 'case', 'manager')) {
            return res.status(403).json({ error: 'Analyst role required to delete' });
        }

        await caseRepo.delete(req.params.id);
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
