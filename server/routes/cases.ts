import { AuthenticatedRequest } from '../types';
import express, { Response } from 'express';
import nodeCrypto from 'crypto';
import { z } from 'zod';
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const CaseRepository = require('../repositories/CaseRepository');
const authenticateToken = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { logAudit } = require('../utils/audit');
const { isAdmin, userHasTypeAccess, userHasTypeAccessForBeneficiary, isTeamLeadForCase } = require('../utils/access');
const { getTlpColor, getPapColor } = require('../utils/colors');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authenticateToken as any);

// --- Zod Schemas ---
const createCaseSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().min(1, 'Description is required'),
    severity_id: z.string().min(1, 'Severity is required'),
    beneficiary_id: z.string().min(1, 'Beneficiary is required'),
    tlp_id: z.string().optional(),
    pap_id: z.string().optional(),
    tlp: z.string().optional(),
    pap: z.string().optional(),
    kill_chain_type: z.string().optional(),
    type: z.enum(['case', 'alert']).optional(),
    assigned_to: z.array(z.string()).optional(),
    adversary: z.string().optional().nullable(),
});

const updateCaseSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    severity_id: z.string().optional(),
    status: z.enum(['open', 'closed', 'archived']).optional(),
    closure_summary: z.string().optional().nullable(),
    closed_at: z.string().optional().nullable(),
    closed_by: z.string().optional().nullable(),
    tlp: z.string().optional(),
    pap: z.string().optional(),
    attacker_utc_offset: z.union([z.number(), z.string()]).optional().nullable(),
    kill_chain_type: z.string().optional(),
    beneficiary_id: z.string().optional().nullable(),
    author_id: z.string().optional(),
    adversary: z.string().optional().nullable(),
});


// Get beneficiaries for current user
router.get('/my-beneficiaries', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const caseRepo = new CaseRepository();
        const beneficiaries = await caseRepo.getBeneficiaries(req.user.id);
        res.json(beneficiaries);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get members of a beneficiary (for responsible dropdown)
router.get('/beneficiary-members/:beneficiary_id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const caseRepo = new CaseRepository();
        const members = await caseRepo.getBeneficiaryMembers((req.params.beneficiary_id as string));
        res.json(members);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create case or alert
router.post('/', validateRequest(createCaseSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { title, description, severity_id, tlp_id, pap_id, tlp, pap, kill_chain_type, beneficiary_id, type, assigned_to } = req.body;
        // case_number is always auto-generated — never accept it from the client
        const entityType = type === 'alert' ? 'alert' : 'case';

        if (!await userHasTypeAccessForBeneficiary(req.user.id, beneficiary_id, entityType, 'analyst')) {
            return res.status(403).json({ error: `You do not have permission to create ${entityType}s for this beneficiary` });
        }

        const actualTlp = tlp_id || tlp || 'AMBER';
        const actualPap = pap_id || pap || 'GREEN';
        const actualKillChain = kill_chain_type || 'cyber_kill_chain';

        const id = nodeCrypto.randomUUID();
        const author_id = req.user.id;

        const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
        const isMember = await memRepo.findFirst({ beneficiary_id, user_id: author_id });
        if (!isMember) {
            return res.status(403).json({ error: 'You must be a member of the beneficiary to create a case for it' });
        }

        const currentYear = new Date().getFullYear().toString();

        const caseRepo = new CaseRepository();
        const case_number = await caseRepo.getNextCaseNumber(currentYear);

        const newCaseId = await caseRepo.createWithAssignment({
            id, case_number, type: entityType, title, description, author_id,
            severity_id, tlp: actualTlp, pap: actualPap, status: 'open',
            kill_chain_type: actualKillChain, beneficiary_id,
            adversary: req.body.adversary || null
        }, assigned_to);

        logAudit(id, req.user.id, entityType === 'alert' ? 'alert_created' : 'case_created', 'case', id, { title });
        
        const createdCase = await caseRepo.findById(newCaseId);
        res.json(createdCase);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update case
router.put('/:id', validateRequest(updateCaseSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { title, description, severity_id, status, closure_summary, closed_at, closed_by, tlp, pap, attacker_utc_offset, kill_chain_type, beneficiary_id, author_id, adversary } = req.body;

        const updateData: Record<string, any> = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (severity_id !== undefined) updateData.severity_id = severity_id;
        if (status !== undefined) {
            if (status === 'closed') {
                if (!await isTeamLeadForCase(req.user.id, (req.params.id as string))) {
                    return res.status(403).json({ error: 'Only team leads or admins can close cases' });
                }
            }
            updateData.status = status;
        }
        if (closure_summary !== undefined) updateData.closure_summary = closure_summary;
        if (closed_at !== undefined) updateData.closed_at = closed_at;
        if (closed_by !== undefined) updateData.closed_by = closed_by;
        if (tlp !== undefined) updateData.tlp = tlp;
        if (pap !== undefined) updateData.pap = pap;
        if (attacker_utc_offset !== undefined) updateData.attacker_utc_offset = attacker_utc_offset;
        if (kill_chain_type !== undefined) updateData.kill_chain_type = kill_chain_type;
        if (adversary !== undefined) updateData.adversary = adversary;

        if (beneficiary_id !== undefined && beneficiary_id !== null) {
            const userRepo = new BaseRepository(getDb(), 'user_profiles');
            const currentUserRole = await userRepo.findById(req.user.id);
            const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
            const isMember = await memRepo.findFirst({ beneficiary_id, user_id: req.user.id });
            if (!isMember && !isAdmin(currentUserRole?.role)) {
                return res.status(403).json({ error: 'You must be a member of the beneficiary to assign it to a case' });
            }
            updateData.beneficiary_id = beneficiary_id;
        } else if (beneficiary_id === null) {
            return res.status(400).json({ error: 'beneficiary_id cannot be null' });
        }

        if (author_id !== undefined) {
            const userRepo = new BaseRepository(getDb(), 'user_profiles');
            const currentUserRole = await userRepo.findById(req.user.id);
            if (currentUserRole && isAdmin(currentUserRole.role)) {
                updateData.author_id = author_id;
            }
        }

        if (Object.keys(updateData).length > 0) {
            const caseRepo = new CaseRepository();
            const oldCase = await caseRepo.findById((req.params.id as string));
            await caseRepo.update((req.params.id as string), updateData);

            if (attacker_utc_offset !== undefined && oldCase && String(oldCase.attacker_utc_offset) !== String(attacker_utc_offset)) {
                logAudit((req.params.id as string), req.user.id, 'timezone_changed', 'case', (req.params.id as string), {
                    oldValue: oldCase.attacker_utc_offset, newValue: attacker_utc_offset,
                });
            }
        }

        if (req.body.assigned_to !== undefined) {
            const assignRepo = new BaseRepository(getDb(), 'case_assignments');
            const existing = await assignRepo.findWhere({ case_id: (req.params.id as string) });
            for (const a of existing) await assignRepo.delete(a.id);
            if (req.body.assigned_to) {
                await assignRepo.create({ id: nodeCrypto.randomUUID(), case_id: (req.params.id as string), user_id: req.body.assigned_to });
            }
        }

        res.json({ success: true, id: (req.params.id as string) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /cases:
 *   get:
 *     summary: Récupère la liste des cas (Cases) ou alertes (Alerts)
 *     tags: [Cases]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Numéro de la page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Nombre d'éléments par page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [case, alert]
 *         description: Filtrer par type
 *     responses:
 *       200:
 *         description: Liste paginée des cas/alertes
 *       403:
 *         description: Non autorisé
 *       500:
 *         description: Erreur serveur
 */
// Get filters metadata for given type (case/alert) to populate frontend dropdowns efficiently
router.get('/filters-metadata', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const typeFilter = req.query.type === 'alert' ? 'alert' : 'case';
        const currentUserRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUser = await currentUserRepo.findById(req.user.id);
        const hasAdminAccessGlobal = currentUser && isAdmin(currentUser.role);
        
        const caseRepo = new CaseRepository();
        const metadata = await caseRepo.getFiltersMetadata(req.user.id, hasAdminAccessGlobal, typeFilter);
        res.json(metadata);
    } catch (err) {
        logger.error({ err, userId: req.user?.id, route: 'GET /cases/filters-metadata' }, 'Erreur AQL lors de la récupération des meta-données');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all cases/alerts accessible to user
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limitParam = parseInt(req.query.limit as string) || 50;
        const limit = page > 0 ? Math.min(limitParam, 200) : 0;
        const typeFilter = req.query.type === 'alert' ? 'alert' : 'case';

        // Extract filters
        const status = (req.query.status as string) === 'all' ? null : (req.query.status as string) || null;
        const beneficiary_id = (req.query.beneficiary as string) === 'all' ? null : (req.query.beneficiary as string) || null;
        const severity_id = (req.query.severity as string) === 'all' ? null : (req.query.severity as string) || null;
        const author_id = (req.query.author as string) === 'all' ? null : (req.query.author as string) || null;
        const supervisionStr = req.query.supervision as string;
        const supervision = supervisionStr === 'true' ? true : (supervisionStr === 'backlog' ? 'backlog' : (supervisionStr === 'false' ? false : undefined));

        const filters = { status, beneficiary_id, severity_id, author_id, supervision };

        const currentUserRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUser = await currentUserRepo.findById(req.user.id);
        const hasAdminAccessGlobal = currentUser && isAdmin(currentUser.role);
        
        const caseRepo = new CaseRepository();
        const result = await caseRepo.findAllAccessible(req.user.id, hasAdminAccessGlobal, typeFilter, page, limit, filters);
        
        if (page <= 0) return res.json(result.rows);
        
        const totalPages = Math.ceil(result.total / limit);
        res.json({ data: result.rows, pagination: { page, limit, total: result.total, totalPages } });
    } catch (err) {
        logger.error({ err, userId: req.user?.id, route: 'GET /cases' }, 'Erreur AQL lors de la récupération des dossiers');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a single case
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const currentUserRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUser = await currentUserRepo.findById(req.user.id);
        const hasAdminAccessGlobal = currentUser && isAdmin(currentUser.role);
        
        const caseRepo = new CaseRepository();
        const r = await caseRepo.findByIdAccessible((req.params.id as string), req.user.id, hasAdminAccessGlobal);
        
        if (r.notFound) return res.status(404).json({ error: 'Case not found' });
        if (!r.hasAccess) return res.status(403).json({ error: 'Access denied: you are not assigned to this case' });
        
        delete r.hasAccess;
        res.json(r);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:id/beneficiary-members', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const caseRepo = new CaseRepository();
        const caseRecord = await caseRepo.findById((req.params.id as string));
        if (!caseRecord) return res.status(404).json({ error: 'Case not found' });
        
        const assignRepo = new BaseRepository(getDb(), 'case_assignments');
        const assignments = await assignRepo.findWhere({ case_id: (req.params.id as string) });
        const isAssigned = caseRecord.author_id === req.user.id || assignments.some((a: any) => a.user_id === req.user.id);
        
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const currentUser = await userRepo.findById(req.user.id);
        if (!isAssigned && (!currentUser || !isAdmin(currentUser.role))) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const members = await caseRepo.getBeneficiaryMembers(caseRecord.beneficiary_id);
        res.json(members);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Convert alert to case
router.post('/:id/convert', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const caseRepo = new CaseRepository();
        const caseRecord = await caseRepo.findById((req.params.id as string));
        if (!caseRecord) return res.status(404).json({ error: 'Not found' });
        if (caseRecord.type !== 'alert') return res.status(400).json({ error: 'Only alerts can be converted to cases' });

        if (!await userHasTypeAccessForBeneficiary(req.user.id, caseRecord.beneficiary_id, 'case', 'user')) {
            return res.status(403).json({ error: 'case_analyst role or higher required to convert alerts' });
        }

        await caseRepo.update((req.params.id as string), { type: 'case' });

        const assignRepo = new BaseRepository(getDb(), 'case_assignments');
        const assignedUsers = await assignRepo.findWhere({ case_id: (req.params.id as string) });
        
        if (assignedUsers.length > 0) {
            const userIds = assignedUsers.map((a: any) => a.user_id);
            const userRepo = new BaseRepository(getDb(), 'user_profiles');
            
            // Re-fetch users for role details. Better to just loop.
            const assignmentsToRemove = [];
            for (const assignment of assignedUsers) {
                const p = await userRepo.findById(assignment.user_id);
                const isGloballyAdmin = p && isAdmin(p.role);
                
                let hasAccess = isGloballyAdmin;
                if (!hasAccess) {
                    const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
                    const m = await memRepo.findFirst({ user_id: assignment.user_id, beneficiary_id: caseRecord.beneficiary_id });
                    if (m && m.role) {
                        const mRoles = Array.isArray(m.role) ? m.role : JSON.parse(m.role || '[]');
                        hasAccess = mRoles.some((r: any) => r === 'case_analyst' || r === 'case_manager' || r === 'case_user' || r === 'case_viewer');
                    }
                }
                
                if (!hasAccess) {
                    assignmentsToRemove.push(assignment);
                    await assignRepo.delete(assignment.id);
                    logAudit((req.params.id as string), req.user.id, 'member_removed', 'case_assignment', assignment.id, {
                        user_name: p?.full_name || 'Inconnu',
                        reason: 'Accès insuffisant après conversion en dossier',
                    });
                }
            }
        }

        logAudit((req.params.id as string), req.user.id, 'alert_converted_to_case', 'case', (req.params.id as string), { title: caseRecord.title });
        res.json({ success: true, id: (req.params.id as string) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a case
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const caseRepo = new CaseRepository();
        const caseRecord = await caseRepo.findById((req.params.id as string));
        if (!caseRecord) return res.status(404).json({ error: 'Not found' });

        if (!await userHasTypeAccessForBeneficiary(req.user.id, caseRecord.beneficiary_id, caseRecord.type || 'case', 'manager')) {
            return res.status(403).json({ error: 'Analyst role required to delete' });
        }

        await caseRepo.delete((req.params.id as string));
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
export {};
