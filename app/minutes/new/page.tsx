"use client";

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function NewMinuteRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('minutes');
  
  useEffect(() => {
    // Redirect to enhanced version with all search params
    const params = new URLSearchParams(searchParams.toString());
    router.replace(`/minutes/new-enhanced?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{t('redirectingToEnhanced')}</p>
      </div>
    </div>
  );
}