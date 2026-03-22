const express = require('express');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const authenticateToken = require('../middleware/auth');
const { isAdmin, canSeeType } = require('../utils/access');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) return res.json({ cases: [], tasks: [], systems: [], indicators: [], malware: [], accounts: [], exfiltrations: [], attackerInfra: [], comments: [], events: [] });

        const searchTerm = `%${q.trim()}%`;
        const userId = req.user.id;
        const db = getDb();

        const userRepo = new BaseRepository(db, 'user_profiles');
        const currentUser = await userRepo.findById(userId);
        const userIsAdmin = currentUser && isAdmin(currentUser.role);
        const canSeeAlerts = await canSeeType(userId, 'alert');
        const canSeeCases = await canSeeType(userId, 'case');

        // Access fragment for non-admin
        const accessCheck = userIsAdmin ? `true` : `
            (c.author_id == @userId || 
            LENGTH(FOR a IN case_assignments FILTER a.case_id == c._key AND a.user_id == @userId RETURN 1) > 0 ||
            LENGTH(FOR bm IN beneficiary_members FILTER bm.beneficiary_id == c.beneficiary_id AND bm.user_id == @userId RETURN 1) > 0)
        `;

        // Only pass userId bind parameter when the access check uses it
        const bindVars = userIsAdmin ? { q: searchTerm } : { q: searchTerm, userId };

        // 1. Cases
        const casesCursor = await db.query(`
            FOR c IN cases
            FILTER (c.title LIKE @q OR c.case_number LIKE @q OR c.description LIKE @q) AND ${accessCheck}
            SORT c.created_at DESC LIMIT 5
            LET s = (FOR sev IN severities FILTER sev._key == c.severity_id RETURN sev)[0]
            LET b = (FOR ben IN beneficiaries FILTER ben._key == c.beneficiary_id RETURN ben)[0]
            RETURN MERGE(c, { id: c._key, severity_label: s.label, severity_color: s.color, beneficiary_name: b.name, type: c.type || 'case' })
        `, bindVars);
        const casesRaw = await casesCursor.all();
        const cases = casesRaw
            .filter(c => (c.type === 'alert' && canSeeAlerts) || (c.type !== 'alert' && canSeeCases))
            .map(c => ({
                id: c.id, case_number: c.case_number, title: c.title, status: c.status, type: c.type,
                severity: c.severity_label ? { label: c.severity_label, color: c.severity_color } : null,
                beneficiary_name: c.beneficiary_name
            }));

        // 2. Tasks
        const tasksCursor = await db.query(`
            FOR t IN tasks
            FILTER (t.title LIKE @q OR t.description LIKE @q)
            LET c = (FOR case IN cases FILTER case._key == t.case_id RETURN case)[0]
            FILTER c != null AND ${accessCheck}
            SORT t.created_at DESC LIMIT 5
            RETURN { id: t._key, case_id: t.case_id, title: t.title, status: t.status, case_number: c.case_number, case_title: c.title }
        `, bindVars);
        const tasks = await tasksCursor.all();

        // 3. Systems
        const sysCursor = await db.query(`
            FOR s IN case_systems
            FILTER (s.name LIKE @q OR CONCAT_SEPARATOR(',', s.ip_addresses) LIKE @q)
            LET c = (FOR case IN cases FILTER case._key == s.case_id RETURN case)[0]
            FILTER c != null AND ${accessCheck}
            SORT s.created_at DESC LIMIT 5
            RETURN { id: s._key, case_id: s.case_id, name: s.name, system_type: s.system_type, case_number: c.case_number, case_title: c.title }
        `, bindVars);
        const systems = await sysCursor.all();

        // 4. Indicators
        const iocCursor = await db.query(`
            FOR i IN case_network_indicators
            FILTER (i.ip LIKE @q OR i.domain_name LIKE @q OR i.url LIKE @q)
            LET c = (FOR case IN cases FILTER case._key == i.case_id RETURN case)[0]
            FILTER c != null AND ${accessCheck}
            SORT i.created_at DESC LIMIT 5
            RETURN { id: i._key, case_id: i.case_id, ip: i.ip, domain_name: i.domain_name, url: i.url, port: i.port, case_number: c.case_number, case_title: c.title }
        `, bindVars);
        const indicators = (await iocCursor.all()).map(i => ({
            id: i.id, case_id: i.case_id, value: i.ip || i.domain_name || i.url || `port:${i.port}`,
            iocType: i.ip ? 'IP' : i.domain_name ? 'Domain' : i.url ? 'URL' : 'Port',
            case_number: i.case_number, case_title: i.case_title
        }));

        // 5. Malware
        const malCursor = await db.query(`
            FOR m IN case_malware_tools
            FILTER (m.file_name LIKE @q OR m.file_path LIKE @q OR m.hashes LIKE @q OR m.description LIKE @q)
            LET c = (FOR case IN cases FILTER case._key == m.case_id RETURN case)[0]
            FILTER c != null AND ${accessCheck}
            SORT m.created_at DESC LIMIT 5
            RETURN { id: m._key, case_id: m.case_id, file_name: m.file_name, file_path: m.file_path, is_malicious: m.is_malicious, case_number: c.case_number, case_title: c.title }
        `, bindVars);
        const malware = await malCursor.all();

        // 6. Accounts
        const accCursor = await db.query(`
            FOR a IN case_compromised_accounts
            FILTER (a.account_name LIKE @q OR a.domain LIKE @q OR a.sid LIKE @q)
            LET c = (FOR case IN cases FILTER case._key == a.case_id RETURN case)[0]
            FILTER c != null AND ${accessCheck}
            SORT a.created_at DESC LIMIT 5
            RETURN { id: a._key, case_id: a.case_id, account_name: a.account_name, domain: a.domain, privileges: a.privileges, case_number: c.case_number, case_title: c.title }
        `, bindVars);
        const accounts = (await accCursor.all()).map(a => ({
            id: a.id, case_id: a.case_id, label: a.domain ? `${a.domain}\\\\${a.account_name}` : a.account_name,
            privileges: a.privileges, case_number: a.case_number, case_title: a.case_title
        }));

        // 7. Exfiltrations
        const exfilCursor = await db.query(`
            FOR e IN case_exfiltrations
            FILTER (e.file_name LIKE @q OR e.content_description LIKE @q OR e.other_info LIKE @q)
            LET c = (FOR case IN cases FILTER case._key == e.case_id RETURN case)[0]
            FILTER c != null AND ${accessCheck}
            SORT e.created_at DESC LIMIT 5
            RETURN { id: e._key, case_id: e.case_id, file_name: e.file_name, file_size: e.file_size, file_size_unit: e.file_size_unit, case_number: c.case_number, case_title: c.title }
        `, bindVars);
        const exfiltrations = (await exfilCursor.all()).map(e => ({
            id: e.id, case_id: e.case_id, file_name: e.file_name,
            file_size: e.file_size ? `${e.file_size} ${e.file_size_unit || ''}`.trim() : null,
            case_number: e.case_number, case_title: e.case_title
        }));

        // 8. Attacker Infra
        const infraCursor = await db.query(`
            FOR ai IN case_attacker_infra
            FILTER (ai.name LIKE @q OR CONCAT_SEPARATOR(',', ai.ip_addresses || []) LIKE @q OR ai.description LIKE @q)
            LET c = (FOR case IN cases FILTER case._key == ai.case_id RETURN case)[0]
            FILTER c != null AND ${accessCheck}
            SORT ai.created_at DESC LIMIT 5
            RETURN { id: ai._key, case_id: ai.case_id, name: ai.name, infra_type: ai.infra_type, case_number: c.case_number, case_title: c.title }
        `, bindVars);
        const attackerInfra = await infraCursor.all();

        // 9. Comments
        const commentsCursor = await db.query(`
            FOR cm IN comments
            FILTER cm.content LIKE @q
            LET t = (FOR task IN tasks FILTER task._key == cm.task_id RETURN task)[0]
            FILTER t != null
            LET c = (FOR case IN cases FILTER case._key == t.case_id RETURN case)[0]
            FILTER c != null AND ${accessCheck}
            LET u = (FOR user IN user_profiles FILTER user._key == cm.author_id RETURN user)[0]
            SORT cm.created_at DESC LIMIT 5
            RETURN { id: cm._key, case_id: t.case_id, task_id: cm.task_id, content: cm.content, task_title: t.title, case_number: c.case_number, case_title: c.title, author_name: u.full_name }
        `, bindVars);
        const comments = (await commentsCursor.all()).map(cm => ({
            ...cm, content: (cm.content || '').replace(/<[^>]+>/g, '').substring(0, 120)
        }));

        // 10. Events
        const eventsCursor = await db.query(`
            FOR ev IN case_events
            FILTER (ev.description LIKE @q OR ev.kill_chain LIKE @q)
            LET c = (FOR case IN cases FILTER case._key == ev.case_id RETURN case)[0]
            FILTER c != null AND ${accessCheck}
            SORT ev.event_datetime DESC LIMIT 5
            RETURN { id: ev._key, case_id: ev.case_id, description: ev.description, event_datetime: ev.event_datetime, kill_chain: ev.kill_chain, case_number: c.case_number, case_title: c.title }
        `, bindVars);
        const events = (await eventsCursor.all()).map(ev => ({
            ...ev, description: (ev.description || '').replace(/<[^>]+>/g, '').substring(0, 120)
        }));

        res.json({ cases, tasks, systems, indicators, malware, accounts, exfiltrations, attackerInfra, comments, events });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
