/**
 * MeetingSeries Model
 * Represents a series of recurring meetings
 * Migrated from 4minitz Meteor version
 */
import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for Label subdocument
export interface ILabel {
  _id?: string;
  name: string;
  color: string;
  isDefaultLabel?: boolean;
}

// Interface for Member subdocument
export interface IMember {
  _id?: string;
  userId: string; // Reference to User._id
  addedAt?: Date;
}

// Interface for MeetingSeries document
export interface IMeetingSeries extends Document {
  project: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Access Control
  visibleFor: string[];
  informedUsers?: string[];
  
  // Roles
  moderators: string[];
  participants: string[];
  additionalResponsibles?: string[];
  
  // Members
  members: IMember[];
  
  // Meeting Information
  lastMinutesDate?: Date;
  lastMinutesFinalized?: boolean;
  lastMinutesId?: string;
  
  // Configuration
  availableLabels: ILabel[];
  minutes?: string[]; // Array of minute IDs
}

// Label Schema
const LabelSchema = new Schema<ILabel>({
  name: { 
    type: String, 
    required: true,
    trim: true,
  },
  color: { 
    type: String, 
    required: true,
    match: /^#[0-9A-F]{6}$/i, // Hex color validation
  },
  isDefaultLabel: { 
    type: Boolean, 
    default: false 
  },
});

// Member Schema
const MemberSchema = new Schema<IMember>({
  userId: {
    type: String,
    required: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

// MeetingSeries Schema
const MeetingSeriesSchema = new Schema<IMeetingSeries>(
  {
    project: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [200, 'Project name cannot exceed 200 characters'],
    },
    name: {
      type: String,
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
      default: '',
    },
    
    // Access Control
    visibleFor: [{
      type: String,
      required: true,
    }],
    informedUsers: [{
      type: String,
    }],
    
    // Roles
    moderators: [{
      type: String,
      required: true,
    }],
    participants: [{
      type: String,
    }],
    additionalResponsibles: [{
      type: String,
    }],
    
    // Members
    members: [MemberSchema],
    
    // Meeting Information
    lastMinutesDate: {
      type: Date,
    },
    lastMinutesFinalized: {
      type: Boolean,
      default: false,
    },
    lastMinutesId: {
      type: String,
    },
    
    // Configuration
    availableLabels: [LabelSchema],
    minutes: [{
      type: String,
    }],
  },
  {
    timestamps: true,
    collection: 'meetingSeries',
  }
);

// Indexes for performance
MeetingSeriesSchema.index({ visibleFor: 1 });
MeetingSeriesSchema.index({ moderators: 1 });
MeetingSeriesSchema.index({ project: 1 });
MeetingSeriesSchema.index({ createdAt: -1 });

// Virtual for getting all users involved
MeetingSeriesSchema.virtual('allUsers').get(function() {
  const users = new Set([
    ...this.moderators,
    ...this.participants,
    ...(this.additionalResponsibles || []),
  ]);
  return Array.from(users);
});

// Method to check if user has access
MeetingSeriesSchema.methods.hasAccess = function(userId: string): boolean {
  return this.visibleFor.includes(userId);
};

// Method to check if user is moderator
MeetingSeriesSchema.methods.isModerator = function(userId: string): boolean {
  return this.moderators.includes(userId);
};

// Export the model
const MeetingSeries: Model<IMeetingSeries> = 
  mongoose.models.MeetingSeries || 
  mongoose.model<IMeetingSeries>('MeetingSeries', MeetingSeriesSchema);

export default MeetingSeries;
