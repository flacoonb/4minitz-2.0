/**
 * API Route: Meeting Series
 * Handles CRUD operations for meeting series
 */
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import MeetingSeries from '@/models/MeetingSeries';
import MinutesTemplate from '@/models/MinutesTemplate';
import PdfTemplate from '@/models/PdfTemplate';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { createMeetingSeriesSchema, validateBody } from '@/lib/validations';
import { sanitizeResponsibles, validateFunctionResponsibles } from '@/lib/club-functions';

/**
 * GET /api/meeting-series
 * Retrieve all meeting series visible to the user
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    // Verify authentication (optional). If authenticated, filter by username;
    // otherwise only return public meeting series.
    const authResult = await verifyToken(request);
    const username = authResult.success && authResult.user ? authResult.user.username : null;
    const userId = authResult.success && authResult.user ? authResult.user._id.toString() : null;

    // Check permissions via centralized permission system
    const canViewAll = authResult.user
      ? await hasPermission(authResult.user, 'canViewAllMeetings')
      : false;

    // Build query
    let query: Record<string, unknown> = {};
    if (username && userId) {
      if (!canViewAll) {
        query = {
          $or: [
            { visibleFor: username },
            { visibleFor: userId },
            { moderators: username },
            { moderators: userId },
            { participants: username },
            { participants: userId },
          ],
        };
      }
      // If canViewAll is true, we don't add any filter, so all series are returned
    } else {
      // Unauthenticated: no access
      return NextResponse.json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const series = await MeetingSeries.find(query)
    .sort({ lastMinutesDate: -1, updatedAt: -1 })
    .limit(50)
    .select('-__v')
    .lean();
    
    const response = NextResponse.json({
      success: true,
      count: series.length,
      data: series,
    });
    response.headers.set('Cache-Control', 'private, no-cache');
    return response;
  } catch (error) {
    console.error('Error fetching meeting series:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch meeting series',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/meeting-series
 * Create a new meeting series
 * Only admins and moderators are allowed
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    
    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const username = authResult.user.username;

    // Check permissions via centralized permission system
    const canCreate = await hasPermission(authResult.user, 'canCreateMeetings');
    if (!canCreate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: Sie haben keine Berechtigung, Sitzungsserien zu erstellen'
        },
        { status: 403 }
      );
    }
    
    // Validation
    const validation = validateBody(createMeetingSeriesSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    const validated = validation.data;

    // Create new meeting series
    // Note: moderators, participants, visibleFor should contain usernames, not IDs
    const clubFunctions = sanitizeResponsibles(body.clubFunctions);
    const functionValidation = await validateFunctionResponsibles(clubFunctions);
    if (!functionValidation.valid) {
      return NextResponse.json(
        { success: false, error: functionValidation.error || 'Ungültige Vereinsfunktion' },
        { status: 400 }
      );
    }
    const members = Array.isArray(body.members) ? body.members : [];
    const defaultTemplateIdInput = typeof body.defaultTemplateId === 'string' ? body.defaultTemplateId.trim() : '';
    const defaultPdfTemplateIdInput = typeof body.defaultPdfTemplateId === 'string' ? body.defaultPdfTemplateId.trim() : '';
    let defaultTemplateId: mongoose.Types.ObjectId | undefined;
    let defaultPdfTemplateId: mongoose.Types.ObjectId | undefined;

    if (defaultTemplateIdInput) {
      if (!mongoose.isValidObjectId(defaultTemplateIdInput)) {
        return NextResponse.json(
          { success: false, error: 'Ungültige Standard-Vorlage' },
          { status: 400 }
        );
      }

      const defaultTemplate = await MinutesTemplate.findById(defaultTemplateIdInput)
        .select('scope isActive')
        .lean();

      if (!defaultTemplate || !defaultTemplate.isActive) {
        return NextResponse.json(
          { success: false, error: 'Standard-Vorlage nicht gefunden oder inaktiv' },
          { status: 400 }
        );
      }

      if (defaultTemplate.scope !== 'global') {
        return NextResponse.json(
          { success: false, error: 'Beim Erstellen sind nur globale Standard-Vorlagen erlaubt' },
          { status: 400 }
        );
      }

      defaultTemplateId = new mongoose.Types.ObjectId(defaultTemplateIdInput);
    }

    if (defaultPdfTemplateIdInput) {
      if (!mongoose.isValidObjectId(defaultPdfTemplateIdInput)) {
        return NextResponse.json(
          { success: false, error: 'Ungültige PDF-Vorlage' },
          { status: 400 }
        );
      }

      const defaultPdfTemplateExists = await PdfTemplate.exists({
        _id: defaultPdfTemplateIdInput,
      });

      if (!defaultPdfTemplateExists) {
        return NextResponse.json(
          { success: false, error: 'PDF-Vorlage nicht gefunden' },
          { status: 400 }
        );
      }

      defaultPdfTemplateId = new mongoose.Types.ObjectId(defaultPdfTemplateIdInput);
    }

    const newSeries = await MeetingSeries.create({
      project: validated.project,
      name: validated.name || '',
      visibleFor: validated.visibleFor || [], // Can be empty for public access
      moderators: [username, ...(validated.moderators || [])].filter((v, i, a) => a.indexOf(v) === i), // Remove duplicates
      participants: validated.participants || [],
      informedUsers: body.informedUsers || [],
      additionalResponsibles: body.additionalResponsibles || [],
      clubFunctions,
      members,
      defaultTemplateId,
      defaultPdfTemplateId,
      availableLabels: body.availableLabels || [
        { name: 'Important', color: '#FF0000', isDefaultLabel: true },
        { name: 'Decision', color: '#00FF00', isDefaultLabel: true },
        { name: 'TODO', color: '#0000FF', isDefaultLabel: true },
      ],
    });
    
    return NextResponse.json(
      {
        success: true,
        data: newSeries,
        message: 'Meeting series created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating meeting series:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create meeting series',
      },
      { status: 500 }
    );
  }
}
