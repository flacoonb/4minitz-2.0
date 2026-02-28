import AuditLog from '@/models/AuditLog';
import Settings from '@/models/Settings';
import connectDB from '@/lib/mongodb';

interface AuditLogEntry {
  action: string;
  details: string;
  userId?: string;
  username?: string;
  ipAddress?: string;
  resourceId?: string;
  resourceType?: string;
  metadata?: any;
}

export async function logAction(entry: AuditLogEntry) {
  try {
    await connectDB();
    
    // Check if audit logging is enabled
    const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
    if (!settings?.systemSettings?.enableAuditLog) {
      return;
    }

    await AuditLog.create({
      ...entry,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // We don't throw here to avoid blocking the main action
  }
}
