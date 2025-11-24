import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Get current settings (no authentication required for public settings)
    const settings = await Settings.findOne({}).sort({ version: -1 });

    if (!settings) {
      return NextResponse.json({
        success: true,
        data: {
          system: {
            organizationName: '4Minitz',
            organizationLogo: null
          }
        }
      });
    }

    // Return only public settings
    const publicSettings = {
      system: {
        organizationName: settings.systemSettings?.organizationName || '4Minitz',
        organizationLogo: settings.systemSettings?.organizationLogo,
        allowRegistration: settings.systemSettings?.allowRegistration,
        theme: settings.systemSettings?.theme,
        dateFormat: settings.systemSettings?.dateFormat || 'DD.MM.YYYY',
        timeFormat: settings.systemSettings?.timeFormat || '24h'
      },
      language: {
        defaultLanguage: settings.languageSettings?.defaultLanguage || 'de'
      }
    };

    return NextResponse.json({
      success: true,
      data: publicSettings
    });

  } catch (error: any) {
    console.error('Error fetching public settings:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Einstellungen' },
      { status: 500 }
    );
  }
}
