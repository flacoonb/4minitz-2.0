import { NextRequest, NextResponse } from 'next/server';

// POST - Logout user
export async function POST(_request: NextRequest) {
  try {
    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Abmeldung erfolgreich'
    });

    // Determine if we should use secure cookies
    const isProduction = process.env.NODE_ENV === 'production';
    const isHttp = process.env.NEXTAUTH_URL?.startsWith('http://');
    const useSecureCookies = isProduction && !isHttp && process.env.DISABLE_SECURE_COOKIES !== 'true';

    // Clear auth cookie
    response.cookies.set({
      name: 'auth-token',
      value: '',
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: 'lax',
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