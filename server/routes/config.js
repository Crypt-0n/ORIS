const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
    try {
        const publicKeys = ['investigation_debug', 'default_kill_chain_type', 'allow_api_tokens', 'kill_chain_event_type_mapping', 'session_lock_enabled', 'session_lock_timeout'];
        const items = await db('system_config').whereIn('key', publicKeys).select('key', 'value');
        const configMap = {};
        for (const item of items) configMap[item.key] = item.value;
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
        const ttps = await db('kill_chain_ttps')
            .where({ kill_chain_type })
            .orderBy('phase_value')
            .orderBy('order');
        res.json(ttps);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

