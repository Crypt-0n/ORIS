const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const authenticateToken = require('../middleware/auth');
const { requireAdmin, getRoles, isAdmin } = require('../utils/access');

const router = express.Router();

router.get('/setup-status', async (req, res) => {
    try {
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const users = await userRepo.findWhere({});
        const hasAdmin = users.some(u => isAdmin(u.role));
        
        const configRepo = new BaseRepository(getDb(), 'system_config');
        const configRows = await configRepo.findWhere({ key: 'initialization_complete' });
        const config = configRows[0];
        
        const db = getDb();
        const bCountCursor = await db.query(`RETURN LENGTH(beneficiaries)`);
        const beneficiaryCount = await bCountCursor.next();
        
        res.json({
            hasAdmin,
            isInitialized: (config && config.value === 'true' && beneficiaryCount > 0) ? true : false
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.use(authenticateToken);
router.use(requireAdmin);

// Users
router.get('/users', async (req, res) => {
    try {
        const db = getDb();
        const cursor = await db.query(`
            FOR u IN user_profiles
            SORT u.created_at DESC
            LET memberships = (FOR b IN beneficiary_members FILTER b.user_id == u._key RETURN b.beneficiary_id)
            RETURN { id: u._key, email: u.email, full_name: u.full_name, role: u.role, is_active: u.is_active, created_at: u.created_at, beneficiary_ids: memberships }
        `);
        const users = await cursor.all();
        res.json(users.map(u => ({ ...u, roles: getRoles(u.role) })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/users', async (req, res) => {
    try {
        const { email, password, fullName, roles, beneficiaryIds } = req.body;
        if (!email || !password || !fullName) return res.status(400).json({ error: 'Missing required fields' });

        const id = crypto.randomUUID();
        const hashedPassword = await bcrypt.hash(password, 10);
        const rolesStr = JSON.stringify(roles || ['user']);

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const existing = await userRepo.findWhere({ email });
        if (existing.length > 0) return res.status(400).json({ error: 'Email already exists' });

        await userRepo.create({ id, email, password_hash: hashedPassword, full_name: fullName, role: rolesStr, is_active: 1, created_at: new Date().toISOString() });
        
        if (beneficiaryIds && Array.isArray(beneficiaryIds) && beneficiaryIds.length > 0) {
            const bRepo = new BaseRepository(getDb(), 'beneficiary_members');
            for (const bId of beneficiaryIds) {
                await bRepo.create({ id: crypto.randomUUID(), beneficiary_id: bId, user_id: id });
            }
        }

        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/users/:id', async (req, res) => {
    try {
        const { email, full_name, roles, password, is_active, beneficiaryIds } = req.body;
        const userId = req.params.id;

        if (req.user.id === userId && roles && !roles.includes('admin')) {
            return res.status(400).json({ error: 'Cannot remove your own admin role' });
        }

        const updateData = {};
        if (email !== undefined) {
             const userRepo = new BaseRepository(getDb(), 'user_profiles');
             const existing = await userRepo.findWhere({ email });
             if (existing.length > 0 && existing[0].id !== userId) return res.status(400).json({ error: 'Email already exists' });
             updateData.email = email;
        }
        if (full_name !== undefined) updateData.full_name = full_name;
        if (roles !== undefined) updateData.role = JSON.stringify(roles);
        if (is_active !== undefined) {
            if (userId === req.user.id && !is_active) throw new Error('Cannot deactivate your own account');
            updateData.is_active = is_active ? 1 : 0;
        }
        if (password) updateData.password_hash = await bcrypt.hash(password, 10);

        if (Object.keys(updateData).length > 0) {
            const userRepo = new BaseRepository(getDb(), 'user_profiles');
            await userRepo.update(userId, updateData);
        }

        if (beneficiaryIds && Array.isArray(beneficiaryIds)) {
            const bRepo = new BaseRepository(getDb(), 'beneficiary_members');
            await bRepo.deleteWhere({ user_id: userId });
            for (const bId of beneficiaryIds) {
                await bRepo.create({ id: crypto.randomUUID(), beneficiary_id: bId, user_id: userId });
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        if (req.user.id === req.params.id) return res.status(400).json({ error: 'Cannot deactivate yourself' });
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        const user = await userRepo.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        await userRepo.update(req.params.id, { is_active: 0 });
        res.json({ success: true, deactivated: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Config
router.get('/config', async (req, res) => {
    try {
        const repo = new BaseRepository(getDb(), 'system_config');
        const items = await repo.findWhere({});
        res.json(items.map(i => ({ key: i.key, value: i.value })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/config', async (req, res) => {
    try {
        const { key, value } = req.body;
        const db = getDb();
        await db.query(`UPSERT { key: @key } INSERT { key: @key, value: @val } UPDATE { value: @val } IN system_config`, { key, val: String(value) });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Beneficiaries
router.get('/beneficiaries', async (req, res) => {
    try {
        const db = getDb();
        const cursor = await db.query(`
            FOR b IN beneficiaries
            SORT b.name ASC
            LET ms = (FOR m IN beneficiary_members FILTER m.beneficiary_id == b._key RETURN 1)
            RETURN MERGE(b, { id: b._key, member_count: LENGTH(ms) })
        `);
        const beneficiaries = await cursor.all();
        res.json(beneficiaries);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/beneficiaries/:id/members', async (req, res) => {
    try {
        const db = getDb();
        const cursor = await db.query(`
            FOR m IN beneficiary_members
            FILTER m.beneficiary_id == @bId
            LET u = (FOR user IN user_profiles FILTER user._key == m.user_id RETURN user)[0]
            RETURN { id: m._key, beneficiary_id: m.beneficiary_id, user_id: m.user_id, full_name: u.full_name, email: u.email, is_team_lead: m.is_team_lead, role: m.role }
        `, { bId: req.params.id });
        const members = await cursor.all();
        res.json(members);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/beneficiaries/members/:id/team-lead', async (req, res) => {
    try {
        const { is_team_lead } = req.body;
        const repo = new BaseRepository(getDb(), 'beneficiary_members');
        await repo.update(req.params.id, { is_team_lead: is_team_lead ? 1 : 0 });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/beneficiaries/members/:id/role', async (req, res) => {
    try {
        const { roles } = req.body;
        if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles must be an array' });
        const repo = new BaseRepository(getDb(), 'beneficiary_members');
        await repo.update(req.params.id, { role: JSON.stringify(roles) });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/beneficiaries', async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const repo = new BaseRepository(getDb(), 'beneficiaries');
        const existing = await repo.findWhere({ name });
        if (existing.length > 0) return res.status(400).json({ error: 'Beneficiary name already exists' });

        const id = crypto.randomUUID();
        await repo.create({ id, name, description });
        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/beneficiaries/:id', async (req, res) => {
    try {
        const { name, description } = req.body;
        const repo = new BaseRepository(getDb(), 'beneficiaries');
        
        if (name !== undefined) {
             const existing = await repo.findWhere({ name });
             if (existing.length > 0 && existing[0].id !== req.params.id) return res.status(400).json({ error: 'Beneficiary name already exists' });
        }
        
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (Object.keys(updateData).length > 0) {
            updateData.updated_at = new Date().toISOString();
            await repo.update(req.params.id, updateData);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/beneficiaries/:id', async (req, res) => {
    try {
        const repo = new BaseRepository(getDb(), 'beneficiaries');
        await repo.delete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/beneficiaries/:id/members', async (req, res) => {
    try {
        const { user_id } = req.body;
        if (!user_id) return res.status(400).json({ error: 'User ID is required' });
        
        const repo = new BaseRepository(getDb(), 'beneficiary_members');
        const existing = await repo.findWhere({ beneficiary_id: req.params.id, user_id });
        if (existing.length > 0) return res.status(400).json({ error: 'User is already a member of this beneficiary' });

        const id = crypto.randomUUID();
        await repo.create({ id, beneficiary_id: req.params.id, user_id });
        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/beneficiaries/members/:id', async (req, res) => {
    try {
        const repo = new BaseRepository(getDb(), 'beneficiary_members');
        await repo.delete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// TTPs Management
router.get('/ttps', async (req, res) => {
    try {
        const { kill_chain_type } = req.query;
        let aql = `FOR t IN kill_chain_ttps `;
        let bindVars = {};
        if (kill_chain_type) {
            aql += ` FILTER t.kill_chain_type == @kct`;
            bindVars.kct = kill_chain_type;
        }
        aql += ` SORT t.phase_value ASC, t.order ASC RETURN MERGE(t, { id: t._key })`;
        
        const db = getDb();
        const cursor = await db.query(aql, bindVars);
        const ttps = await cursor.all();
        res.json(ttps);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/ttps', async (req, res) => {
    try {
        const { kill_chain_type, phase_value, ttp_id, name, description } = req.body;
        if (!kill_chain_type || !phase_value || !ttp_id || !name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const repo = new BaseRepository(getDb(), 'kill_chain_ttps');
        const existing = await repo.findWhere({ kill_chain_type, phase_value, ttp_id });
        if (existing.length > 0) return res.status(400).json({ error: 'This TTP already exists for this phase' });

        const db = getDb();
        const mCursor = await db.query(`FOR t IN kill_chain_ttps FILTER t.kill_chain_type == @kct AND t.phase_value == @pv COLLECT AGGREGATE m = MAX(t.order) RETURN m`, { kct: kill_chain_type, pv: phase_value });
        const maxOrder = await mCursor.next();
        
        const order = (maxOrder ?? -1) + 1;
        const id = crypto.randomUUID();
        await repo.create({ id, kill_chain_type, phase_value, ttp_id, name, description: description || '', order });
        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/ttps/:id', async (req, res) => {
    try {
        const { ttp_id, name, description } = req.body;
        const updateData = {};
        if (ttp_id !== undefined) updateData.ttp_id = ttp_id;
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (Object.keys(updateData).length > 0) {
            const repo = new BaseRepository(getDb(), 'kill_chain_ttps');
            await repo.update(req.params.id, updateData);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/ttps/:id', async (req, res) => {
    try {
        const repo = new BaseRepository(getDb(), 'kill_chain_ttps');
        await repo.delete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
