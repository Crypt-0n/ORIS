const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { getTlpColor, getPapColor } = require('../utils/colors');

const router = express.Router();
router.use(authenticateToken);

const { canAccessCase } = require('../utils/access');

router.get('/case/:id', async (req, res) => {
    try {
        const caseId = req.params.id;
        if (!await canAccessCase(req.user.id, caseId)) return res.status(403).json({ error: 'Access denied' });

        const caseObj = await db('cases')
            .leftJoin('severities', 'cases.severity_id', 'severities.id')
            .leftJoin('user_profiles', 'cases.author_id', 'user_profiles.id')
            .leftJoin('user_profiles as closer', 'cases.closed_by', 'closer.id')
            .where('cases.id', caseId)
            .select('cases.*', 'severities.label as severity_label', 'severities.color as severity_color',
                'user_profiles.full_name as author_name', 'user_profiles.email as author_email',
                'closer.full_name as closed_by_user_name')
            .first();

        if (!caseObj) return res.status(404).json({ error: 'Case not found' });

        const formattedCase = {
            ...caseObj,
            author: { full_name: caseObj.author_name },
            severity: { label: caseObj.severity_label, color: caseObj.severity_color },
            tlp: { code: caseObj.tlp, label: `TLP:${caseObj.tlp}`, color: getTlpColor(caseObj.tlp) },
            pap: caseObj.pap ? { code: caseObj.pap, label: `PAP:${caseObj.pap}`, color: getPapColor(caseObj.pap) } : null,
            closed_by_user: caseObj.closed_by_user_name ? { full_name: caseObj.closed_by_user_name } : null,
        };

        const tasks = (await db('tasks')
            .leftJoin('user_profiles as u1', 'tasks.assigned_to', 'u1.id')
            .leftJoin('user_profiles as u2', 'tasks.closed_by', 'u2.id')
            .leftJoin('task_results as res', 'tasks.result_id', 'res.id')
            .where('tasks.case_id', caseId)
            .select('tasks.*', 'u1.full_name as assigned_to_user_name', 'u2.full_name as closed_by_user_name',
                'res.label as result_label', 'res.color as result_color')
            .orderBy('tasks.created_at', 'asc')
        ).map(t => ({
            ...t,
            assigned_to_user: t.assigned_to_user_name ? { full_name: t.assigned_to_user_name } : null,
            closed_by_user: t.closed_by_user_name ? { full_name: t.closed_by_user_name } : null,
            result: t.result_label ? { label: t.result_label, color: t.result_color } : null,
        }));

        const events = await db('case_events as e')
            .leftJoin('case_diamond_overrides as d', 'e.id', 'd.event_id')
            .where('e.case_id', caseId)
            .select('e.id', 'e.event_datetime', 'e.kill_chain', 'e.description', 'e.task_id', 'e.created_at',
                'd.infrastructure', 'd.victim')
            .orderBy('e.event_datetime', 'asc');

        const mappedEvents = events.map(e => {
            let infra = [], vict = [];
            try { if (e.infrastructure) infra = JSON.parse(e.infrastructure); } catch {}
            try { if (e.victim) vict = JSON.parse(e.victim); } catch {}
            return { ...e, source_system: infra.length > 0 ? { name: infra[0].label } : null, target_system: vict.length > 0 ? { name: vict[0].label } : null };
        });

        const systems = await db('case_systems').where({ case_id: caseId }).orderBy('name', 'asc');
        const tasksForSystems = await db('tasks').where({ case_id: caseId }).whereNotNull('system_id')
            .select('id', 'system_id', 'status', 'closed_at', 'investigation_status', 'initial_investigation_status');

        const mappedSystems = systems.map(s => {
            let ipArr = [];
            try { ipArr = JSON.parse(s.ip_addresses); } catch {}
            return { ...s, ip_addresses: ipArr || [], investigation_tasks: tasksForSystems.filter(t => t.system_id === s.id) };
        });

        const accounts = await db('case_compromised_accounts').where({ case_id: caseId })
            .select('id', 'account_name', 'domain', 'sid', 'privileges', 'first_malicious_activity', 'last_malicious_activity', 'context', 'created_at')
            .orderBy('first_malicious_activity', 'asc');

        const indicators = (await db('case_network_indicators as ind')
            .leftJoin('case_malware_tools as mal', 'ind.malware_id', 'mal.id')
            .where('ind.case_id', caseId)
            .select('ind.id', 'ind.ip', 'ind.domain_name', 'ind.port', 'ind.url', 'ind.first_activity', 'ind.last_activity', 'ind.created_at',
                'mal.file_name as malware_file_name')
            .orderBy('ind.first_activity', 'asc')
        ).map(i => ({ ...i, malware: i.malware_file_name ? { file_name: i.malware_file_name } : null }));

        const malware = await db('case_malware_tools as mal')
            .leftJoin('case_systems as sys', 'mal.system_id', 'sys.id')
            .where('mal.case_id', caseId)
            .select('mal.id', 'mal.file_name', 'mal.file_path', 'mal.is_malicious', 'mal.creation_date', 'mal.created_at',
                'sys.name as system_name')
            .orderBy('mal.created_at', 'asc');

        const exfiltrations = await db('case_exfiltrations as e')
            .leftJoin('case_systems as s1', 'e.source_system_id', 's1.id')
            .leftJoin('case_systems as s2', 'e.exfil_system_id', 's2.id')
            .leftJoin('case_systems as s3', 'e.destination_system_id', 's3.id')
            .where('e.case_id', caseId)
            .select('e.id', 'e.exfiltration_date', 'e.file_name', 'e.file_size', 'e.file_size_unit', 'e.content_description', 'e.created_at',
                's1.name as source_system_name', 's2.name as exfil_system_name', 's3.name as destination_system_name')
            .orderBy('e.exfiltration_date', 'asc');

        res.json({ caseData: formattedCase, tasks, events: mappedEvents, systems: mappedSystems, accounts, indicators, malware, exfiltrations });
    } catch (err) {
        console.error('Reports error:', err.message, err);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

module.exports = router;
