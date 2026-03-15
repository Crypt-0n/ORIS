const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticateToken);

const { canAccessCase } = require('../utils/access');

// Known columns per table (replaces PRAGMA table_info which is SQLite-specific)
// IMPORTANT: keep in sync with migrations/001_initial_schema.js + 002_task_centric_investigation.js
const TABLE_COLUMNS = {
    case_systems: ['id', 'case_id', 'task_id', 'name', 'system_type', 'ip_addresses', 'owner', 'network_indicator_id', 'investigation_status', 'created_by', 'created_at', 'updated_at'],
    case_events: ['id', 'case_id', 'task_id', 'description', 'event_datetime', 'kill_chain', 'malware_id', 'compromised_account_id', 'exfiltration_id', 'created_by', 'created_at', 'updated_at'],
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
            const items = await db(tableName).where({ case_id: req.params.caseId }).orderBy('created_at', 'desc');
            res.json(items);
        } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
    });

    // GET by task (task-centric investigation)
    subRouter.get('/by-task/:taskId', async (req, res) => {
        try {
            const task = await db('tasks').where({ id: req.params.taskId }).select('case_id').first();
            if (!task) return res.status(404).json({ error: 'Task not found' });
            if (!await canAccessCase(req.user.id, task.case_id)) return res.status(403).json({ error: 'Access denied' });
            const items = await db(tableName).where({ task_id: req.params.taskId }).orderBy('created_at', 'desc');
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
                else if (typeof v === 'object' && v !== null) insertData[k] = JSON.stringify(v);
                else insertData[k] = v;
            }
            await db(tableName).insert(insertData);

            if (tableName === 'case_events' && payload.task_id) {
                const task = await db('tasks').where({ id: payload.task_id }).select('title').first();
                logAudit(payload.case_id, req.user.id, 'highlight_added', 'task', payload.task_id, {
                    task_title: task ? task.title : 'Unknown Task', kill_chain: payload.kill_chain, event_id: id,
                });
            }
            res.json({ id });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
    });

    subRouter.put('/:id', async (req, res) => {
        try {
            const record = await db(tableName).where({ id: req.params.id }).select('case_id').first();
            if (record && !await canAccessCase(req.user.id, record.case_id)) return res.status(403).json({ error: 'Access denied' });

            const payload = { ...req.body, updated_at: new Date().toISOString(), updated_by: req.user.id };
            delete payload.id; delete payload.created_at; delete payload.created_by;

            const validKeys = Object.keys(payload).filter(k => allowedColumns.includes(k));
            if (validKeys.length === 0) return res.json({ success: true });

            const updateData = {};
            for (const k of validKeys) {
                const v = payload[k];
                if (typeof v === 'boolean') updateData[k] = v ? 1 : 0;
                else if (typeof v === 'object' && v !== null) updateData[k] = JSON.stringify(v);
                else updateData[k] = v;
            }
            await db(tableName).where({ id: req.params.id }).update(updateData);

            if (tableName === 'case_events') {
                const event = await db('case_events').where({ id: req.params.id }).select('case_id', 'task_id', 'kill_chain').first();
                if (event && event.task_id) {
                    const task = await db('tasks').where({ id: event.task_id }).select('title').first();
                    logAudit(event.case_id, req.user.id, 'highlight_updated', 'task', event.task_id, {
                        task_title: task ? task.title : 'Unknown Task', kill_chain: event.kill_chain, event_id: req.params.id,
                    });
                }
            }
            res.json({ success: true });
        } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
    });

    subRouter.delete('/:id', async (req, res) => {
        try {
            const record = await db(tableName).where({ id: req.params.id }).select('case_id').first();
            if (record && !await canAccessCase(req.user.id, record.case_id)) return res.status(403).json({ error: 'Access denied' });

            if (tableName === 'case_events') {
                const event = await db('case_events').where({ id: req.params.id }).select('case_id', 'task_id', 'kill_chain').first();
                if (event && event.task_id) {
                    const task = await db('tasks').where({ id: event.task_id }).select('title').first();
                    logAudit(event.case_id, req.user.id, 'highlight_removed', 'task', event.task_id, {
                        task_title: task ? task.title : 'Unknown Task', kill_chain: event.kill_chain,
                    });
                }
            }
            await db(tableName).where({ id: req.params.id }).del();
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
router.use('/attacker-infra', createCrudRouter('case_attacker_infra'));

// --- Event Linked Objects (STIX SRO-like) ---

const linkedObjectsRouter = express.Router();

// GET linked objects for an event
linkedObjectsRouter.get('/by-event/:eventId', async (req, res) => {
    try {
        const event = await db('case_events').where({ id: req.params.eventId }).select('case_id').first();
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (!await canAccessCase(req.user.id, event.case_id)) return res.status(403).json({ error: 'Access denied' });
        const items = await db('event_linked_objects').where({ event_id: req.params.eventId }).orderBy('created_at', 'asc');
        res.json(items);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET linked objects for a case (aggregated from all events)
linkedObjectsRouter.get('/by-case/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) return res.status(403).json({ error: 'Access denied' });
        const items = await db('event_linked_objects')
            .join('case_events', 'event_linked_objects.event_id', 'case_events.id')
            .where('case_events.case_id', req.params.caseId)
            .select('event_linked_objects.*', 'case_events.task_id', 'case_events.kill_chain', 'case_events.event_datetime')
            .orderBy('case_events.event_datetime', 'desc');
        res.json(items);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST — link an object to an event
linkedObjectsRouter.post('/', async (req, res) => {
    try {
        const { event_id, object_type, object_id, diamond_axis } = req.body;
        if (!event_id || !object_type || !object_id) {
            return res.status(400).json({ error: 'event_id, object_type, and object_id are required' });
        }
        const event = await db('case_events').where({ id: event_id }).select('case_id').first();
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (!await canAccessCase(req.user.id, event.case_id)) return res.status(403).json({ error: 'Access denied' });

        const id = crypto.randomUUID();
        await db('event_linked_objects').insert({
            id, event_id, object_type, object_id,
            diamond_axis: diamond_axis || null,
            created_by: req.user.id,
        });
        res.status(201).json({ id });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE — unlink an object from an event
linkedObjectsRouter.delete('/:id', async (req, res) => {
    try {
        const link = await db('event_linked_objects').where({ id: req.params.id }).first();
        if (!link) return res.status(404).json({ error: 'Link not found' });
        const event = await db('case_events').where({ id: link.event_id }).select('case_id').first();
        if (event && !await canAccessCase(req.user.id, event.case_id)) return res.status(403).json({ error: 'Access denied' });
        await db('event_linked_objects').where({ id: req.params.id }).del();
        res.status(204).end();
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.use('/linked-objects', linkedObjectsRouter);

const auditRouter = express.Router();
auditRouter.get('/by-case/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) return res.status(403).json({ error: 'Access denied' });
        const items = await db('case_audit_log').where({ case_id: req.params.caseId }).orderBy('created_at', 'desc');
        res.json(items);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});
router.use('/audit', auditRouter);
router.use('/diamond-overrides', createCrudRouter('case_diamond_overrides'));
router.use('/diamond-node-order', createCrudRouter('case_diamond_node_order'));
router.use('/graph-layouts', createCrudRouter('case_graph_layouts'));

router.get('/account_systems/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) return res.status(403).json({ error: 'Access denied' });
        const links = await db('case_compromised_account_systems as cas')
            .join('case_systems as sys', 'cas.system_id', 'sys.id')
            .where('sys.case_id', req.params.caseId)
            .select('cas.system_id', 'cas.account_id');
        res.json(links);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/account_systems', async (req, res) => {
    try {
        const links = req.body;
        if (!Array.isArray(links)) return res.status(400).json({ error: 'Expected array' });

        if (links.length > 0) {
            const system = await db('case_systems').where({ id: links[0].system_id }).select('case_id').first();
            if (system && !await canAccessCase(req.user.id, system.case_id)) return res.status(403).json({ error: 'Access denied' });
        }

        await db.transaction(async trx => {
            if (links.length > 0) {
                const inserts = links.map(link => ({
                    id: crypto.randomUUID(), account_id: link.account_id, system_id: link.system_id,
                    created_at: new Date().toISOString(),
                }));
                await trx('case_compromised_account_systems').insert(inserts);
            }
        });
        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Error in POST /account_systems:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/account_systems/by-account/:accountId', async (req, res) => {
    try {
        await db('case_compromised_account_systems').where({ account_id: req.params.accountId }).del();
        res.json({ success: true });
    } catch (error) { console.error(error); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/severities', async (req, res) => {
    try {
        const rows = await db('severities').orderBy('order', 'asc');
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
