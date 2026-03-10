import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import MeetingSeries from '@/models/MeetingSeries';
import Task from '@/models/Task';
import PushSubscription from '@/models/PushSubscription';
import { verifyToken, requirePermission } from '@/lib/auth';
import { sendVerificationEmail, sendWelcomeEmail } from '@/lib/email-service';
import crypto from 'crypto';

function getRequestBaseUrl(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get('host')?.trim();
  if (host) {
    const proto = request.nextUrl.protocol.replace(/:$/, '') || 'https';
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Users can view their own profile, admins can view any profile
    if (authResult.user!._id.toString() !== id) {
      const permResult = await requirePermission(authResult.user!, 'canManageUsers');
      if (!permResult.success) {
        return NextResponse.json(
          { error: permResult.error },
          { status: 403 }
        );
      }
    }

    const user = await User.findById(id).select('-password');
    if (!user) {
      return NextResponse.json(
        { error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user
    });

  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen des Benutzers' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    // Verify authentication
    const authResult = await verifyToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Users can edit their own profile, admins can edit any profile
    const isOwnProfile = authResult.user!._id.toString() === id;
    if (!isOwnProfile) {
      const permResult = await requirePermission(authResult.user!, 'canManageUsers');
      if (!permResult.success) {
        return NextResponse.json(
          { error: permResult.error },
          { status: 403 }
        );
      }
    }

    // Get the user to update
    const userToUpdate = await User.findById(id);
    if (!userToUpdate) {
      return NextResponse.json(
        { error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    const objectIdLikeUsername = /^[a-fA-F0-9]{24}$/;

    // Update fields (with length/format validation)
    if (body.firstName !== undefined) {
      if (typeof body.firstName !== 'string' || body.firstName.trim().length === 0 || body.firstName.length > 50) {
        return NextResponse.json({ error: 'Vorname muss zwischen 1 und 50 Zeichen lang sein' }, { status: 400 });
      }
      userToUpdate.firstName = body.firstName.trim();
    }
    if (body.lastName !== undefined) {
      if (typeof body.lastName !== 'string' || body.lastName.trim().length === 0 || body.lastName.length > 50) {
        return NextResponse.json({ error: 'Nachname muss zwischen 1 und 50 Zeichen lang sein' }, { status: 400 });
      }
      userToUpdate.lastName = body.lastName.trim();
    }
    let emailChanged = false;
    let emailVerificationToken: string | null = null;
    let verificationMailSent = false;

    if (body.email !== undefined) {
      if (typeof body.email !== 'string' || body.email.trim().length === 0) {
        return NextResponse.json({ error: 'E-Mail ist erforderlich' }, { status: 400 });
      }
      const normalizedEmail = body.email.trim().toLowerCase();
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 });
      }

      if (normalizedEmail !== userToUpdate.email) {
        emailChanged = true;
        userToUpdate.email = normalizedEmail;
        userToUpdate.isEmailVerified = false;
        emailVerificationToken = crypto.randomBytes(32).toString('hex');
        userToUpdate.emailVerificationToken = crypto.createHash('sha256').update(emailVerificationToken).digest('hex');
        userToUpdate.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    }
    if (body.username !== undefined) {
      if (typeof body.username !== 'string' || body.username.length < 3 || body.username.length > 30) {
        return NextResponse.json({ error: 'Benutzername muss zwischen 3 und 30 Zeichen lang sein' }, { status: 400 });
      }
      const normalizedUsername = body.username.trim();
      if (!/^[\p{L}\p{N}._ -]+$/u.test(normalizedUsername)) {
        return NextResponse.json({ error: 'Benutzername darf nur Buchstaben, Zahlen, Leerzeichen, Punkte, Unterstriche und Bindestriche enthalten' }, { status: 400 });
      }
      if (objectIdLikeUsername.test(normalizedUsername)) {
        return NextResponse.json({ error: 'Benutzername darf nicht wie eine Benutzer-ID aussehen' }, { status: 400 });
      }

      if (normalizedUsername !== userToUpdate.username) {
        const conflictingUser = await User.findOne({
          _id: { $ne: id },
          $or: [
            { username: normalizedUsername },
            { usernameHistory: normalizedUsername },
          ],
        }).select('_id');

        if (conflictingUser) {
          return NextResponse.json({ error: 'Benutzername wird bereits verwendet oder ist reserviert' }, { status: 409 });
        }

        userToUpdate.usernameHistory = Array.from(
          new Set([...(userToUpdate.usernameHistory || []), userToUpdate.username])
        );
        userToUpdate.username = normalizedUsername;
      }
    }
    if (body.avatar !== undefined) {
      const isExternalAvatar = typeof body.avatar === 'string' && /^https?:\/\/.+/i.test(body.avatar);
      const isInternalAvatar = typeof body.avatar === 'string' && /^\/api\/uploads\/avatars\/[a-zA-Z0-9._-]+$/i.test(body.avatar);
      if (body.avatar !== null && (typeof body.avatar !== 'string' || body.avatar.length > 500 || (!isExternalAvatar && !isInternalAvatar))) {
        return NextResponse.json({ error: 'Avatar muss eine gültige URL sein' }, { status: 400 });
      }
      userToUpdate.avatar = body.avatar;
    }

    // Handle preferences
    if (body.preferences) {
      if (body.preferences.language) userToUpdate.preferences.language = body.preferences.language;
      if (body.preferences.theme) userToUpdate.preferences.theme = body.preferences.theme;
      
      // Handle flat structure from frontend (backward compatibility)
      if (body.preferences.emailNotifications !== undefined) {
        userToUpdate.preferences.notifications.email = body.preferences.emailNotifications;
      }
      if (body.preferences.pushNotifications !== undefined) {
        userToUpdate.preferences.notifications.inApp = body.preferences.pushNotifications;
      }

      // Handle nested structure
      if (body.preferences.notifications) {
        if (body.preferences.notifications.email !== undefined) {
          userToUpdate.preferences.notifications.email = body.preferences.notifications.email;
        }
        if (body.preferences.notifications.inApp !== undefined) {
          userToUpdate.preferences.notifications.inApp = body.preferences.notifications.inApp;
        }
        if (body.preferences.notifications.reminders !== undefined) {
          userToUpdate.preferences.notifications.reminders = body.preferences.notifications.reminders;
        }
      }
    }

    // Only admins can update role and status
    if (!isOwnProfile) {
      // Protect last admin from demotion or deactivation
      if (userToUpdate.role === 'admin' && (body.role && body.role !== 'admin' || body.isActive === false)) {
        const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: 'Der letzte aktive Admin kann nicht herabgestuft oder deaktiviert werden' },
            { status: 400 }
          );
        }
      }
      if (body.role) userToUpdate.role = body.role;
      if (body.isActive !== undefined) {
        userToUpdate.isActive = body.isActive;
        // Clear pending approval flag when admin activates a user
        if (body.isActive === true && userToUpdate.pendingApproval) {
          userToUpdate.pendingApproval = false;
        }
      }
      if (body.isEmailVerified !== undefined && !emailChanged) {
        userToUpdate.isEmailVerified = body.isEmailVerified;
      }
    }

    // Handle password update
    if (body.password) {
      if (isOwnProfile) {
        // Users must provide current password to change it
        if (!body.currentPassword) {
          return NextResponse.json(
            { error: 'Aktuelles Passwort erforderlich' },
            { status: 400 }
          );
        }

        const isCurrentPasswordValid = await userToUpdate.comparePassword(body.currentPassword);
        if (!isCurrentPasswordValid) {
          return NextResponse.json(
            { error: 'Aktuelles Passwort ist falsch' },
            { status: 400 }
          );
        }
      }
      userToUpdate.password = body.password; // Will be hashed by pre-save middleware
      userToUpdate.tokenVersion = (userToUpdate.tokenVersion || 0) + 1;
    }

    // Detect approval (user was inactive, now being activated)
    const wasApproved = !isOwnProfile && body.isActive === true && userToUpdate.isModified('isActive');

    // Update user
    await userToUpdate.save();

    // Send welcome email on approval
    if (wasApproved) {
      sendWelcomeEmail({
        email: userToUpdate.email,
        firstName: userToUpdate.firstName,
        lastName: userToUpdate.lastName
      }).catch(() => {});
    }

    // Send email verification when address changes
    if (emailChanged && emailVerificationToken) {
      try {
        const appUrlFromRequest = getRequestBaseUrl(request);
        const locale = userToUpdate.preferences?.language === 'en' ? 'en' : 'de';
        await sendVerificationEmail(
          {
            email: userToUpdate.email,
            firstName: userToUpdate.firstName,
            lastName: userToUpdate.lastName,
          },
          emailVerificationToken,
          locale,
          appUrlFromRequest
        );
        verificationMailSent = true;
      } catch {
        verificationMailSent = false;
      }
    }

    // Return user without sensitive fields (toJSON strips password, tokens, etc.)
    const userResponse = userToUpdate.toJSON();

    return NextResponse.json({
      success: true,
      message: emailChanged
        ? verificationMailSent
          ? 'Profil aktualisiert. Bitte bestätigen Sie die neue E-Mail-Adresse über den Link in der E-Mail.'
          : 'Profil aktualisiert. Die neue E-Mail-Adresse muss bestätigt werden; Versand der Verifizierungs-E-Mail ist fehlgeschlagen.'
        : 'Benutzer erfolgreich aktualisiert',
      emailChanged,
      emailVerificationSent: verificationMailSent,
      data: userResponse,
    });

  } catch (error: any) {
    console.error('Error updating user:', error);

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { error: `Validierungsfehler: ${validationErrors.join(', ')}` },
        { status: 400 }
      );
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const fieldName = field === 'email' ? 'E-Mail' : 'Benutzername';
      return NextResponse.json(
        { error: `${fieldName} wird bereits verwendet` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Benutzers' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    // Verify authentication and admin role
    const authResult = await verifyToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const permResult = await requirePermission(authResult.user!, 'canManageUsers');
    if (!permResult.success) {
      return NextResponse.json(
        { error: permResult.error },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Prevent self-deletion
    if (authResult.user!._id.toString() === id) {
      return NextResponse.json(
        { error: 'Sie können sich nicht selbst löschen' },
        { status: 400 }
      );
    }

    // Protect last admin from deletion
    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return NextResponse.json(
        { error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    if (userToDelete.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Der letzte Admin kann nicht gelöscht werden' },
          { status: 400 }
        );
      }
    }

    // Cascade cleanup: remove user from meeting series
    const username = userToDelete.username;
    const userId = userToDelete._id.toString();
    await MeetingSeries.updateMany(
      { $or: [{ visibleFor: username }, { moderators: username }, { participants: username }] },
      { $pull: { visibleFor: username, moderators: username, participants: username, members: { userId } } }
    );

    // Remove user from task responsibles
    await Task.updateMany(
      { responsibles: userId },
      { $pull: { responsibles: userId } }
    );

    // Remove push subscriptions for this user
    await PushSubscription.deleteMany({ userId });

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return NextResponse.json(
        { error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Benutzer erfolgreich gelöscht'
    });

  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Benutzers' },
      { status: 500 }
    );
  }
}
