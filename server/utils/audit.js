const db = require('../db');
const crypto = require('crypto');
const { dispatchWebhooks } = require('./webhookDispatcher');

/**
 * Logs an action to the case_audit_log table and dispatches webhooks.
 * Now async — callers should await or fire-and-forget.
 */
async function logAudit(caseId, userId, action, entityType, entityId, details = {}) {
    try {
        const id = crypto.randomUUID();
        const user = await db('user_profiles').where({ id: userId }).select('full_name').first();
        const user_full_name = user ? user.full_name : 'System';

        await db('case_audit_log').insert({
            id,
            case_id: caseId,
            user_id: userId,
            action,
            entity_type: entityType,
            entity_id: entityId,
            details: JSON.stringify({ ...details, user_full_name }),
        });

        // Dispatch webhooks asynchronously (fire-and-forget)
        dispatchWebhooks(action, {
            case_id: caseId,
            user: user_full_name,
            action,
            entity_type: entityType,
            entity_id: entityId,
            ...details,
        });
    } catch (err) {
        console.error('Audit log failed:', err);
    }
}

module.exports = { logAudit };
