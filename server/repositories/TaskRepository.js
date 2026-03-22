const { getDb } = require('../db-arango');
const BaseRepository = require('./BaseRepository');

class TaskRepository extends BaseRepository {
    constructor() {
        super(getDb(), 'tasks');
    }

    async findAllByCaseId(caseId) {
        const aql = `
            FOR t IN tasks
                FILTER t.case_id == @caseId
                SORT t.created_at DESC
                LET res = DOCUMENT('task_results', t.result_id)
                LET c = DOCUMENT('user_profiles', t.created_by)
                LET a = DOCUMENT('user_profiles', t.assigned_to)
                LET sys = DOCUMENT('case_systems', t.system_id)
                LET mal = DOCUMENT('case_malware_tools', t.malware_id)
                
                RETURN MERGE(t, {
                    id: t._key,
                    status: t.status ? t.status : 'open',
                    result: t.result_id ? { label: res.label, color: res.color } : null,
                    created_by_user: { id: t.created_by, full_name: c.full_name, email: c.email },
                    assigned_to_user: t.assigned_to ? { id: t.assigned_to, full_name: a.full_name, email: a.email } : null,
                    system: t.system_id ? { id: t.system_id, name: sys.name, system_type: sys.system_type } : null,
                    malware: t.malware_id ? { id: t.malware_id, file_name: mal.file_name, is_malicious: mal.is_malicious } : null,
                    is_osint: t.is_osint == 1
                })
        `;
        return this.query(aql, { caseId });
    }

    async findMyTasks(userId, hasAdminAccess, page, limit) {
        const aql = `
            LET userCaseIds = (
                FOR c IN cases
                    FILTER c.author_id == @userId
                    RETURN c._key
            )
            LET assignedCaseIds = (
                FOR ca IN case_assignments
                    FILTER ca.user_id == @userId
                    RETURN ca.case_id
            )
            LET userBeneficiaryIds = (
                FOR m IN beneficiary_members
                    FILTER m.user_id == @userId
                    RETURN m.beneficiary_id
            )

            LET allTasks = (
                FOR t IN tasks
                    SORT t.created_at DESC
                    
                    LET case_obj = DOCUMENT('cases', t.case_id)
                    LET hasAccess = @hasAdminAccess OR (case_obj._key IN userCaseIds) OR (case_obj._key IN assignedCaseIds) OR (case_obj.beneficiary_id IN userBeneficiaryIds)
                    FILTER hasAccess
                    
                    LET res = DOCUMENT('task_results', t.result_id)
                    LET c = DOCUMENT('user_profiles', t.created_by)
                    LET a = DOCUMENT('user_profiles', t.assigned_to)
                    LET sev = DOCUMENT('severities', case_obj.severity_id)
                    LET sys = DOCUMENT('case_systems', t.system_id)
                    LET mal = DOCUMENT('case_malware_tools', t.malware_id)
                    
                    RETURN MERGE(t, {
                        id: t._key,
                        status: t.status ? t.status : 'open',
                        result: t.result_id ? { label: res.label, color: res.color } : null,
                        created_by_user: { full_name: c.full_name },
                        assigned_to_user: t.assigned_to ? { full_name: a.full_name } : null,
                        case: {
                            id: case_obj._key, case_number: case_obj.case_number, title: case_obj.title, status: case_obj.status,
                            severity: sev ? { label: sev.label, color: sev.color } : null
                        },
                        system: t.system_id ? { id: t.system_id, name: sys.name, system_type: sys.system_type } : null,
                        malware: t.malware_id ? { id: t.malware_id, file_name: mal.file_name, is_malicious: mal.is_malicious } : null
                    })
            )
            
            LET assignedTasks = (FOR t IN allTasks FILTER t.assigned_to == @userId RETURN t)
            LET unassignedTasks = (FOR t IN allTasks FILTER t.assigned_to == null RETURN t)
            
            LET assignedPaginated = (@limit > 0 ? (FOR t IN assignedTasks LIMIT @offset, @limit RETURN t) : assignedTasks)
            LET unassignedPaginated = (@limit > 0 ? (FOR t IN unassignedTasks LIMIT @offset, @limit RETURN t) : unassignedTasks)

            RETURN {
                assigned: assignedPaginated,
                unassigned: unassignedPaginated,
                totalAssigned: LENGTH(assignedTasks),
                totalUnassigned: LENGTH(unassignedTasks)
            }
        `;
        const offset = Math.max(0, (page - 1) * limit);
        const result = await this.query(aql, { userId, hasAdminAccess: !!hasAdminAccess, offset, limit: limit || 1000 });
        return result[0];
    }

    async findByIdWithDetails(id) {
        const aql = `
            FOR t IN tasks
                FILTER t._key == @id
                LET res = DOCUMENT('task_results', t.result_id)
                LET c = DOCUMENT('user_profiles', t.created_by)
                LET a = DOCUMENT('user_profiles', t.assigned_to)
                LET closed = DOCUMENT('user_profiles', t.closed_by)
                LET mod = DOCUMENT('user_profiles', t.closure_comment_modified_by)
                LET sys = DOCUMENT('case_systems', t.system_id)
                LET mal = DOCUMENT('case_malware_tools', t.malware_id)
                
                RETURN MERGE(t, {
                    id: t._key,
                    status: t.status ? t.status : 'open',
                    result: t.result_id ? { label: res.label, color: res.color } : null,
                    created_by_user: { id: t.created_by, full_name: c.full_name, email: c.email },
                    assigned_to_user: t.assigned_to ? { id: t.assigned_to, full_name: a.full_name, email: a.email } : null,
                    closed_by_user: t.closed_by ? { id: t.closed_by, full_name: closed.full_name, email: closed.email } : null,
                    closure_comment_modified_by_user: t.closure_comment_modified_by ? { id: t.closure_comment_modified_by, full_name: mod.full_name } : null,
                    system: t.system_id ? { id: t.system_id, name: sys.name, system_type: sys.system_type } : null,
                    malware: t.malware_id ? { id: t.malware_id, file_name: mal.file_name, is_malicious: mal.is_malicious } : null,
                    is_osint: t.is_osint == 1
                })
        `;
        const result = await this.query(aql, { id });
        return result[0] || null;
    }
}

module.exports = TaskRepository;
