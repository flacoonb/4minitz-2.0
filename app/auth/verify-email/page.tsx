'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function VerifyEmailPage() {
    const t = useTranslations('auth.verifyEmail');
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const hasRequestedRef = useRef(false);
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStatus('error');
            setMessage(t('missingToken'));
            return;
        }
        if (hasRequestedRef.current) {
            return;
        }
        hasRequestedRef.current = true;

        let isCancelled = false;

        // Verify the email
        fetch(`/api/auth/verify-email?token=${token}`, {
            credentials: 'include'
        })
            .then(async (res) => {
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    return res.json();
                }
                return { success: false, error: t('errorText') };
            })
            .then(data => {
                if (isCancelled) return;
                if (data.success) {
                    setStatus('success');
                    setMessage(data.message || t('successText'));
                    // Redirect to login after 3 seconds
                    setTimeout(() => {
                        router.push('/auth/login');
                    }, 3000);
                } else {
                    setStatus('error');
                    setMessage(data.error || t('errorText'));
                }
            })
            .catch(_err => {
                if (isCancelled) return;
                setStatus('error');
                setMessage(t('errorText'));
            });

        return () => {
            isCancelled = true;
        };
    }, [token, router, t]);

    return (
        <div className="min-h-screen brand-page-gradient flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center">
                    {status === 'loading' && (
                        <>
                            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[var(--brand-primary)] mx-auto mb-4"></div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('verifying')}</h1>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('successTitle')}</h1>
                            <p className="text-gray-600 mb-4">{message}</p>
                            <p className="text-sm text-gray-500">{t('successText')}</p>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('errorTitle')}</h1>
                            <p className="text-gray-600 mb-6">{message}</p>
                            <Link
                                href="/auth/login"
                                className="inline-block px-6 py-3 brand-button-solid rounded-lg transition-colors"
                            >
                                {t('loginButton')}
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
