/**
 * Centralized access control utility — ORIS RBAC V3.
 * 
 * ALL role checks and permission logic live here.
 * No other file should parse roles or check admin status directly.
 * 
 * Role model (V3 — per-beneficiary):
 *   Global roles in user_profiles.role: only ["admin"] or []
 *   Per-beneficiary roles in beneficiary_members.role:
 *     case_analyst, case_viewer, alert_analyst, alert_viewer
 *   Team lead is per-beneficiary: beneficiary_members.is_team_lead
 * 
 * All DB-accessing functions are async (Knex query builder).
 */
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');

// ─── Role Parsing ───────────────────────────────────────────────

function getRoles(roleStr) {
    if (!roleStr) return ['user'];
    if (Array.isArray(roleStr)) return roleStr;
    try {
        const parsed = JSON.parse(roleStr);
        return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
        return [String(roleStr)];
    }
}

// ─── Role Checks ────────────────────────────────────────────────

function isAdmin(roleStr) {
    return getRoles(roleStr).includes('admin');
}

function isTeamLead(roleStr) {
    return getRoles(roleStr).includes('team_leader');
}

async function getMemberRoles(userId, beneficiaryId) {
    if (!userId || !beneficiaryId) return [];
    const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
    const row = await memRepo.findFirst({ user_id: userId, beneficiary_id: beneficiaryId });
    if (!row?.role) return [];
    return getRoles(row.role);
}

function hasTypeAccess(roleStr, type, level = 'viewer') {
    const roles = getRoles(roleStr);
    if (roles.includes('admin')) return true;
    if (roles.includes('team_leader')) return true;

    const prefix = type === 'alert' ? 'alert' : 'case';
    const levelHierarchy = { viewer: 0, user: 1, analyst: 1, manager: 2 };
    const requiredLevel = levelHierarchy[level] || 0;

    if (roles.includes(`${prefix}_manager`)) return requiredLevel <= 2;
    if (roles.includes(`${prefix}_analyst`)) return requiredLevel <= 2;
    if (roles.includes(`${prefix}_user`)) return requiredLevel <= 1;
    if (roles.includes(`${prefix}_viewer`)) return requiredLevel <= 0;
    if (roles.includes('user')) return requiredLevel <= 1;

    return false;
}

async function userHasTypeAccessForBeneficiary(userId, beneficiaryId, type, level = 'viewer') {
    if (!userId) return false;
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (user && isAdmin(user.role)) return true;
    if (!beneficiaryId) return false;
    const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
    const member = await memRepo.findFirst({ user_id: userId, beneficiary_id: beneficiaryId });
    if (!member?.role) return false;
    return hasTypeAccess(member.role, type, level);
}

async function userHasAnyTypeAccess(userId, type) {
    if (!userId) return false;
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (user && isAdmin(user.role)) return true;

    const prefix = type === 'alert' ? 'alert' : 'case';
    const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
    const aql = `
        FOR m IN beneficiary_members
            FILTER m.user_id == @userId
            FILTER m.role LIKE @r1 OR m.role LIKE @r2 OR m.role LIKE @r3 OR m.role LIKE @r4
            RETURN m
    `;
    const rows = await memRepo.query(aql, {
        userId,
        r1: `%"${prefix}_analyst"%`,
        r2: `%"${prefix}_manager"%`,
        r3: `%"${prefix}_user"%`,
        r4: `%"${prefix}_viewer"%`
    });
    return rows.length > 0;
}

async function canSeeType(userId, type) {
    return userHasAnyTypeAccess(userId, type);
}

async function isTeamLeadForBeneficiary(userId, beneficiaryId) {
    if (!userId || !beneficiaryId) return false;
    const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
    const row = await memRepo.findFirst({ user_id: userId, beneficiary_id: beneficiaryId });
    return row?.is_team_lead === 1 || row?.is_team_lead === true || row?.is_team_lead === 'true';
}

async function isTeamLeadForCase(userId, caseId) {
    if (!userId || !caseId) return false;
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (user && isAdmin(user.role)) return true;
    
    const caseRepo = new BaseRepository(getDb(), 'cases');
    const caseRow = await caseRepo.findById(caseId);
    if (!caseRow?.beneficiary_id) return false;
    return isTeamLeadForBeneficiary(userId, caseRow.beneficiary_id);
}

// ─── Case-Level Access (DB lookups) ─────────────────────────────

async function canAccessCase(userId, caseId) {
    if (!userId || !caseId) return false;
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (!user) return false;
    if (isAdmin(user.role)) return true;

    const caseRepo = new BaseRepository(getDb(), 'cases');
    const caseRow = await caseRepo.findById(caseId);
    if (!caseRow) return false;
    if (caseRow.author_id === userId) return true;

    const assignRepo = new BaseRepository(getDb(), 'case_assignments');
    const isAssigned = await assignRepo.findFirst({ case_id: caseId, user_id: userId });
    if (isAssigned) return true;

    if (caseRow.beneficiary_id) {
        const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
        const isMember = await memRepo.findFirst({ beneficiary_id: caseRow.beneficiary_id, user_id: userId });
        if (isMember) return true;
    }
    return false;
}

async function getUserRole(userId) {
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    return user?.role || null;
}

async function userHasTypeAccess(userId, type, level = 'viewer') {
    const roleStr = await getUserRole(userId);
    if (!roleStr) return false;
    return hasTypeAccess(roleStr, type, level);
}

// ─── Express Middleware ─────────────────────────────────────────

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role === undefined) {
        return res.status(401).json({ error: 'Auth context missing' });
    }
    
    if (!isAdmin(req.user.role)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

function requireRole(...requiredRoles) {
    return (req, res, next) => {
        if (!req.user || req.user.role === undefined) {
            return res.status(401).json({ error: 'Auth context missing' });
        }
        
        const userRoles = getRoles(req.user.role);
        // Admin overrides all base role checks
        const hasRole = userRoles.includes('admin') || requiredRoles.some(r => userRoles.includes(r));
        
        if (!hasRole) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

function requireCaseAccess(source = 'params', field = 'caseId') {
    return async (req, res, next) => {
        const caseId = (source === 'params' ? req.params : req.body)?.[field];
        if (!caseId) return res.status(400).json({ error: `${field} is required` });
        const hasAccess = await canAccessCase(req.user.id, caseId);
        if (!hasAccess) return res.status(403).json({ error: 'Access denied to this case' });
        next();
    };
}

/**
 * Returns which entity types a user can access for a given beneficiary.
 * Returns { case: bool, alert: bool } based on per-beneficiary roles.
 */
async function getUserAccessibleTypes(userId, beneficiaryId) {
    if (!userId || !beneficiaryId) return { case: false, alert: false };
    const userRepo = new BaseRepository(getDb(), 'user_profiles');
    const user = await userRepo.findById(userId);
    if (user && isAdmin(user.role)) return { case: true, alert: true };

    const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
    const member = await memRepo.findFirst({ user_id: userId, beneficiary_id: beneficiaryId });
    if (!member?.role) return { case: false, alert: false };

    const roles = getRoles(member.role);
    const hasCase = roles.some(r => r.startsWith('case_') || r === 'admin' || r === 'team_leader');
    const hasAlert = roles.some(r => r.startsWith('alert_') || r === 'admin' || r === 'team_leader');
    return { case: hasCase, alert: hasAlert };
}

module.exports = {
    getRoles,
    getMemberRoles,
    isAdmin,
    isTeamLead,
    isTeamLeadForBeneficiary,
    isTeamLeadForCase,
    hasTypeAccess,
    userHasTypeAccessForBeneficiary,
    userHasAnyTypeAccess,
    canSeeType,
    canAccessCase,
    getUserRole,
    userHasTypeAccess,
    getUserAccessibleTypes,
    requireAdmin,
    requireRole,
    requireCaseAccess,
};
