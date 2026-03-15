const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { isAdmin, canSeeType } = require('../utils/access');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) return res.json({ cases: [], tasks: [], systems: [], indicators: [], malware: [], accounts: [], exfiltrations: [], attackerInfra: [] });

        const searchTerm = `%${q.trim()}%`;
        const userId = req.user.id;

        const currentUser = await db('user_profiles').where({ id: userId }).select('role').first();
        const userIsAdmin = currentUser && isAdmin(currentUser.role);

        const applyAccessControl = (builder) => {
            if (!userIsAdmin) {
                builder.andWhere(function() {
                    this.where('c.author_id', userId)
                        .orWhereExists(db('case_assignments').whereRaw('case_assignments.case_id = c.id').andWhere('case_assignments.user_id', userId))
                        .orWhereExists(db('beneficiary_members').whereRaw('beneficiary_members.beneficiary_id = c.beneficiary_id').andWhere('beneficiary_members.user_id', userId));
                });
            }
        };

        let casesQuery = db('cases as c')
            .leftJoin('severities as s', 'c.severity_id', 's.id')
            .leftJoin('beneficiaries as b', 'c.beneficiary_id', 'b.id')
            .where(function() {
                this.where('c.title', 'like', searchTerm)
                    .orWhere('c.case_number', 'like', searchTerm)
                    .orWhere('c.description', 'like', searchTerm);
            })
            .select('c.id', 'c.case_number', 'c.title', 'c.status',
                db.raw("COALESCE(c.type, 'case') as type"), 'c.created_at',
                's.label as severity_label', 's.color as severity_color', 'b.name as beneficiary_name');

        applyAccessControl(casesQuery);
        const casesRaw = await casesQuery.orderBy('c.created_at', 'desc').limit(5);

        const canSeeAlerts = await canSeeType(userId, 'alert');
        const canSeeCases = await canSeeType(userId, 'case');

        const cases = casesRaw
            .filter(c => ((c.type || 'case') === 'alert' && canSeeAlerts) || ((c.type || 'case') !== 'alert' && canSeeCases))
            .map(c => ({
                id: c.id, case_number: c.case_number, title: c.title, status: c.status,
                type: c.type || 'case',
                severity: c.severity_label ? { label: c.severity_label, color: c.severity_color } : null,
                beneficiary_name: c.beneficiary_name,
            }));

        let tasksQuery = db('tasks as t')
            .leftJoin('cases as c', 't.case_id', 'c.id')
            .where(function() {
                this.where('t.title', 'like', searchTerm).orWhere('t.description', 'like', searchTerm);
            })
            .select('t.id', 't.case_id', 't.title', 't.status', 't.created_at', 'c.case_number', 'c.title as case_title');
        
        applyAccessControl(tasksQuery);
        const tasksRaw = await tasksQuery.orderBy('t.created_at', 'desc').limit(5);
        const tasks = tasksRaw.map(t => ({
            id: t.id, case_id: t.case_id, title: t.title, status: t.status, case_number: t.case_number, case_title: t.case_title,
        }));

        let systemsQuery = db('case_systems as s')
            .leftJoin('cases as c', 's.case_id', 'c.id')
            .where(function() {
                this.where('s.name', 'like', searchTerm).orWhere('s.ip_addresses', 'like', searchTerm);
            })
            .select('s.id', 's.case_id', 's.name', 's.system_type', 's.ip_addresses', 'c.case_number', 'c.title as case_title');
        
        applyAccessControl(systemsQuery);
        const systemsRaw = await systemsQuery.orderBy('s.created_at', 'desc').limit(5);
        const systems = systemsRaw.map(s => ({
            id: s.id, case_id: s.case_id, name: s.name, system_type: s.system_type, case_number: s.case_number, case_title: s.case_title,
        }));

        let iocsQuery = db('case_network_indicators as i')
            .leftJoin('cases as c', 'i.case_id', 'c.id')
            .where(function() {
                this.where('i.ip', 'like', searchTerm).orWhere('i.domain_name', 'like', searchTerm).orWhere('i.url', 'like', searchTerm);
            })
            .select('i.id', 'i.case_id', 'i.ip', 'i.domain_name', 'i.url', 'i.port', 'c.case_number', 'c.title as case_title');
        
        applyAccessControl(iocsQuery);
        const iocsRaw = await iocsQuery.orderBy('i.created_at', 'desc').limit(5);
        const indicators = iocsRaw.map(i => ({
            id: i.id, case_id: i.case_id,
            value: i.ip || i.domain_name || i.url || `port:${i.port}`,
            iocType: i.ip ? 'IP' : i.domain_name ? 'Domain' : i.url ? 'URL' : 'Port',
            case_number: i.case_number, case_title: i.case_title,
        }));

        // Malware / Tools
        let malwareQuery = db('case_malware_tools as m')
            .leftJoin('cases as c', 'm.case_id', 'c.id')
            .where(function() {
                this.where('m.file_name', 'like', searchTerm)
                    .orWhere('m.file_path', 'like', searchTerm)
                    .orWhere('m.hashes', 'like', searchTerm)
                    .orWhere('m.description', 'like', searchTerm);
            })
            .select('m.id', 'm.case_id', 'm.file_name', 'm.file_path', 'm.hashes', 'm.is_malicious', 'c.case_number', 'c.title as case_title');
        applyAccessControl(malwareQuery);
        const malwareRaw = await malwareQuery.orderBy('m.created_at', 'desc').limit(5);
        const malware = malwareRaw.map(m => ({
            id: m.id, case_id: m.case_id, file_name: m.file_name, file_path: m.file_path,
            is_malicious: m.is_malicious, case_number: m.case_number, case_title: m.case_title,
        }));

        // Compromised Accounts
        let accountsQuery = db('case_compromised_accounts as a')
            .leftJoin('cases as c', 'a.case_id', 'c.id')
            .where(function() {
                this.where('a.account_name', 'like', searchTerm)
                    .orWhere('a.domain', 'like', searchTerm)
                    .orWhere('a.sid', 'like', searchTerm);
            })
            .select('a.id', 'a.case_id', 'a.account_name', 'a.domain', 'a.privileges', 'c.case_number', 'c.title as case_title');
        applyAccessControl(accountsQuery);
        const accountsRaw = await accountsQuery.orderBy('a.created_at', 'desc').limit(5);
        const accounts = accountsRaw.map(a => ({
            id: a.id, case_id: a.case_id,
            label: a.domain ? `${a.domain}\\${a.account_name}` : a.account_name,
            privileges: a.privileges, case_number: a.case_number, case_title: a.case_title,
        }));

        // Exfiltrations
        let exfilQuery = db('case_exfiltrations as e')
            .leftJoin('cases as c', 'e.case_id', 'c.id')
            .where(function() {
                this.where('e.file_name', 'like', searchTerm)
                    .orWhere('e.content_description', 'like', searchTerm)
                    .orWhere('e.other_info', 'like', searchTerm);
            })
            .select('e.id', 'e.case_id', 'e.file_name', 'e.file_size', 'e.file_size_unit', 'e.content_description', 'c.case_number', 'c.title as case_title');
        applyAccessControl(exfilQuery);
        const exfilRaw = await exfilQuery.orderBy('e.created_at', 'desc').limit(5);
        const exfiltrations = exfilRaw.map(e => ({
            id: e.id, case_id: e.case_id, file_name: e.file_name,
            file_size: e.file_size ? `${e.file_size} ${e.file_size_unit || ''}`.trim() : null,
            case_number: e.case_number, case_title: e.case_title,
        }));

        // Attacker Infrastructure
        let infraQuery = db('case_attacker_infra as ai')
            .leftJoin('cases as c', 'ai.case_id', 'c.id')
            .where(function() {
                this.where('ai.name', 'like', searchTerm)
                    .orWhere('ai.ip_addresses', 'like', searchTerm)
                    .orWhere('ai.description', 'like', searchTerm);
            })
            .select('ai.id', 'ai.case_id', 'ai.name', 'ai.infra_type', 'ai.ip_addresses', 'c.case_number', 'c.title as case_title');
        applyAccessControl(infraQuery);
        const infraRaw = await infraQuery.orderBy('ai.created_at', 'desc').limit(5);
        const attackerInfra = infraRaw.map(ai => ({
            id: ai.id, case_id: ai.case_id, name: ai.name, infra_type: ai.infra_type,
            case_number: ai.case_number, case_title: ai.case_title,
        }));

        // Comments
        let commentsQuery = db('comments as cm')
            .leftJoin('tasks as t', 'cm.task_id', 't.id')
            .leftJoin('cases as c', 't.case_id', 'c.id')
            .leftJoin('user_profiles as u', 'cm.author_id', 'u.id')
            .where(function() {
                this.where('cm.content', 'like', searchTerm);
            })
            .select('cm.id', 'cm.content', 'cm.task_id', 'cm.created_at',
                't.case_id', 't.title as task_title',
                'c.case_number', 'c.title as case_title',
                'u.full_name as author_name');
        applyAccessControl(commentsQuery);
        const commentsRaw = await commentsQuery.orderBy('cm.created_at', 'desc').limit(5);
        const comments = commentsRaw.map(cm => {
            // Strip HTML tags for preview
            const textContent = (cm.content || '').replace(/<[^>]+>/g, '').substring(0, 120);
            return {
                id: cm.id, case_id: cm.case_id, task_id: cm.task_id, content: textContent,
                task_title: cm.task_title, case_number: cm.case_number, case_title: cm.case_title,
                author_name: cm.author_name,
            };
        });

        // Events (chronology)
        let eventsQuery = db('case_events as ev')
            .leftJoin('cases as c', 'ev.case_id', 'c.id')
            .where(function() {
                this.where('ev.description', 'like', searchTerm)
                    .orWhere('ev.kill_chain', 'like', searchTerm);
            })
            .select('ev.id', 'ev.case_id', 'ev.description', 'ev.event_datetime', 'ev.kill_chain',
                'c.case_number', 'c.title as case_title');
        applyAccessControl(eventsQuery);
        const eventsRaw = await eventsQuery.orderBy('ev.event_datetime', 'desc').limit(5);
        const events = eventsRaw.map(ev => ({
            id: ev.id, case_id: ev.case_id,
            description: (ev.description || '').replace(/<[^>]+>/g, '').substring(0, 120),
            event_datetime: ev.event_datetime, kill_chain: ev.kill_chain,
            case_number: ev.case_number, case_title: ev.case_title,
        }));

        res.json({ cases, tasks, systems, indicators, malware, accounts, exfiltrations, attackerInfra, comments, events });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
