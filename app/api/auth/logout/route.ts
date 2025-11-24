import { NextRequest, NextResponse } from 'next/server';

// POST - Logout user
export async function POST(request: NextRequest) {
  try {
    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Abmeldung erfolgreich'
    });

    // Clear auth cookie
    response.cookies.set({
      name: 'auth-token',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0 // Expire immediately
    });

    return response;

  } catch (error: any) {
    console.error('Error logging out user:', error);
    return NextResponse.json(
      { error: 'Fehler bei der Abmeldung' },
      { status: 500 }
    );
  }
}