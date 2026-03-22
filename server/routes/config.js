const express = require('express');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
    try {
        const publicKeys = ['investigation_debug', 'default_kill_chain_type', 'allow_api_tokens', 'kill_chain_event_type_mapping', 'session_lock_enabled', 'session_lock_timeout'];
        const repo = new BaseRepository(getDb(), 'system_config');
        const items = await repo.findWhere({});
        const configMap = {};
        for (const item of items) {
            if (publicKeys.includes(item.key)) configMap[item.key] = item.value;
        }
        res.json(configMap);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/ttps', async (req, res) => {
    try {
        const { kill_chain_type } = req.query;
        if (!kill_chain_type) return res.status(400).json({ error: 'kill_chain_type is required' });
        
        const db = getDb();
        const cursor = await db.query(`
            FOR t IN kill_chain_ttps
            FILTER t.kill_chain_type == @kct
            SORT t.phase_value ASC, t.order ASC
            RETURN MERGE(t, { id: t._key })
        `, { kct: kill_chain_type });
        const ttps = await cursor.all();
        
        res.json(ttps);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
