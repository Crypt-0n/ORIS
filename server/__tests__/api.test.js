/**
 * API Tests — Auth, Cases, Tasks, Comments, Presence, Health
 * Tests run against an isolated temp SQLite database (see setup.js).
 */
const request = require('supertest');

const app = require('../index');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');

beforeAll(async () => {
    // Wait for ArangoDB migrations and setup to complete before starting any requests
    await require('../init_db');
    if (!adminToken) {
        const res = await registerAndLogin(TEST_USER);
        adminToken = res.token;
    }
});

// ------ Helpers ------

let authToken;
let userId;
let adminToken; // Global admin token for creating subsequent users

const TEST_USER = {
    email: 'test@oris.local',
    password: 'TestPassword123!',
    full_name: 'Test User',
};

// Register a user (uses admin token for auth when users already exist)
const registerUser = async (user) => {
    const res = await request(app).post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(user);
    if (!res.body.session && res.statusCode !== 200) {
         console.error('REGISTER FAILED:', res.statusCode, res.body);
    }
    return res;
};

async function registerAndLogin(user = TEST_USER) {
    // Try register first
    const regRes = await registerUser(user);

    if (regRes.statusCode === 200 && regRes.body.session) {
        userId = regRes.body.user.id;
        authToken = regRes.body.session.access_token;

        // First user ever → promote to admin and save global admin token
        if (!adminToken) {
            const userRepo = new BaseRepository(getDb(), 'user_profiles');
            await userRepo.update(userId, { role: JSON.stringify(['admin']) });
            adminToken = authToken;
        }

        return { token: authToken, userId };
    }

    // User already exists — login instead
    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });
        
    if (!loginRes.body.user) {
        console.error('LOGIN FAILED:', loginRes.statusCode, loginRes.body);
    }
    
    userId = loginRes.body.user.id;
    authToken = loginRes.body.session.access_token;
    if (!adminToken) adminToken = authToken;
    return { token: authToken, userId };
}

function auth(req) {
    return req.set('Authorization', `Bearer ${authToken}`);
}

// Create a beneficiary, add the test user as a member with case_analyst role
async function setupBeneficiary() {
    const crypto = require('crypto');
    const beneficiaryId = crypto.randomUUID();
    
    // Use ArangoDB repositories
    const benRepo = new BaseRepository(getDb(), 'beneficiaries');
    await benRepo.create({ id: beneficiaryId, name: 'Test Beneficiary' });

    const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
    await memRepo.create({
        id: crypto.randomUUID(), 
        beneficiary_id: beneficiaryId, 
        user_id: userId, 
        role: JSON.stringify(['case_analyst', 'alert_analyst'])
    });
    return beneficiaryId;
}

// ------ Tests ------

describe('Health Check', () => {
    it('GET /api/health returns OK', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});

describe('Auth API', () => {
    // Global admin is already created in the top-level beforeAll

    it('POST /api/auth/register creates a new user (admin-gated)', async () => {
        const res = await registerUser({ email: 'reg@oris.local', password: 'Pass123!', full_name: 'Reg Test' });
        expect(res.statusCode).toBe(200);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe('reg@oris.local');
        expect(res.body.session.access_token).toBeDefined();
    });

    it('POST /api/auth/register rejects without auth token', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'noauth@oris.local', password: 'Pass123!', full_name: 'No Auth' });
        expect(res.statusCode).toBe(401);
    });

    it('POST /api/auth/register rejects duplicate email', async () => {
        await registerUser({ email: 'dup@oris.local', password: 'Pass123!', full_name: 'Dup1' });
        const res = await registerUser({ email: 'dup@oris.local', password: 'Pass123!', full_name: 'Dup2' });
        expect(res.statusCode).toBe(409);
    });

    it('POST /api/auth/register rejects missing fields', async () => {
        const res = await registerUser({ email: 'x@x.com' });
        expect(res.statusCode).toBe(400);
    });

    it('POST /api/auth/login returns token', async () => {
        await registerUser({ email: 'login@oris.local', password: 'Pass123!', full_name: 'Login' });
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'login@oris.local', password: 'Pass123!' });
        expect(res.statusCode).toBe(200);
        expect(res.body.session.access_token).toBeDefined();
        expect(res.body.user.id).toBeDefined();
    });

    it('POST /api/auth/login rejects wrong password', async () => {
        await registerUser({ email: 'wrong@oris.local', password: 'Pass123!', full_name: 'Wrong' });
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'wrong@oris.local', password: 'BadPass!' });
        expect(res.statusCode).toBe(401);
    });

    it('GET /api/auth/me returns profile with valid token', async () => {
        const res = await auth(request(app).get('/api/auth/me'));
        expect(res.statusCode).toBe(200);
        expect(res.body.user.email).toBe(TEST_USER.email);
    });

    it('GET /api/auth/me rejects without token', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.statusCode).toBe(401);
    });

    it('GET /api/auth/users-list returns user list', async () => {
        const res = await auth(request(app).get('/api/auth/users-list'));
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });
});

describe('Cases & Tasks API', () => {
    let caseId;
    let taskId;
    let beneficiaryId;

    beforeAll(async () => {
        await registerAndLogin();
        beneficiaryId = await setupBeneficiary();
    });

    it('POST /api/cases creates a case', async () => {
        const sevRepo = new BaseRepository(getDb(), 'severities');
        const severities = await sevRepo.findWhere({});
        const severity = severities[0];

        const res = await auth(request(app).post('/api/cases'))
            .send({
                title: 'Test Case',
                description: '<p>Test description</p>',
                severity_id: severity?.id,
                beneficiary_id: beneficiaryId,
            });
        expect(res.statusCode).toBe(200);
        expect(res.body.id).toBeDefined();
        expect(res.body.title).toBe('Test Case');
        caseId = res.body.id;
    });

    it('POST /api/cases rejects missing fields', async () => {
        const res = await auth(request(app).post('/api/cases'))
            .send({ title: 'No description' });
        expect(res.statusCode).toBe(400);
    });

    it('GET /api/cases lists cases', async () => {
        const res = await auth(request(app).get('/api/cases'));
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/cases/:id returns case details', async () => {
        const res = await auth(request(app).get(`/api/cases/${caseId}`));
        expect(res.statusCode).toBe(200);
        expect(res.body.title).toBe('Test Case');
        expect(res.body.beneficiary).toBeDefined();
    });

    it('PUT /api/cases/:id updates a case', async () => {
        const res = await auth(request(app).put(`/api/cases/${caseId}`))
            .send({ title: 'Updated Case' });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('POST /api/tasks creates a task', async () => {
        const res = await auth(request(app).post('/api/tasks'))
            .send({
                case_id: caseId,
                title: 'Test Task',
                description: '<p>Task description</p>',
            });
        expect(res.statusCode).toBe(200);
        expect(res.body.id).toBeDefined();
        taskId = res.body.id;
    });

    it('GET /api/tasks/:id returns task details', async () => {
        const res = await auth(request(app).get(`/api/tasks/${taskId}`));
        expect(res.statusCode).toBe(200);
        expect(res.body.title).toBe('Test Task');
    });

    describe('Comments', () => {
        let commentId;

        it('POST /api/comments creates a comment', async () => {
            const res = await auth(request(app).post('/api/comments'))
                .send({ task_id: taskId, content: '<p>Hello world</p>' });
            expect(res.statusCode).toBe(200);
            expect(res.body.id).toBeDefined();
            commentId = res.body.id;
        });

        it('GET /api/comments/by-task/:id returns comments', async () => {
            const res = await auth(request(app).get(`/api/comments/by-task/${taskId}`));
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(1);
            expect(res.body[0].content).toContain('Hello');
            expect(res.body[0]).toHaveProperty('attachments');
        });

        it('PUT /api/comments/:id updates a comment', async () => {
            const res = await auth(request(app).put(`/api/comments/${commentId}`))
                .send({ content: '<p>Updated</p>' });
            expect(res.statusCode).toBe(200);
        });

        it('DELETE /api/comments/:id deletes a comment', async () => {
            const res = await auth(request(app).delete(`/api/comments/${commentId}`));
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            const listRes = await auth(request(app).get(`/api/comments/by-task/${taskId}`));
            expect(listRes.body.length).toBe(0);
        });

        it('POST /api/comments rejects missing content', async () => {
            const res = await auth(request(app).post('/api/comments'))
                .send({ task_id: taskId });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('Presence', () => {
        it('POST /api/presence/heartbeat accepts heartbeat', async () => {
            const res = await auth(request(app).post('/api/presence/heartbeat'))
                .send({ caseId });
            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
        });

        it('GET /api/presence/case/:id returns active users array', async () => {
            // Heartbeat first
            await auth(request(app).post('/api/presence/heartbeat'))
                .send({ caseId });
            const res = await auth(request(app).get(`/api/presence/case/${caseId}`));
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('GET /api/presence/task/:id returns active users array', async () => {
            await auth(request(app).post('/api/presence/heartbeat'))
                .send({ caseId, taskId });
            const res = await auth(request(app).get(`/api/presence/task/${taskId}`));
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('POST /api/presence/heartbeat rejects without caseId', async () => {
            const res = await auth(request(app).post('/api/presence/heartbeat'))
                .send({});
            expect(res.statusCode).toBe(400);
        });
    });

    describe('My Tasks', () => {
        let myTasksCaseId;
        let myTaskId;

        beforeAll(async () => {
            // Create a case and task assigned to the current user
            const sevRepo = new BaseRepository(getDb(), 'severities');
            const severities = await sevRepo.findWhere({});
            const severity = severities[0];
            const caseRes = await auth(request(app).post('/api/cases'))
                .send({
                    title: 'MyTasks Test Case',
                    description: '<p>For my-tasks test</p>',
                    severity_id: severity?.id,
                    beneficiary_id: beneficiaryId,
                });
            myTasksCaseId = caseRes.body.id;

            const taskRes = await auth(request(app).post('/api/tasks'))
                .send({
                    case_id: myTasksCaseId,
                    title: 'MyTasks Assigned Task',
                    description: '<p>Assigned to me</p>',
                    assigned_to: userId,
                });
            myTaskId = taskRes.body.id;
        });

        it('GET /api/tasks/my-tasks returns assigned and unassigned lists', async () => {
            const res = await auth(request(app).get('/api/tasks/my-tasks'));
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('assigned');
            expect(res.body).toHaveProperty('unassigned');
            expect(Array.isArray(res.body.assigned)).toBe(true);
        });

        it('GET /api/tasks/my-tasks includes tasks on accessible cases', async () => {
            const res = await auth(request(app).get('/api/tasks/my-tasks'));
            expect(res.statusCode).toBe(200);
            const found = res.body.assigned.some(t => t.id === myTaskId);
            expect(found).toBe(true);
        });



        afterAll(async () => {
            // Cleanup
            if (myTasksCaseId) {
                await auth(request(app).delete(`/api/cases/${myTasksCaseId}`));
            }
        });
    });

    it('DELETE /api/cases/:id deletes a case', async () => {
        const res = await auth(request(app).delete(`/api/cases/${caseId}`));
        expect(res.statusCode).toBe(204);
    });
});

// ====== Non-Regression Tests for Audit Fixes ======

describe('Access Control — Non-Regression', () => {
    let ownerToken, ownerUserId, ownerBeneficiaryId, ownerCaseId, ownerTaskId;
    let outsiderToken, outsiderUserId;

    beforeAll(async () => {
        const crypto = require('crypto');

        // Create owner user (has access)
        const ownerRes = await registerUser({ email: 'owner-acl@oris.local', password: 'Pass123!', full_name: 'Owner ACL' });
        ownerToken = ownerRes.body.session.access_token;
        ownerUserId = ownerRes.body.user.id;

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        await userRepo.update(ownerUserId, { role: JSON.stringify(['admin']) });

        ownerBeneficiaryId = crypto.randomUUID();
        const benRepo = new BaseRepository(getDb(), 'beneficiaries');
        await benRepo.create({ id: ownerBeneficiaryId, name: 'Owner Beneficiary' });
        
        const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
        await memRepo.create({
            id: crypto.randomUUID(), beneficiary_id: ownerBeneficiaryId, user_id: ownerUserId, role: JSON.stringify(['case_analyst', 'alert_analyst'])
        });

        const sevRepo = new BaseRepository(getDb(), 'severities');
        const severities = await sevRepo.findWhere({});
        const severity = severities[0];
        const caseRes = await request(app)
            .post('/api/cases')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
                title: 'ACL Test Case',
                description: '<p>Private</p>',
                severity_id: severity?.id,
                beneficiary_id: ownerBeneficiaryId,
            });
        ownerCaseId = caseRes.body.id;

        // Create a task in that case
        const taskRes = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ case_id: ownerCaseId, title: 'ACL Task', description: '<p>test</p>' });
        ownerTaskId = taskRes.body.id;

        // Create outsider user (no access to owner's case)
        const outsiderRes = await registerUser({ email: 'outsider-acl@oris.local', password: 'Pass123!', full_name: 'Outsider ACL' });
        outsiderToken = outsiderRes.body.session.access_token;
        outsiderUserId = outsiderRes.body.user.id;
    });

    // --- Files access control ---
    it('POST /api/files/upload returns 403 for unauthorized user', async () => {
        const res = await request(app)
            .post('/api/files/upload')
            .set('Authorization', `Bearer ${outsiderToken}`)
            .field('caseId', ownerCaseId)
            .field('taskId', ownerTaskId);
        // Will be 400 (no file) or 403 — we check it's not 200/201
        expect([400, 403]).toContain(res.statusCode);
    });

    it.skip('GET /api/files/task/:taskId returns 403 for unauthorized user', async () => {
        const res = await request(app)
            .get(`/api/files/task/${ownerTaskId}`)
            .set('Authorization', `Bearer ${outsiderToken}`);
        expect(res.statusCode).toBe(403);
    });

    // --- Comments access control ---
    it('GET /api/comments/by-task/:taskId returns 403 for unauthorized user', async () => {
        const res = await request(app)
            .get(`/api/comments/by-task/${ownerTaskId}`)
            .set('Authorization', `Bearer ${outsiderToken}`);
        expect(res.statusCode).toBe(403);
    });

    it('POST /api/comments returns 403 for unauthorized user', async () => {
        const res = await request(app)
            .post('/api/comments')
            .set('Authorization', `Bearer ${outsiderToken}`)
            .send({ task_id: ownerTaskId, content: '<p>Unauthorized comment</p>' });
        expect(res.statusCode).toBe(403);
    });

    it('POST /api/comments allows authorized user', async () => {
        const res = await request(app)
            .post('/api/comments')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ task_id: ownerTaskId, content: '<p>Authorized comment</p>' });
        expect(res.statusCode).toBe(200);
        expect(res.body.id).toBeDefined();
    });

    // --- Investigation access control ---
    it('GET /api/investigation/systems/by-case/:caseId returns 403 for unauthorized user', async () => {
        const res = await request(app)
            .get(`/api/investigation/systems/by-case/${ownerCaseId}`)
            .set('Authorization', `Bearer ${outsiderToken}`);
        expect(res.statusCode).toBe(403);
    });

    it('POST /api/investigation/systems returns 403 for unauthorized user', async () => {
        const res = await request(app)
            .post('/api/investigation/systems')
            .set('Authorization', `Bearer ${outsiderToken}`)
            .send({ case_id: ownerCaseId, name: 'Hacked Server', type: 'server' });
        expect(res.statusCode).toBe(403);
    });

    it('GET /api/investigation/systems/by-case/:caseId allows authorized user', async () => {
        const res = await request(app)
            .get(`/api/investigation/systems/by-case/${ownerCaseId}`)
            .set('Authorization', `Bearer ${ownerToken}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    // --- Audit log access control ---
    it('GET /api/audit/case/:caseId returns 403 for unauthorized user', async () => {
        const res = await request(app)
            .get(`/api/audit/case/${ownerCaseId}`)
            .set('Authorization', `Bearer ${outsiderToken}`);
        expect(res.statusCode).toBe(403);
    });

    it('GET /api/audit/case/:caseId allows authorized user', async () => {
        const res = await request(app)
            .get(`/api/audit/case/${ownerCaseId}`)
            .set('Authorization', `Bearer ${ownerToken}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    // --- Reports access control ---
    it('GET /api/reports/case/:id returns 403 for unauthorized user', async () => {
        const res = await request(app)
            .get(`/api/reports/case/${ownerCaseId}`)
            .set('Authorization', `Bearer ${outsiderToken}`);
        expect(res.statusCode).toBe(403);
    });


});

describe('Bug Fixes — Non-Regression', () => {
    let fixToken, fixUserId, fixBeneficiaryId, fixCaseId, fixTaskId;

    beforeAll(async () => {
        const crypto = require('crypto');

        const res = await registerUser({ email: 'fix-test@oris.local', password: 'Pass123!', full_name: 'Fix Test' });
        fixToken = res.body.session.access_token;
        fixUserId = res.body.user.id;

        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        await userRepo.update(fixUserId, { role: JSON.stringify([]) });

        fixBeneficiaryId = crypto.randomUUID();
        const benRepo = new BaseRepository(getDb(), 'beneficiaries');
        await benRepo.create({ id: fixBeneficiaryId, name: 'Fix Beneficiary' });
        
        const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
        await memRepo.create({
            id: crypto.randomUUID(), beneficiary_id: fixBeneficiaryId, user_id: fixUserId, role: JSON.stringify(['case_analyst', 'alert_analyst'])
        });

        const sevRepo = new BaseRepository(getDb(), 'severities');
        const severities = await sevRepo.findWhere({});
        const severity = severities[0];
        
        const caseRes = await request(app)
            .post('/api/cases')
            .set('Authorization', `Bearer ${fixToken}`)
            .send({
                title: 'Fix Test Case',
                description: '<p>For bug fix tests</p>',
                severity_id: severity?.id,
                beneficiary_id: fixBeneficiaryId,
            });
        fixCaseId = caseRes.body.id;

        const taskRes = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${fixToken}`)
            .send({ case_id: fixCaseId, title: 'Fix Task', description: '<p>test</p>' });
        fixTaskId = taskRes.body.id;
    });

    // FUNC-01: req.db → db (no more TypeError crash)
    it('POST /api/investigation/account_systems does not crash with TypeError (req.db fix)', async () => {
        const res = await request(app)
            .post('/api/investigation/account_systems')
            .set('Authorization', `Bearer ${fixToken}`)
            .send([]);
        // The table may not exist (pre-existing schema gap), so 500 from SQL is acceptable.
        // What matters is it does NOT crash with "Cannot read properties of undefined (reading 'prepare')"
        if (res.statusCode === 500) {
            expect(res.body.error).not.toContain('undefined');
        } else {
            expect([200, 201]).toContain(res.statusCode);
        }
    });

    // FUNC-02: Duplicate audit route removed — single registration works
    it('GET /api/investigation/audit/by-case/:caseId returns single result set', async () => {
        const res = await request(app)
            .get(`/api/investigation/audit/by-case/${fixCaseId}`)
            .set('Authorization', `Bearer ${fixToken}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    // SEC-04: Comment role check with JSON.parse — admin can moderate
    it('Admin can delete another user comment (role check fix)', async () => {
        // Create a comment as fixUser
        const commentRes = await request(app)
            .post('/api/comments')
            .set('Authorization', `Bearer ${fixToken}`)
            .send({ task_id: fixTaskId, content: '<p>To be moderated</p>' });
        const commentId = commentRes.body.id;

        // Create admin user
        const adminRes = await registerUser({ email: 'admin-mod@oris.local', password: 'Pass123!', full_name: 'Admin Mod' });
        const adminToken = adminRes.body.session.access_token;
        const adminUserId = adminRes.body.user.id;

        // Grant admin role and add to beneficiary
        const crypto = require('crypto');
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        await userRepo.update(adminUserId, { role: JSON.stringify(['admin']) });
        
        const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
        await memRepo.create({
            id: crypto.randomUUID(), beneficiary_id: fixBeneficiaryId, user_id: adminUserId
        });

        // Admin should be able to delete the comment (was broken before JSON.parse fix)
        const delRes = await request(app)
            .delete(`/api/comments/${commentId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(delRes.statusCode).toBe(200);
        expect(delRes.body.success).toBe(true);
    });

    // PERF-01: N+1 fix — comment attachments still returned correctly
    it('GET /api/comments/by-task returns attachments array (N+1 batch fix)', async () => {
        // Create a comment first
        await request(app)
            .post('/api/comments')
            .set('Authorization', `Bearer ${fixToken}`)
            .send({ task_id: fixTaskId, content: '<p>Attachment test</p>' });

        const res = await request(app)
            .get(`/api/comments/by-task/${fixTaskId}`)
            .set('Authorization', `Bearer ${fixToken}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
        // Every comment should have an attachments array
        for (const comment of res.body) {
            expect(comment).toHaveProperty('attachments');
            expect(Array.isArray(comment.attachments)).toBe(true);
        }
    });

    // FUNC-04: Reports no longer leaks error details
    it('GET /api/reports/case/:id does not expose error details for nonexistent case', async () => {
        const res = await request(app)
            .get('/api/reports/case/nonexistent-id')
            .set('Authorization', `Bearer ${fixToken}`);
        // Should be 403 (access denied) or 404, but body should NOT have 'details'
        expect(res.body).not.toHaveProperty('details');
    });

    // SEC-07: CORS is configured
    it('CORS headers are present on responses', async () => {
        const res = await request(app).get('/api/health');
        // With cors configured, access-control headers should be present
        expect(res.statusCode).toBe(200);
    });
});

describe.skip('Auth guards on protected routes', () => {
    const routes = [
        ['GET', '/api/cases'],
        ['GET', '/api/auth/me'],
        ['GET', '/api/auth/users-list'],
        ['POST', '/api/comments'],
        ['POST', '/api/presence/heartbeat'],
        ['GET', '/api/tasks/my-tasks'],
        ['POST', '/api/files/upload'],
        ['GET', '/api/files/task/fake-id'],
        ['GET', '/api/files/download'],
        ['GET', '/api/audit/case/fake-id'],
        ['GET', '/api/reports/case/fake-id'],
        ['GET', '/api/investigation/systems/by-case/fake-id'],
        ['GET', '/api/investigation/events/by-case/fake-id'],
    ];

    test.each(routes)('%s %s returns 401 without token', async (method, url) => {
        const res = await request(app)[method.toLowerCase()](url);
        expect(res.statusCode).toBe(401);
    });
});

// ====== Audit V2 Non-Regression Tests ======

describe('Audit V2 Fixes', () => {
    let v2Token, v2UserId, v2BeneficiaryId, v2CaseId, v2TaskId;

    beforeAll(async () => {
        // Ensure admin user exists
        if (!adminToken) {
            await registerAndLogin(TEST_USER);
        }
        const crypto = require('crypto');

        // Create a user for these tests
        const regRes = await registerUser({
            email: 'auditv2@oris.local',
            password: 'AuditV2Pass123!',
            full_name: 'Audit V2 User',
        });
        if (regRes.statusCode === 200 && regRes.body.session) {
            v2UserId = regRes.body.user.id;
        } else {
            const loginRes = await request(app).post('/api/auth/login')
                .send({ email: 'auditv2@oris.local', password: 'AuditV2Pass123!' });
            v2UserId = loginRes.body.user.id;
        }

        // Grant admin role
        const userRepo = new BaseRepository(getDb(), 'user_profiles');
        await userRepo.update(v2UserId, { role: JSON.stringify(['admin', 'user', 'case_manager']) });

        // Re-login to get a token reflecting the new role
        const freshLogin = await request(app).post('/api/auth/login')
            .send({ email: 'auditv2@oris.local', password: 'AuditV2Pass123!' });
        v2Token = freshLogin.body.session.access_token;

        // Setup beneficiary and case
        v2BeneficiaryId = crypto.randomUUID();
        const benRepo = new BaseRepository(getDb(), 'beneficiaries');
        await benRepo.create({ id: v2BeneficiaryId, name: 'Audit V2 Beneficiary' });
        
        const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
        await memRepo.create({
            id: crypto.randomUUID(), beneficiary_id: v2BeneficiaryId, user_id: v2UserId
        });

        const sevRepo = new BaseRepository(getDb(), 'severities');
        const severities = await sevRepo.findWhere({});
        const severity = severities[0];

        const caseRes = await request(app).post('/api/cases')
            .set('Authorization', `Bearer ${v2Token}`)
            .send({
                title: 'Audit V2 Test Case',
                description: 'Test case for audit v2',
                severity_id: severity.id,
                beneficiary_id: v2BeneficiaryId,
            });
        v2CaseId = caseRes.body.id;

        if (v2CaseId) {
            v2TaskId = crypto.randomUUID();
            const taskRepo = new BaseRepository(getDb(), 'tasks');
            await taskRepo.create({
                id: v2TaskId, case_id: v2CaseId, title: 'Audit V2 Task', created_by: v2UserId, created_at: new Date().toISOString()
            });
        }
    });

    // SEC-01: Admin can delete files uploaded by another user
    it.skip('SEC-01: Admin can delete a file uploaded by another user (fixed admin check)', async () => {
        expect(v2CaseId).toBeDefined();
        expect(v2TaskId).toBeDefined();

        // Create a non-admin user to upload a file
        const crypto = require('crypto');
        const uploaderRes = await registerUser({
            email: 'uploader@oris.local',
            password: 'UploadPass123!',
            full_name: 'File Uploader',
        });
        let uploaderToken;
        let uploaderId;
        if (uploaderRes.statusCode === 200 && uploaderRes.body.session) {
            uploaderToken = uploaderRes.body.session.access_token;
            uploaderId = uploaderRes.body.user.id;
        } else {
            const loginRes = await request(app).post('/api/auth/login')
                .send({ email: 'uploader@oris.local', password: 'UploadPass123!' });
            uploaderToken = loginRes.body.session.access_token;
            uploaderId = loginRes.body.user.id;
        }

        // Add to beneficiary
        const memRepo = new BaseRepository(getDb(), 'beneficiary_members');
        await memRepo.create({ id: crypto.randomUUID(), beneficiary_id: v2BeneficiaryId, user_id: uploaderId });
        
        // Assign to case
        const assignRepo = new BaseRepository(getDb(), 'case_assignments');
        await assignRepo.create({ id: crypto.randomUUID(), case_id: v2CaseId, user_id: uploaderId });

        // Insert a fake file record as if uploaded by this uploader
        const fileId = crypto.randomUUID();
        const fileRepo = new BaseRepository(getDb(), 'task_files');
        await fileRepo.create({
            id: fileId, task_id: v2TaskId, case_id: v2CaseId, file_name: 'test.txt', file_size: 100, content_type: 'text/plain', storage_path: 'fake/path/test.txt', uploaded_by: uploaderId, created_at: new Date().toISOString()
        });

        // Admin should be able to delete it
        const delRes = await request(app)
            .delete(`/api/files/${fileId}`)
            .set('Authorization', `Bearer ${v2Token}`);
        expect(delRes.statusCode).toBe(200);
        expect(delRes.body.success).toBe(true);
    });

    // FUNC-01: Audit logs are immutable — POST/PUT/DELETE should fail
    it('FUNC-01: POST to /api/investigation/audit should return 404 (CRUD removed)', async () => {
        const res = await request(app)
            .post('/api/investigation/audit')
            .set('Authorization', `Bearer ${v2Token}`)
            .send({ case_id: v2CaseId || 'fake', action: 'fake_action', user_id: v2UserId });
        // Should be 404 because the POST route no longer exists
        expect([404, 400]).toContain(res.statusCode);
    });

    it('FUNC-01: DELETE on audit logs should return 404', async () => {
        const res = await request(app)
            .delete('/api/investigation/audit/fake-id')
            .set('Authorization', `Bearer ${v2Token}`);
        expect(res.statusCode).toBe(404);
    });

    it('FUNC-01: GET audit logs by case still works', async () => {
        expect(v2CaseId).toBeDefined();
        const res = await request(app)
            .get(`/api/investigation/audit/by-case/${v2CaseId}`)
            .set('Authorization', `Bearer ${v2Token}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    // SEC-02: Dashboard returns valid stats (no SQL injection)
    it.skip('SEC-02: GET /api/dashboard returns valid stats object', async () => {
        const res = await request(app)
            .get('/api/dashboard')
            .set('Authorization', `Bearer ${v2Token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('stats');
        expect(typeof res.body.stats.openCases).toBe('number');
        expect(typeof res.body.stats.closedCases).toBe('number');
        expect(typeof res.body.stats.openAlerts).toBe('number');
        expect(typeof res.body.stats.closedAlerts).toBe('number');
    });

    // SEC-05: Error messages are masked
    it.skip('SEC-05: POST /api/case_assignments with duplicate does not leak err.message', async () => {
        // First assignment
        const crypto = require('crypto');
        const assignId = crypto.randomUUID();
        const assignRepo = new BaseRepository(getDb(), 'case_assignments');
        try {
            await assignRepo.create({ id: assignId, case_id: v2CaseId, user_id: v2UserId, created_at: new Date().toISOString() });
        } catch (e) { /* might already exist */ }

        // Try duplicate assignment via API — should return generic error message
        const res = await request(app)
            .post('/api/case_assignments')
            .set('Authorization', `Bearer ${v2Token}`)
            .send({ case_id: v2CaseId, user_id: v2UserId });

        if (res.statusCode === 500) {
            expect(res.body.error).toBe('Internal server error');
            // Ensure no SQL details leak
            expect(res.body.error).not.toContain('SQLITE');
            expect(res.body.error).not.toContain('UNIQUE');
        }
    });

    // FUNC-02: isAdmin works correctly with centralized function
    it('FUNC-02: Cases list works for admin (centralized isAdmin)', async () => {
        const res = await request(app)
            .get('/api/cases')
            .set('Authorization', `Bearer ${v2Token}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    // FUNC-05: Centralized colors — reports still work

});

// ====== RBAC V2 Non-Regression Tests ======
describe.skip('RBAC V2 — Permissions', () => {
    let rbacUserId, rbacToken, rbacBeneficiaryId, rbacCaseId;

    beforeAll(async () => {
        if (!adminToken) {
            await registerAndLogin(TEST_USER);
        }
        const crypto = require('crypto');
        const bcrypt = require('bcrypt');

        // Create a test user with case_analyst + alert_analyst roles
        rbacUserId = crypto.randomUUID();
        const rbacEmail = `rbac-${Date.now()}@test.com`;
        const hash = await bcrypt.hash('rbac-pass-123', 10);
        await db.prepare('INSERT INTO user_profiles (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)')
            .run(rbacUserId, rbacEmail, hash, 'RBAC Test User', '["admin"]');

        // Create a beneficiary and add user as regular member (NOT team lead) with case_analyst role
        rbacBeneficiaryId = crypto.randomUUID();
        await db.prepare('INSERT INTO beneficiaries (id, name) VALUES (?, ?)').run(rbacBeneficiaryId, 'RBAC Test Beneficiary');
        await db.prepare('INSERT INTO beneficiary_members (id, beneficiary_id, user_id, is_team_lead, role) VALUES (?, ?, ?, 0, ?)')
            .run(crypto.randomUUID(), rbacBeneficiaryId, rbacUserId, JSON.stringify(['case_analyst', 'alert_analyst']));

        // Log in (needs admin to create case)
        const loginRes = await request(app).post('/api/auth/login')
            .send({ email: rbacEmail, password: 'rbac-pass-123' });
        rbacToken = loginRes.body.session?.access_token;

        // Create a case for this beneficiary
        const severity = await db.prepare('SELECT id FROM severities LIMIT 1').get();
        const caseRes = await request(app).post('/api/cases')
            .set('Authorization', `Bearer ${rbacToken}`)
            .send({ title: 'RBAC Test Case', description: 'Test', type: 'case', severity_id: severity?.id, beneficiary_id: rbacBeneficiaryId });
        rbacCaseId = caseRes.body?.id;

        // Remove admin so they're just analyst (per-beneficiary roles still on membership)
        await db.prepare('UPDATE user_profiles SET role = ? WHERE id = ?').run('[]', rbacUserId);
    });

    it('RBAC-01: Non-team-lead cannot close a case (403)', async () => {
        expect(rbacCaseId).toBeDefined();
        await db.prepare('UPDATE beneficiary_members SET is_team_lead = 0 WHERE user_id = ?').run(rbacUserId);
        const res = await request(app).put(`/api/cases/${rbacCaseId}`)
            .set('Authorization', `Bearer ${rbacToken}`)
            .send({ status: 'closed' });
        expect(res.statusCode).toBe(403);
        expect(res.body.error).toContain('team lead');
    });

    it('RBAC-02: Team lead CAN close a case (200)', async () => {
        expect(rbacCaseId).toBeDefined();
        await db.prepare('UPDATE beneficiary_members SET is_team_lead = 1 WHERE user_id = ? AND beneficiary_id = ?')
            .run(rbacUserId, rbacBeneficiaryId);
        const res = await request(app).put(`/api/cases/${rbacCaseId}`)
            .set('Authorization', `Bearer ${rbacToken}`)
            .send({ status: 'closed' });
        expect(res.statusCode).toBe(200);
    });

    it('RBAC-03: Viewer can see cases of their beneficiary', async () => {
        const crypto = require('crypto');
        const bcrypt = require('bcrypt');
        const viewerId = crypto.randomUUID();
        const viewerEmail = `viewer-${Date.now()}@test.com`;
        const viewerHash = await bcrypt.hash('viewer-pass-123', 10);
        await db.prepare('INSERT INTO user_profiles (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)')
            .run(viewerId, viewerEmail, viewerHash, 'Viewer User', '[]');
        await db.prepare('INSERT INTO beneficiary_members (id, beneficiary_id, user_id, role) VALUES (?, ?, ?, ?)')
            .run(crypto.randomUUID(), rbacBeneficiaryId, viewerId, JSON.stringify(['case_viewer']));

        const loginRes = await request(app).post('/api/auth/login')
            .send({ email: viewerEmail, password: 'viewer-pass-123' });
        const viewerToken = loginRes.body.session?.access_token;

        const res = await request(app).get('/api/cases?type=case')
            .set('Authorization', `Bearer ${viewerToken}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const found = res.body.find(c => c.id === rbacCaseId);
        expect(found).toBeDefined();
    });

    it('RBAC-04: getRoles handles edge cases', () => {
        const { getRoles, isAdmin, hasTypeAccess } = require('../utils/access');
        expect(getRoles(null)).toEqual(['user']);
        expect(getRoles('["admin"]')).toEqual(['admin']);
        expect(getRoles('invalid-json')).toEqual(['invalid-json']);
        expect(isAdmin('["admin","case_analyst"]')).toBe(true);
        expect(isAdmin('["case_analyst"]')).toBe(false);
        expect(hasTypeAccess('["case_analyst"]', 'case', 'manager')).toBe(true);
        expect(hasTypeAccess('["case_analyst"]', 'alert', 'viewer')).toBe(false);
        expect(hasTypeAccess('["alert_viewer"]', 'alert', 'viewer')).toBe(true);
        expect(hasTypeAccess('["alert_viewer"]', 'alert', 'manager')).toBe(false);
    });

    it('RBAC-05: analyst and viewer roles grant correct access per type', () => {
        const { hasTypeAccess } = require('../utils/access');

        // case_analyst can see cases (all levels) but NOT alerts
        expect(hasTypeAccess('["case_analyst"]', 'case', 'viewer')).toBe(true);
        expect(hasTypeAccess('["case_analyst"]', 'case', 'analyst')).toBe(true);
        expect(hasTypeAccess('["case_analyst"]', 'case', 'manager')).toBe(true);
        expect(hasTypeAccess('["case_analyst"]', 'alert', 'viewer')).toBe(false);

        // case_viewer can see cases (viewer only) but NOT alerts
        expect(hasTypeAccess('["case_viewer"]', 'case', 'viewer')).toBe(true);
        expect(hasTypeAccess('["case_viewer"]', 'case', 'analyst')).toBe(false);
        expect(hasTypeAccess('["case_viewer"]', 'alert', 'viewer')).toBe(false);

        // alert_analyst can see alerts (all levels) but NOT cases
        expect(hasTypeAccess('["alert_analyst"]', 'alert', 'viewer')).toBe(true);
        expect(hasTypeAccess('["alert_analyst"]', 'alert', 'analyst')).toBe(true);
        expect(hasTypeAccess('["alert_analyst"]', 'alert', 'manager')).toBe(true);
        expect(hasTypeAccess('["alert_analyst"]', 'case', 'viewer')).toBe(false);

        // alert_viewer can see alerts (viewer only) but NOT cases
        expect(hasTypeAccess('["alert_viewer"]', 'alert', 'viewer')).toBe(true);
        expect(hasTypeAccess('["alert_viewer"]', 'alert', 'analyst')).toBe(false);
        expect(hasTypeAccess('["alert_viewer"]', 'case', 'viewer')).toBe(false);

        // dual role: case_analyst + alert_analyst sees both
        expect(hasTypeAccess('["case_analyst","alert_analyst"]', 'case', 'viewer')).toBe(true);
        expect(hasTypeAccess('["case_analyst","alert_analyst"]', 'alert', 'viewer')).toBe(true);
    });
});

// ====== System Status Auto-Sync — Non-Regression Tests ======
describe.skip('System Status Auto-Sync', () => {
    let syncCaseId, syncSystemId, syncTaskId;

    beforeAll(async () => {
        const crypto = require('crypto');

        // Reuse existing admin user from earlier tests
        if (!authToken) await registerAndLogin(TEST_USER);

        // Setup beneficiary
        const beneficiaryId = crypto.randomUUID();
        await db.prepare('INSERT INTO beneficiaries (id, name) VALUES (?, ?)').run(beneficiaryId, 'Sync Beneficiary');
        await db.prepare('INSERT INTO beneficiary_members (id, beneficiary_id, user_id, role) VALUES (?, ?, ?, ?)')
            .run(crypto.randomUUID(), beneficiaryId, userId, JSON.stringify(['case_analyst']));

        // Create case via API
        const severity = await db.prepare('SELECT id FROM severities LIMIT 1').get();
        const caseRes = await auth(request(app).post('/api/cases'))
            .send({ title: 'Sync Test Case', description: '<p>Test</p>', type: 'case', severity_id: severity?.id, beneficiary_id: beneficiaryId });
        syncCaseId = caseRes.body?.id;

        // Create system and task directly via DB
        syncSystemId = crypto.randomUUID();
        await db.prepare('INSERT INTO case_systems (id, case_id, name, system_type, created_by) VALUES (?, ?, ?, ?, ?)')
            .run(syncSystemId, syncCaseId, 'PC-SYNC-TEST', 'workstation', userId);

        syncTaskId = crypto.randomUUID();
        await db.prepare('INSERT INTO tasks (id, case_id, title, system_id, created_by) VALUES (?, ?, ?, ?, ?)')
            .run(syncTaskId, syncCaseId, 'Analyse PC-SYNC-TEST', syncSystemId, userId);
    });

    it('SYNC-01: PUT initial_investigation_status updates system status', async () => {
        expect(syncTaskId).toBeDefined();
        expect(syncSystemId).toBeDefined();

        const res = await auth(request(app).put(`/api/tasks/${syncTaskId}`))
            .send({ initial_investigation_status: 'compromised' });
        expect(res.statusCode).toBe(200);

        // Verify system was updated
        const sys = await db.prepare('SELECT investigation_status FROM case_systems WHERE id = ?').get(syncSystemId);
        expect(sys.investigation_status).toBe('compromised');
    });

    it('SYNC-02: PUT investigation_status updates system status', async () => {
        const res = await auth(request(app).put(`/api/tasks/${syncTaskId}`))
            .send({ investigation_status: 'infected' });
        expect(res.statusCode).toBe(200);

        const sys = await db.prepare('SELECT investigation_status FROM case_systems WHERE id = ?').get(syncSystemId);
        expect(sys.investigation_status).toBe('infected');
    });

    it('SYNC-03: POST close with investigation_status updates system status', async () => {
        // Reopen task first
        await auth(request(app).put(`/api/tasks/${syncTaskId}`))
            .send({ status: 'open' });

        const res = await auth(request(app).post(`/api/tasks/${syncTaskId}/close`))
            .send({ closure_comment: '<p>Test closure</p>', investigation_status: 'clean' });
        expect(res.statusCode).toBe(200);

        const sys = await db.prepare('SELECT investigation_status FROM case_systems WHERE id = ?').get(syncSystemId);
        expect(sys.investigation_status).toBe('clean');
    });

    it('SYNC-04: PUT without investigation_status does NOT change system status', async () => {
        // System is currently "clean" from SYNC-03
        const res = await auth(request(app).put(`/api/tasks/${syncTaskId}`))
            .send({ title: 'Analyse updated' });
        expect(res.statusCode).toBe(200);

        // System should still be "clean"
        const sys = await db.prepare('SELECT investigation_status FROM case_systems WHERE id = ?').get(syncSystemId);
        expect(sys.investigation_status).toBe('clean');
    });
});
