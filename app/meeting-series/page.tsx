'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import MeetingSeriesList from '@/components/MeetingSeriesList';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function MeetingSeriesPage() {
  const t = useTranslations('meetingSeries');
  const router = useRouter();
  const { user, loading: authLoading, hasPermission } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)]"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5">
      {/* Header Section */}
      <div className="bg-[var(--brand-primary-soft)] rounded-xl p-4 sm:p-5 border border-[var(--brand-primary-border)]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 brand-gradient-bg rounded-xl flex items-center justify-center shadow">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent break-words" style={{ backgroundImage: 'linear-gradient(90deg, var(--brand-text), var(--brand-text-muted))' }}>
                {t('title')}
              </h1>
              <p className="text-sm sm:text-base mt-1 app-text-muted">
                {t('subtitle')}
              </p>
            </div>
          </div>
          
          {hasPermission('canCreateMeetings') && (
            <Link
              href="/meeting-series/new"
              className="hidden md:inline-flex w-full md:w-auto justify-center items-center gap-2 px-6 py-3 min-h-11 brand-button-primary rounded-xl shadow-lg hover:shadow-xl md:hover:scale-105 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('createNew')}
            </Link>
          )}
        </div>
      </div>

      {hasPermission('canCreateMeetings') && (
        <div className="md:hidden sticky top-28 z-40">
          <Link
            href="/meeting-series/new"
            className="inline-flex w-full justify-center items-center gap-2 px-6 py-3 min-h-11 brand-button-primary rounded-xl shadow-lg transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('createNew')}
          </Link>
        </div>
      )}

      {/* Meeting Series List */}
      <div className="app-card rounded-xl p-4 sm:p-5 shadow-sm">
        <MeetingSeriesList />
      </div>
    </div>
  );
}
