'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function VerifyEmailPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const token = searchParams.get('token');

        if (!token) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStatus('error');
            setMessage('Kein Bestätigungstoken gefunden');
            return;
        }

        // Verify the email
        fetch(`/api/auth/verify-email?token=${token}`, {
            credentials: 'include'
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setStatus('success');
                    setMessage(data.message);
                    // Redirect to login after 3 seconds
                    setTimeout(() => {
                        router.push('/auth/login');
                    }, 3000);
                } else {
                    setStatus('error');
                    setMessage(data.error || 'Fehler bei der E-Mail-Bestätigung');
                }
            })
            .catch(err => {
                setStatus('error');
                setMessage('Netzwerkfehler bei der E-Mail-Bestätigung');
            });
    }, [searchParams, router]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center">
                    {status === 'loading' && (
                        <>
                            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">E-Mail wird bestätigt...</h1>
                            <p className="text-gray-600">Bitte warten Sie einen Moment.</p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">E-Mail bestätigt!</h1>
                            <p className="text-gray-600 mb-4">{message}</p>
                            <p className="text-sm text-gray-500">Sie werden in Kürze zur Anmeldeseite weitergeleitet...</p>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Fehler</h1>
                            <p className="text-gray-600 mb-6">{message}</p>
                            <Link
                                href="/auth/login"
                                className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                Zur Anmeldung
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
