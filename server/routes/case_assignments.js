const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const authenticateToken = require('../middleware/auth');
const { isAdmin } = require('../utils/access');

const router = express.Router();
router.use(authenticateToken);

router.post('/', async (req, res) => {
    try {
        const { case_id, user_id } = req.body;
        if (!case_id || !user_id) return res.status(400).json({ error: 'Missing case_id or user_id' });

        const caseRepo = new BaseRepository(getDb(), 'cases');
        const caseRecord = await caseRepo.findById(case_id);
        if (!caseRecord) return res.status(404).json({ error: 'Case not found' });

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUser = await userRepo.findById(req.user.id);
        const hasAdminRole = isAdmin(currentUser?.role);

        const isSelfAssign = user_id === req.user.id;
        const assignmentRepo = new BaseRepository(getDb(), 'case_assignments');
        const existingAssignments = await assignmentRepo.findWhere({ case_id });
        const existingAssignment = existingAssignments.length > 0 ? existingAssignments[0] : null;

        const isUnassignedAlert = caseRecord.type === 'alert' && !existingAssignment;
        
        let isBeneficiaryMember = false;
        const bRepo = new BaseRepository(getDb(), 'beneficiary_members');
        if (caseRecord.beneficiary_id) {
            const bMembers = await bRepo.findWhere({ beneficiary_id: caseRecord.beneficiary_id, user_id: req.user.id });
            isBeneficiaryMember = bMembers.length > 0;
        }
        
        const canSelfAssignAlert = isSelfAssign && isUnassignedAlert && isBeneficiaryMember;

        if (caseRecord.author_id !== req.user.id && !hasAdminRole && !canSelfAssignAlert) {
            return res.status(403).json({ error: 'Not authorized to add members to this case' });
        }

        if (caseRecord.beneficiary_id && !hasAdminRole) {
            const mem = await bRepo.findWhere({ beneficiary_id: caseRecord.beneficiary_id, user_id });
            if (mem.length === 0) return res.status(400).json({ error: 'User is not a member of the case beneficiary' });
        }

        const id = crypto.randomUUID();
        await assignmentRepo.create({ id, case_id, user_id });

        const targetUser = await userRepo.findById(user_id);
        
        const auditRepo = new BaseRepository(getDb(), 'case_audit_log');
        await auditRepo.create({
            id: crypto.randomUUID(), case_id, user_id: req.user.id, action: 'member_added',
            entity_type: 'case_assignment', entity_id: id,
            details: JSON.stringify({
                user_name: targetUser?.full_name || 'Inconnu',
                performed_by_name: currentUser?.full_name || 'Inconnu',
            }),
            created_at: new Date().toISOString()
        });

        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error('[ERROR] POST /case_assignments:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const assignmentRepo = new BaseRepository(getDb(), 'case_assignments');
        const assignmentRecord = await assignmentRepo.findById(req.params.id);
        if (!assignmentRecord) return res.status(404).json({ error: 'Assignment not found' });

        const caseRepo = new BaseRepository(getDb(), 'cases');
        const caseRecord = await caseRepo.findById(assignmentRecord.case_id);
        
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const adminUser = await userRepo.findById(req.user.id);
        const hasAdminRole = isAdmin(adminUser?.role);

        if (caseRecord.author_id !== req.user.id && !hasAdminRole) {
            return res.status(403).json({ error: 'Not authorized to remove members from this case' });
        }

        const targetUser = await userRepo.findById(assignmentRecord.user_id);
        
        const auditRepo = new BaseRepository(getDb(), 'case_audit_log');
        await auditRepo.create({
            id: crypto.randomUUID(), case_id: assignmentRecord.case_id, user_id: req.user.id,
            action: 'member_removed', entity_type: 'case_assignment', entity_id: req.params.id,
            details: JSON.stringify({
                user_name: targetUser?.full_name || 'Inconnu',
                performed_by_name: adminUser?.full_name || 'Inconnu',
            }),
            created_at: new Date().toISOString()
        });

        await assignmentRepo.delete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
