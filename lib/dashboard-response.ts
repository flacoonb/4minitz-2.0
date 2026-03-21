/**
 * Minimal shapes for GET /api/dashboard (avoid sending full Task/Minutes documents).
 */

export function serializeDashboardMinute(raw: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw._id;
  const seriesRaw = raw.meetingSeries_id as Record<string, unknown> | null | undefined;
  const series =
    seriesRaw && typeof seriesRaw === 'object'
      ? {
          project: seriesRaw.project != null ? String(seriesRaw.project) : null,
          name: seriesRaw.name != null ? String(seriesRaw.name) : null,
        }
      : null;

  return {
    _id: id != null ? String(id) : '',
    date: raw.date,
    isFinalized: Boolean(raw.isFinalized),
    meetingSeries_id: series,
  };
}
