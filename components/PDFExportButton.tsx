'use client';

import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { downloadMinutesPDF, PDFOptions } from '@/lib/pdf-generator';

interface PDFExportButtonProps {
  minute: any;
  locale: 'de' | 'en';
  options?: PDFOptions;
  className?: string;
}

export default function PDFExportButton({ 
  minute, 
  locale, 
  options = {},
  className = ''
}: PDFExportButtonProps) {
  const t = useTranslations('minutes');

  const handleExport = () => {
    try {
      downloadMinutesPDF(minute, { 
        locale,
        ...options
      });
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert(t('exportError'));
    }
  };

  return (
    <button
      onClick={handleExport}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors ${className}`}
    >
      <FileText className="w-4 h-4" />
      {t('exportPDF')}
    </button>
  );
}
