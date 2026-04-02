import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import { getDb } from '../db-arango';
import BaseRepository from '../repositories/BaseRepository';
import authenticateToken from '../middleware/auth';
import { isAdmin, canSeeType } from '../utils/access';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string' || q.trim().length < 2) {
            res.json({ cases: [], tasks: [], stixObjects: [], comments: [] });
            return;
        }

        const searchTerm = `%${q.trim()}%`;
        const userId = req.user.id;
        const db = getDb();

        const userRepo = new BaseRepository(db, 'user_profiles');
        const currentUser = await userRepo.findById(userId);
        const userIsAdmin = currentUser && isAdmin(currentUser.role);
        const canSeeAlerts = await canSeeType(userId, 'alert');
        const canSeeCases = await canSeeType(userId, 'case');

        const accessCheck = userIsAdmin ? `true` : `
            (c.author_id == @userId || 
            LENGTH(FOR a IN case_assignments FILTER a.case_id == c._key AND a.user_id == @userId RETURN 1) > 0 ||
            LENGTH(FOR bm IN beneficiary_members FILTER bm.beneficiary_id == c.beneficiary_id AND bm.user_id == @userId RETURN 1) > 0)
        `;

        const bindVars: any = userIsAdmin ? { q: searchTerm } : { q: searchTerm, userId };

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
            .filter((c: any) => (c.type === 'alert' && canSeeAlerts) || (c.type !== 'alert' && canSeeCases))
            .map((c: any) => ({
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

        // 3. STIX Objects
        const stixCursor = await db.query(`
            FOR obj IN stix_objects
            LET searchable = CONCAT_SEPARATOR(' ', obj.data.name || '', obj.data.value || '', obj.data.display_name || '', obj.data.user_id || '', obj.data.description || '', obj.data.pattern || '')
            FILTER searchable LIKE @q
            LET c = (FOR case IN cases FILTER case._key == obj.case_id RETURN case)[0]
            FILTER c != null AND ${accessCheck}
            SORT obj.created_at DESC LIMIT 10
            RETURN {
                id: obj._key,
                case_id: obj.case_id,
                stix_type: obj.data.type,
                name: obj.data.name || obj.data.value || obj.data.display_name || obj.data.user_id || '',
                description: obj.data.description || obj.data.pattern || '',
                case_number: c.case_number,
                case_title: c.title
            }
        `, bindVars);
        const stixObjects = await stixCursor.all();

        // 4. Comments
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
        const comments = (await commentsCursor.all()).map((cm: any) => ({
            ...cm, content: (cm.content || '').replace(/<[^>]+>/g, '').substring(0, 120)
        }));

        res.json({ cases, tasks, stixObjects, comments });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
