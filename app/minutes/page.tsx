"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';

interface Minute {
  _id: string;
  date: string;
  title?: string;
  isFinalized?: boolean;
  finalized?: boolean;
  meetingSeries_id?: {
    _id: string;
    project?: string;
    name?: string;
  } | null;
}

type FilterState = 'all' | 'draft' | 'finalized';

export default function MinutesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();

  const [minutes, setMinutes] = useState<Minute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>('all');

  useEffect(() => {
    const isFinalizedParam = searchParams.get('isFinalized');
    if (isFinalizedParam === 'true') {
      setFilter('finalized');
    } else if (isFinalizedParam === 'false') {
      setFilter('draft');
    } else {
      setFilter('all');
    }
  }, [searchParams]);

  const fetchMinutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (filter === 'finalized') params.set('isFinalized', 'true');
      if (filter === 'draft') params.set('isFinalized', 'false');

      const response = await fetch(`/api/minutes?${params.toString()}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to load minutes');
      const result = await response.json();
      setMinutes(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Protokolle');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }
    if (user) fetchMinutes();
  }, [authLoading, user, router, fetchMinutes]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)]"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Protokolle</h1>
          <p className="text-slate-600 mt-1">Übersicht aller verfügbaren Protokolle</p>
        </div>

        <div className="mb-6 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${filter === 'all' ? 'bg-[var(--brand-primary)] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Alle
            </button>
            <button
              type="button"
              onClick={() => setFilter('draft')}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${filter === 'draft' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Entwürfe
            </button>
            <button
              type="button"
              onClick={() => setFilter('finalized')}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${filter === 'finalized' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Finalisiert
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">
            {error}
          </div>
        )}

        {minutes.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-600">
            Keine Protokolle gefunden.
          </div>
        ) : (
          <div className="space-y-3">
            {minutes.map((minute) => {
              const isFinalized = Boolean(minute.isFinalized ?? minute.finalized);
              const seriesLabel = minute.meetingSeries_id
                ? `${minute.meetingSeries_id.project || 'Sitzung'}${minute.meetingSeries_id.name ? ` – ${minute.meetingSeries_id.name}` : ''}`
                : 'Sitzung';

              return (
                <Link
                  key={minute._id}
                  href={`/minutes/${minute._id}`}
                  className="block bg-white/90 border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-900 break-words">
                        {minute.title || `Protokoll vom ${new Date(minute.date).toLocaleDateString(locale)}`}
                      </h2>
                      <p className="text-sm text-slate-600 break-words">
                        {seriesLabel} • {new Date(minute.date).toLocaleDateString(locale)}
                      </p>
                    </div>
                    <span className={`inline-flex self-start sm:self-center px-2.5 py-1 rounded-full text-xs font-semibold ${isFinalized ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isFinalized ? 'Finalisiert' : 'Entwurf'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
