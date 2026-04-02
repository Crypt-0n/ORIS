import crypto from 'crypto';
import { getDb } from '../db-arango';
import BaseRepository from '../repositories/BaseRepository';
// @ts-ignore
import { sendPushToUser } from '../utils/push';

export class NotificationService {
    static async getNotifications(userId: string) {
        const repo = new BaseRepository(getDb(), 'notifications');
        return await repo.findWhere({ user_id: userId }, { sort: '-created_at', limit: 50 });
    }

    static async getUnreadCount(userId: string) {
        const db = getDb();
        const cursor = await db.query(`
            FOR n IN notifications
            FILTER n.user_id == @userId AND n.is_read == 0
            COLLECT WITH COUNT INTO length
            RETURN length
        `, { userId });
        return await cursor.next();
    }

    static async markAsRead(id: string, userId: string) {
        const db = getDb();
        await db.query(`
            FOR n IN notifications
            FILTER n._key == @id AND n.user_id == @userId
            UPDATE n WITH { is_read: 1 } IN notifications
        `, { id, userId });
    }

    static async markAllAsRead(userId: string) {
        const db = getDb();
        await db.query(`
            FOR n IN notifications
            FILTER n.user_id == @userId AND n.is_read == 0
            UPDATE n WITH { is_read: 1 } IN notifications
        `, { userId });
    }

    static async deleteAll(userId: string) {
        const db = getDb();
        await db.query(`
            FOR n IN notifications
            FILTER n.user_id == @userId
            REMOVE n IN notifications
        `, { userId });
    }

    static async delete(id: string, userId: string) {
        const db = getDb();
        await db.query(`
            FOR n IN notifications
            FILTER n._key == @id AND n.user_id == @userId
            REMOVE n IN notifications
        `, { id, userId });
    }

    static async subscribeToPush(userId: string, endpoint: string, keys: any) {
        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            throw new Error('Invalid subscription');
        }
        
        const db = getDb();
        await db.query(`
            FOR s IN push_subscriptions
            FILTER s.endpoint == @endpoint
            REMOVE s IN push_subscriptions
        `, { endpoint });

        const id = crypto.randomUUID();
        const repo = new BaseRepository(db, 'push_subscriptions');
        await repo.create({ id, user_id: userId, endpoint, keys_p256dh: keys.p256dh, keys_auth: keys.auth });
    }

    static async unsubscribeFromPush(userId: string, endpoint: string) {
        if (!endpoint) return;
        const db = getDb();
        await db.query(`
            FOR s IN push_subscriptions
            FILTER s.endpoint == @endpoint AND s.user_id == @userId
            REMOVE s IN push_subscriptions
        `, { endpoint, userId });
    }

    static async getVapidPublicKey() {
        const repo = new BaseRepository(getDb(), 'system_config');
        const rows = await repo.findWhere({ key: 'vapid_public_key' });
        if (rows.length === 0) throw new Error('VAPID keys not configured');
        return rows[0].value;
    }

    static async getPreferences(userId: string) {
        return await this.getUserNotificationPreferences(userId);
    }

    static async updatePreferences(userId: string, prefs: any) {
        const repo = new BaseRepository(getDb(), 'user_profiles');
        await repo.update(userId, { notification_preferences: JSON.stringify(prefs) });
    }

    private static async getUserNotificationPreferences(userId: string) {
        try {
            const repo = new BaseRepository(getDb(), 'user_profiles');
            const user = await repo.findById(userId);
            const prefs = JSON.parse(user?.notification_preferences || '{}');
            const defaults = { mention: true, assignment: true, task_status: true, task_comment: true, case_status: true };
            return { ...defaults, ...prefs };
        } catch {
            return { mention: true, assignment: true, task_status: true, task_comment: true, case_status: true };
        }
    }

    static async createNotification(userId: string, type: string, title: string, body: string, link?: string) {
        const prefs: any = await this.getUserNotificationPreferences(userId);
        if (prefs[type] === false) return null;
        const id = crypto.randomUUID();
        const repo = new BaseRepository(getDb(), 'notifications');
        await repo.create({ id, user_id: userId, type, title, body, link: link || null, is_read: 0, created_at: new Date().toISOString() });
        sendPushToUser(userId, { title, body, link }).catch((err: any) => console.error('Push notification error:', err.message));
        return id;
    }
}
