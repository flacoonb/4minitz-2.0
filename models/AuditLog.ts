import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
  action: string;
  details: string;
  userId?: string;
  username?: string;
  ipAddress?: string;
  resourceId?: string;
  resourceType?: string;
  timestamp: Date;
  metadata?: any;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    details: { type: String, required: true },
    userId: { type: String, index: true },
    username: { type: String },
    ipAddress: { type: String },
    resourceId: { type: String, index: true },
    resourceType: { type: String, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: false, // We use our own timestamp field
    collection: 'audit_logs',
  }
);

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
