import { NextRequest } from 'next/server';

interface RateLimitStore {
    count: number;
    resetTime: number;
}

const ipRateLimits = new Map<string, RateLimitStore>();

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [ip, store] of ipRateLimits.entries()) {
        if (now > store.resetTime) {
            ipRateLimits.delete(ip);
        }
    }
}, 5 * 60 * 1000);

/**
 * Checks if a request has exceeded the rate limit.
 * @param request The NextRequest object (used to extract IP)
 * @param limit Max number of requests allowed within the window
 * @param windowMs Time window in milliseconds
 * @returns Object indicating if the request is allowed and remaining requests
 */
export function checkRateLimit(request: NextRequest, limit: number, windowMs: number) {
    // Get IP address from headers (x-forwarded-for is standard for proxies/load balancers)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    const now = Date.now();
    const store = ipRateLimits.get(ip);

    if (!store || now > store.resetTime) {
        // New window or expired window
        ipRateLimits.set(ip, {
            count: 1,
            resetTime: now + windowMs
        });
        return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
    }

    // Existing window
    if (store.count >= limit) {
        return { allowed: false, remaining: 0, resetTime: store.resetTime };
    }

    store.count += 1;
    return { allowed: true, remaining: limit - store.count, resetTime: store.resetTime };
}
