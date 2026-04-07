/**
 * Non-Regression Tests for MITRE Knowledge Base API
 * Replaces the old TTP CRUD tests since kill_chain_ttps has been removed.
 */
const request = require('supertest');
const app = require('../index');
const { getDb } = require('../db-arango');

let adminToken;
let userToken;
let adminUserId;
let caseId;

beforeAll(async () => {
    // 1. Create or Login Admin
    const adminEmail = 'admin-kb@oris.local';
    const adminPass = 'ValidPassword123!';
    let res = await request(app).post('/api/auth/register').send({ email: adminEmail, password: adminPass, full_name: 'Admin KB' });
    if (!res.body.session) {
        res = await request(app).post('/api/auth/login').send({ email: adminEmail, password: adminPass });
    }
    adminToken = res.body.session.access_token;
    adminUserId = res.body.user.id;
    
    // Ensure admin role
    const db = getDb();
    await db.query(`UPDATE @id WITH { role: @r } IN user_profiles`, { id: adminUserId, r: JSON.stringify(['admin']) });

    // 2. Create or Login Normal User
    const userEmail = 'user-kb@oris.local';
    const userPass = 'ValidPassword123!';
    let userRes = await request(app).post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: userEmail, password: userPass, full_name: 'User KB' });
    if (!userRes.body.session) {
        userRes = await request(app).post('/api/auth/login').send({ email: userEmail, password: userPass });
    }
    userToken = userRes.body.session.access_token;

    // 3. Seed one test attack-pattern into kb_stix_objects for testing
    const kbCol = db.collection('kb_stix_objects');
    try {
        await kbCol.save({
            _key: 'attack-pattern_test-0001-0001-0001-000000000001',
            id: 'attack-pattern--test-0001-0001-0001-000000000001',
            type: 'attack-pattern',
            name: 'Test Phishing Technique',
            description: 'Test technique for non-regression',
            spec_version: '2.1',
            external_references: [
                { source_name: 'mitre-attack', external_id: 'T9999', url: 'https://attack.mitre.org/techniques/T9999/' }
            ],
            kill_chain_phases: [
                { kill_chain_name: 'mitre-attack', phase_name: 'initial-access' }
            ],
            x_mitre_platforms: ['Windows', 'Linux'],
        });
    } catch (e) { /* already exists */ }

    // 4. Use a dummy case ID to test the clone operation.
    // We don't need a real case since the KB route doesn't check the Cases collection.
    const crypto = require('crypto');
    caseId = crypto.randomUUID();
});

describe('MITRE KB API - Attack Patterns', () => {
    it('GET /api/kb/mitre/attack-patterns requires authentication', async () => {
        const res = await request(app).get('/api/kb/mitre/attack-patterns');
        expect(res.statusCode).toBe(401);
    });

    it('GET /api/kb/mitre/attack-patterns returns attack patterns', async () => {
        const res = await request(app).get('/api/kb/mitre/attack-patterns')
            .set('Authorization', `Bearer ${userToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
        
        // Verify the test pattern is present
        const found = res.body.find(p => p.mitre_id === 'T9999');
        expect(found).toBeDefined();
        expect(found.name).toBe('Test Phishing Technique');
    });

    it('GET /api/kb/mitre/attack-patterns?search=T9999 filters by MITRE ID', async () => {
        const res = await request(app).get('/api/kb/mitre/attack-patterns?search=T9999')
            .set('Authorization', `Bearer ${userToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].mitre_id).toBe('T9999');
    });

    it('GET /api/kb/mitre/attack-patterns?search=phishing filters by name', async () => {
        const res = await request(app).get('/api/kb/mitre/attack-patterns?search=phishing')
            .set('Authorization', `Bearer ${userToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
        expect(res.body.some(p => p.name.toLowerCase().includes('phishing'))).toBe(true);
    });

    it('GET /api/kb/mitre/attack-patterns?search=zzzznonexistent returns empty', async () => {
        const res = await request(app).get('/api/kb/mitre/attack-patterns?search=zzzznonexistent')
            .set('Authorization', `Bearer ${userToken}`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBe(0);
    });
});

describe('MITRE KB API - Clone to Case', () => {
    it('POST /api/kb/mitre/clone-to-case requires authentication', async () => {
        const res = await request(app).post('/api/kb/mitre/clone-to-case')
            .send({ case_id: 'x', stix_id: 'y' });
        expect(res.statusCode).toBe(401);
    });

    it('POST /api/kb/mitre/clone-to-case validates required fields', async () => {
        const res = await request(app).post('/api/kb/mitre/clone-to-case')
            .set('Authorization', `Bearer ${userToken}`)
            .send({});
        
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    it('POST /api/kb/mitre/clone-to-case returns 404 for unknown stix_id', async () => {
        const res = await request(app).post('/api/kb/mitre/clone-to-case')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ case_id: caseId, stix_id: 'attack-pattern--nonexistent-0000-0000-0000-000000000000' });
        
        expect(res.statusCode).toBe(404);
    });

    it('POST /api/kb/mitre/clone-to-case successfully clones an object', async () => {
        const res = await request(app).post('/api/kb/mitre/clone-to-case')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ case_id: caseId, stix_id: 'attack-pattern--test-0001-0001-0001-000000000001' });
        
        expect(res.statusCode).toBe(201);
        expect(res.body.cloned).toBe(true);
        expect(res.body.object).toBeDefined();
        expect(res.body.object.case_id).toBe(caseId);
        expect(res.body.object.kb_origin).toBe('attack-pattern--test-0001-0001-0001-000000000001');
        expect(res.body.object.data.name).toBe('Test Phishing Technique');
    });

    it('POST /api/kb/mitre/clone-to-case returns existing if already cloned', async () => {
        const res = await request(app).post('/api/kb/mitre/clone-to-case')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ case_id: caseId, stix_id: 'attack-pattern--test-0001-0001-0001-000000000001' });
        
        expect(res.statusCode).toBe(200);
        expect(res.body.cloned).toBe(false);
        expect(res.body.object).toBeDefined();
    });
});

describe('Old TTP Routes should be removed', () => {
    it('GET /api/admin/ttps should return 404', async () => {
        const res = await request(app).get('/api/admin/ttps')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toBe(404);
    });

    it('POST /api/admin/ttps should return 404', async () => {
        const res = await request(app).post('/api/admin/ttps')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ kill_chain_type: 'mitre_attack', phase_value: 'x', ttp_id: 'y', name: 'z' });
        expect(res.statusCode).toBe(404);
    });

    it('GET /api/config/ttps should return 404', async () => {
        const res = await request(app).get('/api/config/ttps?kill_chain_type=mitre_attack')
            .set('Authorization', `Bearer ${userToken}`);
        expect(res.statusCode).toBe(404);
    });
});
