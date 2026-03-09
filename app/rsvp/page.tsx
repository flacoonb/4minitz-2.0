'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type RsvpResponse = 'accepted' | 'tentative' | 'declined';

export default function RsvpPage() {
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
    if (response === 'accepted') return 'Zusage';
    if (response === 'tentative') return 'Vorbehalt';
    if (response === 'declined') return 'Absage';
    return 'Antwort';
  }, [response]);

  if (finalStatus === 'success' && isValidResponse) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Antwort gespeichert</h1>
          <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">
            Ihre {responseLabel} wurde gespeichert.
          </div>
        </div>
      </div>
    );
  }

  if (finalStatus === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Fehler</h1>
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {finalMessage || 'Die Antwort konnte nicht gespeichert werden.'}
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
        setMessage(data.error || 'Die Antwort konnte nicht gespeichert werden.');
        return;
      }
      setStatus('success');
      setMessage(`Ihre ${responseLabel} wurde gespeichert.`);
    } catch {
      setStatus('error');
      setMessage('Die Antwort konnte nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !isValidResponse) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Ungültiger Link</h1>
          <p className="text-slate-600">Der RSVP-Link ist unvollständig oder ungültig.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Antwort bestätigen</h1>
        <p className="text-slate-700 mb-5">
          Sie möchten folgende Antwort senden: <strong>{responseLabel}</strong>
        </p>

        {status === 'success' ? (
          <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">{message}</div>
        ) : (
          <>
            {status === 'error' && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm mb-3">{message}</div>
            )}
            <button
              onClick={submitRsvp}
              disabled={loading}
              className="w-full py-2.5 rounded-lg brand-button-solid disabled:opacity-50 transition-colors"
            >
              {loading ? 'Speichert...' : `${responseLabel} bestätigen`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
