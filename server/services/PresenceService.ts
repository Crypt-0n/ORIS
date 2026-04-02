import { getDb } from '../db-arango';
import BaseRepository from '../repositories/BaseRepository';

interface PresenceEntry {
    userId: string;
    fullName: string;
    caseId: string;
    taskId: string | null;
    lastSeen: number;
}

const presenceMap = new Map<string, PresenceEntry>();

const presenceCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of presenceMap) {
        if (now - entry.lastSeen > 20000) presenceMap.delete(key);
    }
}, 15000);
presenceCleanup.unref();

export class PresenceService {
    static async updatePresence(userId: string, caseId: string, taskId?: string) {
        const repo = new BaseRepository(getDb(), 'user_profiles');
        const user = await repo.findById(userId);
        
        presenceMap.set(userId, {
            userId, 
            fullName: user?.full_name || 'Inconnu',
            caseId, 
            taskId: taskId || null, 
            lastSeen: Date.now(),
        });
    }

    static getActiveOnCase(caseId: string, requestUserId: string) {
        const now = Date.now();
        const active: any[] = [];
        for (const [, entry] of presenceMap) {
            if (entry.caseId === caseId && now - entry.lastSeen < 20000 && entry.userId !== requestUserId) {
                active.push({ userId: entry.userId, fullName: entry.fullName, taskId: entry.taskId });
            }
        }
        return active;
    }

    static getActiveOnTask(taskId: string, requestUserId: string) {
        const now = Date.now();
        const active: any[] = [];
        for (const [, entry] of presenceMap) {
            if (entry.taskId === taskId && now - entry.lastSeen < 20000 && entry.userId !== requestUserId) {
                active.push({ userId: entry.userId, fullName: entry.fullName });
            }
        }
        return active;
    }
}
