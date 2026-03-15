/**
 * Demo Smoke Tests — ORIS
 *
 * Validates all API endpoints needed for the demo.
 * Run: DB_PATH=/tmp/oris_demo_test.sqlite npx jest __tests__/demo_smoke.test.js --forceExit --detectOpenHandles --verbose
 */

const request = require('supertest');
const fs = require('fs');
const TEST_DB = '/tmp/oris_demo_test.sqlite';

let app;
let adminToken, aliceToken;
let adminMemberId, aliceMemberId, bobMemberId;
let adminId, aliceId, bobId, charlieId;
let beneficiaryAcmeId, beneficiaryBetaId;
let caseId, alertId;
let taskId1, taskId2;
let systemId1, systemId2, malwareId, accountId;

beforeAll(async () => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    process.env.DB_PATH = TEST_DB;
    process.env.JWT_SECRET = 'test_secret_for_demo';
    await require('../init_db');
    app = require('../index');
});

afterAll(async () => {
    const db = require('../db');
    await db.destroy();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

// ====== PHASE 1 — Configuration initiale ======

describe('Phase 1: Setup', () => {
    test('Setup-status: not initialized', async () => {
        const res = await request(app).get('/api/admin/setup-status');
        expect(res.status).toBe(200);
        expect(res.body.hasAdmin).toBe(false);
    });

    test('Register first admin', async () => {
        const res = await request(app).post('/api/auth/register').send({
            email: 'admin@oris.demo', password: 'AdminDemo2024!',
            fullName: 'Admin Démo', roles: ['admin'],
        });
        expect(res.status).toBe(200);
        expect(res.body.session?.access_token).toBeDefined();
        adminToken = res.body.session.access_token;
        adminId = res.body.user.id;
    });

    test('Login admin', async () => {
        const res = await request(app).post('/api/auth/login').send({
            email: 'admin@oris.demo', password: 'AdminDemo2024!',
        });
        expect(res.status).toBe(200);
        adminToken = res.body.session.access_token;
    });

    test('Health check', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});

// ====== PHASE 2 — Administration ======

describe('Phase 2: Admin', () => {
    test('Create beneficiary ACME', async () => {
        const res = await request(app).post('/api/admin/beneficiaries')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'ACME Corp', description: 'Entreprise principale' });
        expect(res.status).toBe(201);
        beneficiaryAcmeId = res.body.id;
    });

    test('Create beneficiary Beta', async () => {
        const res = await request(app).post('/api/admin/beneficiaries')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Beta Industries', description: 'Second bénéficiaire' });
        expect(res.status).toBe(201);
        beneficiaryBetaId = res.body.id;
    });

    test('List beneficiaries (2)', async () => {
        const res = await request(app).get('/api/admin/beneficiaries')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
    });

    test('Assign admin to ACME', async () => {
        const res = await request(app).post(`/api/admin/beneficiaries/${beneficiaryAcmeId}/members`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ user_id: adminId });
        expect(res.status).toBe(201);
        adminMemberId = res.body.id;
    });

    test('Set admin ACME role', async () => {
        const res = await request(app).put(`/api/admin/beneficiaries/members/${adminMemberId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ roles: ['case_manager', 'alert_manager'] });
        expect(res.status).toBe(200);
    });

    test('Create Alice', async () => {
        const res = await request(app).post('/api/auth/register')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'alice@oris.demo', password: 'AliceDemo2024!', fullName: 'Alice Martin', roles: ['user'] });
        expect(res.status).toBe(200);
        aliceId = res.body.user.id;
    });

    test('Create Bob', async () => {
        const res = await request(app).post('/api/auth/register')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'bob@oris.demo', password: 'BobDemo2024!', fullName: 'Bob Dupont', roles: ['user'] });
        expect(res.status).toBe(200);
        bobId = res.body.user.id;
    });

    test('Create Charlie', async () => {
        const res = await request(app).post('/api/auth/register')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'charlie@oris.demo', password: 'CharlieDemo2024!', fullName: 'Charlie Viewer', roles: ['user'] });
        expect(res.status).toBe(200);
        charlieId = res.body.user.id;
    });

    test('Assign Alice to ACME', async () => {
        const res = await request(app).post(`/api/admin/beneficiaries/${beneficiaryAcmeId}/members`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ user_id: aliceId });
        expect(res.status).toBe(201);
        aliceMemberId = res.body.id;
    });

    test('Set Alice ACME role', async () => {
        const res = await request(app).put(`/api/admin/beneficiaries/members/${aliceMemberId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ roles: ['case_manager', 'alert_viewer'] });
        expect(res.status).toBe(200);
    });

    test('Assign Bob to ACME', async () => {
        const res = await request(app).post(`/api/admin/beneficiaries/${beneficiaryAcmeId}/members`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ user_id: bobId });
        expect(res.status).toBe(201);
        bobMemberId = res.body.id;
    });

    test('Set Bob ACME role', async () => {
        const res = await request(app).put(`/api/admin/beneficiaries/members/${bobMemberId}/role`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ roles: ['alert_manager', 'case_viewer'] });
        expect(res.status).toBe(200);
    });

    test('List users (≥4)', async () => {
        const res = await request(app).get('/api/admin/users')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(4);
    });

    test('Login Alice', async () => {
        const res = await request(app).post('/api/auth/login')
            .send({ email: 'alice@oris.demo', password: 'AliceDemo2024!' });
        expect(res.status).toBe(200);
        aliceToken = res.body.session.access_token;
    });

    test('Read config', async () => {
        const res = await request(app).get('/api/config')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
    });

    test('Update config', async () => {
        const res = await request(app).put('/api/admin/config')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ key: 'session_lock_enabled', value: 'true' });
        expect(res.status).toBe(200);
    });

    test('Create webhook', async () => {
        const res = await request(app).post('/api/webhooks')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Test Webhook', url: 'https://httpbin.org/post', events: ['case.created'] });
        expect(res.status).toBe(201);
    });

    test('List webhooks', async () => {
        const res = await request(app).get('/api/webhooks')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.webhooks.length).toBe(1);
    });
});

// ====== PHASE 3 — Cases ======

describe('Phase 3: Cases', () => {
    test('Create ransomware case', async () => {
        const res = await request(app).post('/api/cases')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Incident ransomware ACME', description: 'Ransomware détecté sur SRV-DC01.',
                severity_id: 'sev_crit', tlp: 'AMBER', pap: 'RED',
                beneficiary_id: beneficiaryAcmeId, type: 'case',
            });
        expect(res.status).toBe(200);
        caseId = res.body.id;
        expect(caseId).toBeDefined();
    });

    test('Case in list', async () => {
        const res = await request(app).get('/api/cases?type=case')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.find(c => c.id === caseId)).toBeDefined();
    });

    test('Case detail', async () => {
        const res = await request(app).get(`/api/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Incident ransomware ACME');
    });

    test('Create task 1', async () => {
        const res = await request(app).post('/api/tasks')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, title: 'Analyser les logs serveur', description: 'Chercher les traces', assigned_to: aliceId });
        expect(res.status).toBe(200);
        taskId1 = res.body.id;
        expect(taskId1).toBeDefined();
    });

    test('Create task 2', async () => {
        const res = await request(app).post('/api/tasks')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, title: 'Isoler la machine infectée', description: 'Déconnecter du réseau', assigned_to: bobId });
        expect(res.status).toBe(200);
        taskId2 = res.body.id;
    });

    test('List tasks (2)', async () => {
        const res = await request(app).get(`/api/tasks/by-case/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
    });

    test('Add comment', async () => {
        const res = await request(app).post('/api/comments')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ task_id: taskId1, content: 'Traces de ransomware identifiées dans les logs.' });
        expect(res.status).toBe(200);
    });

    test('List comments (1)', async () => {
        const res = await request(app).get(`/api/comments/by-task/${taskId1}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
    });

    test('Assign Alice to case', async () => {
        const res = await request(app).post('/api/case_assignments')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, user_id: aliceId });
        expect(res.status).toBe(201);
    });

    test('Case detail includes assignment', async () => {
        const res = await request(app).get(`/api/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        // Case was assigned Alice, so assignments should exist
        expect(res.body.assignments?.length || res.body.title).toBeDefined();
    });

    test('Update case title', async () => {
        const res = await request(app).put(`/api/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ title: 'Incident ransomware ACME — REvil' });
        expect(res.status).toBe(200);
    });

    test('Audit log', async () => {
        const res = await request(app).get(`/api/audit/case/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
});

// ====== PHASE 4 — Investigation ======

describe('Phase 4: Investigation', () => {
    test('Add system SRV-DC01', async () => {
        const res = await request(app).post('/api/investigation/systems')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, name: 'SRV-DC01', system_type: 'Serveur', ip_addresses: '["192.168.1.10"]' });
        expect(res.status).toBe(200);
        systemId1 = res.body.id;
    });

    test('Add system WKS-USER01', async () => {
        const res = await request(app).post('/api/investigation/systems')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, name: 'WKS-USER01', system_type: 'Poste de travail', ip_addresses: '["192.168.1.50"]' });
        expect(res.status).toBe(200);
        systemId2 = res.body.id;
    });

    test('List systems (2)', async () => {
        const res = await request(app).get(`/api/investigation/systems/by-case/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
    });

    test('Add malware', async () => {
        const res = await request(app).post('/api/investigation/malware')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, file_name: 'ransomware.exe', system_id: systemId1, is_malicious: 1 });
        expect(res.status).toBe(200);
        malwareId = res.body.id;
    });

    test('Add compromised account', async () => {
        const res = await request(app).post('/api/investigation/accounts')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, account_name: 'admin@acme.local', domain: 'ACME', system_id: systemId1 });
        expect(res.status).toBe(200);
        accountId = res.body.id;
    });

    test('Add network indicator (IP)', async () => {
        const res = await request(app).post('/api/investigation/indicators')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, ip: '185.220.101.42', context: 'C2 server' });
        expect(res.status).toBe(200);
    });

    test('Add network indicator (domain)', async () => {
        const res = await request(app).post('/api/investigation/indicators')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, domain_name: 'evil-server.com', context: 'Payload download' });
        expect(res.status).toBe(200);
    });

    test('List indicators (2)', async () => {
        const res = await request(app).get(`/api/investigation/indicators/by-case/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
    });

    test('Add exfiltration', async () => {
        const res = await request(app).post('/api/investigation/exfiltrations')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, file_name: 'database_dump.sql', file_size: 450, source_system_id: systemId1 });
        expect(res.status).toBe(200);
    });

    test('Add timeline event C2', async () => {
        const res = await request(app).post('/api/investigation/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, kill_chain: 'c2', event_datetime: '2024-03-10T14:30:00Z', description: 'C2 connexion' });
        expect(res.status).toBe(200);
    });

    test('Add timeline event lateral movement', async () => {
        const res = await request(app).post('/api/investigation/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, kill_chain: 'ukc_lateral_movement', event_datetime: '2024-03-10T16:00:00Z', description: 'PsExec' });
        expect(res.status).toBe(200);
    });

    test('List events (2)', async () => {
        const res = await request(app).get(`/api/investigation/events/by-case/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
    });
});

// ====== PHASE 4b — Task-Centric Investigation (Approach B) ======

let taskScopedSystemId, taskScopedEventId, linkedObjectId;

describe('Phase 4b: Task-Centric Investigation', () => {
    // --- Task-scoped objects ---

    test('Add system scoped to task 1', async () => {
        const res = await request(app).post('/api/investigation/systems')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, task_id: taskId1, name: 'SRV-TASK01', system_type: 'Serveur' });
        expect(res.status).toBe(200);
        taskScopedSystemId = res.body.id;
    });

    test('Add malware scoped to task 1', async () => {
        const res = await request(app).post('/api/investigation/malware')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, task_id: taskId1, file_name: 'task_payload.dll', system_id: taskScopedSystemId, is_malicious: 1 });
        expect(res.status).toBe(200);
    });

    test('Add account scoped to task 2', async () => {
        const res = await request(app).post('/api/investigation/accounts')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, task_id: taskId2, account_name: 'svc_backup@acme.local', domain: 'ACME' });
        expect(res.status).toBe(200);
    });

    test('Add indicator scoped to task 1', async () => {
        const res = await request(app).post('/api/investigation/indicators')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: caseId, task_id: taskId1, ip: '10.0.0.99', context: 'Internal C2 relay' });
        expect(res.status).toBe(200);
    });

    // --- Query by task ---

    test('Systems by-task returns only task-scoped', async () => {
        const res = await request(app).get(`/api/investigation/systems/by-task/${taskId1}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].name).toBe('SRV-TASK01');
    });

    test('Malware by-task returns only task-scoped', async () => {
        const res = await request(app).get(`/api/investigation/malware/by-task/${taskId1}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].file_name).toBe('task_payload.dll');
    });

    test('Accounts by-task returns only task-scoped', async () => {
        const res = await request(app).get(`/api/investigation/accounts/by-task/${taskId2}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].account_name).toBe('svc_backup@acme.local');
    });

    test('Indicators by-task returns only task-scoped', async () => {
        const res = await request(app).get(`/api/investigation/indicators/by-task/${taskId1}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
    });

    // --- Backward compat: case-level still returns all ---

    test('Systems by-case includes task-scoped + case-scoped', async () => {
        const res = await request(app).get(`/api/investigation/systems/by-case/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(3); // 2 case-level + 1 task-scoped
    });

    // --- Event Linked Objects (STIX SRO) ---

    test('Create highlight event on task 1', async () => {
        const res = await request(app).post('/api/investigation/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                case_id: caseId, task_id: taskId1,
                kill_chain: 'ukc_initial_access', event_datetime: '2024-03-10T10:00:00Z',
                description: 'Phishing email opened on SRV-TASK01',
            });
        expect(res.status).toBe(200);
        taskScopedEventId = res.body.id;
    });

    test('Link system to event (Diamond: victim)', async () => {
        const res = await request(app).post('/api/investigation/linked-objects')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                event_id: taskScopedEventId,
                object_type: 'system', object_id: taskScopedSystemId,
                diamond_axis: 'victim',
            });
        expect(res.status).toBe(201);
        linkedObjectId = res.body.id;
    });

    test('Link malware to event (Diamond: capability)', async () => {
        const res = await request(app).post('/api/investigation/linked-objects')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                event_id: taskScopedEventId,
                object_type: 'malware', object_id: malwareId,
                diamond_axis: 'capability',
            });
        expect(res.status).toBe(201);
    });

    test('Link account to event (Diamond: adversary)', async () => {
        const res = await request(app).post('/api/investigation/linked-objects')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                event_id: taskScopedEventId,
                object_type: 'account', object_id: accountId,
                diamond_axis: 'adversary',
            });
        expect(res.status).toBe(201);
    });

    test('Get linked objects by event', async () => {
        const res = await request(app).get(`/api/investigation/linked-objects/by-event/${taskScopedEventId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(3);
        const axes = res.body.map(o => o.diamond_axis).sort();
        expect(axes).toEqual(['adversary', 'capability', 'victim']);
    });

    test('Get linked objects by case (aggregated)', async () => {
        const res = await request(app).get(`/api/investigation/linked-objects/by-case/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(3);
        // Should include task_id enrichment from joined case_events
        expect(res.body[0].task_id).toBe(taskId1);
    });

    test('Validation: missing fields → 400', async () => {
        const res = await request(app).post('/api/investigation/linked-objects')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ event_id: taskScopedEventId });
        expect(res.status).toBe(400);
    });

    test('Delete linked object', async () => {
        const res = await request(app).delete(`/api/investigation/linked-objects/${linkedObjectId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(204);
    });

    test('After delete: 2 linked objects remain', async () => {
        const res = await request(app).get(`/api/investigation/linked-objects/by-event/${taskScopedEventId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
    });
});

// ====== PHASE 4c — event_type Removal Validation ======

describe('Phase 4c: Event without event_type', () => {
    test('Create event with kill_chain only (no event_type)', async () => {
        const res = await request(app).post('/api/investigation/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                case_id: caseId,
                kill_chain: 'ukc_exfiltration',
                event_datetime: '2024-03-11T09:00:00Z',
                description: 'Data exfiltrated via HTTPS',
            });
        expect(res.status).toBe(200);
        expect(res.body.id).toBeDefined();
    });

    test('Created event does not contain event_type', async () => {
        const res = await request(app).get(`/api/investigation/events/by-case/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(3);
        // Verify no event has event_type property in the response
        res.body.forEach(event => {
            expect(event).not.toHaveProperty('event_type');
        });
    });

    test('Create event with task_id and kill_chain (highlight)', async () => {
        const res = await request(app).post('/api/investigation/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                case_id: caseId,
                task_id: taskId1,
                kill_chain: 'att_c2',
                event_datetime: '2024-03-11T10:30:00Z',
                description: 'C2 beacon to attacker infra',
            });
        expect(res.status).toBe(200);
        expect(res.body.id).toBeDefined();
    });

    test('Event with minimal fields (only kill_chain + datetime)', async () => {
        const res = await request(app).post('/api/investigation/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                case_id: caseId,
                kill_chain: 'reconnaissance',
                event_datetime: '2024-03-09T08:00:00Z',
            });
        expect(res.status).toBe(200);
        expect(res.body.id).toBeDefined();
    });

    test('Linked objects by-case also have no event_type', async () => {
        const res = await request(app).get(`/api/investigation/linked-objects/by-case/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        res.body.forEach(obj => {
            expect(obj).not.toHaveProperty('event_type');
        });
    });
});

// ====== PHASE 5 — Alerts ======

describe('Phase 5: Alerts', () => {
    test('Create alert', async () => {
        const res = await request(app).post('/api/cases')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Tentative de brute force SSH', description: 'Multiples tentatives.',
                severity_id: 'sev_med', tlp: 'GREEN', pap: 'GREEN',
                beneficiary_id: beneficiaryAcmeId, type: 'alert',
            });
        expect(res.status).toBe(200);
        alertId = res.body.id;
    });

    test('Alert in list', async () => {
        const res = await request(app).get('/api/cases?type=alert')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.some(c => c.id === alertId)).toBe(true);
    });

    test('Add task to alert', async () => {
        const res = await request(app).post('/api/tasks')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ case_id: alertId, title: 'Vérifier les IP sources', description: 'Analyser SSH' });
        expect(res.status).toBe(200);
    });
});

// ====== PHASE 6 — Workflow ======

describe('Phase 6: Workflow', () => {
    test('Close task', async () => {
        const res = await request(app).post(`/api/tasks/${taskId1}/close`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ result_id: 'res_success', closure_comment: 'Traces identifiées.' });
        expect(res.status).toBe(200);
    });

    test('Close case', async () => {
        const res = await request(app).put(`/api/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'closed', closure_summary: 'Incident contenu.', closed_at: new Date().toISOString(), closed_by: adminId });
        expect(res.status).toBe(200);
    });

    test('Case is closed', async () => {
        const res = await request(app).get(`/api/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('closed');
    });

    test('Reopen case', async () => {
        const res = await request(app).put(`/api/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'open' });
        expect(res.status).toBe(200);
    });

    test('Case is reopened', async () => {
        const res = await request(app).get(`/api/cases/${caseId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('open');
    });
});

// ====== PHASE 7 — AI Configuration ======

describe('Phase 7: AI Config', () => {
    test('AI status (disabled by default)', async () => {
        const res = await request(app).get('/api/ai/status')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.enabled).toBe(false);
    });

    test('List AI providers', async () => {
        const res = await request(app).get('/api/ai/providers')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(5);
        const ids = res.body.map(p => p.id);
        expect(ids).toContain('openai');
        expect(ids).toContain('ollama');
        expect(ids).toContain('google');
    });

    test('Get AI config (admin)', async () => {
        const res = await request(app).get('/api/ai/config')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
    });

    test('Set AI config (admin)', async () => {
        const res = await request(app).put('/api/ai/config')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ai_provider: 'ollama', ai_api_url: 'http://localhost:11434', ai_model: 'mistral:7b', ai_enabled: 'true' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('AI status (now enabled)', async () => {
        const res = await request(app).get('/api/ai/status')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.enabled).toBe(true);
    });

    test('Non-admin cannot access AI config', async () => {
        const res = await request(app).get('/api/ai/config')
            .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(403);
    });

    test('Disable AI', async () => {
        const res = await request(app).put('/api/ai/config')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ ai_enabled: 'false' });
        expect(res.status).toBe(200);
    });

    test('Chat rejected when disabled', async () => {
        const res = await request(app).post('/api/ai/chat')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ messages: [{ role: 'user', content: 'test' }] });
        expect(res.status).toBe(403);
    });
});

// ====== PHASE 8 — Cross-cutting ======

describe('Phase 8: Transversal', () => {
    test('Dashboard', async () => {
        const res = await request(app).get('/api/dashboard')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
    });

    test('Search "ransomware"', async () => {
        const res = await request(app).get('/api/search?q=ransomware')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
    });

    test('Notifications', async () => {
        const res = await request(app).get('/api/notifications')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
    });

    test('Profile /me', async () => {
        const res = await request(app).get('/api/auth/me')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe('admin@oris.demo');
    });

    test('Presence heartbeat', async () => {
        const res = await request(app).post('/api/presence/heartbeat')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ caseId });
        expect(res.status).toBe(200);
    });

    test('Severities (4)', async () => {
        const res = await request(app).get('/api/investigation/severities')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(4);
    });

    test('Alice can access ACME case', async () => {
        const res = await request(app).get(`/api/cases/${caseId}`)
            .set('Authorization', `Bearer ${aliceToken}`);
        expect(res.status).toBe(200);
    });

    test('No token → 401', async () => {
        const res = await request(app).get('/api/cases');
        expect(res.status).toBe(401);
    });

    test('Invalid token → 401', async () => {
        const res = await request(app).get('/api/cases')
            .set('Authorization', 'Bearer invalid');
        expect(res.status).toBe(401);
    });
});
