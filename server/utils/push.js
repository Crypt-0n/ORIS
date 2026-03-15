const webpush = require('web-push');
const db = require('../db');

async function initVapid() {
    let publicKey = await db('system_config').where({ key: 'vapid_public_key' }).select('value').first();
    let privateKey = await db('system_config').where({ key: 'vapid_private_key' }).select('value').first();

    if (!publicKey || !privateKey) {
        const keys = webpush.generateVAPIDKeys();
        // Upsert: use onConflict for multi-dialect support
        await db('system_config').insert({ key: 'vapid_public_key', value: keys.publicKey })
            .onConflict('key').merge();
        await db('system_config').insert({ key: 'vapid_private_key', value: keys.privateKey })
            .onConflict('key').merge();
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
    const subscriptions = await db('push_subscriptions').where({ user_id: userId });

    for (const sub of subscriptions) {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        };

        try {
            await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
        } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
                await db('push_subscriptions').where({ id: sub.id }).del();
                console.log(`[Push] Removed stale subscription ${sub.id}`);
            } else {
                console.error(`[Push] Error sending to ${sub.endpoint}:`, err.message);
            }
        }
    }
}

module.exports = { initVapid, sendPushToUser };
