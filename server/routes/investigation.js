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

// ─── STIX SCO namespace (OASIS recommended) ─────────────────────
const STIX_SCO_NAMESPACE = '00abedb4-aa42-466c-9c01-fed23315a9b7';

/**
 * Generate a deterministic UUIDv5 from a seed string (RFC 4122).
 */
function deterministicUuid(seed) {
    const nsBytes = Buffer.from(STIX_SCO_NAMESPACE.replace(/-/g, ''), 'hex');
    const hash = crypto.createHash('sha1').update(nsBytes).update(seed).digest();
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = hash.subarray(0, 16).toString('hex');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

// ─── Generic CRUD router for remaining tables ──────────────────
const TABLE_COLUMNS = {
    case_events: ['id', 'case_id', 'task_id', 'description', 'event_datetime', 'kill_chain', 'source_system_id', 'target_system_id', 'malware_id', 'compromised_account_id', 'exfiltration_id', 'created_by', 'created_at', 'updated_at'],
    case_diamond_overrides: ['id', 'case_id', 'event_id', 'label', 'adversary', 'infrastructure', 'capability', 'victim', 'notes', 'created_at', 'updated_at', 'updated_by'],
    case_diamond_node_order: ['id', 'case_id', 'node_order', 'created_at', 'updated_at', 'updated_by'],
    case_graph_layouts: ['id', 'case_id', 'graph_type', 'layout_data', 'created_at', 'updated_at', 'updated_by'],
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

// ─── Remaining CRUD routes ──────────────────────────────────────
router.use('/events', createCrudRouter('case_events'));
router.use('/diamond-overrides', createCrudRouter('case_diamond_overrides'));
router.use('/diamond-node-order', createCrudRouter('case_diamond_node_order'));
router.use('/graph-layouts', createCrudRouter('case_graph_layouts'));

// ─── Audit log ──────────────────────────────────────────────────
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

// ─── STIX Objects per Task (Unified API) ────────────────────────

/**
 * GET /api/investigation/stix/by-task/:taskId
 * Returns all STIX objects linked to the given task via x_oris_task_id.
 */
router.get('/stix/by-task/:taskId', async (req, res) => {
    try {
        const taskRepo = new BaseRepository(getDb(), 'tasks');
        const task = await taskRepo.findById(req.params.taskId);
        if (!task) return res.status(404).json({ error: 'Task not found' });
        if (!await canAccessCase(req.user.id, task.case_id)) return res.status(403).json({ error: 'Access denied' });

        const graphRepo = new StixGraphRepository(getDb());
        const objects = await graphRepo.getObjectsByTaskId(req.params.taskId);
        res.json(objects);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

/**
 * GET /api/investigation/stix/by-case/:caseId
 * Returns all STIX objects for a case.
 */
router.get('/stix/by-case/:caseId', async (req, res) => {
    try {
        if (!await canAccessCase(req.user.id, req.params.caseId)) return res.status(403).json({ error: 'Access denied' });
        const graphRepo = new StixGraphRepository(getDb());
        const objects = await graphRepo.getObjectsByCaseId(req.params.caseId);
        res.json(objects);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

/**
 * POST /api/investigation/stix
 * Create STIX objects for a task.
 * Body: { case_id, task_id, stix_type, data }
 * stix_type: 'infrastructure' | 'user-account' | 'malware' | 'ipv4-addr' | 'domain-name' | 'url'
 */
router.post('/stix', async (req, res) => {
    try {
        const { case_id, task_id, stix_type, data } = req.body;
        if (!case_id || !task_id || !stix_type || !data) {
            return res.status(400).json({ error: 'Missing required fields: case_id, task_id, stix_type, data' });
        }
        if (!await canAccessCase(req.user.id, case_id)) return res.status(403).json({ error: 'Access denied' });

        const graphRepo = new StixGraphRepository(getDb());
        const now = new Date().toISOString();
        const createdObjects = [];

        // ── SDO types ──
        if (stix_type === 'infrastructure') {
            const id = `infrastructure--${crypto.randomUUID()}`;
            const obj = {
                type: 'infrastructure', id, spec_version: '2.1',
                name: data.name,
                description: data.description || '',
                infrastructure_types: [data.infrastructure_type || 'unknown'],
                x_oris_task_id: task_id,
                created: now, modified: now,
            };
            await graphRepo.createObject(case_id, obj, req.user.id);
            createdObjects.push(obj);

            // Create observed-data linking to this infrastructure
            const obsId = `observed-data--${crypto.randomUUID()}`;
            const obs = {
                type: 'observed-data', id: obsId, spec_version: '2.1',
                x_oris_task_id: task_id,
                first_observed: now, last_observed: now,
                number_observed: 1,
                object_refs: [id],
                created: now, modified: now,
            };
            await graphRepo.createObject(case_id, obs, req.user.id);
            createdObjects.push(obs);

            // relationship: observed-data → infrastructure
            const relId = `relationship--${crypto.randomUUID()}`;
            await graphRepo.createRelationship(case_id, {
                type: 'relationship', id: relId,
                relationship_type: 'originates-from',
                source_ref: obsId, target_ref: id,
                created: now, modified: now,
            }, req.user.id);
        }

        if (stix_type === 'malware') {
            const malId = `malware--${crypto.randomUUID()}`;
            const malObj = {
                type: 'malware', id: malId, spec_version: '2.1',
                name: data.name || 'Unknown',
                description: data.description || '',
                malware_types: data.malware_types || ['unknown'],
                is_family: !!data.is_family,
                x_oris_task_id: task_id,
                created: now, modified: now,
            };
            await graphRepo.createObject(case_id, malObj, req.user.id);
            createdObjects.push(malObj);

            // Create file SCO if hash or filename provided
            if (data.file_name || data.sha256 || data.md5) {
                const fileSeed = `file-${data.file_name || ''}-${data.sha256 || data.md5 || crypto.randomUUID()}`;
                const fileId = `file--${deterministicUuid(fileSeed)}`;
                const hashes = {};
                if (data.sha256) hashes['SHA-256'] = data.sha256;
                if (data.md5) hashes['MD5'] = data.md5;
                const fileObj = {
                    type: 'file', id: fileId, spec_version: '2.1',
                    name: data.file_name || undefined,
                    ...(Object.keys(hashes).length > 0 ? { hashes } : {}),
                    x_oris_task_id: task_id,
                };
                await graphRepo.createObject(case_id, fileObj, req.user.id);
                createdObjects.push(fileObj);
            }

            // Create observed-data
            const obsId = `observed-data--${crypto.randomUUID()}`;
            const obs = {
                type: 'observed-data', id: obsId, spec_version: '2.1',
                x_oris_task_id: task_id,
                first_observed: now, last_observed: now,
                number_observed: 1, object_refs: [malId],
                created: now, modified: now,
            };
            await graphRepo.createObject(case_id, obs, req.user.id);
            createdObjects.push(obs);
        }

        // ── SCO types ──
        if (stix_type === 'user-account') {
            const seed = `user-account-${data.user_id || data.display_name || crypto.randomUUID()}`;
            const id = `user-account--${deterministicUuid(seed)}`;
            const obj = {
                type: 'user-account', id, spec_version: '2.1',
                user_id: data.user_id || data.account_name,
                display_name: data.display_name || `${data.account_name || ''}${data.domain ? '@' + data.domain : ''}`,
                x_oris_task_id: task_id,
                created: now, modified: now,
            };
            await graphRepo.createObject(case_id, obj, req.user.id);
            createdObjects.push(obj);

            const obsId = `observed-data--${crypto.randomUUID()}`;
            const obs = {
                type: 'observed-data', id: obsId, spec_version: '2.1',
                x_oris_task_id: task_id,
                first_observed: now, last_observed: now,
                number_observed: 1, object_refs: [id],
                created: now, modified: now,
            };
            await graphRepo.createObject(case_id, obs, req.user.id);
            createdObjects.push(obs);
        }

        if (stix_type === 'ipv4-addr') {
            const id = `ipv4-addr--${deterministicUuid(`ipv4-${data.value}`)}`;
            const obj = {
                type: 'ipv4-addr', id, spec_version: '2.1',
                value: data.value,
                x_oris_task_id: task_id,
            };
            await graphRepo.createObject(case_id, obj, req.user.id);
            createdObjects.push(obj);

            // Also create an indicator SDO
            const indId = `indicator--${crypto.randomUUID()}`;
            const indObj = {
                type: 'indicator', id: indId, spec_version: '2.1',
                name: data.value,
                pattern: `[ipv4-addr:value = '${data.value}']`,
                pattern_type: 'stix',
                valid_from: now,
                x_oris_task_id: task_id,
                created: now, modified: now,
            };
            await graphRepo.createObject(case_id, indObj, req.user.id);
            createdObjects.push(indObj);

            // based-on relationship
            const relId = `relationship--${crypto.randomUUID()}`;
            await graphRepo.createRelationship(case_id, {
                type: 'relationship', id: relId,
                relationship_type: 'based-on',
                source_ref: indId, target_ref: id,
                created: now, modified: now,
            }, req.user.id);

            // observed-data
            const obsId = `observed-data--${crypto.randomUUID()}`;
            await graphRepo.createObject(case_id, {
                type: 'observed-data', id: obsId, spec_version: '2.1',
                x_oris_task_id: task_id,
                first_observed: now, last_observed: now,
                number_observed: 1, object_refs: [id],
                created: now, modified: now,
            }, req.user.id);
        }

        if (stix_type === 'domain-name') {
            const id = `domain-name--${deterministicUuid(`domain-${data.value}`)}`;
            const obj = {
                type: 'domain-name', id, spec_version: '2.1',
                value: data.value,
                x_oris_task_id: task_id,
            };
            await graphRepo.createObject(case_id, obj, req.user.id);
            createdObjects.push(obj);

            const indId = `indicator--${crypto.randomUUID()}`;
            await graphRepo.createObject(case_id, {
                type: 'indicator', id: indId, spec_version: '2.1',
                name: data.value,
                pattern: `[domain-name:value = '${data.value}']`,
                pattern_type: 'stix',
                valid_from: now,
                x_oris_task_id: task_id,
                created: now, modified: now,
            }, req.user.id);

            const relId = `relationship--${crypto.randomUUID()}`;
            await graphRepo.createRelationship(case_id, {
                type: 'relationship', id: relId,
                relationship_type: 'based-on',
                source_ref: indId, target_ref: id,
                created: now, modified: now,
            }, req.user.id);

            const obsId = `observed-data--${crypto.randomUUID()}`;
            await graphRepo.createObject(case_id, {
                type: 'observed-data', id: obsId, spec_version: '2.1',
                x_oris_task_id: task_id,
                first_observed: now, last_observed: now,
                number_observed: 1, object_refs: [id],
                created: now, modified: now,
            }, req.user.id);
        }

        if (stix_type === 'url') {
            const id = `url--${deterministicUuid(`url-${data.value}`)}`;
            const obj = {
                type: 'url', id, spec_version: '2.1',
                value: data.value,
                x_oris_task_id: task_id,
            };
            await graphRepo.createObject(case_id, obj, req.user.id);
            createdObjects.push(obj);

            const indId = `indicator--${crypto.randomUUID()}`;
            await graphRepo.createObject(case_id, {
                type: 'indicator', id: indId, spec_version: '2.1',
                name: data.value,
                pattern: `[url:value = '${data.value}']`,
                pattern_type: 'stix',
                valid_from: now,
                x_oris_task_id: task_id,
                created: now, modified: now,
            }, req.user.id);

            const relId = `relationship--${crypto.randomUUID()}`;
            await graphRepo.createRelationship(case_id, {
                type: 'relationship', id: relId,
                relationship_type: 'based-on',
                source_ref: indId, target_ref: id,
                created: now, modified: now,
            }, req.user.id);

            const obsId = `observed-data--${crypto.randomUUID()}`;
            await graphRepo.createObject(case_id, {
                type: 'observed-data', id: obsId, spec_version: '2.1',
                x_oris_task_id: task_id,
                first_observed: now, last_observed: now,
                number_observed: 1, object_refs: [id],
                created: now, modified: now,
            }, req.user.id);
        }

        logAudit(case_id, req.user.id, 'stix_object_created', 'stix', stix_type, {
            task_id, object_count: createdObjects.length,
        });

        res.status(201).json({ objects: createdObjects });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

/**
 * DELETE /api/investigation/stix/:id
 * Delete a STIX object and its relationships.
 */
router.delete('/stix/:id', async (req, res) => {
    try {
        const graphRepo = new StixGraphRepository(getDb());
        const obj = await graphRepo.getObjectById(req.params.id);
        if (!obj) return res.status(404).json({ error: 'STIX object not found' });
        if (!await canAccessCase(req.user.id, obj.case_id)) return res.status(403).json({ error: 'Access denied' });

        await graphRepo.deleteObject(req.params.id);
        res.status(204).end();
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Reference data ─────────────────────────────────────────────

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
