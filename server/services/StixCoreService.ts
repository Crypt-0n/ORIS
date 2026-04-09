import { getDb } from '../db-arango';
// @ts-ignore
import StixGraphRepository from '../repositories/StixGraphRepository';
import { canAccessCase } from '../utils/access';
import { logAudit } from '../utils/audit';

export class StixCoreService {
    static getRepo() {
        return new StixGraphRepository(getDb());
    }

    static async getObjectsByCaseId(caseId: string, userId: string) {
        if (!await canAccessCase(userId, caseId)) throw new Error('Access denied');
        return await this.getRepo().getObjectsByCaseId(caseId);
    }

    static async getObjectById(id: string) {
        return await this.getRepo().getObjectById(id);
    }

    static async createObject(caseId: string, stixData: any, userId: string) {
        if (!await canAccessCase(userId, caseId)) throw new Error('Access denied');
        const result = await this.getRepo().createObject(caseId, stixData, userId);
        logAudit(caseId, userId, 'stix_object_created', 'stix', stixData.id || result.id, { type: stixData.type });
        return result;
    }

    static async updateObject(id: string, stixData: any, userId: string) {
        const repo = this.getRepo();
        const existing = await repo.getObjectById(id);
        if (!existing) throw new Error('Object not found');
        if (!await canAccessCase(userId, existing.case_id)) throw new Error('Access denied');
        
        // Deep compare to prevent noisy audit logs for non-modifications
        const prev = existing.data;
        
        const isObjectDeepEqual = (obj1: any, obj2: any): boolean => {
            if (obj1 === obj2) return true;
            if (obj1 == null || obj2 == null) return obj1 === obj2;
            if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
            if (Array.isArray(obj1) && Array.isArray(obj2)) {
                if (obj1.length !== obj2.length) return false;
                // Arrays in STIX are often un-ordered ID lists, but we'll assume ordered for simplicity,
                // or just sort strings if they are pure string arrays
                const isStringArr = obj1.every(x => typeof x === 'string') && obj2.every(x => typeof x === 'string');
                if (isStringArr) {
                    const sorted1 = [...obj1].sort();
                    const sorted2 = [...obj2].sort();
                    return sorted1.every((val, i) => val === sorted2[i]);
                }
                return obj1.every((val, i) => isObjectDeepEqual(val, obj2[i]));
            }
            const keys1 = Object.keys(obj1).filter(k => obj1[k] !== undefined && obj1[k] !== null && obj1[k] !== '');
            const keys2 = Object.keys(obj2).filter(k => obj2[k] !== undefined && obj2[k] !== null && obj2[k] !== '');
            
            const kSet = new Set([...keys1, ...keys2]);
            for (const k of kSet) {
                if (['modified', 'updated_at', 'created_at', 'created', '_axes', '_relations'].includes(k)) continue;
                if (!isObjectDeepEqual(obj1[k], obj2[k])) return false;
            }
            return true;
        };

        if (isObjectDeepEqual(prev, stixData)) {
            console.log(`[ORIS STIX diff] FAST PATH HIT for ${id} (no real modifications found)`);
            return prev; // Fast path: no changes
        }

        const result = await repo.updateObject(id, existing.case_id, stixData, userId);
        logAudit(existing.case_id, userId, 'stix_object_updated', 'stix', id, { 
            type: stixData.type,
            previous_state: existing.data,
            new_state: result
        });
        return result;
    }

    static async updateVisuals(id: string, patchData: any, userId: string) {
        const VISUAL_KEYS = ['x_oris_diamond_label', 'x_oris_graph_position', 'x_oris_diamond_edge', 'x_oris_diamond_axes'];
        const repo = this.getRepo();
        const existing = await repo.getObjectById(id);
        if (!existing) throw new Error('Object not found');
        if (!await canAccessCase(userId, existing.case_id)) throw new Error('Access denied');

        const patch: any = {};
        for (const key of VISUAL_KEYS) {
            if (key in patchData) patch[key] = patchData[key];
        }
        if (Object.keys(patch).length === 0) throw new Error('No valid visual properties provided');

        const mergedData = { ...existing.data, ...patch, modified: new Date().toISOString() };
        await repo.createObject(existing.case_id, mergedData, userId);
    }

    static async deleteObject(id: string, userId: string) {
        const repo = this.getRepo();
        const existing = await repo.getObjectById(id);
        if (!existing) throw new Error('Object not found');
        if (!await canAccessCase(userId, existing.case_id)) throw new Error('Access denied');

        await repo.deleteObject(id);
        logAudit(existing.case_id, userId, 'stix_object_deleted', 'stix', id, {});
    }

    static async getRelationshipsByCaseId(caseId: string, userId: string) {
        if (!await canAccessCase(userId, caseId)) throw new Error('Access denied');
        return await this.getRepo().getRelationshipsByCaseId(caseId);
    }

    static async createRelationship(caseId: string, relData: any, userId: string) {
        if (!await canAccessCase(userId, caseId)) throw new Error('Access denied');
        return await this.getRepo().createRelationship(caseId, relData, userId);
    }

    static async deleteRelationship(id: string) {
        await this.getRepo().deleteRelationship(id);
    }

    static async getBundleForCase(caseId: string, userId: string) {
        if (!await canAccessCase(userId, caseId)) throw new Error('Access denied');
        return await this.getRepo().getBundleForCase(caseId);
    }

    static async getDiamondData(caseId: string, userId: string) {
        if (!await canAccessCase(userId, caseId)) throw new Error('Access denied');
        return await this.getRepo().getDiamondData(caseId);
    }

    static async getLateralMovements(caseId: string, userId: string) {
        if (!await canAccessCase(userId, caseId)) throw new Error('Access denied');
        return await this.getRepo().getLateralMovements(caseId);
    }

    static async syncCaseToGraph(caseId: string, userId: string) {
        if (!await canAccessCase(userId, caseId)) throw new Error('Access denied');
        return await this.getRepo().syncCaseToGraph(caseId);
    }
}
