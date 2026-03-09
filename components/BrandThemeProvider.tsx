'use client';

import { useCallback, useEffect } from 'react';
import { getBrandCssVars, DEFAULT_BRAND_COLORS, sanitizeBrandColors } from '@/lib/brand-colors';

function applyBrandVars(colors: unknown) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const vars = getBrandCssVars(colors);
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

export default function BrandThemeProvider({ children }: { children: React.ReactNode }) {
  const refreshBrandColors = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/public', { cache: 'no-store' });
      if (!response.ok) {
        applyBrandVars(DEFAULT_BRAND_COLORS);
        return;
      }
      const payload = await response.json();
      const colors = sanitizeBrandColors(payload?.data?.system?.brandColors);
      applyBrandVars(colors);
    } catch {
      applyBrandVars(DEFAULT_BRAND_COLORS);
    }
  }, []);

  useEffect(() => {
    refreshBrandColors();
    const handler = () => {
      refreshBrandColors();
    };
    window.addEventListener('settingsUpdated', handler);
    return () => {
      window.removeEventListener('settingsUpdated', handler);
    };
  }, [refreshBrandColors]);

  return <>{children}</>;
}
