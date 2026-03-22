const express = require('express');
const { getDb } = require('../db-arango');
const authenticateToken = require('../middleware/auth');
const { isAdmin, canSeeType } = require('../utils/access');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const db = getDb();
        
        let currentUser = null;
        try {
            const userCursor = await db.query(`FOR u IN user_profiles FILTER u._key == @userId RETURN u`, { userId });
            currentUser = await userCursor.next();
        } catch (e) {}
        
        const admin = currentUser && isAdmin(currentUser.role);
        const canSeeAlerts = await canSeeType(userId, 'alert');
        const canSeeCases = await canSeeType(userId, 'case');

        const [openCasesCount, closedCasesCount, openAlertsCount, closedAlertsCount] = await Promise.all([
            countCases(db, userId, admin, 'open', 'case'),
            countCases(db, userId, admin, 'closed', 'case'),
            countCases(db, userId, admin, 'open', 'alert'),
            countCases(db, userId, admin, 'closed', 'alert')
        ]);

        const tasksCursor = await db.query(`
            FOR t IN tasks
            FILTER t.assigned_to == @userId AND t.status == 'open'
            COLLECT WITH COUNT INTO length
            RETURN length
        `, { userId });
        const myOpenTasksCount = await tasksCursor.next();

        let unassignedTasksCount = 0;
        if (admin) {
            const uCursor = await db.query(`
                FOR t IN tasks
                FILTER t.assigned_to == null AND t.status == 'open'
                COLLECT WITH COUNT INTO length
                RETURN length
            `);
            unassignedTasksCount = await uCursor.next();
        } else {
            const uCursor = await db.query(`
                FOR t IN tasks
                FILTER t.assigned_to == null AND t.status == 'open'
                LET c = (FOR c IN cases FILTER c._key == t.case_id RETURN c)[0]
                LET isAuthor = c.author_id == @userId
                LET isAssigned = (FOR a IN case_assignments FILTER a.case_id == t.case_id AND a.user_id == @userId LIMIT 1 RETURN 1)
                FILTER isAuthor OR LENGTH(isAssigned) > 0
                COLLECT WITH COUNT INTO length
                RETURN length
            `, { userId });
            unassignedTasksCount = await uCursor.next();
        }

        let recentActivity = [];
        if (admin) {
            const rCursor = await db.query(`
                FOR al IN case_audit_log
                SORT al.created_at DESC
                LIMIT 15
                LET up = (FOR u IN user_profiles FILTER u._key == al.user_id RETURN u)[0]
                LET c = (FOR c IN cases FILTER c._key == al.case_id RETURN c)[0]
                RETURN MERGE(al, { id: al._key, user_name: up.full_name, case_number: c.case_number, case_title: c.title, case_type: c.type || 'case' })
            `);
            recentActivity = await rCursor.all();
        } else {
            const rCursor = await db.query(`
                FOR al IN case_audit_log
                SORT al.created_at DESC
                LET c = (FOR c IN cases FILTER c._key == al.case_id RETURN c)[0]
                LET isAuthor = c.author_id == @userId
                LET isAssigned = (FOR a IN case_assignments FILTER a.case_id == al.case_id AND a.user_id == @userId LIMIT 1 RETURN 1)
                FILTER isAuthor OR LENGTH(isAssigned) > 0
                LIMIT 15
                LET up = (FOR u IN user_profiles FILTER u._key == al.user_id RETURN u)[0]
                RETURN MERGE(al, { id: al._key, user_name: up.full_name, case_number: c.case_number, case_title: c.title, case_type: c.type || 'case' })
            `, { userId });
            recentActivity = await rCursor.all();
        }

        let criticalCases = [];
        if (admin) {
            const cCursor = await db.query(`
                FOR c IN cases
                FILTER c.status == 'open'
                LET sev = (FOR s IN severities FILTER s._key == c.severity_id RETURN s)[0]
                FILTER sev.label IN ['Critique', 'Critical', 'Haute', 'High']
                SORT c.created_at DESC
                LIMIT 5
                RETURN { id: c._key, case_number: c.case_number, title: c.title, type: c.type || 'case', created_at: c.created_at, severity_label: sev.label, severity_color: sev.color }
            `);
            criticalCases = await cCursor.all();
        } else {
            const cCursor = await db.query(`
                FOR c IN cases
                FILTER c.status == 'open'
                LET isAuthor = c.author_id == @userId
                LET isAssigned = (FOR a IN case_assignments FILTER a.case_id == c._key AND a.user_id == @userId LIMIT 1 RETURN 1)
                FILTER isAuthor OR LENGTH(isAssigned) > 0
                LET sev = (FOR s IN severities FILTER s._key == c.severity_id RETURN s)[0]
                FILTER sev.label IN ['Critique', 'Critical', 'Haute', 'High']
                SORT c.created_at DESC
                LIMIT 5
                RETURN { id: c._key, case_number: c.case_number, title: c.title, type: c.type || 'case', created_at: c.created_at, severity_label: sev.label, severity_color: sev.color }
            `, { userId });
            criticalCases = await cCursor.all();
        }

        res.json({
            stats: {
                openCases: canSeeCases ? openCasesCount : 0,
                closedCases: canSeeCases ? closedCasesCount : 0,
                openAlerts: canSeeAlerts ? openAlertsCount : 0,
                closedAlerts: canSeeAlerts ? closedAlertsCount : 0,
                myOpenTasks: myOpenTasksCount,
                unassignedTasks: unassignedTasksCount,
            },
            recentActivity, criticalCases, canSeeAlerts, canSeeCases,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function countCases(db, userId, admin, status, type) {
    if (admin) {
        const cursor = await db.query(`
            FOR c IN cases
            FILTER c.status == @status AND (c.type == @type OR (c.type == null AND @type == 'case'))
            COLLECT WITH COUNT INTO length
            RETURN length
        `, { status, type });
        return await cursor.next();
    }
    const cursor = await db.query(`
        FOR c IN cases
        FILTER c.status == @status AND (c.type == @type OR (c.type == null AND @type == 'case'))
        LET isAuthor = c.author_id == @userId
        LET isAssigned = (FOR a IN case_assignments FILTER a.case_id == c._key AND a.user_id == @userId LIMIT 1 RETURN 1)
        LET inBeneficiary = (FOR bm IN beneficiary_members FILTER bm.beneficiary_id == c.beneficiary_id AND bm.user_id == @userId LIMIT 1 RETURN 1)
        FILTER isAuthor OR LENGTH(isAssigned) > 0 OR LENGTH(inBeneficiary) > 0
        COLLECT WITH COUNT INTO length
        RETURN length
    `, { status, type, userId });
    return await cursor.next();
}

module.exports = router;
