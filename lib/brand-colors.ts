export type BrandColorSettings = {
  primary: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  dashboardSeriesBadge: string;
  dashboardMinutesBadge: string;
  dashboardDraftsBadge: string;
  dashboardTasksBadge: string;
  dashboardOverdueBadge: string;
  dashboardUpcomingBadge: string;
  dashboardMinuteDraftBadge: string;
  dashboardMinuteFinalBadge: string;
  pageFrom: string;
  pageTo: string;
  surface: string;
  card: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  success: string;
  warning: string;
  danger: string;
};

export const DEFAULT_BRAND_COLORS: BrandColorSettings = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  secondary: '#8B5CF6',
  accent: '#06B6D4',
  dashboardSeriesBadge: '#06B6D4',
  dashboardMinutesBadge: '#0891B2',
  dashboardDraftsBadge: '#0E7490',
  dashboardTasksBadge: '#0F766E',
  dashboardOverdueBadge: '#0F766E',
  dashboardUpcomingBadge: '#0D9488',
  dashboardMinuteDraftBadge: '#0E7490',
  dashboardMinuteFinalBadge: '#0891B2',
  pageFrom: '#F8FAFC',
  pageTo: '#F1F5F9',
  surface: '#EEF2FF',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
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
    accent: normalizeHexColor(source.accent, DEFAULT_BRAND_COLORS.accent),
    dashboardSeriesBadge: normalizeHexColor(source.dashboardSeriesBadge, DEFAULT_BRAND_COLORS.dashboardSeriesBadge),
    dashboardMinutesBadge: normalizeHexColor(source.dashboardMinutesBadge, DEFAULT_BRAND_COLORS.dashboardMinutesBadge),
    dashboardDraftsBadge: normalizeHexColor(source.dashboardDraftsBadge, DEFAULT_BRAND_COLORS.dashboardDraftsBadge),
    dashboardTasksBadge: normalizeHexColor(source.dashboardTasksBadge, DEFAULT_BRAND_COLORS.dashboardTasksBadge),
    dashboardOverdueBadge: normalizeHexColor(source.dashboardOverdueBadge, DEFAULT_BRAND_COLORS.dashboardOverdueBadge),
    dashboardUpcomingBadge: normalizeHexColor(source.dashboardUpcomingBadge, DEFAULT_BRAND_COLORS.dashboardUpcomingBadge),
    dashboardMinuteDraftBadge: normalizeHexColor(source.dashboardMinuteDraftBadge, DEFAULT_BRAND_COLORS.dashboardMinuteDraftBadge),
    dashboardMinuteFinalBadge: normalizeHexColor(source.dashboardMinuteFinalBadge, DEFAULT_BRAND_COLORS.dashboardMinuteFinalBadge),
    pageFrom: normalizeHexColor(source.pageFrom, DEFAULT_BRAND_COLORS.pageFrom),
    pageTo: normalizeHexColor(source.pageTo, DEFAULT_BRAND_COLORS.pageTo),
    surface: normalizeHexColor(source.surface, DEFAULT_BRAND_COLORS.surface),
    card: normalizeHexColor(source.card, DEFAULT_BRAND_COLORS.card),
    cardBorder: normalizeHexColor(source.cardBorder, DEFAULT_BRAND_COLORS.cardBorder),
    text: normalizeHexColor(source.text, DEFAULT_BRAND_COLORS.text),
    textMuted: normalizeHexColor(source.textMuted, DEFAULT_BRAND_COLORS.textMuted),
    success: normalizeHexColor(source.success, DEFAULT_BRAND_COLORS.success),
    warning: normalizeHexColor(source.warning, DEFAULT_BRAND_COLORS.warning),
    danger: normalizeHexColor(source.danger, DEFAULT_BRAND_COLORS.danger),
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

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHexChannel(value: number): string {
  return clampChannel(value).toString(16).padStart(2, '0').toUpperCase();
}

function mixHex(baseHex: string, targetHex: string, ratio: number): string {
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  return `#${toHexChannel(base.r + (target.r - base.r) * safeRatio)}${toHexChannel(base.g + (target.g - base.g) * safeRatio)}${toHexChannel(base.b + (target.b - base.b) * safeRatio)}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

export function getBrandCssVars(input: unknown): Record<string, string> {
  const colors = sanitizeBrandColors(input);
  const dashboardSeriesBadgeInk = mixHex(colors.dashboardSeriesBadge, '#111827', 0.16);
  const dashboardMinutesBadgeInk = mixHex(colors.dashboardMinutesBadge, '#111827', 0.16);
  const dashboardDraftsBadgeInk = mixHex(colors.dashboardDraftsBadge, '#111827', 0.16);
  const dashboardTasksBadgeInk = mixHex(colors.dashboardTasksBadge, '#111827', 0.16);
  const dashboardOverdueBadgeInk = mixHex(colors.dashboardOverdueBadge, '#111827', 0.16);
  const dashboardUpcomingBadgeInk = mixHex(colors.dashboardUpcomingBadge, '#111827', 0.16);
  const dashboardMinuteDraftBadgeInk = mixHex(colors.dashboardMinuteDraftBadge, '#111827', 0.16);
  const dashboardMinuteFinalBadgeInk = mixHex(colors.dashboardMinuteFinalBadge, '#111827', 0.16);
  return {
    '--brand-primary': colors.primary,
    '--brand-primary-strong': colors.primaryDark,
    '--brand-secondary': colors.secondary,
    '--brand-accent': colors.accent,
    '--brand-page-from': colors.pageFrom,
    '--brand-page-to': colors.pageTo,
    '--brand-surface': colors.surface,
    '--brand-card': colors.card,
    '--brand-card-border': colors.cardBorder,
    '--brand-text': colors.text,
    '--brand-text-muted': colors.textMuted,
    '--brand-success': colors.success,
    '--brand-warning': colors.warning,
    '--brand-danger': colors.danger,
    '--brand-primary-soft': hexToRgba(colors.primary, 0.12),
    '--brand-primary-border': hexToRgba(colors.primary, 0.32),
    '--brand-primary-shadow': hexToRgba(colors.primary, 0.35),
    '--brand-surface-soft': hexToRgba(colors.surface, 0.7),
    '--brand-card-soft': hexToRgba(colors.card, 0.82),
    '--brand-muted-soft': hexToRgba(colors.textMuted, 0.14),
    '--brand-danger-soft': hexToRgba(colors.danger, 0.12),
    '--brand-danger-border': hexToRgba(colors.danger, 0.28),
    '--brand-warning-soft': hexToRgba(colors.warning, 0.14),
    '--brand-warning-border': hexToRgba(colors.warning, 0.28),
    '--brand-success-soft': hexToRgba(colors.success, 0.12),
    '--brand-success-border': hexToRgba(colors.success, 0.28),
    '--brand-dashboard-badge-series': colors.dashboardSeriesBadge,
    '--brand-dashboard-badge-series-soft': hexToRgba(colors.dashboardSeriesBadge, 0.14),
    '--brand-dashboard-badge-series-ink': dashboardSeriesBadgeInk,
    '--brand-dashboard-badge-minutes': colors.dashboardMinutesBadge,
    '--brand-dashboard-badge-minutes-soft': hexToRgba(colors.dashboardMinutesBadge, 0.14),
    '--brand-dashboard-badge-minutes-ink': dashboardMinutesBadgeInk,
    '--brand-dashboard-badge-drafts': colors.dashboardDraftsBadge,
    '--brand-dashboard-badge-drafts-soft': hexToRgba(colors.dashboardDraftsBadge, 0.14),
    '--brand-dashboard-badge-drafts-ink': dashboardDraftsBadgeInk,
    '--brand-dashboard-badge-tasks': colors.dashboardTasksBadge,
    '--brand-dashboard-badge-tasks-soft': hexToRgba(colors.dashboardTasksBadge, 0.14),
    '--brand-dashboard-badge-tasks-ink': dashboardTasksBadgeInk,
    '--brand-dashboard-badge-overdue': colors.dashboardOverdueBadge,
    '--brand-dashboard-badge-overdue-soft': hexToRgba(colors.dashboardOverdueBadge, 0.14),
    '--brand-dashboard-badge-overdue-ink': dashboardOverdueBadgeInk,
    '--brand-dashboard-badge-upcoming': colors.dashboardUpcomingBadge,
    '--brand-dashboard-badge-upcoming-soft': hexToRgba(colors.dashboardUpcomingBadge, 0.14),
    '--brand-dashboard-badge-upcoming-ink': dashboardUpcomingBadgeInk,
    '--brand-dashboard-badge-minute-draft': colors.dashboardMinuteDraftBadge,
    '--brand-dashboard-badge-minute-draft-soft': hexToRgba(colors.dashboardMinuteDraftBadge, 0.14),
    '--brand-dashboard-badge-minute-draft-ink': dashboardMinuteDraftBadgeInk,
    '--brand-dashboard-badge-minute-final': colors.dashboardMinuteFinalBadge,
    '--brand-dashboard-badge-minute-final-soft': hexToRgba(colors.dashboardMinuteFinalBadge, 0.14),
    '--brand-dashboard-badge-minute-final-ink': dashboardMinuteFinalBadgeInk,
  };
}
