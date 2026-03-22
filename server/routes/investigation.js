const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const StixGraphRepository = require('../repositories/StixGraphRepository');
const authenticateToken = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticateToken);

const { canAccessCase } = require('../utils/access');

// Known columns per table (replaces PRAGMA table_info which is SQLite-specific)
// IMPORTANT: keep in sync with migrations/001_initial_schema.js + 002_task_centric_investigation.js
const TABLE_COLUMNS = {
    case_systems: ['id', 'case_id', 'task_id', 'name', 'system_type', 'ip_addresses', 'owner', 'network_indicator_id', 'investigation_status', 'created_by', 'created_at', 'updated_at'],
    case_events: ['id', 'case_id', 'task_id', 'description', 'event_datetime', 'kill_chain', 'source_system_id', 'target_system_id', 'malware_id', 'compromised_account_id', 'exfiltration_id', 'created_by', 'created_at', 'updated_at'],
    case_network_indicators: ['id', 'case_id', 'task_id', 'ip', 'domain_name', 'port', 'url', 'context', 'first_activity', 'last_activity', 'malware_id', 'created_by', 'created_at', 'updated_at', 'updated_by'],
    case_malware_tools: ['id', 'case_id', 'task_id', 'system_id', 'file_name', 'file_path', 'hashes', 'description', 'is_malicious', 'creation_date', 'modification_date', 'created_by', 'created_at', 'updated_at', 'updated_by'],
    case_exfiltrations: ['id', 'case_id', 'task_id', 'exfiltration_date', 'source_system_id', 'exfil_system_id', 'destination_system_id', 'file_name', 'file_size', 'file_size_unit', 'content_description', 'other_info', 'created_by', 'created_at', 'updated_at', 'updated_by'],
    case_compromised_accounts: ['id', 'case_id', 'task_id', 'system_id', 'account_name', 'domain', 'sid', 'privileges', 'context', 'first_malicious_activity', 'last_malicious_activity', 'created_by', 'created_at', 'updated_at', 'updated_by'],
    case_diamond_overrides: ['id', 'case_id', 'event_id', 'label', 'adversary', 'infrastructure', 'capability', 'victim', 'notes', 'created_at', 'updated_at', 'updated_by'],
    case_diamond_node_order: ['id', 'case_id', 'node_order', 'created_at', 'updated_at', 'updated_by'],
    case_graph_layouts: ['id', 'case_id', 'graph_type', 'layout_data', 'created_at', 'updated_at', 'updated_by'],
    case_attacker_infra: ['id', 'case_id', 'name', 'infra_type', 'ip_addresses', 'network_indicator_id', 'description', 'created_by', 'created_at', 'updated_at'],
};
const createCrudRouter = (tableName) => {
    const subRouter = express.Router();
    const allowedColumns = TABLE_COLUMNS[tableName] || [];

    subRouter.get('/by-case/:caseId', async (req, res) => {
        try {
            if (!await canAccessCase(req.user.id, req.params.caseId)) return res.status(403).json({ error: 'Access denied' });
            const repo = new BaseRepository(getDb(), tableName);
            const items = await repo.findWhere({ case_id: req.params.caseId }, { sort: '-created_at' });
            res.json(items);
        } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
    });

    // GET by task (task-centric investigation)
    subRouter.get('/by-task/:taskId', async (req, res) => {
        try {
            const taskRepo = new BaseRepository(getDb(), 'tasks');
            const task = await taskRepo.findById(req.params.taskId);
            if (!task) return res.status(404).json({ error: 'Task not found' });
            if (!await canAccessCase(req.user.id, task.case_id)) return res.status(403).json({ error: 'Access denied' });
            
            const repo = new BaseRepository(getDb(), tableName);
            const items = await repo.findWhere({ task_id: req.params.taskId }, { sort: '-created_at' });
            res.json(items);
        } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
    });

    subRouter.post('/', async (req, res) => {
        try {
            if (req.body.case_id && !await canAccessCase(req.user.id, req.body.case_id)) return res.status(403).json({ error: 'Access denied' });
            const id = crypto.randomUUID();
            const payload = { ...req.body, id, created_by: req.user.id, updated_by: req.user.id };
            const validKeys = Object.keys(payload).filter(k => allowedColumns.includes(k));
            const insertData = {};
            for (const k of validKeys) {
                const v = payload[k];
                if (typeof v === 'boolean') insertData[k] = v ? 1 : 0;
                else if (typeof v === 'object' && v !== null && !Array.isArray(v)) insertData[k] = JSON.stringify(v);
                else insertData[k] = v;
            }
            const repo = new BaseRepository(getDb(), tableName);
            await repo.create(insertData);

            if (tableName === 'case_events' && payload.task_id) {
                const taskRepo = new BaseRepository(getDb(), 'tasks');
                const task = await taskRepo.findById(payload.task_id);
                logAudit(payload.case_id, req.user.id, 'highlight_added', 'task', payload.task_id, {
                    task_title: task ? task.title : 'Unknown Task', kill_chain: payload.kill_chain, event_id: id,
                });
            }
            
            if (payload.case_id) {
                const graphRepo = new StixGraphRepository(getDb());
                await graphRepo.syncCaseToGraph(payload.case_id).catch(e => console.error('STIX Sync error:', e));
            }

            res.json({ id });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
    });

    subRouter.put('/:id', async (req, res) => {
        try {
            const repo = new BaseRepository(getDb(), tableName);
            const record = await repo.findById(req.params.id);
            if (record && !await canAccessCase(req.user.id, record.case_id)) return res.status(403).json({ error: 'Access denied' });

            const payload = { ...req.body, updated_at: new Date().toISOString(), updated_by: req.user.id };
            delete payload.id; delete payload.created_at; delete payload.created_by;

            const validKeys = Object.keys(payload).filter(k => allowedColumns.includes(k));
            if (validKeys.length === 0) return res.json({ success: true });

            const updateData = {};
            for (const k of validKeys) {
                const v = payload[k];
                if (typeof v === 'boolean') updateData[k] = v ? 1 : 0;
                else if (typeof v === 'object' && v !== null && !Array.isArray(v)) updateData[k] = JSON.stringify(v);
                else updateData[k] = v;
            }
            await repo.update(req.params.id, updateData);

            if (tableName === 'case_events') {
                const event = await repo.findById(req.params.id);
                if (event && event.task_id) {
                    const taskRepo = new BaseRepository(getDb(), 'tasks');
                    const task = await taskRepo.findById(event.task_id);
                    logAudit(event.case_id, req.user.id, 'highlight_updated', 'task', event.task_id, {
                        task_title: task ? task.title : 'Unknown Task', kill_chain: event.kill_chain, event_id: req.params.id,
                    });
                }
            }

            if (record && record.case_id) {
                const graphRepo = new StixGraphRepository(getDb());
                await graphRepo.syncCaseToGraph(record.case_id).catch(e => console.error('STIX Sync error:', e));
            }

            res.json({ success: true });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
    });

    subRouter.delete('/:id', async (req, res) => {
        try {
            const repo = new BaseRepository(getDb(), tableName);
            const record = await repo.findById(req.params.id);
            if (record && !await canAccessCase(req.user.id, record.case_id)) return res.status(403).json({ error: 'Access denied' });

            if (tableName === 'case_events') {
                if (record && record.task_id) {
                    const taskRepo = new BaseRepository(getDb(), 'tasks');
                    const task = await taskRepo.findById(record.task_id);
                    logAudit(record.case_id, req.user.id, 'highlight_removed', 'task', record.task_id, {
                        task_title: task ? task.title : 'Unknown Task', kill_chain: record.kill_chain,
                    });
                }
            }
            await repo.delete(req.params.id);

            if (record && record.case_id) {
                const graphRepo = new StixGraphRepository(getDb());
                await graphRepo.syncCaseToGraph(record.case_id).catch(e => console.error('STIX Sync error:', e));
            }

            res.status(204).end();
        } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
    });

    return subRouter;
};

router.use('/systems', createCrudRouter('case_systems'));
router.use('/events', createCrudRouter('case_events'));
router.use('/indicators', createCrudRouter('case_network_indicators'));
router.use('/malware', createCrudRouter('case_malware_tools'));
router.use('/exfiltrations', createCrudRouter('case_exfiltrations'));
router.use('/accounts', createCrudRouter('case_compromised_accounts'));

// Temporary stubs — will be replaced by STIX2-native routes
const createLegacyStub = () => {
    const stubRouter = express.Router();
    stubRouter.get('/by-case/:caseId', (_req, res) => res.json([]));
    stubRouter.get('/by-task/:taskId', (_req, res) => res.json([]));
    stubRouter.get('/by-event/:eventId', (_req, res) => res.json([]));
    stubRouter.get('/:id', (_req, res) => res.status(404).json({ error: 'Use STIX API' }));
    stubRouter.post('/', (req, res) => res.status(201).json({ id: crypto.randomUUID(), ...req.body }));
    stubRouter.put('/:id', (req, res) => res.json({ success: true, ...req.body }));
    stubRouter.put('/by-event/:eventId', (req, res) => res.json({ success: true, ...req.body }));
    stubRouter.delete('/:id', (_req, res) => res.json({ success: true }));
    return stubRouter;
};
// Legacy APIs restored from temporary STIX stubs 
router.use('/diamond-overrides', createCrudRouter('case_diamond_overrides'));
router.use('/diamond-node-order', createCrudRouter('case_diamond_node_order'));
router.use('/graph-layouts', createCrudRouter('case_graph_layouts'));
router.use('/attacker-infra', createCrudRouter('case_attacker_infra'));
const auditRouter = express.Router();
auditRouter.get('/by-case/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) return res.status(403).json({ error: 'Access denied' });
        const repo = new BaseRepository(getDb(), 'case_audit_log');
        const items = await repo.findWhere({ case_id: req.params.caseId }, { sort: '-created_at' });
        res.json(items);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});
router.use('/audit', auditRouter);

router.get('/account_systems/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) return res.status(403).json({ error: 'Access denied' });
        
        const aql = `
            FOR cas IN case_compromised_account_systems
                FOR sys IN case_systems
                    FILTER cas.system_id == sys._key
                    FILTER sys.case_id == @caseId
                    RETURN KEEP(cas, 'system_id', 'account_id')
        `;
        const repo = new BaseRepository(getDb(), 'case_compromised_account_systems');
        const links = await repo.query(aql, { caseId: req.params.caseId });
        
        res.json(links);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/account_systems', async (req, res) => {
    try {
        const links = req.body;
        if (!Array.isArray(links)) return res.status(400).json({ error: 'Expected array' });

        if (links.length > 0) {
            const sysRepo = new BaseRepository(getDb(), 'case_systems');
            const system = await sysRepo.findById(links[0].system_id);
            if (system && !await canAccessCase(req.user.id, system.case_id)) return res.status(403).json({ error: 'Access denied' });
        }

        const repo = new BaseRepository(getDb(), 'case_compromised_account_systems');
        if (links.length > 0) {
            for (const link of links) {
                await repo.create({
                    id: crypto.randomUUID(), account_id: link.account_id, system_id: link.system_id,
                    created_at: new Date().toISOString(),
                });
            }
        }
        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Error in POST /account_systems:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/account_systems/by-account/:accountId', async (req, res) => {
    try {
        const repo = new BaseRepository(getDb(), 'case_compromised_account_systems');
        await repo.deleteWhere({ account_id: req.params.accountId });
        res.json({ success: true });
    } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/severities', async (req, res) => {
    try {
        const repo = new BaseRepository(getDb(), 'severities');
        const rows = await repo.findWhere({}, { sort: 'order' });
        res.json(rows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/tlp', (req, res) => {
    res.json([
        { id: 'RED', code: 'RED', label: 'TLP:RED', description: 'Restreint aux participants', color: '#FF2B2B' },
        { id: 'AMBER', code: 'AMBER', label: 'TLP:AMBER', description: 'Restreint aux organisations', color: '#FFC000' },
        { id: 'AMBER+STRICT', code: 'AMBER+STRICT', label: 'TLP:AMBER+STRICT', description: "Restreint à l'organisation", color: '#FFC000' },
        { id: 'GREEN', code: 'GREEN', label: 'TLP:GREEN', description: 'Restreint à la communauté', color: '#33FF00' },
        { id: 'CLEAR', code: 'CLEAR', label: 'TLP:CLEAR', description: 'Public', color: '#FFFFFF' },
    ]);
});

router.get('/pap', (req, res) => {
    res.json([
        { id: 'RED', code: 'RED', label: 'PAP:RED', description: 'Action non détectable sur le réseau', color: '#FF2B2B' },
        { id: 'AMBER', code: 'AMBER', label: 'PAP:AMBER', description: 'Recherche passive sur source payante', color: '#FFC000' },
        { id: 'GREEN', code: 'GREEN', label: 'PAP:GREEN', description: 'Recherche passive', color: '#33FF00' },
        { id: 'CLEAR', code: 'CLEAR', label: 'PAP:CLEAR', description: 'Aucune restriction', color: '#FFFFFF' },
    ]);
});

module.exports = router;
