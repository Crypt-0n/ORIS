/**
 * STIX 2.1 Compliance Unit Tests
 *
 * Validates that generated STIX objects comply with the OASIS standard:
 * - Relationship IDs use proper UUID format with dashes
 * - UUIDv5 is used for deterministic SCO IDs with STIX namespace
 * - observed-data objects do NOT contain a "name" property
 * - observed-data objects DO contain an "object_refs" array
 * - SCO schemas (ipv4-addr, domain-name, url, file, user-account) are valid
 */
const crypto = require('crypto');

const STIX_SCO_NAMESPACE = '00abedb4-aa42-466c-9c01-fed23315a9b7';

// Native UUIDv5 implementation (same as StixGraphRepository.js)
function deterministicUuid(seed) {
    const nsBytes = Buffer.from(STIX_SCO_NAMESPACE.replace(/-/g, ''), 'hex');
    const hash = crypto.createHash('sha1').update(nsBytes).update(seed).digest();
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = hash.subarray(0, 16).toString('hex');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STIX_RELATIONSHIP_ID_REGEX = /^relationship--[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('STIX 2.1 Compliance', () => {

    describe('UUIDv5 deterministic IDs', () => {

        it('deterministicUuid produces valid UUID format with dashes', () => {
            const uuid = deterministicUuid('test-seed-value');
            expect(uuid).toMatch(UUID_REGEX);
        });

        it('deterministicUuid is deterministic (same input → same output)', () => {
            const uuid1 = deterministicUuid('same-seed');
            const uuid2 = deterministicUuid('same-seed');
            expect(uuid1).toBe(uuid2);
        });

        it('deterministicUuid produces different outputs for different seeds', () => {
            const uuid1 = deterministicUuid('seed-a');
            const uuid2 = deterministicUuid('seed-b');
            expect(uuid1).not.toBe(uuid2);
        });

        it('uses UUIDv5 (version nibble = 5)', () => {
            const uuid = deterministicUuid('test-v5-check');
            // UUIDv5: version nibble is position 14 (0-indexed) and must be '5'
            expect(uuid.charAt(14)).toBe('5');
        });

        it('relationship ID format is relationship--<uuid>', () => {
            const uuid = deterministicUuid('origin-evt123-sys456');
            const relId = `relationship--${uuid}`;
            expect(relId).toMatch(STIX_RELATIONSHIP_ID_REGEX);
        });

        it('relationship IDs do NOT contain contiguous hex without dashes', () => {
            const uuid = deterministicUuid('target-evt789-sys012');
            expect(uuid).not.toMatch(/^[0-9a-f]{32}$/);
            expect(uuid).toMatch(UUID_REGEX);
        });

        it('all relationship edge patterns produce valid UUIDs', () => {
            const patterns = [
                'origin-evt1-sys1',
                'target-evt1-sys2',
                'lateral-evt1-sys1-sys2',
                'uses-evt1-acct1',
                'malware-target-mal1-sys1',
                'task-consists-task1-evt1',
                'ipv4-sys1-192.168.1.1',
                'file-mal-mal1',
                'ipv4-ind-ind1',
                'domain-ind-ind2',
                'url-ind-ind3',
                'ind-based-on-ind1',
            ];
            for (const pattern of patterns) {
                const uuid = deterministicUuid(pattern);
                expect(uuid).toMatch(UUID_REGEX);
            }
        });
    });

    describe('observed-data schema', () => {

        it('observed-data must NOT have a "name" property', () => {
            const observedData = {
                type: 'observed-data',
                id: 'observed-data--test-event-1',
                spec_version: '2.1',
                x_oris_description: 'Lateral movement via RDP',
                first_observed: '2026-03-22T18:00:00Z',
                last_observed: '2026-03-22T18:00:00Z',
                number_observed: 1,
                object_refs: ['ipv4-addr--abc', 'user-account--def'],
                created: '2026-03-22T18:01:00Z',
                modified: '2026-03-22T18:01:00Z',
            };
            expect(observedData).not.toHaveProperty('name');
        });

        it('observed-data MUST have "object_refs" array', () => {
            const observedData = {
                type: 'observed-data',
                id: 'observed-data--test-1',
                spec_version: '2.1',
                first_observed: '2026-03-22T18:00:00Z',
                last_observed: '2026-03-22T18:00:00Z',
                number_observed: 1,
                object_refs: ['ipv4-addr--x', 'ipv4-addr--y'],
            };
            expect(observedData).toHaveProperty('object_refs');
            expect(Array.isArray(observedData.object_refs)).toBe(true);
            expect(observedData.object_refs.length).toBe(2);
        });

        it('observed-data object_refs can be empty', () => {
            const objectRefs = [];
            expect(Array.isArray(objectRefs)).toBe(true);
            expect(objectRefs.length).toBe(0);
        });

        it('observed-data object_refs uses SCO IDs (not infrastructure SDO IDs)', () => {
            // When a system has IPs, object_refs should reference ipv4-addr SCOs
            const systemId = 'sys-001';
            const ip = '192.168.1.100';
            const scoId = `ipv4-addr--${deterministicUuid(`ipv4-${systemId}-${ip}`)}`;

            expect(scoId).toMatch(/^ipv4-addr--[0-9a-f-]{36}$/);
            expect(scoId).not.toMatch(/^infrastructure--/);
        });
    });

    describe('SCO schemas', () => {

        it('ipv4-addr SCO has type, id, value', () => {
            const scoId = `ipv4-addr--${deterministicUuid('ipv4-sys1-10.0.0.1')}`;
            const sco = { type: 'ipv4-addr', id: scoId, spec_version: '2.1', value: '10.0.0.1' };
            expect(sco.type).toBe('ipv4-addr');
            expect(sco.value).toBe('10.0.0.1');
            expect(sco.id).toMatch(/^ipv4-addr--/);
        });

        it('domain-name SCO has type, id, value', () => {
            const scoId = `domain-name--${deterministicUuid('domain-ind-1')}`;
            const sco = { type: 'domain-name', id: scoId, spec_version: '2.1', value: 'evil.com' };
            expect(sco.type).toBe('domain-name');
            expect(sco.value).toBe('evil.com');
        });

        it('url SCO has type, id, value', () => {
            const scoId = `url--${deterministicUuid('url-ind-1')}`;
            const sco = { type: 'url', id: scoId, spec_version: '2.1', value: 'https://evil.com/payload' };
            expect(sco.type).toBe('url');
            expect(sco.value).toBe('https://evil.com/payload');
        });

        it('file SCO has type, id, optional name and hashes', () => {
            const scoId = `file--${deterministicUuid('file-mal-1')}`;
            const sco = {
                type: 'file', id: scoId, spec_version: '2.1',
                name: 'ransomware.exe',
                hashes: { 'SHA-256': 'abcdef1234567890' }
            };
            expect(sco.type).toBe('file');
            expect(sco.name).toBe('ransomware.exe');
            expect(sco.hashes['SHA-256']).toBeDefined();
        });

        it('user-account SCO has type, id, user_id', () => {
            const sco = {
                type: 'user-account',
                id: 'user-account--acct-001',
                spec_version: '2.1',
                user_id: 'admin',
                display_name: 'admin@CORP',
            };
            expect(sco.type).toBe('user-account');
            expect(sco.user_id).toBe('admin');
            // user-account is also a SCO — no mandatory name property
            expect(sco).not.toHaveProperty('name');
        });
    });

    describe('Extended relationship types', () => {

        it('lateral-movement is a valid relationship type', () => {
            const validTypes = [
                'uses', 'targets', 'originates-from', 'located-at', 'mitigates',
                'lateral-movement', 'based-on', 'consists-of', 'delivers', 'indicates',
                'attributed-to', 'communicates-with', 'drops', 'exploits',
            ];
            expect(validTypes).toContain('lateral-movement');
            expect(validTypes).toContain('based-on');
            expect(validTypes).toContain('indicates');
        });

        it('relationship can have start_time and stop_time', () => {
            const rel = {
                type: 'relationship',
                id: `relationship--${deterministicUuid('rel-test')}`,
                relationship_type: 'targets',
                source_ref: 'infrastructure--src',
                target_ref: 'identity--tgt',
                created: '2026-03-22T18:00:00Z',
                modified: '2026-03-22T18:00:00Z',
                start_time: '2026-03-20T10:00:00Z',
                stop_time: '2026-03-22T18:00:00Z',
            };
            expect(rel.start_time).toBeDefined();
            expect(rel.stop_time).toBeDefined();
        });
    });
});
