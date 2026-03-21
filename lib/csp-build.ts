/**
 * Build Content-Security-Policy for the app (nonce-based, no scheme wildcards like https:).
 * Used by root `proxy.ts` so policy stays testable and in one place.
 */

function parseOriginList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type BuildCspOptions = {
  nonce: string;
  isDev: boolean;
  allowCloudflareInsights: boolean;
  /**
   * If true, style-src has no unsafe-inline (breaks many React `style={{}}` props until migrated to CSS).
   * Default false: scripts stay strict; styles allow unsafe-inline for compatibility.
   */
  strictStyles: boolean;
  /** Space- or comma-separated extra script origins (full origins, e.g. https://static.example.com) */
  extraScriptSrc?: string;
  /** Extra connect-src origins (e.g. push gateway if needed) */
  extraConnectSrc?: string;
  /** Extra img-src origins for external logos/avatars (no * or https:) */
  extraImgSrc?: string;
  /** Send upgrade-insecure-requests (HTTPS deployments) */
  upgradeInsecureRequests: boolean;
};

export function buildContentSecurityPolicyHeader(opts: BuildCspOptions): string {
  const {
    nonce,
    isDev,
    allowCloudflareInsights,
    strictStyles,
    extraScriptSrc,
    extraConnectSrc,
    extraImgSrc,
    upgradeInsecureRequests,
  } = opts;

  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDev) scriptSrc.push("'unsafe-eval'");
  if (allowCloudflareInsights) {
    scriptSrc.push('https://static.cloudflareinsights.com');
  }
  scriptSrc.push(...parseOriginList(extraScriptSrc));

  // IMPORTANT: If `style-src` includes a nonce, browsers ignore `'unsafe-inline'` (CSP3).
  // We use many React `style={{}}` props → default production = no nonce in style-src, only
  // `'self' 'unsafe-inline'`. Brand CSS still works via that inline allowance.
  const styleSrc =
    isDev
      ? ["'self'", "'unsafe-inline'"]
      : strictStyles
        ? ["'self'", `'nonce-${nonce}'`]
        : ["'self'", "'unsafe-inline'"];

  const imgSrc = ["'self'", 'data:', 'blob:', ...parseOriginList(extraImgSrc)];

  const connectSrc = ["'self'", ...parseOriginList(extraConnectSrc)];
  if (allowCloudflareInsights) {
    connectSrc.push('https://static.cloudflareinsights.com');
    connectSrc.push('https://cloudflareinsights.com');
  }

  const parts = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    `style-src ${styleSrc.join(' ')}`,
    `img-src ${imgSrc.join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(' ')}`,
    "worker-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ];

  if (upgradeInsecureRequests) {
    parts.push('upgrade-insecure-requests');
  }

  return parts.join('; ');
}
