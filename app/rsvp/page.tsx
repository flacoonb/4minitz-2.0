'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

type RsvpResponse = 'accepted' | 'tentative' | 'declined';

export default function RsvpPage() {
  const t = useTranslations('rsvpPage');
  const searchParams = useSearchParams();
  const token = String(searchParams.get('token') || '').trim();
  const response = String(searchParams.get('response') || '').trim().toLowerCase() as RsvpResponse;
  const finalStatus = String(searchParams.get('status') || '').trim().toLowerCase();
  const finalMessage = String(searchParams.get('message') || '').trim();
  const isValidResponse = response === 'accepted' || response === 'tentative' || response === 'declined';
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const responseLabel = useMemo(() => {
    if (response === 'accepted') return t('response.accepted');
    if (response === 'tentative') return t('response.tentative');
    if (response === 'declined') return t('response.declined');
    return t('response.generic');
  }, [response, t]);

  if (finalStatus === 'success' && isValidResponse) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 brand-page-gradient">
        <div className="max-w-md w-full app-card rounded-xl p-6">
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--brand-text)' }}>{t('savedTitle')}</h1>
          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--brand-success-soft)', color: 'var(--brand-success)' }}>
            {t('savedMessage', { response: responseLabel })}
          </div>
        </div>
      </div>
    );
  }

  if (finalStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 brand-page-gradient">
        <div className="max-w-md w-full app-card rounded-xl p-6">
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--brand-text)' }}>{t('errorTitle')}</h1>
          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--brand-danger-soft)', color: 'var(--brand-danger)' }}>
            {finalMessage || t('saveError')}
          </div>
        </div>
      </div>
    );
  }

  const submitRsvp = async () => {
    if (!token || !isValidResponse) return;
    setLoading(true);
    try {
      const res = await fetch('/api/meeting-events/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, response }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || t('saveError'));
        return;
      }
      setStatus('success');
      setMessage(t('savedMessage', { response: responseLabel }));
    } catch {
      setStatus('error');
      setMessage(t('saveError'));
    } finally {
      setLoading(false);
    }
  };

  if (!token || !isValidResponse) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 brand-page-gradient">
        <div className="max-w-md w-full app-card rounded-xl p-6 text-center">
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--brand-text)' }}>{t('invalidTitle')}</h1>
          <p className="app-text-muted">{t('invalidMessage')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 brand-page-gradient">
      <div className="max-w-md w-full app-card rounded-xl p-6">
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--brand-text)' }}>{t('confirmTitle')}</h1>
        <p className="mb-5" style={{ color: 'var(--brand-text)' }}>
          {t('confirmMessage', { response: responseLabel })}
        </p>

        {status === 'success' ? (
          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--brand-success-soft)', color: 'var(--brand-success)' }}>{message}</div>
        ) : (
          <>
            {status === 'error' && (
              <div className="p-3 rounded-lg text-sm mb-3" style={{ backgroundColor: 'var(--brand-danger-soft)', color: 'var(--brand-danger)' }}>{message}</div>
            )}
            <button
              onClick={submitRsvp}
              disabled={loading}
              className="w-full py-2.5 rounded-lg brand-button-solid disabled:opacity-50 transition-colors"
            >
              {loading ? t('saving') : t('confirmAction', { response: responseLabel })}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
