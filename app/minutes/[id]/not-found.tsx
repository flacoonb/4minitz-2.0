'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function MinutesNotFound() {
  const t = useTranslations('errorPages');

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="bg-gray-100 rounded-full p-4 mx-auto mb-4 w-16 h-16 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('minuteNotFound')}</h2>
        <p className="text-gray-600 mb-6 text-sm">
          {t('minuteNotFoundText')}
        </p>
        <Link
          href="/meeting-series"
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium inline-block"
        >
          {t('backToHome')}
        </Link>
      </div>
    </div>
  );
}
