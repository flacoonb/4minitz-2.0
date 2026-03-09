import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import ClubFunction from '@/models/ClubFunction';
import {
  createFunctionToken,
  normalizeFunctionName,
  slugifyFunctionName,
} from '@/lib/club-functions';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const auth = await verifyToken(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const onlyActive = searchParams.get('activeOnly') !== 'false';

    const query: Record<string, unknown> = {};
    if (!includeInactive && onlyActive) {
      query.isActive = true;
    }

    const data = await ClubFunction.find(query)
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      count: data.length,
      data: data.map((entry: any) => ({
        ...entry,
        token: createFunctionToken(entry.slug),
      })),
    });
  } catch (error) {
    console.error('Error loading club functions:', error);
    return NextResponse.json({ error: 'Failed to load club functions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const auth = await verifyToken(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const canManageUsers = await hasPermission(auth.user, 'canManageUsers');
    if (!canManageUsers && auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const name = normalizeFunctionName(String(body?.name || ''));
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0;
    const validFrom = body?.validFrom ? new Date(body.validFrom) : undefined;
    const validTo = body?.validTo ? new Date(body.validTo) : undefined;
    const isActive = body?.isActive !== false;

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Name ist erforderlich (mindestens 2 Zeichen)' }, { status: 400 });
    }

    let slug = typeof body?.slug === 'string' ? slugifyFunctionName(body.slug) : '';
    if (!slug) slug = slugifyFunctionName(name);
    if (!slug) {
      return NextResponse.json({ error: 'Ungültiger Funktions-Slug' }, { status: 400 });
    }

    const exists = await ClubFunction.findOne({ $or: [{ slug }, { name }] }).lean();
    if (exists) {
      return NextResponse.json({ error: 'Funktion mit gleichem Namen oder Slug existiert bereits' }, { status: 409 });
    }

    const userId = auth.user._id.toString();
    const created = await ClubFunction.create({
      name,
      slug,
      description,
      sortOrder,
      isActive,
      validFrom: validFrom && !Number.isNaN(validFrom.getTime()) ? validFrom : undefined,
      validTo: validTo && !Number.isNaN(validTo.getTime()) ? validTo : undefined,
      createdBy: userId,
      updatedBy: userId,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...created.toObject(),
        token: createFunctionToken(created.slug),
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating club function:', error);
    if (error?.code === 11000) {
      return NextResponse.json({ error: 'Funktion mit gleichem Slug existiert bereits' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create club function' }, { status: 500 });
  }
}
