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
const db = require('../db');

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
    const row = await db('beneficiary_members')
        .where({ user_id: userId, beneficiary_id: beneficiaryId })
        .select('role')
        .first();
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
    const user = await db('user_profiles').where({ id: userId }).select('role').first();
    if (user && isAdmin(user.role)) return true;
    if (!beneficiaryId) return false;
    const member = await db('beneficiary_members')
        .where({ user_id: userId, beneficiary_id: beneficiaryId })
        .select('role')
        .first();
    if (!member?.role) return false;
    return hasTypeAccess(member.role, type, level);
}

async function userHasAnyTypeAccess(userId, type) {
    if (!userId) return false;
    const user = await db('user_profiles').where({ id: userId }).select('role').first();
    if (user && isAdmin(user.role)) return true;

    const prefix = type === 'alert' ? 'alert' : 'case';
    const row = await db('beneficiary_members')
        .where('user_id', userId)
        .andWhere(function() {
            this.where('role', 'like', `%"${prefix}_analyst"%`)
                .orWhere('role', 'like', `%"${prefix}_manager"%`)
                .orWhere('role', 'like', `%"${prefix}_user"%`)
                .orWhere('role', 'like', `%"${prefix}_viewer"%`);
        })
        .first();
    return !!row;
}

async function canSeeType(userId, type) {
    return userHasAnyTypeAccess(userId, type);
}

async function isTeamLeadForBeneficiary(userId, beneficiaryId) {
    if (!userId || !beneficiaryId) return false;
    const row = await db('beneficiary_members')
        .where({ user_id: userId, beneficiary_id: beneficiaryId })
        .select('is_team_lead')
        .first();
    return row?.is_team_lead === 1;
}

async function isTeamLeadForCase(userId, caseId) {
    if (!userId || !caseId) return false;
    const user = await db('user_profiles').where({ id: userId }).select('role').first();
    if (user && isAdmin(user.role)) return true;
    const caseRow = await db('cases').where({ id: caseId }).select('beneficiary_id').first();
    if (!caseRow?.beneficiary_id) return false;
    return isTeamLeadForBeneficiary(userId, caseRow.beneficiary_id);
}

// ─── Case-Level Access (DB lookups) ─────────────────────────────

async function canAccessCase(userId, caseId) {
    if (!userId || !caseId) return false;
    const user = await db('user_profiles').where({ id: userId }).select('role').first();
    if (!user) return false;
    if (isAdmin(user.role)) return true;

    const caseRow = await db('cases').where({ id: caseId }).select('author_id', 'type', 'beneficiary_id').first();
    if (!caseRow) return false;
    if (caseRow.author_id === userId) return true;

    const isAssigned = await db('case_assignments').where({ case_id: caseId, user_id: userId }).first();
    if (isAssigned) return true;

    if (caseRow.beneficiary_id) {
        const isMember = await db('beneficiary_members')
            .where({ beneficiary_id: caseRow.beneficiary_id, user_id: userId }).first();
        if (isMember) return true;
    }
    return false;
}

async function getUserRole(userId) {
    const user = await db('user_profiles').where({ id: userId }).select('role').first();
    return user?.role || null;
}

async function userHasTypeAccess(userId, type, level = 'viewer') {
    const roleStr = await getUserRole(userId);
    if (!roleStr) return false;
    return hasTypeAccess(roleStr, type, level);
}

// ─── Express Middleware ─────────────────────────────────────────

function requireAdmin(req, res, next) {
    db('user_profiles').where({ id: req.user.id }).select('role').first()
        .then(user => {
            if (!user) return res.status(401).json({ error: 'User not found' });
            if (!isAdmin(user.role)) return res.status(403).json({ error: 'Admin access required' });
            next();
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        });
}

function requireRole(...requiredRoles) {
    return (req, res, next) => {
        db('user_profiles').where({ id: req.user.id }).select('role').first()
            .then(user => {
                if (!user) return res.status(401).json({ error: 'User not found' });
                const userRoles = getRoles(user.role);
                const hasRole = requiredRoles.some(r => userRoles.includes(r));
                if (!hasRole) return res.status(403).json({ error: 'Insufficient permissions' });
                next();
            })
            .catch(err => {
                console.error(err);
                res.status(500).json({ error: 'Internal server error' });
            });
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
    requireAdmin,
    requireRole,
    requireCaseAccess,
};
