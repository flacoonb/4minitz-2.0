import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PdfLayoutSettings from '@/models/PdfLayoutSettings';
import { verifyToken } from '@/lib/auth';

// GET - Retrieve PDF layout settings
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();
    
    // Find the most recent settings (there should only be one)
    let settings = await PdfLayoutSettings.findOne().sort({ updatedAt: -1 });
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = await PdfLayoutSettings.create({
        elements: [
          {
            id: 'header',
            type: 'header',
            label: 'Kopfzeile',
            enabled: true,
            position: { x: 20, y: 20 },
            size: { width: 170, height: 25 },
            style: {
              borderWidth: 0.5,
              borderColor: '#000000'
            }
          },
          {
            id: 'protocol-title',
            type: 'title',
            label: 'Protokoll-Titel',
            enabled: true,
            position: { x: 55, y: 27 },
            size: { width: 100, height: 10 },
            style: {
              fontSize: 24,
              fontWeight: 'bold',
              alignment: 'center'
            }
          },
          {
            id: 'info-box',
            type: 'info-box',
            label: 'Info-Box (Ort/Datum/Zeit)',
            enabled: true,
            position: { x: 20, y: 50 },
            size: { width: 170, height: 10 },
            style: {
              borderWidth: 0.5,
              borderColor: '#000000',
              fontSize: 9
            }
          },
          {
            id: 'topic-title',
            type: 'topic-title',
            label: 'Themen-Titel',
            enabled: true,
            position: { x: 20, y: 70 },
            size: { width: 170, height: 8 },
            style: {
              fontSize: 11,
              fontWeight: 'bold',
              backgroundColor: '#F3F4F6',
              borderWidth: 0.5
            }
          },
          {
            id: 'item-label',
            type: 'item-label',
            label: 'Item-Label (1a, 1b, etc.)',
            enabled: true,
            position: { x: 22, y: 85 },
            size: { width: 12, height: 5.5 },
            style: {
              fontSize: 8,
              fontWeight: 'bold',
              alignment: 'center',
              backgroundColor: '#3B82F6',
              color: '#FFFFFF'
            }
          },
          {
            id: 'separator',
            type: 'separator',
            label: 'Trennlinie zwischen Items',
            enabled: true,
            position: { x: 20, y: 95 },
            size: { width: 170, height: 0.3 },
            style: {
              borderWidth: 0.3,
              borderColor: '#E6E6E6',
              backgroundColor: '#E6E6E6'
            }
          }
        ],
        pageMargins: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20
        },
        itemSpacing: 5,
        sectionSpacing: 5,
        labelColors: {
          info: '#3B82F6',
          task: '#F97316'
        },
        logo: {
          enabled: false,
          url: '',
          position: { x: 25, y: 25 },
          size: { width: 40, height: 15 }
        }
      });
    }
    
    // Ensure logo field exists in response (even if not in DB)
    const responseData = settings.toObject();
    if (!responseData.logo) {
      responseData.logo = {
        enabled: false,
        url: '',
        position: { x: 25, y: 25 },
        size: { width: 40, height: 15 }
      };
    }
    
    return NextResponse.json({ 
      success: true, 
      data: responseData 
    });
  } catch (error) {
    console.error('Error fetching PDF layout settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch PDF layout settings' },
      { status: 500 }
    );
  }
}

// PUT - Update or create PDF layout settings
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!['admin', 'moderator'].includes(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    await connectDB();

    const body = await request.json();

    // Find existing settings
    let settings = await PdfLayoutSettings.findOne().sort({ updatedAt: -1 });
    
    if (settings) {
      // Update existing settings - be explicit about nested objects
      if (body.elements) settings.elements = body.elements;
      if (body.pageMargins) settings.pageMargins = body.pageMargins;
      if (body.itemSpacing !== undefined) settings.itemSpacing = body.itemSpacing;
      if (body.sectionSpacing !== undefined) settings.sectionSpacing = body.sectionSpacing;
      if (body.labelColors) settings.labelColors = body.labelColors;
      if (body.logo !== undefined) {
        // Initialize logo if it doesn't exist
        if (!settings.logo) {
          settings.logo = {
            enabled: false,
            url: '',
            position: { x: 25, y: 25 },
            size: { width: 40, height: 15 }
          };
        }
        // Update logo fields
        if (body.logo.enabled !== undefined) settings.logo.enabled = body.logo.enabled;
        if (body.logo.url !== undefined) settings.logo.url = body.logo.url;
        if (body.logo.position) settings.logo.position = body.logo.position;
        if (body.logo.size) settings.logo.size = body.logo.size;
        // Mark as modified for Mongoose
        settings.markModified('logo');
      }
      settings.updatedAt = new Date();
      await settings.save();
    } else {
      // Create new settings with defaults
      const newSettings: any = {
        ...body,
        logo: body.logo || {
          enabled: false,
          url: '',
          position: { x: 25, y: 25 },
          size: { width: 40, height: 15 }
        }
      };
      settings = await PdfLayoutSettings.create(newSettings);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: settings 
    });
  } catch (error) {
    console.error('Error updating PDF layout settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update PDF layout settings' },
      { status: 500 }
    );
  }
}

// DELETE - Reset to default settings
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    if (authResult.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin permissions required' },
        { status: 403 }
      );
    }

    await connectDB();
    
    // Delete all settings
    await PdfLayoutSettings.deleteMany({});
    
    return NextResponse.json({ 
      success: true, 
      message: 'PDF layout settings reset to defaults' 
    });
  } catch (error) {
    console.error('Error resetting PDF layout settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset PDF layout settings' },
      { status: 500 }
    );
  }
}
