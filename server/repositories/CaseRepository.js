const { getDb } = require('../db-arango');
const BaseRepository = require('./BaseRepository');
const { getTlpColor, getPapColor } = require('../utils/colors');

class CaseRepository extends BaseRepository {
    constructor() {
        super(getDb(), 'cases');
    }

    async getBeneficiaries(userId) {
        const aql = `
            FOR m IN beneficiary_members
                FILTER m.user_id == @userId
                FOR b IN beneficiaries
                    FILTER b._key == m.beneficiary_id
                    SORT b.name ASC
                    RETURN b
        `;
        return this.query(aql, { userId });
    }

    async getBeneficiaryMembers(beneficiaryId) {
        const aql = `
            FOR m IN beneficiary_members
                FILTER m.beneficiary_id == @beneficiaryId
                FOR u IN user_profiles
                    FILTER u._key == m.user_id
                    SORT u.full_name ASC
                    RETURN KEEP(u, '_key', 'full_name')
        `;
        const members = await this.query(aql, { beneficiaryId });
        return members.map(m => ({ id: m._key, full_name: m.full_name }));
    }

    async createWithAssignment(caseData, assignedToId) {
        const newCase = await this.create(caseData);
        if (caseData.type === 'alert' && assignedToId) {
            const assignRepo = new BaseRepository(this.db, 'case_assignments');
            await assignRepo.create({
                case_id: newCase.id,
                user_id: assignedToId
            });
        }
        return newCase;
    }

    async findAllAccessible(userId, hasAdminAccessGlobal, typeFilter, page, limit) {
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

            LET accessibleCases = (
                FOR c IN cases
                    FILTER c.type == null OR c.type == @typeFilter OR (c.type == 'case' AND @typeFilter == 'case')
                    LET hasAccess = @hasAdminAccessGlobal OR (c._key IN userCaseIds) OR (c._key IN assignedCaseIds) OR (c.beneficiary_id IN userBeneficiaryIds)
                    FILTER hasAccess OR @hasAdminAccessGlobal
                    
                    SORT c.created_at DESC
                    
                    LET sev = DOCUMENT('severities', c.severity_id)
                    LET auth = DOCUMENT('user_profiles', c.author_id)
                    LET ben = DOCUMENT('beneficiaries', c.beneficiary_id)
                    
                    LET assignments = (
                        FOR ca IN case_assignments
                            FILTER ca.case_id == c._key
                            LET u = DOCUMENT('user_profiles', ca.user_id)
                            RETURN { id: ca._key, user_id: ca.user_id, user: { id: u._key, full_name: u.full_name, email: u.email } }
                    )
                    
                    LET isAssigned = c.author_id == @userId || (LENGTH(FOR ca IN assignments FILTER ca.user_id == @userId RETURN 1) > 0)
                    LET isBeneficiaryMember = c.beneficiary_id IN userBeneficiaryIds
                    LET fullAccess = isAssigned || isBeneficiaryMember
                    
                    RETURN fullAccess ? {
                        id: c._key,
                        type: c.type || 'case',
                        case_number: c.case_number,
                        title: c.title,
                        description: c.description,
                        status: c.status,
                        created_at: c.created_at,
                        updated_at: c.updated_at,
                        author_id: c.author_id,
                        severity_id: c.severity_id,
                        tlp_id: c.tlp || 'AMBER',
                        pap_id: c.pap || 'GREEN',
                        beneficiary_id: c.beneficiary_id,
                        attacker_utc_offset: c.attacker_utc_offset,
                        kill_chain_type: c.kill_chain_type,
                        author: { full_name: auth.full_name },
                        severity: { label: sev.label, color: sev.color },
                        tlp: { code: c.tlp || 'AMBER', label: CONCAT('TLP:', c.tlp || 'AMBER') },
                        pap: c.pap ? { code: c.pap, label: CONCAT('PAP:', c.pap) } : null,
                        beneficiary: { id: c.beneficiary_id, name: ben.name },
                        case_assignments: assignments
                    } : {
                        id: c._key,
                        case_number: c.case_number,
                        title: "Accès Restreint",
                        description: "",
                        status: c.status,
                        created_at: null,
                        author_id: c.author_id,
                        severity_id: c.severity_id,
                        tlp_id: "WHITE",
                        pap_id: "WHITE",
                        author: { full_name: auth.full_name },
                        severity: { label: "Restreint", color: "#6b7280" },
                        tlp: { code: "WHITE", label: "TLP:WHITE" },
                        pap: { code: "WHITE", label: "PAP:WHITE" },
                        attacker_utc_offset: c.attacker_utc_offset,
                        beneficiary_id: c.beneficiary_id,
                        beneficiary: { id: c.beneficiary_id, name: "RESTRICTED" },
                        case_assignments: assignments
                    }
            )
            
            LET total = LENGTH(accessibleCases)
            LET paginated = (
                @limit > 0 
                ? (FOR c IN accessibleCases LIMIT @offset, @limit RETURN c)
                : accessibleCases
            )
            
            RETURN { total: total, rows: paginated }
        `;
        const offset = Math.max(0, (page - 1) * limit);
        const result = await this.query(aql, {
            userId,
            hasAdminAccessGlobal: !!hasAdminAccessGlobal,
            typeFilter: typeFilter || 'case',
            offset: offset,
            limit: limit || 1000
        });
        
        const data = result[0] || { total: 0, rows: [] };
        if (data.rows) {
            data.rows.forEach(r => {
                if (r.tlp && r.tlp.code) r.tlp.color = getTlpColor(r.tlp.code);
                if (r.pap && r.pap.code) r.pap.color = getPapColor(r.pap.code);
            });
        }
        return data;
    }

    async findByIdAccessible(id, userId, hasAdminAccessGlobal) {
        const aql = `
            LET c = DOCUMENT('cases', @id)
            FILTER c != null

            LET sev = DOCUMENT('severities', c.severity_id)
            LET auth = DOCUMENT('user_profiles', c.author_id)
            LET closer = DOCUMENT('user_profiles', c.closed_by)
            LET ben = DOCUMENT('beneficiaries', c.beneficiary_id)
            
            LET assignments = (
                FOR ca IN case_assignments
                    FILTER ca.case_id == c._key
                    LET u = DOCUMENT('user_profiles', ca.user_id)
                    RETURN { id: ca._key, user_id: ca.user_id, user: { id: u._key, full_name: u.full_name, email: u.email } }
            )
            
            LET isAssigned = c.author_id == @userId || (LENGTH(FOR ca IN assignments FILTER ca.user_id == @userId RETURN 1) > 0)
            
            LET isBeneficiaryAlert = (c.type == 'alert' && c.beneficiary_id != null && LENGTH(
                FOR m IN beneficiary_members FILTER m.beneficiary_id == c.beneficiary_id AND m.user_id == @userId RETURN 1
            ) > 0)
            
            LET hasFullAccess = isAssigned || isBeneficiaryAlert
            
            RETURN hasFullAccess ? {
                id: c._key,
                type: c.type || 'case',
                case_number: c.case_number,
                title: c.title,
                description: c.description,
                status: c.status,
                created_at: c.created_at,
                updated_at: c.updated_at,
                closed_at: c.closed_at,
                author_id: c.author_id,
                severity_id: c.severity_id,
                tlp_id: c.tlp || 'AMBER',
                pap_id: c.pap || 'GREEN',
                beneficiary_id: c.beneficiary_id,
                attacker_utc_offset: c.attacker_utc_offset,
                kill_chain_type: c.kill_chain_type,
                author: { id: c.author_id, full_name: auth.full_name, email: auth.email },
                severity: { label: sev.label, color: sev.color },
                tlp: { code: c.tlp || 'AMBER', label: CONCAT('TLP:', c.tlp || 'AMBER') },
                pap: c.pap ? { code: c.pap, label: CONCAT('PAP:', c.pap) } : null,
                closed_by_user: closer ? { full_name: closer.full_name } : null,
                beneficiary: { id: c.beneficiary_id, name: ben.name },
                case_assignments: assignments,
                hasAccess: true
            } : (@hasAdminAccessGlobal ? {
                id: c._key,
                case_number: c.case_number,
                title: "Accès Restreint",
                description: "",
                status: c.status,
                created_at: null,
                closed_at: null,
                author_id: c.author_id,
                severity_id: c.severity_id,
                tlp_id: "WHITE",
                pap_id: "WHITE",
                author: { id: c.author_id, full_name: auth.full_name, email: auth.email },
                severity: { label: "Restreint", color: "#6b7280" },
                tlp: { code: "WHITE", label: "TLP:WHITE" },
                pap: { code: "WHITE", label: "PAP:WHITE" },
                attacker_utc_offset: c.attacker_utc_offset,
                closed_by_user: closer ? { full_name: "RESTRICTED" } : null,
                beneficiary_id: c.beneficiary_id,
                beneficiary: { id: c.beneficiary_id, name: "RESTRICTED" },
                case_assignments: assignments,
                hasAccess: true
            } : { hasAccess: false })
        `;
        const result = await this.query(aql, { id, userId, hasAdminAccessGlobal: !!hasAdminAccessGlobal });
        const doc = result[0] || { hasAccess: false, notFound: true };
        
        if (doc && doc.hasAccess && !doc.notFound) {
            if (doc.tlp && doc.tlp.code) doc.tlp.color = getTlpColor(doc.tlp.code);
            if (doc.pap && doc.pap.code) doc.pap.color = getPapColor(doc.pap.code);
        }
        return doc;
    }
}

module.exports = CaseRepository;
