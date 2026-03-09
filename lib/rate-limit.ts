import { NextRequest } from 'next/server';
import crypto from 'crypto';

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
    const ip = getClientIp(request);
    const path = request.nextUrl?.pathname || 'global';
    return checkRateLimitByKey(`ip:${ip}:${path}`, limit, windowMs);
}

export function checkRateLimitByKey(rawKey: string, limit: number, windowMs: number) {
    const key = sanitizeKeyPart(rawKey);

    const now = Date.now();
    const store = ipRateLimits.get(key);

    if (!store || now > store.resetTime) {
        // New window or expired window
        ipRateLimits.set(key, {
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

function sanitizeKeyPart(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9:._-]/g, '_').slice(0, 200);
}

function getClientIp(request: NextRequest): string {
    // Preferred source in Next runtimes.
    const directIp = ((request as any).ip as string | undefined)?.trim();
    if (directIp) return sanitizeKeyPart(directIp);

    // Never trust forwarding headers unless explicitly enabled.
    const trustProxyHeaders = process.env.TRUST_PROXY_HEADERS === 'true';
    if (trustProxyHeaders) {
        // Trusted reverse proxies often provide x-real-ip.
        const realIp = request.headers.get('x-real-ip')?.trim();
        if (realIp) return sanitizeKeyPart(realIp);

        // For x-forwarded-for, prefer left-most element (original client IP).
        const xff = request.headers.get('x-forwarded-for');
        if (xff) {
            const parts = xff.split(',').map((part) => part.trim()).filter(Boolean);
            if (parts.length > 0) {
                return sanitizeKeyPart(parts[0]);
            }
        }
    }

    // Last resort: derive a stable anonymous fingerprint so all clients do not
    // share the same global "unknown" bucket.
    const fallbackFingerprint = getAnonymousFingerprint(request);
    return fallbackFingerprint || 'unknown';
}

function getAnonymousFingerprint(request: NextRequest): string | null {
    const userAgent = request.headers.get('user-agent')?.trim() || '';
    const acceptLanguage = request.headers.get('accept-language')?.trim() || '';
    const clientHintsUa = request.headers.get('sec-ch-ua')?.trim() || '';

    if (!userAgent && !acceptLanguage && !clientHintsUa) {
        return null;
    }

    const raw = `${userAgent}|${acceptLanguage}|${clientHintsUa}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
    return sanitizeKeyPart(`anon-${hash}`);
}
