import crypto from 'crypto';
import { getDb } from '../db-arango';
import BaseRepository from '../repositories/BaseRepository';
import { isAdmin } from '../utils/access';

export class CaseAssignmentService {
    static async assignUser(caseId: string, targetUserId: string, currentUserId: string) {
        const caseRepo = new BaseRepository(getDb(), 'cases');
        const caseRecord = await caseRepo.findById(caseId);
        if (!caseRecord) throw new Error('Case not found');

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUser = await userRepo.findById(currentUserId);
        const hasAdminRole = isAdmin(currentUser?.role);

        const isSelfAssign = targetUserId === currentUserId;
        const assignmentRepo = new BaseRepository(getDb(), 'case_assignments');
        const existingAssignments = await assignmentRepo.findWhere({ case_id: caseId });
        const existingAssignment = existingAssignments.length > 0 ? existingAssignments[0] : null;

        const isUnassignedAlert = caseRecord.type === 'alert' && !existingAssignment;
        
        let isBeneficiaryMember = false;
        const bRepo = new BaseRepository(getDb(), 'beneficiary_members');
        if (caseRecord.beneficiary_id) {
            const bMembers = await bRepo.findWhere({ beneficiary_id: caseRecord.beneficiary_id, user_id: currentUserId });
            isBeneficiaryMember = bMembers.length > 0;
        }
        
        const canSelfAssignAlert = isSelfAssign && isUnassignedAlert && isBeneficiaryMember;

        if (caseRecord.author_id !== currentUserId && !hasAdminRole && !canSelfAssignAlert) {
            throw new Error('Not authorized to add members to this case');
        }

        if (caseRecord.beneficiary_id && !hasAdminRole) {
            const mem = await bRepo.findWhere({ beneficiary_id: caseRecord.beneficiary_id, user_id: targetUserId });
            if (mem.length === 0) throw new Error('User is not a member of the case beneficiary');
        }

        const id = crypto.randomUUID();
        await assignmentRepo.create({ id, case_id: caseId, user_id: targetUserId });

        const targetUser = await userRepo.findById(targetUserId);
        
        const auditRepo = new BaseRepository(getDb(), 'case_audit_log');
        await auditRepo.create({
            id: crypto.randomUUID(), case_id: caseId, user_id: currentUserId, action: 'member_added',
            entity_type: 'case_assignment', entity_id: id,
            details: JSON.stringify({
                user_name: targetUser?.full_name || 'Inconnu',
                performed_by_name: currentUser?.full_name || 'Inconnu',
            }),
            created_at: new Date().toISOString()
        });

        return id;
    }

    static async removeAssignment(assignmentId: string, currentUserId: string) {
        const assignmentRepo = new BaseRepository(getDb(), 'case_assignments');
        const assignmentRecord = await assignmentRepo.findById(assignmentId);
        if (!assignmentRecord) throw new Error('Assignment not found');

        const caseRepo = new BaseRepository(getDb(), 'cases');
        const caseRecord = await caseRepo.findById(assignmentRecord.case_id);
        
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const adminUser = await userRepo.findById(currentUserId);
        const hasAdminRole = isAdmin(adminUser?.role);

        if (caseRecord.author_id !== currentUserId && !hasAdminRole) {
            throw new Error('Not authorized to remove members from this case');
        }

        const targetUser = await userRepo.findById(assignmentRecord.user_id);
        
        const auditRepo = new BaseRepository(getDb(), 'case_audit_log');
        await auditRepo.create({
            id: crypto.randomUUID(), case_id: assignmentRecord.case_id, user_id: currentUserId,
            action: 'member_removed', entity_type: 'case_assignment', entity_id: assignmentId,
            details: JSON.stringify({
                user_name: targetUser?.full_name || 'Inconnu',
                performed_by_name: adminUser?.full_name || 'Inconnu',
            }),
            created_at: new Date().toISOString()
        });

        await assignmentRepo.delete(assignmentId);
    }
}
