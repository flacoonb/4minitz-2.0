
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { checkRateLimit } from '@/lib/rate-limit';
import { getTranslations } from 'next-intl/server';
import crypto from 'crypto';

// GET /api/auth/verify-email?token=...
export async function GET(request: NextRequest) {
    const t = await getTranslations('errors');

    try {
        // Rate Limit: 10 attempts per hour
        const rateLimit = checkRateLimit(request, 10, 60 * 60 * 1000);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: t('tooManyRequests') },
                { status: 429 }
            );
        }

        await connectDB();

        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: t('missingToken') }, { status: 400 });
        }

        // Hash the token and find user (tokens are stored hashed)
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            emailVerificationToken: tokenHash,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            return NextResponse.json({ error: t('invalidOrExpiredToken') }, { status: 400 });
        }

        // Verify user
        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        // Redirect to login page with success message
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('verified', 'true');

        return NextResponse.redirect(loginUrl);

    } catch {
        return NextResponse.json({ error: t('serverError') }, { status: 500 });
    }
}

