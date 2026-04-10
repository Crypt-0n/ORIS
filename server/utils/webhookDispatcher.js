const { getDb } = require('../db-arango');
const crypto = require('crypto');

async function dispatchWebhooks(eventType, payload) {
    try {
        const db = getDb();
        const cursor = await db.query(`FOR w IN webhooks FILTER w.enabled == 1 RETURN w`);
        const webhooks = await cursor.all();

        for (const wh of webhooks) {
            try {
                const events = JSON.parse(wh.events || '[]');
                if (!events.includes('*') && !events.includes(eventType)) continue;

                // SSRF Guard: skip webhooks targeting internal/private addresses
                try {
                    const parsed = new URL(wh.url);
                    const hostname = parsed.hostname.toLowerCase();
                    if (!['http:', 'https:'].includes(parsed.protocol)) continue;
                    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1' || hostname === '169.254.169.254') continue;
                    const ipParts = hostname.split('.').map(Number);
                    if (ipParts.length === 4 && ipParts.every(n => !isNaN(n))) {
                        if (ipParts[0] === 10 || (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) || (ipParts[0] === 192 && ipParts[1] === 168) || ipParts[0] === 0) continue;
                    }
                } catch { continue; }

                const body = JSON.stringify({
                    event: eventType,
                    timestamp: new Date().toISOString(),
                    data: payload,
                });

                const headers = {
                    'Content-Type': 'application/json',
                    'X-ORIS-Event': eventType,
                };

                if (wh.secret) {
                    const sig = crypto.createHmac('sha256', wh.secret).update(body).digest('hex');
                    headers['X-ORIS-Signature'] = `sha256=${sig}`;
                }

                fetch(wh.url, {
                    method: 'POST',
                    headers,
                    body,
                    signal: AbortSignal.timeout(10000),
                }).then(async res => {
                    await db.query(`UPDATE @key WITH { last_triggered_at: @time } IN webhooks`, { key: wh._key, time: new Date().toISOString() });
                    if (!res.ok) {
                        console.error(`[Webhook] ${wh.name} returned ${res.status} for ${eventType}`);
                    }
                }).catch(err => {
                    console.error(`[Webhook] ${wh.name} failed for ${eventType}:`, err.message);
                });
            } catch (e) {
                console.error(`[Webhook] Error processing webhook ${wh.name}:`, e);
            }
        }
    } catch (e) {
        console.error('[Webhook] dispatchWebhooks error:', e);
    }
}

module.exports = { dispatchWebhooks };
