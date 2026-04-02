/**
 * StixGraphRepository — Graph operations on the STIX graph in ArangoDB.
 *
 * Handles STIX Domain Objects (SDOs) as vertices in stix_objects collection,
 * and STIX Relationship Objects (SROs) as edges in stix_relationships collection.
 *
 * OASIS STIX 2.1 ID Rules:
 *   - SDO IDs (report, malware, infrastructure, etc.) → UUIDv4 (crypto.randomUUID)
 *   - SCO IDs (ipv4-addr, file, url, domain-name, user-account) → UUIDv5 deterministic
 *   - SRO IDs (relationship) → UUIDv4 (crypto.randomUUID)
 *
 * Provides:
 * - CRUD for STIX objects and relationships
 * - Graph traversals for Diamond Model axes
 * - Lateral movement path queries
 * - Full STIX bundle generation
 * - Sync from legacy investigation tables
 */
const crypto = require('crypto');

/**
 * STIX SCO deterministic namespace (OASIS recommended).
 * Used for generating UUIDv5 IDs for Cyber Observable objects.
 */
const STIX_SCO_NAMESPACE = '00abedb4-aa42-466c-9c01-fed23315a9b7';

/**
 * Generate a deterministic UUIDv5 from a seed string (RFC 4122).
 * Uses the STIX SCO namespace for OASIS compliance.
 * Native implementation — no ESM dependency.
 * @param {string} seed - Deterministic seed value
 * @returns {string} UUIDv5 string (xxxxxxxx-xxxx-5xxx-yxxx-xxxxxxxxxxxx)
 */
function deterministicUuid(seed) {
    // Convert namespace UUID to 16-byte buffer
    const nsBytes = Buffer.from(STIX_SCO_NAMESPACE.replace(/-/g, ''), 'hex');
    // SHA-1(namespace + name)
    const hash = crypto.createHash('sha1').update(nsBytes).update(seed).digest();
    // Set version to 5
    hash[6] = (hash[6] & 0x0f) | 0x50;
    // Set variant to RFC 4122
    hash[8] = (hash[8] & 0x3f) | 0x80;
    // Format as UUID (use only first 16 bytes)
    const hex = hash.subarray(0, 16).toString('hex');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

class StixGraphRepository {
    constructor(db) {
        this.db = db;
        this.objects = db.collection('stix_objects');
        this.relationships = db.collection('stix_relationships');
    }

    // ─── STIX Object CRUD ────────────────────────────────────

    async createObject(caseId, stixObject, userId) {
        const doc = {
            _key: stixObject.id,
            case_id: caseId,
            type: stixObject.type,
            spec_version: stixObject.spec_version || '2.1',
            data: stixObject,
            created_by_user_id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await this.objects.save(doc, { overwriteMode: 'replace' });
        return stixObject;
    }

    async updateObject(id, caseId, updateData, userId) {
        // Fetch existing object
        const existing = await this.getObjectById(id);
        if (!existing) throw new Error('Object not found');
        if (existing.case_id !== caseId) throw new Error('Access denied to this object');

        const now = new Date().toISOString();
        const updatedStix = {
            ...existing.data,
            ...updateData,
            modified: now
        };

        const doc = {
            _key: id,
            case_id: caseId,
            type: updatedStix.type,
            spec_version: updatedStix.spec_version || '2.1',
            data: updatedStix,
            created_by_user_id: existing.created_by_user_id, // keep original creator
            created_at: existing.data.created,
            updated_at: now
        };

        await this.objects.update(id, doc);
        return updatedStix;
    }

    async getObjectById(id) {
        try {
            const doc = await this.objects.document(id);
            return { data: doc.data, case_id: doc.case_id, created_by_user_id: doc.created_by_user_id };
        } catch (err) {
            if (err.code === 404 || err.errorNum === 1202) return null;
            throw err;
        }
    }

    async getObjectsByCaseId(caseId) {
        const cursor = await this.db.query(
            `FOR d IN stix_objects FILTER d.case_id == @caseId SORT d.created_at DESC RETURN d.data`,
            { caseId }
        );
        return await cursor.all();
    }

    async getObjectsByTaskId(taskId) {
        const cursor = await this.db.query(
            `
            LET task_diamonds = (
                FOR d IN stix_objects
                FILTER d.data.x_oris_task_id == @taskId AND d.type == 'observed-data' AND HAS(d.data, 'x_oris_diamond_axes')
                RETURN d.data
            )
            LET diamond_refs = (
                FOR d IN task_diamonds
                LET axes = d.x_oris_diamond_axes
                LET refs = APPEND(
                    APPEND(axes.adversary || [], axes.infrastructure || []),
                    APPEND(axes.capability || [], axes.victim || [])
                )
                FOR ref IN refs
                RETURN ref
            )
            LET referenced_objects = (
                FOR ref IN UNIQUE(diamond_refs)
                FOR o IN stix_objects
                FILTER o.data.id == ref
                RETURN o.data
            )
            LET all_results = APPEND(task_diamonds, referenced_objects)
            FOR r IN UNIQUE(all_results)
            SORT r.created DESC
            RETURN r
            `,
            { taskId }
        );
        return await cursor.all();
    }

    async deleteObject(id) {
        // Delete edges referencing this object first
        await this.db.query(
            `FOR e IN stix_relationships
             FILTER e._from == @fullId OR e._to == @fullId
             REMOVE e IN stix_relationships`,
            { fullId: `stix_objects/${id}` }
        );
        try { await this.objects.remove(id); } catch (err) { /* ignore 404 */ }
    }

    // ─── STIX Relationship CRUD ──────────────────────────────

    async createRelationship(caseId, relationship, userId) {
        const doc = {
            _key: relationship.id,
            _from: `stix_objects/${relationship.source_ref}`,
            _to: `stix_objects/${relationship.target_ref}`,
            case_id: caseId,
            relationship_type: relationship.relationship_type,
            data: relationship,
            created_by_user_id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await this.relationships.save(doc, { overwriteMode: 'replace' });
        return relationship;
    }

    async getRelationshipsByCaseId(caseId) {
        const cursor = await this.db.query(
            `FOR e IN stix_relationships FILTER e.case_id == @caseId SORT e.created_at DESC RETURN e.data`,
            { caseId }
        );
        return await cursor.all();
    }

    async deleteRelationship(id) {
        try { await this.relationships.remove(id); } catch (err) { /* ignore 404 */ }
    }

    // ─── Diamond Model Queries ───────────────────────────────

    /**
     * Get Diamond Model data for a case.
     *
     * Uses AQL graph traversal to find connected nodes for each observed-data event:
     * - Adversary: threat-actor, intrusion-set, user-account
     * - Infrastructure: infrastructure, indicator
     * - Capability: malware, tool, attack-pattern
     * - Victim: identity
     */
    async getDiamondData(caseId) {
        const cursor = await this.db.query(`
            LET events = (
                FOR obj IN stix_objects
                    FILTER obj.case_id == @caseId AND obj.type == 'observed-data'
                    RETURN obj
            )
            
            FOR event IN events
                // 1-hop: direct relationships from/to the event (infrastructure/victim)
                LET directEdges = (
                    FOR v, e IN 1..1 ANY event stix_relationships
                        FILTER v.case_id == @caseId
                        RETURN { vertex: v, edge: e }
                )
                
                // 2-hop: indirect relationships (adversary, capability via further links)
                LET indirectEdges = (
                    FOR v, e IN 2..2 ANY event stix_relationships
                        FILTER v.case_id == @caseId
                        RETURN { vertex: v, edge: e }
                )
                
                LET allConnected = APPEND(directEdges, indirectEdges)
                
                LET adversary = (
                    FOR c IN allConnected
                        FILTER c.vertex.type IN ['threat-actor', 'intrusion-set']
                        RETURN DISTINCT { id: c.vertex._key, name: c.vertex.data.name, type: c.vertex.type }
                )
                
                LET infrastructure = (
                    FOR c IN directEdges
                        FILTER c.vertex.type IN ['infrastructure', 'indicator']
                        FILTER c.edge.relationship_type == 'originates-from'
                        RETURN DISTINCT { id: c.vertex._key, name: c.vertex.data.name, type: c.vertex.type }
                )
                
                LET capability = (
                    FOR c IN allConnected
                        FILTER c.vertex.type IN ['malware', 'tool', 'attack-pattern']
                        RETURN DISTINCT { id: c.vertex._key, name: c.vertex.data.name, type: c.vertex.type }
                )
                
                LET victim = (
                    FOR c IN directEdges
                        FILTER (c.vertex.type == 'identity')
                           OR (c.vertex.type IN ['infrastructure', 'indicator'] AND c.edge.relationship_type == 'targets' AND c.edge._from == event._id)
                        RETURN DISTINCT { id: c.vertex._key, name: c.vertex.data.name, type: c.vertex.type }
                )
                
                LET accounts = (
                    FOR c IN allConnected
                        FILTER c.vertex.type == 'user-account'
                        RETURN DISTINCT { id: c.vertex._key, name: c.vertex.data.display_name || c.vertex.data.user_id, type: 'user-account' }
                )
                
                RETURN {
                    event_stix_id: event._key,
                    event_name: event.data.name || event.data.x_oris_description || '',
                    event_description: event.data.x_oris_description || event.data.description || '',
                    kill_chain: event.data.x_oris_kill_chain,
                    event_datetime: event.data.first_observed || event.data.created,
                    axes: {
                        adversary: APPEND(adversary, accounts),
                        infrastructure: infrastructure,
                        capability: capability,
                        victim: victim
                    }
                }
        `, { caseId });

        return await cursor.all();
    }

    // ─── Lateral Movement Queries ────────────────────────────

    /**
     * Get lateral movement paths between infrastructure nodes.
     */
    async getLateralMovements(caseId) {
        const cursor = await this.db.query(`
            // 1. Explicit lateral-movement relations
            LET explicit = (
                FOR src IN stix_objects
                    FILTER src.case_id == @caseId AND (src.type == 'infrastructure' OR src.type == 'ipv4-addr' OR src.type == 'domain-name' OR src.type == 'url' OR src.type == 'mac-addr')
                    FOR v, e IN 1..1 OUTBOUND src stix_relationships
                        FILTER e.relationship_type == 'lateral-movement'
                        
                        LET attack_pattern = e.data.x_oris_attack_pattern_ref ? (
                            FOR obj IN stix_objects
                                FILTER obj.id == e.data.x_oris_attack_pattern_ref
                                RETURN obj.data
                        )[0] : null
    
                        RETURN {
                            source: { id: src._key, name: src.data.name || src.data.value, type: src.type },
                            target: { id: v._key, name: v.data.name || v.data.value, type: v.type },
                            relationship_type: e.relationship_type,
                            event_datetime: e.data.created,
                            attack_pattern_name: attack_pattern ? attack_pattern.name : null,
                            kill_chain_phases: attack_pattern ? attack_pattern.kill_chain_phases : null
                        }
            )

            // 2. Implicit relations from Diamond events (observed-data)
            LET implicit = (
                FOR diamond IN stix_objects
                    FILTER diamond.case_id == @caseId AND diamond.type == 'observed-data' AND HAS(diamond.data, 'x_oris_diamond_axes')
                    LET axes = diamond.data.x_oris_diamond_axes
                    FILTER axes != null AND LENGTH(axes.infrastructure) > 0 AND LENGTH(axes.victim) > 0
                    
                    FOR src_id IN axes.infrastructure
                        FOR tgt_id IN axes.victim
                            LET src = (FOR obj IN stix_objects FILTER obj.id == src_id RETURN obj)[0]
                            LET tgt = (FOR obj IN stix_objects FILTER obj.id == tgt_id RETURN obj)[0]
                            FILTER src != null AND tgt != null AND src._key != tgt._key
                            
                            RETURN {
                                source: { id: src._key, name: src.data.name || src.data.value, type: src.type },
                                target: { id: tgt._key, name: tgt.data.name || tgt.data.value, type: tgt.type },
                                relationship_type: 'lateral-movement',
                                event_datetime: diamond.data.first_observed || diamond.data.created,
                                attack_pattern_name: diamond.data.name,
                                kill_chain_phases: diamond.data.x_oris_kill_chain ? [{ kill_chain_name: diamond.data.x_oris_kill_chain }] : null
                            }
            )

            // Merge and ensure uniqueness
            LET all_edges = APPEND(explicit, implicit)
            FOR edge IN all_edges
                COLLECT src_id = edge.source.id, tgt_id = edge.target.id INTO g = edge
                RETURN g[0]
        `, { caseId });

        return await cursor.all();
    }

    // ─── Sync from Legacy Tables ─────────────────────────────

    /**
     * Synchronize flat document data for a case into the STIX graph.
     * Reads from ArangoDB flat collections and creates STIX objects.
     */
    async syncCaseToGraph(caseId) {
        let vertexCount = 0;
        let edgeCount = 0;

        // 1. Case → report
        const caseCursor = await this.db.query(
            `FOR c IN cases
             FILTER c._key == @caseId
             LET sev = (FOR s IN severities FILTER s._key == c.severity_id RETURN s)[0]
             RETURN MERGE(c, { severity_label: sev.label })`,
            { caseId }
        );
        const caseRow = await caseCursor.next();

        if (caseRow) {
            await this.createObject(caseId, {
                type: 'report', id: `report--${caseId}`, spec_version: '2.1',
                name: caseRow.title,
                description: (caseRow.description || '').replace(/<[^>]*>/g, ''),
                report_types: ['incident'],
                labels: [caseRow.severity_label || 'unknown', `tlp:${(caseRow.tlp || 'white').toLowerCase()}`],
                created: caseRow.created_at, modified: caseRow.updated_at || caseRow.created_at,
                published: caseRow.created_at, object_refs: [],
            }, 'system');
            vertexCount++;
        }

        // 2. Systems → infrastructure + ipv4-addr SCOs
        const sysCursor = await this.db.query(`FOR s IN case_systems FILTER s.case_id == @caseId RETURN s`, { caseId });
        const systems = await sysCursor.all();
        const systemScoMap = new Map(); // systemId → [scoId, ...]
        
        for (const sys of systems) {
            await this.createObject(caseId, {
                type: 'infrastructure', id: `infrastructure--${sys._key}`, spec_version: '2.1',
                name: sys.name,
                description: `Type: ${sys.system_type || 'unknown'}`,
                infrastructure_types: [sys.system_type || 'unknown'],
                created: sys.created_at, modified: sys.created_at,
            }, 'system');
            vertexCount++;

            // Create ipv4-addr SCOs for each IP on this system
            const scoRefs = [];
            const ips = Array.isArray(sys.ip_addresses) ? sys.ip_addresses : [];
            for (const ip of ips) {
                if (!ip) continue;
                const scoId = `ipv4-addr--${deterministicUuid(`ipv4-${sys._key}-${ip}`)}`;
                await this.createObject(caseId, {
                    type: 'ipv4-addr', id: scoId, spec_version: '2.1',
                    value: ip,
                }, 'system');
                scoRefs.push(scoId);
                vertexCount++;
            }
            systemScoMap.set(sys._key, scoRefs);
        }

        // 3. Malware → malware SDO + file SCO + edges
        const malCursor = await this.db.query(`FOR m IN case_malware_tools FILTER m.case_id == @caseId RETURN m`, { caseId });
        const malware = await malCursor.all();
        const malwareScoMap = new Map(); // malwareId → scoId
        
        for (const mal of malware) {
            await this.createObject(caseId, {
                type: 'malware', id: `malware--${mal._key}`, spec_version: '2.1',
                name: mal.file_name || 'Unknown',
                description: mal.description || '',
                malware_types: ['unknown'], is_family: false,
                created: mal.created_at, modified: mal.created_at,
            }, 'system');
            vertexCount++;

            // Create file SCO for this malware
            if (mal.file_name) {
                const fileScoId = `file--${deterministicUuid(`file-mal-${mal._key}`)}`;
                await this.createObject(caseId, {
                    type: 'file', id: fileScoId, spec_version: '2.1',
                    name: mal.file_name,
                    ...(mal.file_hash ? { hashes: { 'SHA-256': mal.file_hash } } : {}),
                }, 'system');
                malwareScoMap.set(mal._key, fileScoId);
                vertexCount++;
            }

            if (mal.system_id) {
                const edgeId = `relationship--${crypto.randomUUID()}`;
                await this.createRelationship(caseId, {
                    type: 'relationship', id: edgeId,
                    relationship_type: 'targets',
                    source_ref: `malware--${mal._key}`,
                    target_ref: `infrastructure--${mal.system_id}`,
                    created: mal.created_at, modified: mal.created_at,
                }, 'system');
                edgeCount++;
            }
        }

        // 4. Accounts → user-account SCO
        const accountsCursor = await this.db.query(`FOR a IN case_compromised_accounts FILTER a.case_id == @caseId RETURN a`, { caseId });
        const accounts = await accountsCursor.all();
        
        for (const acct of accounts) {
            await this.createObject(caseId, {
                type: 'user-account', id: `user-account--${acct._key}`, spec_version: '2.1',
                user_id: acct.account_name,
                display_name: `${acct.account_name}${acct.domain ? '@' + acct.domain : ''}`,
                created: acct.created_at || new Date().toISOString(),
                modified: acct.created_at || new Date().toISOString(),
            }, 'system');
            vertexCount++;
        }

        // 5. Indicators → indicator SDO + SCO (ipv4-addr / domain-name / url)
        const indCursor = await this.db.query(`FOR i IN case_network_indicators FILTER i.case_id == @caseId RETURN i`, { caseId });
        const indicators = await indCursor.all();
        
        for (const ind of indicators) {
            // Determine the SCO type and create it
            let scoId = null;
            if (ind.ip) {
                scoId = `ipv4-addr--${deterministicUuid(`ipv4-ind-${ind._key}`)}`;
                await this.createObject(caseId, {
                    type: 'ipv4-addr', id: scoId, spec_version: '2.1',
                    value: ind.ip,
                }, 'system');
                vertexCount++;
            }
            if (ind.domain_name) {
                const domScoId = `domain-name--${deterministicUuid(`domain-ind-${ind._key}`)}`;
                await this.createObject(caseId, {
                    type: 'domain-name', id: domScoId, spec_version: '2.1',
                    value: ind.domain_name,
                }, 'system');
                vertexCount++;
                if (!scoId) scoId = domScoId;
            }
            if (ind.url) {
                const urlScoId = `url--${deterministicUuid(`url-ind-${ind._key}`)}`;
                await this.createObject(caseId, {
                    type: 'url', id: urlScoId, spec_version: '2.1',
                    value: ind.url,
                }, 'system');
                vertexCount++;
                if (!scoId) scoId = urlScoId;
            }

            // Create the indicator SDO with a proper pattern
            let pattern = `[ipv4-addr:value = '${ind.ip || '0.0.0.0'}']`;
            if (!ind.ip && ind.domain_name) pattern = `[domain-name:value = '${ind.domain_name}']`;
            if (!ind.ip && !ind.domain_name && ind.url) pattern = `[url:value = '${ind.url}']`;

            await this.createObject(caseId, {
                type: 'indicator', id: `indicator--${ind._key}`, spec_version: '2.1',
                name: ind.ip || ind.domain_name || ind.url || 'IOC',
                pattern,
                pattern_type: 'stix',
                valid_from: ind.first_activity || ind.created_at,
                created: ind.created_at, modified: ind.created_at,
            }, 'system');
            vertexCount++;

            // Link indicator to its SCO via based-on relationship
            if (scoId) {
                const edgeId = `relationship--${crypto.randomUUID()}`;
                await this.createRelationship(caseId, {
                    type: 'relationship', id: edgeId,
                    relationship_type: 'based-on',
                    source_ref: `indicator--${ind._key}`,
                    target_ref: scoId,
                    created: ind.created_at, modified: ind.created_at,
                }, 'system');
                edgeCount++;
            }
        }

        // 6. Tasks → grouping objects (using STIX objects linked via x_oris_task_id)
        const taskCursor = await this.db.query(`FOR t IN tasks FILTER t.case_id == @caseId RETURN t`, { caseId });
        const tasks = await taskCursor.all();
        
        for (const task of tasks) {
            // Get STIX objects linked to this task
            const taskObjCursor = await this.db.query(
                `FOR d IN stix_objects FILTER d.data.x_oris_task_id == @taskId RETURN d.data.id`,
                { taskId: task._key }
            );
            const taskObjRefs = await taskObjCursor.all();

            await this.createObject(caseId, {
                type: 'grouping', id: `grouping--${task._key}`, spec_version: '2.1',
                name: task.title,
                description: (task.description || '').replace(/<[^>]*>/g, ''),
                context: 'suspicious-activity',
                object_refs: taskObjRefs,
                created: task.created_at, modified: task.updated_at || task.created_at,
            }, 'system');
            vertexCount++;
        }

        return { vertices: vertexCount, edges: edgeCount };
    }

    // ─── STIX Bundle ─────────────────────────────────────────

    /**
     * Generate a complete STIX 2.1 bundle for a case from the graph.
     */
    async getBundleForCase(caseId) {
        const objects = await this.getObjectsByCaseId(caseId);
        const relationships = await this.getRelationshipsByCaseId(caseId);

        return {
            type: 'bundle',
            id: `bundle--${crypto.randomUUID()}`,
            objects: [...objects, ...relationships],
        };
    }
}

module.exports = StixGraphRepository;
