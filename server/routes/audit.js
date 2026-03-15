const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const { canAccessCase } = require('../utils/access');

router.get('/case/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const items = await db('case_audit_log').where({ case_id: req.params.caseId }).orderBy('created_at', 'desc');

        const parsed = items.map(item => ({
            ...item,
            details: item.details ? JSON.parse(item.details) : {},
        }));

        res.json(parsed);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
