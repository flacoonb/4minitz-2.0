import mongoose, { Schema, Document } from 'mongoose';

export interface IPdfTemplate extends Document {
  name: string;
  description: string;
  isActive: boolean;
  contentSettings: Record<string, unknown>;
  layoutSettings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PdfTemplateSchema = new Schema<IPdfTemplate>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 400 },
    isActive: { type: Boolean, default: false, index: true },
    contentSettings: { type: Schema.Types.Mixed, required: true },
    layoutSettings: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
  }
);

PdfTemplateSchema.index({ updatedAt: -1 });

export default mongoose.models.PdfTemplate || mongoose.model<IPdfTemplate>('PdfTemplate', PdfTemplateSchema);
