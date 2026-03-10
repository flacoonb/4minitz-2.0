import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';
import { encrypt } from '@/lib/crypto';
import { isHexObjectIdLike, isValidEmailAddress } from '@/lib/input-validation';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const SETUP_TOKEN_FILE = path.resolve(process.cwd(), '.setup_token');

async function getExpectedSetupToken(): Promise<string | null> {
  const envToken = (process.env.SETUP_TOKEN || '').trim();
  if (envToken) return envToken;
  try {
    const token = (await fs.readFile(SETUP_TOKEN_FILE, 'utf8')).trim();
    return token || null;
  } catch {
    return null;
  }
}

function timingSafeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function providedTokenMatches(expectedToken: string, body: any, request: Request | undefined) {
  let provided = '';
  try {
    if (request && typeof (request as any).headers?.get === 'function') {
      provided = (request as any).headers.get('x-setup-token') || '';
    }
  } catch { /* ignore */ }
  if (!provided && body && body.token) provided = body.token;
  if (!provided) return false;
  return timingSafeEquals(String(provided).trim(), expectedToken);
}

export async function GET() {
  try {
    await connectDB();
    const count = await User.countDocuments({});
    return NextResponse.json({ success: true, needsSetup: count === 0 });
  } catch {
    return NextResponse.json({ success: false, error: 'Setup check failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const expectedSetupToken = await getExpectedSetupToken();

    if (!expectedSetupToken) {
      return NextResponse.json(
        { success: false, error: 'Setup token is not configured' },
        { status: 503 }
      );
    }

    if (!(await providedTokenMatches(expectedSetupToken, body, request as unknown as Request))) {
      return NextResponse.json({ success: false, error: 'Invalid or missing setup token' }, { status: 403 });
    }

    // Connect to DB using provided URI or default
    const mongoUri = String(body.mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/nxtminutes').trim();
    if (!/^mongodb(\+srv)?:\/\//i.test(mongoUri)) {
      return NextResponse.json({ success: false, error: 'Invalid MongoDB URI format' }, { status: 400 });
    }
    if (/[\r\n]/.test(mongoUri)) {
      return NextResponse.json({ success: false, error: 'Invalid MongoDB URI characters' }, { status: 400 });
    }
    await connectDB(mongoUri);

    const existing = await User.countDocuments({});
    if (existing > 0) {
      return NextResponse.json({ success: false, error: 'Setup already completed' }, { status: 403 });
    }

    const admin = body.admin || {};
    const systemSettings = body.systemSettings || {};
    const smtpSettings = body.smtpSettings || {};

    // Basic validation
    const { email, password, firstName, lastName, username } = admin;
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ success: false, error: 'Missing required admin fields' }, { status: 400 });
    }

    if (!isValidEmailAddress(String(email || ''))) {
      return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const userName = username && username.trim().length >= 3 ? username.trim() : email.split('@')[0];
    if (isHexObjectIdLike(userName)) {
      return NextResponse.json({ success: false, error: 'Username is reserved' }, { status: 400 });
    }

    const user = new User({
      email: email.toLowerCase(),
      username: userName,
      password,
      firstName,
      lastName,
      role: 'admin',
      isActive: true,
      isEmailVerified: true
    });

    await user.save();

    // Update settings (create default settings if missing)
    let settings = await Settings.findOne({}).sort({ updatedAt: -1 });
    if (!settings) {
      settings = new Settings({ updatedBy: user._id.toString() });
    }
    if (systemSettings.organizationName) {
      settings.systemSettings.organizationName = systemSettings.organizationName;
    }



    // ... (inside POST handler)

    // Save SMTP Settings
    if (smtpSettings.host) {
      settings.smtpSettings = {
        host: smtpSettings.host,
        port: smtpSettings.port,
        secure: smtpSettings.secure,
        auth: {
          user: smtpSettings.auth?.user || '',
          pass: smtpSettings.auth?.pass ? encrypt(smtpSettings.auth.pass) : ''
        },
        from: smtpSettings.from
      };
    }

    settings.updatedBy = user._id.toString();
    await settings.save();

    // Write MONGODB_URI to .env.local if it's different or new
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      let envContent = '';
      try {
        envContent = await fs.readFile(envPath, 'utf8');
      } catch { /* file doesn't exist yet */ }

      const escapedMongoUri = mongoUri.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const mongoEnvLine = `MONGODB_URI='${escapedMongoUri}'`;

      if (!envContent.includes(mongoEnvLine)) {
        envContent = envContent.replace(/^MONGODB_URI=.*$/m, '');
        envContent += `\n${mongoEnvLine}\n`;
        await fs.writeFile(envPath, envContent.trim() + '\n');
      }
    } catch {
      // Non-critical: user may need to set MONGODB_URI manually
    }

    // Delete setup token file to prevent reuse
    try {
      await fs.unlink(SETUP_TOKEN_FILE);
    } catch {
      // Non-critical: token file cleanup failed
    }

    return NextResponse.json({ success: true, message: 'Initial admin created' });
  } catch (err: any) {
    if (err.code === 11000) {
      return NextResponse.json({ success: false, error: 'User with this email or username already exists' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
