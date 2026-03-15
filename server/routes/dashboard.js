const express = require('express');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { isAdmin, canSeeType } = require('../utils/access');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const currentUser = await db('user_profiles').where({ id: userId }).select('role').first();
        const admin = currentUser && isAdmin(currentUser.role);
        const canSeeAlerts = await canSeeType(userId, 'alert');
        const canSeeCases = await canSeeType(userId, 'case');

        const countCases = async (status, type) => {
            if (admin) {
                const r = await db('cases').whereRaw("status = ? AND COALESCE(type, 'case') = ?", [status, type]).count('* as count').first();
                return r.count;
            }
            const r = await db('cases')
                .whereRaw("status = ? AND COALESCE(type, 'case') = ?", [status, type])
                .andWhere(function() {
                    this.where('author_id', userId)
                        .orWhereExists(db('case_assignments').whereRaw('case_id = cases.id').andWhere('user_id', userId))
                        .orWhereExists(db('beneficiary_members').whereRaw('beneficiary_id = cases.beneficiary_id').andWhere('user_id', userId));
                })
                .count('* as count').first();
            return r.count;
        };

        const [openCasesCount, closedCasesCount, openAlertsCount, closedAlertsCount] = await Promise.all([
            countCases('open', 'case'), countCases('closed', 'case'),
            countCases('open', 'alert'), countCases('closed', 'alert'),
        ]);

        const myOpenTasks = await db('tasks').where({ assigned_to: userId, status: 'open' }).count('* as count').first();

        const unassignedTasks = await db('tasks')
            .whereNull('assigned_to').andWhere('status', 'open')
            .andWhere(function() {
                this.whereExists(db('cases').whereRaw('cases.id = tasks.case_id').andWhere('cases.author_id', userId))
                    .orWhereExists(db('case_assignments').whereRaw('case_assignments.case_id = tasks.case_id').andWhere('case_assignments.user_id', userId));
            })
            .count('* as count').first();

        let recentActivityQuery = db('case_audit_log as al')
            .leftJoin('user_profiles as up', 'al.user_id', 'up.id')
            .leftJoin('cases as c', 'al.case_id', 'c.id')
            .select('al.*', 'up.full_name as user_name', 'c.case_number', 'c.title as case_title',
                db.raw("COALESCE(c.type, 'case') as case_type"))
            .orderBy('al.created_at', 'desc').limit(15);

        if (!admin) {
            recentActivityQuery = recentActivityQuery.whereIn('al.case_id',
                db('cases').select('id').where('author_id', userId)
                    .unionAll(db('case_assignments').select('case_id').where('user_id', userId))
            );
        }
        const recentActivity = await recentActivityQuery;

        let criticalQuery = db('cases')
            .leftJoin('severities', 'cases.severity_id', 'severities.id')
            .where('cases.status', 'open')
            .whereIn('severities.label', ['Critique', 'Critical', 'Haute', 'High'])
            .select('cases.id', 'cases.case_number', 'cases.title',
                db.raw("COALESCE(cases.type, 'case') as type"), 'cases.created_at',
                'severities.label as severity_label', 'severities.color as severity_color')
            .orderBy('cases.created_at', 'desc').limit(5);

        if (!admin) {
            criticalQuery = criticalQuery.andWhere(function() {
                this.where('cases.author_id', userId)
                    .orWhereExists(db('case_assignments').whereRaw('case_id = cases.id').andWhere('user_id', userId));
            });
        }
        const criticalCases = await criticalQuery;

        res.json({
            stats: {
                openCases: canSeeCases ? parseInt(openCasesCount, 10) || 0 : 0,
                closedCases: canSeeCases ? parseInt(closedCasesCount, 10) || 0 : 0,
                openAlerts: canSeeAlerts ? parseInt(openAlertsCount, 10) || 0 : 0,
                closedAlerts: canSeeAlerts ? parseInt(closedAlertsCount, 10) || 0 : 0,
                myOpenTasks: parseInt(myOpenTasks.count, 10) || 0,
                unassignedTasks: parseInt(unassignedTasks.count, 10) || 0,
            },
            recentActivity, criticalCases, canSeeAlerts, canSeeCases,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
