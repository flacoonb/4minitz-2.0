import { useTranslations } from 'next-intl';

export default function Loading() {
  const t = useTranslations('errorPages');

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--brand-primary-soft)] border-t-[var(--brand-primary)]" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('loading')}</p>
      </div>
    </div>
  );
}
