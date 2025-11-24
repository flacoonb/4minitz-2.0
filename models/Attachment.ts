import mongoose from 'mongoose';

export interface IAttachment extends mongoose.Document {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  minuteId: mongoose.Types.ObjectId;
  topicId?: mongoose.Types.ObjectId;
  infoItemId?: mongoose.Types.ObjectId;
}

const AttachmentSchema = new mongoose.Schema<IAttachment>({
  fileName: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  uploadedBy: {
    type: String,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  minuteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Minutes',
    required: true,
    index: true,
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  infoItemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
});

// Indexes for efficient queries
AttachmentSchema.index({ minuteId: 1, uploadedAt: -1 });
AttachmentSchema.index({ uploadedBy: 1 });

// Virtual for file URL
AttachmentSchema.virtual('url').get(function() {
  return `/api/attachments/${this._id}/download`;
});

// Ensure virtuals are included in JSON
AttachmentSchema.set('toJSON', { virtuals: true });
AttachmentSchema.set('toObject', { virtuals: true });

export default mongoose.models.Attachment || mongoose.model<IAttachment>('Attachment', AttachmentSchema);
