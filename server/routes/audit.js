const express = require('express');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const { canAccessCase } = require('../utils/access');

router.get('/case/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const auditRepo = new BaseRepository(getDb(), 'case_audit_log');
        const items = await auditRepo.findWhere(
            { case_id: req.params.caseId },
            { sort: '-created_at' }
        );

        const parsed = items.map(item => ({
            ...item,
            details: typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {}),
        }));

        res.json(parsed);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
