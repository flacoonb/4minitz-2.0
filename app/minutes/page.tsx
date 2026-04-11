"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
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
  const t = useTranslations();
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
      if (!response.ok) throw new Error(t('minutes.loadListError'));
      const result = await response.json();
      setMinutes(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('minutes.loadListError'));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

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
    <div className="min-h-screen brand-page-gradient">
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--brand-text)' }}>{t('minutes.title')}</h1>
          <p className="mt-1 app-text-muted">{t('minutes.subtitle')}</p>
        </div>

        <div className="mb-4 app-card rounded-xl p-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${filter === 'all' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--brand-surface-soft)] hover:brightness-95'}`}
              style={filter !== 'all' ? { color: 'var(--brand-text)' } : undefined}
            >
              {t('minutes.allStatus')}
            </button>
            <button
              type="button"
              onClick={() => setFilter('draft')}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${filter === 'draft' ? 'text-white' : 'bg-[var(--brand-surface-soft)] hover:brightness-95'}`}
              style={filter === 'draft' ? { backgroundColor: 'var(--brand-warning)' } : { color: 'var(--brand-text)' }}
            >
              {t('minutes.draft')}
            </button>
            <button
              type="button"
              onClick={() => setFilter('finalized')}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${filter === 'finalized' ? 'text-white' : 'bg-[var(--brand-surface-soft)] hover:brightness-95'}`}
              style={filter === 'finalized' ? { backgroundColor: 'var(--brand-success)' } : { color: 'var(--brand-text)' }}
            >
              {t('minutes.finalized')}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--brand-danger-border)', backgroundColor: 'var(--brand-danger-soft)', color: 'var(--brand-danger)' }}>
            {error}
          </div>
        )}

        {minutes.length === 0 ? (
          <div className="app-card rounded-xl p-8 text-center app-text-muted">
            {t('minutes.noMinutesYet')}
          </div>
        ) : (
          <div className="space-y-3">
            {minutes.map((minute) => {
              const isFinalized = Boolean(minute.isFinalized ?? minute.finalized);
              const seriesLabel = minute.meetingSeries_id
                ? `${minute.meetingSeries_id.project || t('minutes.defaultSeriesName')}${minute.meetingSeries_id.name ? ` – ${minute.meetingSeries_id.name}` : ''}`
                : t('minutes.defaultSeriesName');

              return (
                <Link
                  key={minute._id}
                  href={`/minutes/${minute._id}`}
                  className="block app-card rounded-xl p-4 hover:shadow-md transition-shadow"
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
