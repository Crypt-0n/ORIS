const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { requireAdmin, getRoles, isAdmin } = require('../utils/access');

const router = express.Router();

router.get('/setup-status', async (req, res) => {
    try {
        const users = await db('user_profiles').select('role');
        const hasAdmin = users.some(u => isAdmin(u.role));
        const config = await db('system_config').where({ key: 'initialization_complete' }).select('value').first();
        const countResult = await db('beneficiaries').count('* as count').first();
        const beneficiaryCount = countResult.count;
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
        const users = await db('user_profiles as u')
            .select('u.id', 'u.email', 'u.full_name', 'u.role', 'u.is_active', 'u.created_at')
            .orderBy('u.created_at', 'desc');

        // Fetch beneficiary memberships for all users
        const memberships = await db('beneficiary_members').select('user_id', 'beneficiary_id');
        const membershipMap = {};
        for (const m of memberships) {
            if (!membershipMap[m.user_id]) membershipMap[m.user_id] = [];
            membershipMap[m.user_id].push(m.beneficiary_id);
        }

        res.json(users.map(u => ({
            ...u,
            roles: getRoles(u.role),
            beneficiary_ids: membershipMap[u.id] || [],
        })));
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

        await db.transaction(async trx => {
            await trx('user_profiles').insert({ id, email, password_hash: hashedPassword, full_name: fullName, role: rolesStr });
            if (beneficiaryIds && Array.isArray(beneficiaryIds) && beneficiaryIds.length > 0) {
                const inserts = beneficiaryIds.map(bId => ({ id: crypto.randomUUID(), beneficiary_id: bId, user_id: id }));
                await trx('beneficiary_members').insert(inserts);
            }
        });

        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error(err);
        if (err.message?.includes('UNIQUE') || err.code === '23505' || err.errno === 1062) {
            return res.status(400).json({ error: 'Email already exists' });
        }
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

        await db.transaction(async trx => {
            const updateData = {};
            if (email !== undefined) updateData.email = email;
            if (full_name !== undefined) updateData.full_name = full_name;
            if (roles !== undefined) updateData.role = JSON.stringify(roles);
            if (is_active !== undefined) {
                if (userId === req.user.id && !is_active) throw new Error('Cannot deactivate your own account');
                updateData.is_active = is_active ? 1 : 0;
            }
            if (password) updateData.password_hash = await bcrypt.hash(password, 10);

            if (Object.keys(updateData).length > 0) {
                await trx('user_profiles').where({ id: userId }).update(updateData);
            }

            if (beneficiaryIds && Array.isArray(beneficiaryIds)) {
                await trx('beneficiary_members').where({ user_id: userId }).del();
                if (beneficiaryIds.length > 0) {
                    const inserts = beneficiaryIds.map(bId => ({ id: crypto.randomUUID(), beneficiary_id: bId, user_id: userId }));
                    await trx('beneficiary_members').insert(inserts);
                }
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        if (req.user.id === req.params.id) return res.status(400).json({ error: 'Cannot deactivate yourself' });
        const user = await db('user_profiles').where({ id: req.params.id }).select('id', 'is_active').first();
        if (!user) return res.status(404).json({ error: 'User not found' });
        await db('user_profiles').where({ id: req.params.id }).update({ is_active: 0 });
        res.json({ success: true, deactivated: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Config
router.get('/config', async (req, res) => {
    try {
        const items = await db('system_config').select('key', 'value');
        res.json(items);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/config', async (req, res) => {
    try {
        const { key, value } = req.body;
        await db('system_config').insert({ key, value }).onConflict('key').merge({ value });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Beneficiaries
router.get('/beneficiaries', async (req, res) => {
    try {
        const beneficiaries = await db('beneficiaries as b')
            .select('b.*')
            .select(db.raw('(SELECT COUNT(*) FROM beneficiary_members WHERE beneficiary_id = b.id) as member_count'))
            .orderBy('b.name', 'asc');
        res.json(beneficiaries);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/beneficiaries/:id/members', async (req, res) => {
    try {
        const members = await db('beneficiary_members as m')
            .join('user_profiles as u', 'm.user_id', 'u.id')
            .where('m.beneficiary_id', req.params.id)
            .select('m.id', 'm.beneficiary_id', 'm.user_id', 'u.full_name', 'u.email', 'm.is_team_lead', 'm.role');
        res.json(members);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/beneficiaries/members/:id/team-lead', async (req, res) => {
    try {
        const { is_team_lead } = req.body;
        await db('beneficiary_members').where({ id: req.params.id }).update({ is_team_lead: is_team_lead ? 1 : 0 });
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
        await db('beneficiary_members').where({ id: req.params.id }).update({ role: JSON.stringify(roles) });
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
        const id = crypto.randomUUID();
        await db('beneficiaries').insert({ id, name, description });
        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error(err);
        if (err.message?.includes('UNIQUE') || err.code === '23505' || err.errno === 1062) {
            return res.status(400).json({ error: 'Beneficiary name already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/beneficiaries/:id', async (req, res) => {
    try {
        const { name, description } = req.body;
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (Object.keys(updateData).length > 0) {
            updateData.updated_at = new Date().toISOString();
            await db('beneficiaries').where({ id: req.params.id }).update(updateData);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        if (err.message?.includes('UNIQUE') || err.code === '23505' || err.errno === 1062) {
            return res.status(400).json({ error: 'Beneficiary name already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/beneficiaries/:id', async (req, res) => {
    try {
        await db('beneficiaries').where({ id: req.params.id }).del();
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
        const id = crypto.randomUUID();
        await db('beneficiary_members').insert({ id, beneficiary_id: req.params.id, user_id });
        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error(err);
        if (err.message?.includes('UNIQUE') || err.code === '23505' || err.errno === 1062) {
            return res.status(400).json({ error: 'User is already a member of this beneficiary' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/beneficiaries/members/:id', async (req, res) => {
    try {
        await db('beneficiary_members').where({ id: req.params.id }).del();
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
        let query = db('kill_chain_ttps').orderBy('phase_value').orderBy('order');
        if (kill_chain_type) query = query.where({ kill_chain_type });
        const ttps = await query;
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
            return res.status(400).json({ error: 'Missing required fields: kill_chain_type, phase_value, ttp_id, name' });
        }
        const id = crypto.randomUUID();
        const maxOrder = await db('kill_chain_ttps')
            .where({ kill_chain_type, phase_value })
            .max('order as max')
            .first();
        const order = (maxOrder?.max ?? -1) + 1;
        await db('kill_chain_ttps').insert({ id, kill_chain_type, phase_value, ttp_id, name, description: description || '', order });
        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error(err);
        if (err.message?.includes('UNIQUE') || err.code === '23505' || err.errno === 1062) {
            return res.status(400).json({ error: 'This TTP already exists for this phase' });
        }
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
            await db('kill_chain_ttps').where({ id: req.params.id }).update(updateData);
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/ttps/:id', async (req, res) => {
    try {
        await db('kill_chain_ttps').where({ id: req.params.id }).del();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

