const express = require('express');
const { getDb } = require('../db-arango');
const StixGraphRepository = require('../repositories/StixGraphRepository');
const authenticateToken = require('../middleware/auth');
const { canAccessCase } = require('../utils/access');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticateToken);

// Helper: get repo instance
function getRepo() {
    return new StixGraphRepository(getDb());
}

// ─── STIX Objects ────────────────────────────────────────────

// Get all STIX objects for a case
router.get('/objects/by-case/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const repo = getRepo();
        const objects = await repo.getObjectsByCaseId(req.params.caseId);
        res.json(objects);
    } catch (err) {
        console.error('STIX getObjectsByCaseId error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a single STIX object by ID
router.get('/objects/:id', async (req, res) => {
    try {
        const repo = getRepo();
        const obj = await repo.getObjectById(req.params.id);
        if (!obj) return res.status(404).json({ error: 'Object not found' });
        res.json(obj.data);
    } catch (err) {
        console.error('STIX getObjectById error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a STIX object
router.post('/objects', async (req, res) => {
    try {
        const { case_id, ...stixData } = req.body;
        if (!case_id) return res.status(400).json({ error: 'Missing case_id' });
        if (!await canAccessCase(req.user.id, case_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const repo = getRepo();
        const result = await repo.createObject(case_id, stixData, req.user.id);
        logAudit(case_id, req.user.id, 'stix_object_created', 'stix', stixData.id, { type: stixData.type });
        res.json(result);
    } catch (err) {
        console.error('STIX createObject error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update a STIX object
router.put('/objects/:id', async (req, res) => {
    try {
        const repo = getRepo();
        const existing = await repo.getObjectById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Object not found' });
        if (!await canAccessCase(req.user.id, existing.case_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const result = await repo.createObject(existing.case_id, { ...req.body, id: req.params.id }, req.user.id);
        logAudit(existing.case_id, req.user.id, 'stix_object_updated', 'stix', req.params.id, { type: req.body.type });
        res.json(result);
    } catch (err) {
        console.error('STIX updateObject error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a STIX object
router.delete('/objects/:id', async (req, res) => {
    try {
        const repo = getRepo();
        const existing = await repo.getObjectById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Object not found' });
        if (!await canAccessCase(req.user.id, existing.case_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        await repo.deleteObject(req.params.id);
        logAudit(existing.case_id, req.user.id, 'stix_object_deleted', 'stix', req.params.id, {});
        res.json({ success: true });
    } catch (err) {
        console.error('STIX deleteObject error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── STIX Relationships ─────────────────────────────────────

// Get relationships for a case
router.get('/relationships/by-case/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const repo = getRepo();
        const rels = await repo.getRelationshipsByCaseId(req.params.caseId);
        res.json(rels);
    } catch (err) {
        console.error('STIX getRelationshipsByCaseId error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a relationship
router.post('/relationships', async (req, res) => {
    try {
        const { case_id, ...relData } = req.body;
        if (!case_id) return res.status(400).json({ error: 'Missing case_id' });
        if (!await canAccessCase(req.user.id, case_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const repo = getRepo();
        const result = await repo.createRelationship(case_id, relData, req.user.id);
        res.json(result);
    } catch (err) {
        console.error('STIX createRelationship error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a relationship
router.delete('/relationships/:id', async (req, res) => {
    try {
        const repo = getRepo();
        await repo.deleteRelationship(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('STIX deleteRelationship error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── STIX Bundle ────────────────────────────────────────────

router.get('/bundle/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const repo = getRepo();
        const bundle = await repo.getBundleForCase(req.params.caseId);
        res.json(bundle);
    } catch (err) {
        console.error('STIX getBundleForCase error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Diamond Model ──────────────────────────────────────────

router.get('/diamond/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const repo = getRepo();
        const data = await repo.getDiamondData(req.params.caseId);
        res.json(data);
    } catch (err) {
        console.error('STIX getDiamondData error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Lateral Movements ──────────────────────────────────────

router.get('/lateral/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const repo = getRepo();
        const data = await repo.getLateralMovements(req.params.caseId);
        res.json(data);
    } catch (err) {
        console.error('STIX getLateralMovements error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Sync from Legacy Tables ────────────────────────────────

router.post('/sync/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const repo = getRepo();
        const result = await repo.syncCaseToGraph(req.params.caseId);
        res.json(result);
    } catch (err) {
        console.error('STIX sync error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
