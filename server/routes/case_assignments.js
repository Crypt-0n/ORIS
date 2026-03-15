const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { isAdmin } = require('../utils/access');

const router = express.Router();
router.use(authenticateToken);

router.post('/', async (req, res) => {
    try {
        const { case_id, user_id } = req.body;
        if (!case_id || !user_id) return res.status(400).json({ error: 'Missing case_id or user_id' });

        const caseRecord = await db('cases').where({ id: case_id }).select('author_id', 'type', 'beneficiary_id').first();
        if (!caseRecord) return res.status(404).json({ error: 'Case not found' });

        const currentUser = await db('user_profiles').where({ id: req.user.id }).select('id', 'role').first();
        const hasAdminRole = isAdmin(currentUser?.role);

        const isSelfAssign = user_id === req.user.id;
        const existingAssignment = await db('case_assignments').where({ case_id }).first();
        const isUnassignedAlert = caseRecord.type === 'alert' && !existingAssignment;
        const isBeneficiaryMember = caseRecord.beneficiary_id &&
            await db('beneficiary_members').where({ beneficiary_id: caseRecord.beneficiary_id, user_id: req.user.id }).first();
        const canSelfAssignAlert = isSelfAssign && isUnassignedAlert && isBeneficiaryMember;

        if (caseRecord.author_id !== req.user.id && !hasAdminRole && !canSelfAssignAlert) {
            return res.status(403).json({ error: 'Not authorized to add members to this case' });
        }

        if (caseRecord.beneficiary_id && !hasAdminRole) {
            const isMember = await db('beneficiary_members').where({ beneficiary_id: caseRecord.beneficiary_id, user_id }).first();
            if (!isMember) return res.status(400).json({ error: 'User is not a member of the case beneficiary' });
        }

        const id = crypto.randomUUID();
        await db('case_assignments').insert({ id, case_id, user_id });

        const [targetUser, performedByUser] = await Promise.all([
            db('user_profiles').where({ id: user_id }).select('full_name').first(),
            db('user_profiles').where({ id: req.user.id }).select('full_name').first(),
        ]);
        await db('case_audit_log').insert({
            id: crypto.randomUUID(), case_id, user_id: req.user.id, action: 'member_added',
            entity_type: 'case_assignment', entity_id: id,
            details: JSON.stringify({
                user_name: targetUser?.full_name || 'Inconnu',
                performed_by_name: performedByUser?.full_name || 'Inconnu',
            }),
        });

        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error('[ERROR] POST /case_assignments:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const assignmentRecord = await db('case_assignments').where({ id: req.params.id }).select('case_id', 'user_id').first();
        if (!assignmentRecord) return res.status(404).json({ error: 'Assignment not found' });

        const caseRecord = await db('cases').where({ id: assignmentRecord.case_id }).select('author_id').first();
        const adminUser = await db('user_profiles').where({ id: req.user.id }).select('role').first();
        const hasAdminRole = isAdmin(adminUser?.role);

        if (caseRecord.author_id !== req.user.id && !hasAdminRole) {
            return res.status(403).json({ error: 'Not authorized to remove members from this case' });
        }

        const [targetUser, performedByUser] = await Promise.all([
            db('user_profiles').where({ id: assignmentRecord.user_id }).select('full_name').first(),
            db('user_profiles').where({ id: req.user.id }).select('full_name').first(),
        ]);
        await db('case_audit_log').insert({
            id: crypto.randomUUID(), case_id: assignmentRecord.case_id, user_id: req.user.id,
            action: 'member_removed', entity_type: 'case_assignment', entity_id: req.params.id,
            details: JSON.stringify({
                user_name: targetUser?.full_name || 'Inconnu',
                performed_by_name: performedByUser?.full_name || 'Inconnu',
            }),
        });

        await db('case_assignments').where({ id: req.params.id }).del();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
