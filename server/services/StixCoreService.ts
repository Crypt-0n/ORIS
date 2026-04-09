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
        const keys = new Set([...Object.keys(prev), ...Object.keys(stixData)]);
        let hasChanges = false;
        
        for (const k of keys) {
            if (['modified', 'updated_at', 'created_at', 'created'].includes(k)) continue;
            if (JSON.stringify(prev[k]) !== JSON.stringify(stixData[k])) {
                hasChanges = true;
                break;
            }
        }

        if (!hasChanges) {
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
