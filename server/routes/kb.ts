import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { getDb } from '../db-arango';
import authenticateToken from '../middleware/auth';
import { setHttpCache } from '../middleware/cache';
import { exec } from 'child_process';
import path from 'path';

const router = express.Router();
router.use(authenticateToken);

router.get('/mitre/attack-patterns', setHttpCache(86400), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { search } = req.query;
        const db = getDb();

        let filterClause = '';
        const bindVars: any = {};

        if (search && typeof search === 'string') {
            filterClause = `FILTER CONTAINS(LOWER(obj.name), LOWER(@search)) || CONTAINS(LOWER(mitre_ref), LOWER(@search))`;
            bindVars.search = search;
        }

        const aql = `
            FOR obj IN kb_stix_objects
                FILTER obj.type == "attack-pattern"
                FILTER obj.revoked != true AND obj.x_mitre_deprecated != true
                LET mitre_ref = FIRST(
                    FOR ext IN (obj.external_references || [])
                    FILTER ext.source_name == "mitre-attack"
                    RETURN ext.external_id
                )
                ${filterClause}
                SORT mitre_ref ASC
                RETURN {
                    id: obj.id,
                    name: obj.name,
                    description: obj.description,
                    mitre_id: mitre_ref,
                    kill_chain_phases: obj.kill_chain_phases,
                    x_mitre_platforms: obj.x_mitre_platforms
                }
        `;

        const cursor = await db.query(aql, bindVars);
        const results = await cursor.all();
        res.json(results);
    } catch (err) {
        console.error('[KB] attack-patterns error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const cloneSchema = z.object({
    case_id: z.string().min(1),
    stix_id: z.string().min(1)
});

router.post('/mitre/clone-to-case', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const validation = cloneSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: 'case_id and stix_id are required' });
            return;
        }

        const { case_id, stix_id } = validation.data;
        const db = getDb();

        const existCursor = await db.query(
            `FOR o IN stix_objects FILTER o.case_id == @caseId AND o.kb_origin == @stixId LIMIT 1 RETURN o`,
            { caseId: case_id, stixId: stix_id }
        );
        const existing = await existCursor.next();
        if (existing) {
            res.json({ cloned: false, object: existing });
            return;
        }

        const kbKey = stix_id.replace(/--/g, '_');
        const kbCursor = await db.query(
            `FOR o IN kb_stix_objects FILTER o._key == @key LIMIT 1 RETURN o`,
            { key: kbKey }
        );
        const kbObj = await kbCursor.next();
        if (!kbObj) {
            res.status(404).json({ error: 'STIX object not found in knowledge base' });
            return;
        }

        const { _key, _id, _rev, ...stixData } = kbObj;
        const newKey = crypto.randomUUID();
        const cloned = {
            _key: newKey,
            case_id,
            type: stixData.type,
            kb_origin: stix_id,
            data: stixData,
            created_by_user_id: req.user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const col = db.collection('stix_objects');
        await col.save(cloned);

        res.status(201).json({ cloned: true, object: cloned });
    } catch (err) {
        console.error('[KB] clone-to-case error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/mitre/seed', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const scriptPath = path.join(__dirname, '..', 'scripts', 'seedMitre.js');
        exec(`node ${scriptPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error('[KB] seed error:', error);
            }
            console.log('[KB] seed stdout:', stdout);
        });

        res.status(202).json({ message: 'Synchronisation MITRE lancée en arrière-plan.' });
    } catch (err) {
        console.error('[KB] seed route error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
