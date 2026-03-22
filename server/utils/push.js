const webpush = require('web-push');
const { getDb } = require('../db-arango');

async function initVapid() {
    const db = getDb();
    let configCursor = await db.query(`FOR c IN system_config FILTER c.key IN ['vapid_public_key', 'vapid_private_key'] RETURN c`);
    let rows = await configCursor.all();
    let publicKey = rows.find(r => r.key === 'vapid_public_key');
    let privateKey = rows.find(r => r.key === 'vapid_private_key');

    if (!publicKey || !privateKey) {
        const keys = webpush.generateVAPIDKeys();
        await db.query(`UPSERT { key: 'vapid_public_key' } INSERT { key: 'vapid_public_key', value: @val } UPDATE { value: @val } IN system_config`, { val: keys.publicKey });
        await db.query(`UPSERT { key: 'vapid_private_key' } INSERT { key: 'vapid_private_key', value: @val } UPDATE { value: @val } IN system_config`, { val: keys.privateKey });
        publicKey = { value: keys.publicKey };
        privateKey = { value: keys.privateKey };
        console.log('[Push] Generated new VAPID keys');
    }

    webpush.setVapidDetails(
        'mailto:admin@oris.local',
        publicKey.value,
        privateKey.value
    );
    console.log('[Push] VAPID configured');
}

async function sendPushToUser(userId, payload) {
    const db = getDb();
    const cursor = await db.query(`FOR s IN push_subscriptions FILTER s.user_id == @userId RETURN s`, { userId });
    const subscriptions = await cursor.all();

    for (const sub of subscriptions) {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        };

        try {
            await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
        } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
                await db.query(`REMOVE @key IN push_subscriptions`, { key: sub._key });
                console.log(`[Push] Removed stale subscription ${sub._key}`);
            } else {
                console.error(`[Push] Error sending to ${sub.endpoint}:`, err.message);
            }
        }
    }
}

module.exports = { initVapid, sendPushToUser };
