export type BrandColorSettings = {
  primary: string;
  primaryDark: string;
  secondary: string;
  pageFrom: string;
  pageTo: string;
};

export const DEFAULT_BRAND_COLORS: BrandColorSettings = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  secondary: '#8B5CF6',
  pageFrom: '#F8FAFC',
  pageTo: '#F1F5F9',
};

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;

function normalizeHexColor(input: unknown, fallback: string): string {
  const raw = String(input || '').trim();
  const prefixed = raw.startsWith('#') ? raw : `#${raw}`;
  if (!HEX_COLOR_PATTERN.test(prefixed)) return fallback;
  return prefixed.toUpperCase();
}

export function sanitizeBrandColors(input: unknown): BrandColorSettings {
  const source = (input && typeof input === 'object' ? input : {}) as Partial<BrandColorSettings>;
  return {
    primary: normalizeHexColor(source.primary, DEFAULT_BRAND_COLORS.primary),
    primaryDark: normalizeHexColor(source.primaryDark, DEFAULT_BRAND_COLORS.primaryDark),
    secondary: normalizeHexColor(source.secondary, DEFAULT_BRAND_COLORS.secondary),
    pageFrom: normalizeHexColor(source.pageFrom, DEFAULT_BRAND_COLORS.pageFrom),
    pageTo: normalizeHexColor(source.pageTo, DEFAULT_BRAND_COLORS.pageTo),
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = sanitizeBrandColors({ primary: hex }).primary;
  const value = normalized.slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

export function getBrandCssVars(input: unknown): Record<string, string> {
  const colors = sanitizeBrandColors(input);
  return {
    '--brand-primary': colors.primary,
    '--brand-primary-strong': colors.primaryDark,
    '--brand-secondary': colors.secondary,
    '--brand-page-from': colors.pageFrom,
    '--brand-page-to': colors.pageTo,
    '--brand-primary-soft': hexToRgba(colors.primary, 0.12),
    '--brand-primary-border': hexToRgba(colors.primary, 0.32),
    '--brand-primary-shadow': hexToRgba(colors.primary, 0.35),
  };
}
