const request = require('supertest');
const app = require('../index');
const db = require('../db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

describe('Lot 2 - Regression Tests for SQL Pagination and Limits', () => {
    let adminToken;
    let userToken;
    let adminId = crypto.randomUUID();
    let userId = crypto.randomUUID();
    let beneficiaryId = crypto.randomUUID();

    beforeAll(async () => {
        await db('cases').del();

        const password_hash = await bcrypt.hash('password123', 10);
        
        await db('user_profiles').insert([
            { id: adminId, email: 'admin_pagin@test.com', full_name: 'Admin Pagin', password_hash, role: JSON.stringify(['admin']) },
            { id: userId, email: 'user_pagin@test.com', full_name: 'User Pagin', password_hash, role: JSON.stringify(['user']) }
        ]);

        await db('beneficiaries').insert({ id: beneficiaryId, name: 'Pagin Corp' });
        await db('beneficiary_members').insert({ id: crypto.randomUUID(), beneficiary_id: beneficiaryId, user_id: adminId });
        await db('beneficiary_members').insert({ id: crypto.randomUUID(), beneficiary_id: beneficiaryId, user_id: userId, role: JSON.stringify(['case_analyst']) });

        adminToken = jwt.sign({ id: adminId, role: ['admin'] }, process.env.JWT_SECRET || 'test_secret', { expiresIn: '1h' });
        userToken = jwt.sign({ id: userId, role: ['user'] }, process.env.JWT_SECRET || 'test_secret', { expiresIn: '1h' });

        const severity = await db('severities').select('id').first();
        const severity_id = severity ? severity.id : 'LOW';

        const casesToInsert = [];
        for (let i = 0; i < 6; i++) {
            casesToInsert.push({
                id: crypto.randomUUID(),
                case_number: '9999-0000' + i,
                title: 'Pagination Case ' + i,
                description: 'Description ' + i,
                type: 'case',
                author_id: adminId,
                severity_id: severity_id,
                beneficiary_id: beneficiaryId
            });
        }
        await db('cases').insert(casesToInsert);
        
        const mockCaseId = casesToInsert[0].id;
        const tasksToInsert = [];
        for(let i = 0; i < 6; i++) {
            tasksToInsert.push({
                id: crypto.randomUUID(),
                case_id: mockCaseId,
                title: 'PAGINSEARCH Task ' + i,
                description: 'test limit 5 matching term',
                created_by: adminId
            });
        }
        await db('tasks').insert(tasksToInsert);
    });

    afterAll(async () => {
        await db('user_profiles').whereIn('id', [adminId, userId]).del();
        await db('beneficiaries').where({ id: beneficiaryId }).del();
        await db('cases').where('case_number', 'like', '9999-0000%').del();
        await db('tasks').where('title', 'like', 'PAGINSEARCH%').del();
    });

    it('GET /api/cases should handle SQL pagination properly limit=2, page=1', async () => {
        const res = await request(app)
            .get('/api/cases?limit=2&page=1')
            .set('Authorization', 'Bearer ' + adminToken);
        
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(2);
        expect(res.body.pagination.limit).toBe(2);
        expect(res.body.pagination.page).toBe(1);
        expect(res.body.pagination.total).toBeGreaterThanOrEqual(6);
        expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(3);
    });

    it('GET /api/cases should handle SQL offset properly limit=2, page=2', async () => {
        const resPage1 = await request(app)
            .get('/api/cases?limit=2&page=1')
            .set('Authorization', 'Bearer ' + adminToken);
            
        const resPage2 = await request(app)
            .get('/api/cases?limit=2&page=2')
            .set('Authorization', 'Bearer ' + adminToken);
        
        expect(resPage2.status).toBe(200);
        expect(resPage2.body.data.length).toBe(2);
        const p1Ids = resPage1.body.data.map(c => c.id);
        const p2Ids = resPage2.body.data.map(c => c.id);
        
        p2Ids.forEach(id => {
            expect(p1Ids).not.toContain(id);
        });
    });

    it('GET /api/search should enforce a hard limit of 5 on tasks regardless of matches', async () => {
        const res = await request(app)
            .get('/api/search?q=PAGINSEARCH')
            .set('Authorization', 'Bearer ' + adminToken);
        
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.tasks)).toBe(true);
        expect(res.body.tasks.length).toBeLessThanOrEqual(5); 
    });

    it('GET /api/search should enforce RBAC in SQL', async () => {
        const res = await request(app)
            .get('/api/search?q=Pagination')
            .set('Authorization', 'Bearer ' + userToken);
            
        expect(res.status).toBe(200);
        expect(res.body.cases.length).toBeGreaterThan(0);
        
        await db('beneficiary_members').where({ user_id: userId, beneficiary_id: beneficiaryId }).del();
        
        const resNoAccess = await request(app)
            .get('/api/search?q=Pagination')
            .set('Authorization', 'Bearer ' + userToken);
        
        expect(resNoAccess.status).toBe(200);
        expect(resNoAccess.body.cases.length).toBe(0);
    });
});
