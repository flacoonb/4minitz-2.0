/**
 * PDF Layout Settings Model
 * Stores visual layout configuration for PDF exports
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface ILayoutElement {
  id: string;
  type: 'header' | 'title' | 'info-box' | 'topic-title' | 'item-label' | 'separator' | 'logo';
  label: string;
  enabled: boolean;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  style: {
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    padding?: number;
    alignment?: 'left' | 'center' | 'right';
  };
}

export interface IPdfLayoutSettings extends Document {
  elements: ILayoutElement[];
  pageMargins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  itemSpacing: number;
  sectionSpacing: number;
  labelColors: {
    info: string;
    task: string;
  };
  logo?: {
    enabled: boolean;
    url: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
  };
  updatedAt: Date;
}

const LayoutElementSchema = new Schema({
  id: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['header', 'title', 'info-box', 'topic-title', 'item-label', 'separator', 'logo'],
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  size: {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  style: {
    fontSize: Number,
    fontWeight: {
      type: String,
      enum: ['normal', 'bold'],
    },
    color: String,
    backgroundColor: String,
    borderColor: String,
    borderWidth: Number,
    padding: Number,
    alignment: {
      type: String,
      enum: ['left', 'center', 'right'],
    },
  },
});

const LogoSchema = new Schema({
  enabled: { type: Boolean, default: false },
  url: { type: String, default: '' },
  position: {
    x: { type: Number, default: 25 },
    y: { type: Number, default: 25 },
  },
  size: {
    width: { type: Number, default: 40 },
    height: { type: Number, default: 15 },
  },
}, { _id: false });

const PdfLayoutSettingsSchema = new Schema<IPdfLayoutSettings>({
  elements: [LayoutElementSchema],
  pageMargins: {
    top: { type: Number, default: 20 },
    right: { type: Number, default: 20 },
    bottom: { type: Number, default: 20 },
    left: { type: Number, default: 20 },
  },
  itemSpacing: {
    type: Number,
    default: 5,
  },
  sectionSpacing: {
    type: Number,
    default: 5,
  },
  labelColors: {
    info: { type: String, default: '#3B82F6' },
    task: { type: String, default: '#F97316' },
  },
  logo: {
    type: LogoSchema,
    default: () => ({
      enabled: false,
      url: '',
      position: { x: 25, y: 25 },
      size: { width: 40, height: 15 }
    })
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Middleware to update the updatedAt field
PdfLayoutSettingsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.PdfLayoutSettings || mongoose.model<IPdfLayoutSettings>('PdfLayoutSettings', PdfLayoutSettingsSchema);
