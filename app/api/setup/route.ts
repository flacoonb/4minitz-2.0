import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';
import { encrypt } from '@/lib/crypto';
import fs from 'fs';
import path from 'path';

const SETUP_TOKEN_FILE = path.resolve(process.cwd(), '.setup_token');

function isTokenRequired() {
  return fs.existsSync(SETUP_TOKEN_FILE);
}

function providedTokenMatches(body: any, request: Request | undefined) {
  if (!isTokenRequired()) return true;
  let provided = '';
  try {
    if (request && typeof (request as any).headers?.get === 'function') {
      provided = (request as any).headers.get('x-setup-token') || '';
    }
  } catch (e) { }
  if (!provided && body && body.token) provided = body.token;
  try {
    const expected = fs.readFileSync(SETUP_TOKEN_FILE, 'utf8').trim();
    return provided === expected;
  } catch (e) {
    return false;
  }
}

export async function GET() {
  try {
    await connectDB();
    const count = await User.countDocuments({});
    return NextResponse.json({ success: true, needsSetup: count === 0 });
  } catch (err) {
    console.error('Setup GET error', err);
    return NextResponse.json({ success: false, error: (err as any).message || String(err), stack: (err as any).stack }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // If a setup token exists, require it for web-setup POST
    if (!providedTokenMatches(body, request as unknown as Request)) {
      return NextResponse.json({ success: false, error: 'Invalid or missing setup token' }, { status: 403 });
    }

    // Connect to DB using provided URI or default
    const mongoUri = body.mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/4minitz';
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const userName = username && username.trim().length >= 3 ? username.trim() : email.split('@')[0];

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
    let settings = await Settings.findOne({}).sort({ version: -1 });
    if (!settings) {
      settings = new Settings({ lastModifiedBy: user._id });
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

    settings.lastModifiedBy = user._id as any;
    await settings.save();

    // Write MONGODB_URI to .env.local if it's different or new
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      if (!envContent.includes(`MONGODB_URI=${mongoUri}`)) {
        // Remove existing MONGODB_URI if present
        envContent = envContent.replace(/^MONGODB_URI=.*$/m, '');
        // Append new URI
        envContent += `\nMONGODB_URI=${mongoUri}\n`;
        fs.writeFileSync(envPath, envContent.trim() + '\n');
        console.log('Updated .env.local with new MONGODB_URI');
      }
    } catch (e) {
      console.error('Failed to write .env.local', e);
      // Don't fail the request, just log warning. User might need to set it manually.
    }

    // Delete setup token file to prevent reuse
    try {
      if (fs.existsSync(SETUP_TOKEN_FILE)) {
        fs.unlinkSync(SETUP_TOKEN_FILE);
        console.log('Deleted setup token file');
      }
    } catch (e) {
      console.error('Failed to delete setup token file', e);
      // Non-critical error, but should be logged
    }

    return NextResponse.json({ success: true, message: 'Initial admin created', user: { id: user._id, email: user.email, username: user.username } });
  } catch (err: any) {
    console.error('Setup POST error', err);
    if (err.code === 11000) {
      return NextResponse.json({ success: false, error: 'User with this email or username already exists' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
