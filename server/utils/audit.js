const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const crypto = require('crypto');
const { dispatchWebhooks } = require('./webhookDispatcher');

/**
 * Logs an action to the case_audit_log collection and dispatches webhooks.
 * Now async — callers should await or fire-and-forget.
 */
async function logAudit(caseId, userId, action, entityType, entityId, details = {}) {
    try {
        const id = crypto.randomUUID();
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const user = await userRepo.findById(userId);
        const user_full_name = user ? user.full_name : 'System';

        const auditRepo = new BaseRepository(getDb(), 'case_audit_log');
        await auditRepo.create({
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
