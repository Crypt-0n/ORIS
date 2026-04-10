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
                    LET members_list = (
                        FOR mem IN beneficiary_members
                            FILTER mem.beneficiary_id == b._key
                            FOR u IN user_profiles
                                FILTER u._key == mem.user_id
                                RETURN { id: u._key, full_name: u.full_name, email: u.email }
                    )
                    RETURN MERGE(b, { members: members_list })
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
                    RETURN KEEP(u, '_key', 'full_name', 'email')
        `;
        const members = await this.query(aql, { beneficiaryId });
        return members.map(m => ({ id: m.id, full_name: m.full_name, email: m.email }));
    }

    // ─── CUD operations (ArangoDB) ───

    async createWithAssignment(caseData, assignedToId) {
        const newCaseId = await this.create(caseData);
        if (caseData.type === 'alert' && assignedToId) {
            const crypto = require('crypto');
            const assignId = crypto.randomUUID();
            const assignRepo = new BaseRepository(this.db, 'case_assignments');
            await assignRepo.create({
                id: assignId,
                case_id: newCaseId,
                user_id: assignedToId
            });
        }
        return newCaseId;
    }

    async create(data) {
        const id = await super.create(data);
        return id;
    }

    async update(id, data) {
        return await super.update(id, data);
    }

    async delete(id) {
        return await super.delete(id);
    }

    // ─── Read operations: ArangoDB only (related tables not yet dual-written) ───

    async getNextCaseNumber(yearStr) {
        const aql = `
            FOR c IN cases
                FILTER STARTS_WITH(c.case_number, @prefix)
                SORT c.case_number DESC
                LIMIT 1
                RETURN c.case_number
        `;
        const result = await this.query(aql, { prefix: `${yearStr}-` });
        let nextSeq = 1;
        if (result.length > 0 && result[0]) {
            const parts = result[0].split('-');
            if (parts.length === 2) {
                nextSeq = parseInt(parts[1], 10) + 1;
            }
        }
        return `${yearStr}-${String(nextSeq).padStart(5, '0')}`;
    }

    async findAllAccessible(userId, hasAdminAccessGlobal, typeFilter, page, limit, filters = {}) {
        const { status, beneficiary_id, severity_id, author_id } = filters;
        
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

            LET casesBeforeStatusFilter = (
                FOR c IN cases
                    FILTER !c.type || c.type == @typeFilter
                    LET hasAccess = @hasAdminAccessGlobal OR (c._key IN userCaseIds) OR (c._key IN assignedCaseIds) OR (c.beneficiary_id IN userBeneficiaryIds)
                    FILTER hasAccess OR @hasAdminAccessGlobal
                    
                    FILTER @beneficiary_id == null OR c.beneficiary_id == @beneficiary_id
                    FILTER @severity_id == null OR c.severity_id == @severity_id
                    FILTER @author_id == null OR c.author_id == @author_id
                    
                    LET isUnassigned = LENGTH(FOR ca IN case_assignments FILTER ca.case_id == c._key RETURN 1) == 0
                    LET isMyCase = c.author_id == @userId || (c._key IN assignedCaseIds)
                    FILTER @supervision == null OR (@supervision == 'backlog' ? isUnassigned : (@supervision == true ? (@typeFilter == 'case' ? !isMyCase : (!isMyCase AND !isUnassigned)) : isMyCase))
                    
                    RETURN c
            )

            LET statusCounts = {
                all: LENGTH(casesBeforeStatusFilter),
                open: LENGTH(FOR c IN casesBeforeStatusFilter FILTER c.status == 'open' RETURN 1),
                closed: LENGTH(FOR c IN casesBeforeStatusFilter FILTER c.status == 'closed' RETURN 1)
            }

            LET filteredCaseRefs = (
                FOR c IN casesBeforeStatusFilter
                    FILTER @status == null OR c.status == @status
                    SORT c.created_at DESC
                    RETURN c
            )

            LET total = LENGTH(filteredCaseRefs)
            
            LET paginatedRefs = (
                @limit > 0 
                ? (FOR c IN filteredCaseRefs LIMIT @offset, @limit RETURN c)
                : filteredCaseRefs
            )
            
            LET rows = (
                FOR c IN paginatedRefs
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
                    LET isRestrictedTlp = (c.tlp == 'RED' || c.tlp == 'AMBER+STRICT')
                    LET fullAccess = isRestrictedTlp ? (@hasAdminAccessGlobal || isAssigned) : (isAssigned || isBeneficiaryMember)
                    LET totalPages = @limit > 0 ? CEIL(total / @limit) : 1
                    
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
                        adversary: c.adversary,
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
            
            RETURN { total: total, rows: rows, statusCounts: statusCounts }
        `;
        const offset = Math.max(0, (page - 1) * limit);
        const result = await this.query(aql, {
            userId,
            hasAdminAccessGlobal: !!hasAdminAccessGlobal,
            typeFilter: typeFilter || 'case',
            offset: offset,
            limit: limit || 1000,
            status: status || null,
            beneficiary_id: beneficiary_id || null,
            severity_id: severity_id || null,
            author_id: author_id || null,
            supervision: filters.supervision !== undefined ? filters.supervision : null
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
    async getFiltersMetadata(userId, hasAdminAccessGlobal, typeFilter) {
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
                    FILTER !c.type || c.type == @typeFilter
                    LET hasAccess = @hasAdminAccessGlobal OR (c._key IN userCaseIds) OR (c._key IN assignedCaseIds) OR (c.beneficiary_id IN userBeneficiaryIds)
                    FILTER hasAccess OR @hasAdminAccessGlobal
                    RETURN c
            )
            
            LET beneficiaryIds = UNIQUE(FOR c IN accessibleCases FILTER c.beneficiary_id != null RETURN c.beneficiary_id)
            LET authorIds = UNIQUE(FOR c IN accessibleCases FILTER c.author_id != null RETURN c.author_id)
            LET severityIds = UNIQUE(FOR c IN accessibleCases FILTER c.severity_id != null RETURN c.severity_id)
            
            LET beneficiaries = (
                FOR b IN beneficiaries
                    FILTER b._key IN beneficiaryIds
                    RETURN { id: b._key, name: b.name }
            )
            
            LET authors = (
                FOR u IN user_profiles
                    FILTER u._key IN authorIds
                    RETURN { id: u._key, full_name: u.full_name }
            )
            
            LET severities = (
                FOR s IN severities
                    FILTER s._key IN severityIds
                    RETURN { id: s._key, label: s.label, color: s.color }
            )
            
            LET tabCounts = {
                my: LENGTH(
                    FOR c IN accessibleCases
                        LET isMyCase = c.author_id == @userId || (c._key IN assignedCaseIds)
                        FILTER isMyCase
                        RETURN 1
                ),
                backlog: LENGTH(
                    FOR c IN accessibleCases
                        LET isUnassigned = LENGTH(FOR ca IN case_assignments FILTER ca.case_id == c._key RETURN 1) == 0
                        FILTER isUnassigned
                        RETURN 1
                ),
                supervision: LENGTH(
                    FOR c IN accessibleCases
                        LET isMyCase = c.author_id == @userId || (c._key IN assignedCaseIds)
                        LET isUnassigned = LENGTH(FOR ca IN case_assignments FILTER ca.case_id == c._key RETURN 1) == 0
                        FILTER @typeFilter == 'case' ? !isMyCase : (!isMyCase AND !isUnassigned)
                        RETURN 1
                )
            }
            
            RETURN { beneficiaries, authors, severities, tabCounts }
        `;
        
        const result = await this.query(aql, {
            userId,
            hasAdminAccessGlobal: !!hasAdminAccessGlobal,
            typeFilter: typeFilter || 'case'
        });
        
        return result[0] || { beneficiaries: [], authors: [], severities: [], tabCounts: { my: 0, backlog: 0, supervision: 0 } };
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
            
            LET isBeneficiaryMember = (c.beneficiary_id != null && LENGTH(
                FOR m IN beneficiary_members FILTER m.beneficiary_id == c.beneficiary_id AND m.user_id == @userId RETURN 1
            ) > 0)
            
            LET isRestrictedTlp = (c.tlp == 'RED' || c.tlp == 'AMBER+STRICT')
            LET hasFullAccess = isRestrictedTlp ? isAssigned : (isAssigned || isBeneficiaryMember)
            
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
                adversary: c.adversary,
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
