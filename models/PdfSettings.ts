import mongoose from 'mongoose';

const PdfSettingsSchema = new mongoose.Schema({
  // Logo
  logoUrl: { type: String, default: '' },
  logoPosition: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
  showLogo: { type: Boolean, default: true },
  
  // Header
  companyName: { type: String, default: '' },
  headerText: { type: String, default: '' },
  showHeader: { type: Boolean, default: true },
  
  // Footer
  footerText: { type: String, default: '' },
  showPageNumbers: { type: Boolean, default: true },
  showFooter: { type: Boolean, default: true },
  
  // Colors
  primaryColor: { type: String, default: '#3B82F6' }, // Blue
  secondaryColor: { type: String, default: '#6B7280' }, // Gray
  
  // Layout
  includeResponsibles: { type: Boolean, default: true },
  includeStatusBadges: { type: Boolean, default: true },
  includePriorityBadges: { type: Boolean, default: true },
  includeNotes: { type: Boolean, default: true },
  
  // Font
  fontSize: { type: Number, default: 10 },
  fontFamily: { type: String, enum: ['helvetica', 'times', 'courier'], default: 'helvetica' },
  
  // Metadata
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

PdfSettingsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.PdfSettings || mongoose.model('PdfSettings', PdfSettingsSchema);
