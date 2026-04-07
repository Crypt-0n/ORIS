/**
 * Simple in-memory rate limiter middleware.
 * Tracks request counts per IP within a sliding window.
 *
 * @param {Object} opts
 * @param {number} opts.windowMs - Time window in milliseconds (default: 15 min)
 * @param {number} opts.max - Max requests per window (default: 15)
 * @param {string} opts.message - Error message when rate limited
 */
function rateLimit({ windowMs = 15 * 60 * 1000, max = 15, message = 'Too many requests, please try again later.' } = {}) {
    const hits = new Map(); // ip -> { count, resetTime }

    // Cleanup expired entries every minute (unref to not block process exit)
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of hits) {
            if (now > entry.resetTime) hits.delete(ip);
        }
    }, 60 * 1000);
    cleanupInterval.unref();

    return (req, res, next) => {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
        const now = Date.now();
        let entry = hits.get(ip);

        if (!entry || now > entry.resetTime) {
            entry = { count: 0, resetTime: now + windowMs };
            hits.set(ip, entry);
        }

        entry.count++;

        // Set rate limit headers
        res.set('X-RateLimit-Limit', String(max));
        res.set('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
        res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));

        if (entry.count > max) {
            const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
            res.set('Retry-After', String(retryAfter));
            return res.status(429).json({ error: message });
        }

        next();
    };
}

module.exports = rateLimit;
