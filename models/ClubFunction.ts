import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IClubFunction extends Document {
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  validFrom?: Date;
  validTo?: Date;
  sortOrder: number;
  assignedUserId?: string;
  assignmentUpdatedAt?: Date;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClubFunctionSchema = new Schema<IClubFunction>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 140,
      match: /^[a-z0-9-]+$/,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    validFrom: {
      type: Date,
    },
    validTo: {
      type: Date,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    assignedUserId: {
      type: String,
      trim: true,
      index: true,
    },
    assignmentUpdatedAt: {
      type: Date,
    },
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    updatedBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'clubFunctions',
  }
);

ClubFunctionSchema.index({ slug: 1 }, { unique: true });
ClubFunctionSchema.index({ name: 1 });
ClubFunctionSchema.index({ isActive: 1, sortOrder: 1, name: 1 });

const ClubFunction: Model<IClubFunction> =
  mongoose.models.ClubFunction ||
  mongoose.model<IClubFunction>('ClubFunction', ClubFunctionSchema);

export default ClubFunction;
