import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPendingNotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'newMinute' | 'actionItemAssigned' | 'actionItemOverdue';
  data: any; // Flexible payload depending on type (e.g., minuteId, seriesName, etc.)
  createdAt: Date;
}

const PendingNotificationSchema = new Schema<IPendingNotification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['newMinute', 'actionItemAssigned', 'actionItemOverdue'] 
  },
  data: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Index for faster queries when processing digests
PendingNotificationSchema.index({ userId: 1, createdAt: 1 });

const PendingNotification: Model<IPendingNotification> = 
  mongoose.models.PendingNotification || 
  mongoose.model<IPendingNotification>('PendingNotification', PendingNotificationSchema);

export default PendingNotification;
