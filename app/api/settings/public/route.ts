import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { DEFAULT_BRAND_COLORS, sanitizeBrandColors } from '@/lib/brand-colors';

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
      },
      language: {
        defaultLanguage: settings.languageSettings?.defaultLanguage || 'de',
      },
    };

    const response = NextResponse.json({
      success: true,
      data: publicSettings
    });
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return response;

  } catch (error) {
    console.error('Error fetching public settings:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Einstellungen' },
      { status: 500 }
    );
  }
}
