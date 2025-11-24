import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ILabel extends Document {
  name: string;
  color: string;
  description?: string;
  icon?: string;
  isSystemLabel: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const labelSchema = new Schema<ILabel>(
  {
    name: {
      type: String,
      required: [true, 'Label name is required'],
      trim: true,
      maxlength: [50, 'Label name cannot exceed 50 characters'],
    },
    color: {
      type: String,
      required: [true, 'Label color is required'],
      match: [/^#[0-9A-Fa-f]{6}$/, 'Please provide a valid hex color'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
    },
    icon: {
      type: String,
      default: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', // Info icon
    },
    isSystemLabel: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      required: [true, 'Created by is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique names per user
labelSchema.index({ name: 1, createdBy: 1 }, { unique: true });

// Index for faster queries
labelSchema.index({ createdBy: 1, isSystemLabel: 1 });

const Label: Model<ILabel> = mongoose.models.Label || mongoose.model<ILabel>('Label', labelSchema);

export default Label;