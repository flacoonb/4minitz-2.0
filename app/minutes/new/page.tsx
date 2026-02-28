'use client';

import Link from 'next/link';

export default function NewMinuteInfoPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="bg-blue-100 rounded-full p-4 mx-auto mb-4 w-16 h-16 flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Neues Protokoll erstellen</h2>
        <p className="text-gray-600 mb-6 text-sm">
          Protokolle werden innerhalb einer Sitzungsserie erstellt.
          Wählen Sie eine Sitzungsserie aus und klicken Sie dort auf &quot;Neues Protokoll&quot;.
        </p>
        <Link
          href="/meeting-series"
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium inline-block"
        >
          Zu den Sitzungsserien
        </Link>
      </div>
    </div>
  );
}
