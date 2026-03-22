const express = require('express');
const { getDb } = require('../db-arango');
const authenticateToken = require('../middleware/auth');
const { getTlpColor, getPapColor } = require('../utils/colors');
const { canAccessCase } = require('../utils/access');

const router = express.Router();
router.use(authenticateToken);

router.get('/case/:id', async (req, res) => {
    try {
        const caseId = req.params.id;
        if (!await canAccessCase(req.user.id, caseId)) return res.status(403).json({ error: 'Access denied' });

        const db = getDb();

        // --- Fetch Case Details ---
        const caseCursor = await db.query(`
            FOR c IN cases
            FILTER c._key == @caseId
            LET sev = (FOR s IN severities FILTER s._key == c.severity_id RETURN s)[0]
            LET author = (FOR u IN user_profiles FILTER u._key == c.author_id RETURN u)[0]
            LET closer = (FOR u IN user_profiles FILTER u._key == c.closed_by RETURN u)[0]
            RETURN MERGE(c, {
                id: c._key,
                severity_label: sev.label,
                severity_color: sev.color,
                author_name: author.full_name,
                author_email: author.email,
                closed_by_user_name: closer.full_name
            })
        `, { caseId });
        
        const caseObj = await caseCursor.next();
        if (!caseObj) return res.status(404).json({ error: 'Case not found' });

        const formattedCase = {
            ...caseObj,
            author: { full_name: caseObj.author_name },
            severity: { label: caseObj.severity_label, color: caseObj.severity_color },
            tlp: { code: caseObj.tlp, label: `TLP:${caseObj.tlp}`, color: getTlpColor(caseObj.tlp) },
            pap: caseObj.pap ? { code: caseObj.pap, label: `PAP:${caseObj.pap}`, color: getPapColor(caseObj.pap) } : null,
            closed_by_user: caseObj.closed_by_user_name ? { full_name: caseObj.closed_by_user_name } : null,
        };

        // --- Fetch Tasks ---
        const tasksCursor = await db.query(`
            FOR t IN tasks
            FILTER t.case_id == @caseId
            LET assignee = (FOR u IN user_profiles FILTER u._key == t.assigned_to RETURN u)[0]
            LET closer = (FOR u IN user_profiles FILTER u._key == t.closed_by RETURN u)[0]
            LET res = (FOR r IN task_results FILTER r._key == t.result_id RETURN r)[0]
            SORT t.created_at ASC
            RETURN MERGE(t, {
                id: t._key,
                assigned_to_user_name: assignee.full_name,
                closed_by_user_name: closer.full_name,
                result_label: res.label,
                result_color: res.color
            })
        `, { caseId });
        
        const tasks = (await tasksCursor.all()).map(t => ({
            ...t,
            assigned_to_user: t.assigned_to_user_name ? { full_name: t.assigned_to_user_name } : null,
            closed_by_user: t.closed_by_user_name ? { full_name: t.closed_by_user_name } : null,
            result: t.result_label ? { label: t.result_label, color: t.result_color } : null,
        }));

        // --- Fetch Events ---
        const eventsCursor = await db.query(`
            FOR e IN case_events
            FILTER e.case_id == @caseId
            LET srcSys = (FOR s IN case_systems FILTER s._key == e.source_system_id RETURN s)[0]
            LET tgtSys = (FOR s IN case_systems FILTER s._key == e.target_system_id RETURN s)[0]
            SORT e.event_datetime ASC
            RETURN {
                id: e._key,
                event_datetime: e.event_datetime,
                kill_chain: e.kill_chain,
                description: e.description,
                task_id: e.task_id,
                created_at: e.created_at,
                source_system_id: e.source_system_id,
                target_system_id: e.target_system_id,
                source_system: srcSys ? { name: srcSys.name } : null,
                target_system: tgtSys ? { name: tgtSys.name } : null
            }
        `, { caseId });
        const mappedEvents = await eventsCursor.all();

        // --- Fetch Systems & Tasks for Systems ---
        const systemsCursor = await db.query(`
            FOR s IN case_systems
            FILTER s.case_id == @caseId
            SORT s.name ASC
            RETURN MERGE(s, { id: s._key })
        `, { caseId });
        const systems = await systemsCursor.all();

        const tasksForSystems = tasks.filter(t => t.system_id).map(t => ({
            id: t.id,
            system_id: t.system_id,
            status: t.status,
            closed_at: t.closed_at,
            investigation_status: t.investigation_status,
            initial_investigation_status: t.initial_investigation_status
        }));

        const mappedSystems = systems.map(s => {
            let ipArr = [];
            try { ipArr = typeof s.ip_addresses === 'string' ? JSON.parse(s.ip_addresses) : (s.ip_addresses || []); } catch {}
            return { ...s, ip_addresses: ipArr || [], investigation_tasks: tasksForSystems.filter(t => t.system_id === s.id) };
        });

        // --- Fetch Accounts ---
        const accountsCursor = await db.query(`
            FOR a IN case_compromised_accounts
            FILTER a.case_id == @caseId
            SORT a.first_malicious_activity ASC
            RETURN MERGE(a, { id: a._key })
        `, { caseId });
        const accounts = await accountsCursor.all();

        // --- Fetch Indicators ---
        const indicatorsCursor = await db.query(`
            FOR i IN case_network_indicators
            FILTER i.case_id == @caseId
            LET mal = (FOR m IN case_malware_tools FILTER m._key == i.malware_id RETURN m)[0]
            SORT i.first_activity ASC
            RETURN MERGE(i, {
                id: i._key,
                malware_file_name: mal.file_name
            })
        `, { caseId });
        const indicators = (await indicatorsCursor.all()).map(i => ({
            ...i, malware: i.malware_file_name ? { file_name: i.malware_file_name } : null
        }));

        // --- Fetch Malware ---
        const malwareCursor = await db.query(`
            FOR m IN case_malware_tools
            FILTER m.case_id == @caseId
            LET sys = (FOR s IN case_systems FILTER s._key == m.system_id RETURN s)[0]
            SORT m.created_at ASC
            RETURN MERGE(m, {
                id: m._key,
                system_name: sys.name
            })
        `, { caseId });
        const malware = await malwareCursor.all();

        // --- Fetch Exfiltrations ---
        const exfilCursor = await db.query(`
            FOR e IN case_exfiltrations
            FILTER e.case_id == @caseId
            LET s1 = (FOR s IN case_systems FILTER s._key == e.source_system_id RETURN s)[0]
            LET s2 = (FOR s IN case_systems FILTER s._key == e.exfil_system_id RETURN s)[0]
            LET s3 = (FOR s IN case_systems FILTER s._key == e.destination_system_id RETURN s)[0]
            SORT e.exfiltration_date ASC
            RETURN MERGE(e, {
                id: e._key,
                source_system_name: s1.name,
                exfil_system_name: s2.name,
                destination_system_name: s3.name
            })
        `, { caseId });
        const exfiltrations = await exfilCursor.all();

        res.json({ caseData: formattedCase, tasks, events: mappedEvents, systems: mappedSystems, accounts, indicators, malware, exfiltrations });
    } catch (err) {
        console.error('Reports error:', err.message, err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

module.exports = router;
