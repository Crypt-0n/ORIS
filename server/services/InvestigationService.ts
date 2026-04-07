import crypto from 'crypto';
import { getDb } from '../db-arango';
import BaseRepository from '../repositories/BaseRepository';
// @ts-ignore
import StixGraphRepository from '../repositories/StixGraphRepository';
import { logAudit } from '../utils/audit';

const STIX_SCO_NAMESPACE = '00abedb4-aa42-466c-9c01-fed23315a9b7';

function deterministicUuid(seed: string): string {
    const nsBytes = Buffer.from(STIX_SCO_NAMESPACE.replace(/-/g, ''), 'hex');
    const hash = crypto.createHash('sha1').update(nsBytes).update(seed).digest();
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = hash.subarray(0, 16).toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const enrichStix = (obj: any, dataSrc: any) => {
    if (dataSrc.labels && Array.isArray(dataSrc.labels) && dataSrc.labels.length > 0) {
        obj.labels = dataSrc.labels;
    }
    const markings: string[] = [];
    if (dataSrc.tlp) markings.push(dataSrc.tlp);
    if (dataSrc.pap) markings.push(dataSrc.pap);
    if (markings.length > 0) {
        obj.object_marking_refs = Array.from(new Set([...(obj.object_marking_refs || []), ...markings]));
    }
    if (dataSrc.kill_chain_name && dataSrc.phase_name && ['malware', 'indicator', 'attack-pattern', 'tool'].includes(obj.type)) {
        obj.kill_chain_phases = [{
            kill_chain_name: dataSrc.kill_chain_name,
            phase_name: dataSrc.phase_name
        }];
    }
    return obj;
};

export class InvestigationService {
    static async getTimeline(caseId: string) {
        const db = getDb();
        const cursor = await db.query(`
            LET observed_events = (
                FOR obj IN stix_objects
                FILTER obj.case_id == @caseId AND obj.data.type == 'observed-data'
                FILTER HAS(obj.data, 'first_observed')
                RETURN {
                    id: obj._key,
                    stix_id: obj.data.id,
                    timestamp: obj.data.first_observed,
                    description: obj.data.x_oris_description || obj.data.description || obj.data.name || 'Observation',
                    kill_chain: obj.data.x_oris_kill_chain || null,
                    task_id: obj.data.x_oris_task_id || null,
                    item_type: 'observation'
                }
            )
            LET relationship_events = (
                FOR rel IN stix_relationships
                FILTER rel.case_id == @caseId
                FILTER HAS(rel.data, 'start_time')
                RETURN {
                    id: rel._key,
                    stix_id: rel.data.id,
                    timestamp: rel.data.start_time,
                    description: CONCAT('Action : ', rel.data.relationship_type),
                    kill_chain: rel.data.x_oris_kill_chain || null,
                    task_id: null,
                    item_type: 'action'
                }
            )
            FOR event IN APPEND(observed_events, relationship_events)
                SORT event.timestamp ASC
                RETURN event
        `, { caseId });
        return await cursor.all();
    }

    static async getAuditLogByCaseId(caseId: string) {
        const repo = new BaseRepository(getDb(), 'case_audit_log');
        return await repo.findWhere({ case_id: caseId }, { sort: '-created_at' });
    }

    static async getStixObjectsByTaskId(taskId: string) {
        const graphRepo = new StixGraphRepository(getDb());
        return await graphRepo.getObjectsByTaskId(taskId);
    }

    static async getStixObjectById(id: string) {
        const graphRepo = new StixGraphRepository(getDb());
        return await graphRepo.getObjectById(id);
    }

    static async getStixObjectsByCaseId(caseId: string) {
        const graphRepo = new StixGraphRepository(getDb());
        return await graphRepo.getObjectsByCaseId(caseId);
    }

    static async createStixEntity(case_id: string, task_id: string, stix_type: string, data: any, user_id: string) {
        const graphRepo = new StixGraphRepository(getDb());
        const now = new Date().toISOString();
        const createdObjects: any[] = [];

        // Apply enrichment to every object created in this transaction
        const originalCreate = graphRepo.createObject.bind(graphRepo);
        graphRepo.createObject = async (cId: string, obj: any, uId: string) => {
            enrichStix(obj, data);
            return originalCreate(cId, obj, uId);
        };

        // ── SDO types ──
        if (stix_type === 'infrastructure') {
            const id = `infrastructure--${crypto.randomUUID()}`;
            const obj = {
                type: 'infrastructure', id, spec_version: '2.1',
                name: data.name,
                description: data.description || '',
                infrastructure_types: [data.infrastructure_type || 'unknown'],
                x_oris_task_id: task_id,
                created: now, modified: now,
            };
            await graphRepo.createObject(case_id, obj, user_id);
            createdObjects.push(obj);

            // Create observed-data linking to this infrastructure
            const obsId = `observed-data--${crypto.randomUUID()}`;
            const obs = {
                type: 'observed-data', id: obsId, spec_version: '2.1',
                x_oris_task_id: task_id,
                first_observed: now, last_observed: now,
                number_observed: 1,
                object_refs: [id],
                created: now, modified: now,
            };
            await graphRepo.createObject(case_id, obs, user_id);
            createdObjects.push(obs);

            // relationship: observed-data → infrastructure
            const relId = `relationship--${crypto.randomUUID()}`;
            await graphRepo.createRelationship(case_id, {
                type: 'relationship', id: relId,
                relationship_type: 'originates-from',
                source_ref: obsId, target_ref: id,
                created: now, modified: now,
            }, user_id);
        }

        if (stix_type === 'malware') {
            const malId = `malware--${crypto.randomUUID()}`;
            const malObj = {
                type: 'malware', id: malId, spec_version: '2.1',
                name: data.name || 'Unknown',
                description: data.description || '',
                malware_types: data.malware_types || ['unknown'],
                is_family: !!data.is_family,
                x_oris_task_id: task_id,
                created: now, modified: now,
            };
            await graphRepo.createObject(case_id, malObj, user_id);
            createdObjects.push(malObj);

            // Create file SCO if hash or filename provided
            if (data.file_name || data.sha256 || data.md5) {
                const fileSeed = `file-${data.file_name || ''}-${data.sha256 || data.md5 || crypto.randomUUID()}`;
                const fileId = `file--${deterministicUuid(fileSeed)}`;
                const hashes: any = {};
                if (data.sha256) hashes['SHA-256'] = data.sha256;
                if (data.md5) hashes['MD5'] = data.md5;
                const fileObj = {
                    type: 'file', id: fileId, spec_version: '2.1',
                    name: data.file_name || undefined,
                    ...(Object.keys(hashes).length > 0 ? { hashes } : {}),
                    x_oris_task_id: task_id,
                };
                await graphRepo.createObject(case_id, fileObj, user_id);
                createdObjects.push(fileObj);
            }

            // Create observed-data
            const obsId = `observed-data--${crypto.randomUUID()}`;
            const obs = {
                type: 'observed-data', id: obsId, spec_version: '2.1',
                x_oris_task_id: task_id,
                first_observed: now, last_observed: now,
                number_observed: 1, object_refs: [malId],
                created: now, modified: now,
            };
            await graphRepo.createObject(case_id, obs, user_id);
            createdObjects.push(obs);
        }

        // ── SCO types ──
        if (stix_type === 'user-account') {
            const seed = `user-account-${data.user_id || data.display_name || crypto.randomUUID()}`;
            const id = `user-account--${deterministicUuid(seed)}`;
            const obj = {
                type: 'user-account', id, spec_version: '2.1',
                user_id: data.user_id || data.account_name,
                display_name: data.display_name || `${data.account_name || ''}${data.domain ? '@' + data.domain : ''}`,
                x_oris_task_id: task_id,
                created: now, modified: now,
            };
            await graphRepo.createObject(case_id, obj, user_id);
            createdObjects.push(obj);

            const obsId = `observed-data--${crypto.randomUUID()}`;
            const obs = {
                type: 'observed-data', id: obsId, spec_version: '2.1',
                x_oris_task_id: task_id,
                first_observed: now, last_observed: now,
                number_observed: 1, object_refs: [id],
                created: now, modified: now,
            };
            await graphRepo.createObject(case_id, obs, user_id);
            createdObjects.push(obs);
        }

        // --- UNIVERSAL RELATED INDICATORS CREATION ---
        
        // Normalize single-value submissions from simple indicator creation forms
        const indicatorTypesMap: Record<string, string> = { 'ipv4-addr': 'ipv4', 'domain-name': 'domain', 'url': 'url' };
        if (indicatorTypesMap[stix_type] && data.value && !data[indicatorTypesMap[stix_type]]) {
             data[indicatorTypesMap[stix_type]] = data.value;
        }

        const refs: any = {}; // Keeps track of SCO IDs created
        for (const [key, sType, pType] of [
            ['ipv4', 'ipv4-addr', 'ipv4-addr'],
            ['domain', 'domain-name', 'domain-name'],
            ['url', 'url', 'url']
        ]) {
            if (!data[key]) continue;
            const val = data[key];
            const id = `${sType}--${deterministicUuid(`${sType}-${val}`)}`;
            refs[key] = id;
            
            const obj = { type: sType, id, spec_version: '2.1', value: val };
            await graphRepo.createObject(case_id, obj, user_id);
            if (stix_type === sType || !createdObjects.length) {
                // If it's the primary object being created (legacy single-indicator), add it to output UI
                createdObjects.push(obj);
            }

            const indId = `indicator--${crypto.randomUUID()}`;
            const indObj = {
                type: 'indicator', id: indId, spec_version: '2.1', name: val,
                pattern: `[${pType}:value = '${val}']`, pattern_type: 'stix',
                valid_from: now, created: now, modified: now,
            };
            await graphRepo.createObject(case_id, indObj, user_id);
            if (stix_type === sType) createdObjects.push(indObj); // Also add primary indicator to output UI
            
            const relId = `relationship--${crypto.randomUUID()}`;
            await graphRepo.createRelationship(case_id, {
                type: 'relationship', id: relId, relationship_type: 'based-on',
                source_ref: indId, target_ref: id, created: now, modified: now,
            }, user_id);
            
            const obsId = `observed-data--${crypto.randomUUID()}`;
            await graphRepo.createObject(case_id, {
                type: 'observed-data', id: obsId, spec_version: '2.1', x_oris_task_id: task_id,
                first_observed: now, last_observed: now, number_observed: 1, object_refs: [id],
                created: now, modified: now,
            }, user_id);

            // CORRELATION: Link this Indicator to the Primary object if we are attaching it as supplementary info (e.g. to a Malware)
            if (createdObjects.length > 0 && stix_type !== sType) {
                await graphRepo.createRelationship(case_id, {
                    type: 'relationship', id: `relationship--${crypto.randomUUID()}`,
                    relationship_type: data[key + '_rel'] || 'indicates', source_ref: indId, target_ref: createdObjects[0].id,
                    created: now, modified: now,
                }, user_id);
            }
        }
        
        // INTERNAL CORRELATION: Links between the extra network indicators if multiple were provided
        if (refs.domain && refs.ipv4) {
            await graphRepo.createRelationship(case_id, {
                type: 'relationship', id: `relationship--${crypto.randomUUID()}`,
                relationship_type: 'resolves-to', source_ref: refs.domain, target_ref: refs.ipv4,
                created: now, modified: now,
            }, user_id);
        }
        if (refs.url && refs.domain) {
            await graphRepo.createRelationship(case_id, {
                type: 'relationship', id: `relationship--${crypto.randomUUID()}`,
                relationship_type: 'belongs-to', source_ref: refs.url, target_ref: refs.domain,
                created: now, modified: now,
            }, user_id);
        }

        logAudit(case_id, user_id, 'stix_object_created', 'stix', stix_type, {
            task_id, object_count: createdObjects.length,
        });

        return createdObjects;
    }

    static async updateStixEntity(id: string, case_id: string, stix_type: string, data: any, user_id: string) {
        const graphRepo = new StixGraphRepository(getDb());
        const existingMap = await graphRepo.getObjectById(id);
        if (!existingMap) throw new Error('STIX object not found');
        
        let updateData: any = {};
        
        // Map frontend "data" concepts back to STIX properties
        if (stix_type === 'infrastructure') {
            updateData.name = data.name;
            updateData.description = data.description || '';
            if (data.infrastructure_type) updateData.infrastructure_types = [data.infrastructure_type];
        } else if (stix_type === 'user-account') {
            updateData.user_id = data.account_name;
            if (data.display_name) updateData.display_name = data.display_name;
        } else if (stix_type === 'malware') {
            updateData.name = data.name;
            updateData.description = data.description || '';
            if (data.file_name) updateData.name = data.file_name;
            if (data.malware_types) updateData.malware_types = data.malware_types;
            
            // Reconstruct hashes if provided via the dynamic form
            if (data.sha256 || data.md5 || (existingMap.data && existingMap.data.hashes)) {
                updateData.hashes = { ...(existingMap.data.hashes || {}) };
                if (data.sha256) updateData.hashes['SHA-256'] = data.sha256;
                if (data.md5) updateData.hashes['MD5'] = data.md5;
            }
        } else if (['ipv4-addr', 'domain-name', 'url'].includes(stix_type)) {
            updateData.value = data.value;
        } else if (stix_type === 'indicator') {
             // For indicator, update the value in pattern and name if applicable
             updateData.name = data.value;
             let pattern = `[ipv4-addr:value = '${data.value}']`;
             if (existingMap.data.pattern.includes('domain-name')) pattern = `[domain-name:value = '${data.value}']`;
             if (existingMap.data.pattern.includes('url')) pattern = `[url:value = '${data.value}']`;
             updateData.pattern = pattern;
        } else {
             updateData = { ...data }; // Generic fallback
        }

        // Apply enrichment to the final accumulated set of attributes
        updateData = enrichStix(updateData, data);
        const updated = await graphRepo.updateObject(id, case_id, updateData, user_id);
        
        // --- UNIVERSAL RELATED INDICATORS CREATION (FOR UPDATES) ---
        const now = new Date().toISOString();
        
        for (const [key, sType, pType] of [
            ['ipv4', 'ipv4-addr', 'ipv4-addr'],
            ['domain', 'domain-name', 'domain-name'],
            ['url', 'url', 'url']
        ]) {
            if (!data[key]) continue;
            // The user requested to bind an IP/URL/Domain to this existing object
            const val = data[key];
            const newObjId = `${sType}--${deterministicUuid(`${sType}-${val}`)}`;
            
            // Create the new SCO (e.g. ipv4-addr)
            await graphRepo.createObject(case_id, { type: sType, id: newObjId, spec_version: '2.1', value: val }, user_id);

            // Create Indicator
            const indId = `indicator--${crypto.randomUUID()}`;
            await graphRepo.createObject(case_id, {
                type: 'indicator', id: indId, spec_version: '2.1', name: val,
                pattern: `[${pType}:value = '${val}']`, pattern_type: 'stix',
                valid_from: now, created: now, modified: now,
            }, user_id);
            
            // Link Indicator to SCO
            await graphRepo.createRelationship(case_id, {
                type: 'relationship', id: `relationship--${crypto.randomUUID()}`, relationship_type: 'based-on',
                source_ref: indId, target_ref: newObjId, created: now, modified: now,
            }, user_id);
            
            // Link Indicator to Primary Object (Infrastructure/Malware)
            await graphRepo.createRelationship(case_id, {
                type: 'relationship', id: `relationship--${crypto.randomUUID()}`,
                relationship_type: data[key + '_rel'] || 'indicates', source_ref: indId, target_ref: id,
                created: now, modified: now,
            }, user_id);
        }

        logAudit(case_id, user_id, 'stix_object_updated', 'stix', stix_type, {
            object_id: id
        });

        return updated;
    }

    static async deleteStixEntity(id: string, userId: string) {
        const graphRepo = new StixGraphRepository(getDb());
        const obj = await graphRepo.getObjectById(id);
        if (!obj) throw new Error('STIX object not found');

        await graphRepo.deleteObject(id);
        return obj.case_id;
    }

    static async getSeverities() {
        const repo = new BaseRepository(getDb(), 'severities');
        return await repo.findWhere({}, { sort: 'order' });
    }
}
