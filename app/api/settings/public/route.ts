import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { DEFAULT_BRAND_COLORS, sanitizeBrandColors } from '@/lib/brand-colors';

const DEFAULT_MAX_FILE_UPLOAD_SIZE_MB = 10;
const DEFAULT_ALLOWED_FILE_TYPES = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'txt',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
];

function sanitizeAllowedFileTypes(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  const sanitized = Array.from(
    new Set(
      list
        .map((entry) => String(entry || '').trim().toLowerCase().replace(/^\./, ''))
        .filter((entry) => /^[a-z0-9]{1,10}$/.test(entry))
    )
  );
  return sanitized.length > 0 ? sanitized : DEFAULT_ALLOWED_FILE_TYPES;
}

function sanitizeMaxFileUploadSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_FILE_UPLOAD_SIZE_MB;
  return Math.min(Math.max(Math.round(parsed), 1), 200);
}

export async function GET(_request: NextRequest) {
  try {
    await connectDB();

    // Get current settings (no authentication required for public settings)
    const settings = await Settings.findOne({}).sort({ updatedAt: -1 });

    if (!settings) {
      return NextResponse.json({
        success: true,
        data: {
          system: {
            organizationName: 'NXTMinutes',
            organizationLogo: null,
            agendaItemLabelMode: 'topic-alpha',
            timeFormat: '24h',
            brandColors: DEFAULT_BRAND_COLORS,
            maxFileUploadSize: DEFAULT_MAX_FILE_UPLOAD_SIZE_MB,
            allowedFileTypes: DEFAULT_ALLOWED_FILE_TYPES,
          },
          language: {
            defaultLanguage: 'de',
          },
        },
      });
    }

    // Public branding + display prefs only. Do not expose member/auth policy here
    // (self-registration / admin approval are enforced in /api/auth/register, not advertised).
    const publicSettings = {
      system: {
        organizationName: settings.systemSettings?.organizationName || 'NXTMinutes',
        organizationLogo: settings.systemSettings?.organizationLogo,
        agendaItemLabelMode: settings.memberSettings?.agendaItemLabelMode || 'topic-alpha',
        timeFormat: settings.systemSettings?.timeFormat || '24h',
        brandColors: sanitizeBrandColors(settings.systemSettings?.brandColors),
        maxFileUploadSize: sanitizeMaxFileUploadSize(settings.systemSettings?.maxFileUploadSize),
        allowedFileTypes: sanitizeAllowedFileTypes(settings.systemSettings?.allowedFileTypes),
      },
      language: {
        defaultLanguage: settings.languageSettings?.defaultLanguage || 'de',
      },
    };

    const response = NextResponse.json({
      success: true,
      data: publicSettings
    });
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;

  } catch (error) {
    console.error('Error fetching public settings:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Einstellungen' },
      { status: 500 }
    );
  }
}
