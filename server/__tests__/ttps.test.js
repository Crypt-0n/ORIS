/**
 * Non-Regression Tests for TTP Management Feature
 */
const request = require('supertest');
const app = require('../index');
const { getDb } = require('../db-arango');

let adminToken;
let userToken;

beforeAll(async () => {
    // 1. Create or Login Admin
    const adminEmail = 'admin-ttp@oris.local';
    const adminPass = 'Pass123!';
    let res = await request(app).post('/api/auth/register').send({ email: adminEmail, password: adminPass, full_name: 'Admin TTP' });
    if (!res.body.session) {
        res = await request(app).post('/api/auth/login').send({ email: adminEmail, password: adminPass });
    }
    adminToken = res.body.session.access_token;
    
    // Ensure admin role
    const db = getDb();
    await db.query(`UPDATE @id WITH { role: @r } IN user_profiles`, { id: res.body.user.id, r: JSON.stringify(['admin']) });

    // 2. Create or Login Normal User
    const userEmail = 'user-ttp@oris.local';
    const userPass = 'Pass123!';
    let userRes = await request(app).post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: userEmail, password: userPass, full_name: 'User TTP' });
    if (!userRes.body.session) {
        userRes = await request(app).post('/api/auth/login').send({ email: userEmail, password: userPass });
    }
    userToken = userRes.body.session.access_token;
});

describe('TTP Management API - Access Control', () => {
    it('GET /api/admin/ttps returns 403 for non-admin user', async () => {
        const res = await request(app).get('/api/admin/ttps?kill_chain_type=mitre_attack').set('Authorization', `Bearer ${userToken}`);
        expect(res.statusCode).toBe(403);
    });

    it('POST /api/admin/ttps returns 403 for non-admin user', async () => {
        const res = await request(app).post('/api/admin/ttps').set('Authorization', `Bearer ${userToken}`).send({
            kill_chain_type: 'mitre_attack', phase_value: 'initial_access', ttp_id: 'T1566', name: 'Phishing'
        });
        expect(res.statusCode).toBe(403);
    });
});

describe('TTP Management API - CRUD Operations (Admin)', () => {
    let createdTtpId;

    it('POST /api/admin/ttps creates a new TTP', async () => {
        const res = await request(app).post('/api/admin/ttps')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                kill_chain_type: 'mitre_attack',
                phase_value: 'test_phase',
                ttp_id: 'T9999',
                name: 'Test TTP',
                description: 'A non-regression test TTP'
            });
        
        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.id).toBeDefined();
        createdTtpId = res.body.id;
    });

    it('GET /api/admin/ttps lists TTPs including the new one', async () => {
        const res = await request(app).get('/api/admin/ttps?kill_chain_type=mitre_attack')
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
        
        const found = res.body.find(t => t.id === createdTtpId);
        expect(found).toBeDefined();
        expect(found.ttp_id).toBe('T9999');
        expect(found.name).toBe('Test TTP');
    });

    it('PUT /api/admin/ttps/:id updates an existing TTP', async () => {
        const res = await request(app).put(`/api/admin/ttps/${createdTtpId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Updated Test TTP',
                description: 'Updated description'
            });
        
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        const getRes = await request(app).get('/api/admin/ttps?kill_chain_type=mitre_attack')
            .set('Authorization', `Bearer ${adminToken}`);
        const updated = getRes.body.find(t => t.id === createdTtpId);
        expect(updated.name).toBe('Updated Test TTP');
        expect(updated.description).toBe('Updated description');
    });

    it('DELETE /api/admin/ttps/:id removes the TTP', async () => {
        const res = await request(app).delete(`/api/admin/ttps/${createdTtpId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        const getRes = await request(app).get('/api/admin/ttps?kill_chain_type=mitre_attack')
            .set('Authorization', `Bearer ${adminToken}`);
        const deleted = getRes.body.find(t => t.id === createdTtpId);
        expect(deleted).toBeUndefined();
    });
});

describe('TTP Configuration API (Public / Authenticated)', () => {
    it('GET /api/config/ttps lists TTPs for a normal user', async () => {
        const res = await request(app).get('/api/config/ttps?kill_chain_type=mitre_attack')
            .set('Authorization', `Bearer ${userToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        // Default seed data should exist
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/config/ttps?kill_chain_type=unified_kill_chain returns UKC TTPs', async () => {
        const res = await request(app).get('/api/config/ttps?kill_chain_type=unified_kill_chain')
            .set('Authorization', `Bearer ${userToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});
