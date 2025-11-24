/**
 * Minutes Model
 * Represents meeting minutes/protocols
 * Migrated from 4minitz Meteor version
 */
import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for Participant with attendance status
export interface IParticipant {
  userId: string;
  attendance: 'present' | 'excused' | 'absent';
}

// Interface for Topic (simplified for PoC)
export interface ITopic {
  _id?: string;
  subject: string;
  responsibles: string[];
  isOpen: boolean;
  isNew?: boolean;
  isRecurring?: boolean;
  infoItems?: IInfoItem[];
}

// Interface for InfoItem (Action Items)
export interface IInfoItem {
  _id?: string;
  subject: string;
  details?: string; // Detailed description from protocol
  isOpen: boolean;
  itemType: 'actionItem' | 'infoItem';
  priority?: 'high' | 'medium' | 'low';
  duedate?: Date;
  responsibles: string[];
  labels?: string[];
  // Extended fields for task management
  status?: 'open' | 'in-progress' | 'completed' | 'cancelled';
  completedAt?: Date;
  completedBy?: string;
  estimatedHours?: number;
  actualHours?: number;
  notes?: string; // Additional user comments
  parentMinutesId?: string; // Reference to original minutes if carried over
  parentItemId?: string; // Reference to parent item if carried over
  // Import tracking
  isImported?: boolean; // Mark if this task was imported from previous protocol
  originalTaskId?: string; // Original task ID to prevent duplicate imports
  externalTaskId?: string | mongoose.Types.ObjectId; // Reference to Central Task Registry
}

// Interface for Minutes document
export interface IMinutes extends Document {
  meetingSeries_id: mongoose.Types.ObjectId;
  date: Date;
  time?: string;
  location?: string;
  title?: string; // Protocol title for better overview
  createdAt: Date;
  updatedAt: Date;

  // Status
  isFinalized: boolean;
  finalizedAt?: Date;
  finalizedBy?: string;
  reopeningHistory?: Array<{
    reopenedAt: Date;
    reopenedBy: string;
    reason: string;
  }>;

  // Access Control
  visibleFor: string[];
  informedUsers?: string[];

  // Participants
  participants: string[];
  participantsAdditional?: string;
  participantsWithStatus?: IParticipant[]; // New: Attendance tracking

  // Content
  topics: ITopic[];
  globalNote?: string;

  // Agenda
  agendaSentAt?: Date;
}

// InfoItem Schema
const InfoItemSchema = new Schema<IInfoItem>({
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  details: {
    type: String,
    trim: true,
  },
  isOpen: {
    type: Boolean,
    default: true,
  },
  itemType: {
    type: String,
    enum: ['actionItem', 'infoItem'],
    default: 'infoItem',
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium',
  },
  duedate: {
    type: Date,
  },
  responsibles: [{
    type: String,
  }],
  labels: [{
    type: String,
  }],
  status: {
    type: String,
    enum: ['open', 'in-progress', 'completed', 'cancelled'],
    default: 'open',
  },
  completedAt: {
    type: Date,
  },
  completedBy: {
    type: String,
  },
  estimatedHours: {
    type: Number,
    min: 0,
  },
  actualHours: {
    type: Number,
    min: 0,
  },
  notes: {
    type: String,
    trim: true,
  },
  parentMinutesId: {
    type: String,
  },
  parentItemId: {
    type: String,
  },
  isImported: {
    type: Boolean,
    default: false,
  },
  originalTaskId: {
    type: String,
  },
  externalTaskId: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
  },
});

// Topic Schema
const TopicSchema = new Schema<ITopic>({
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  responsibles: [{
    type: String,
  }],
  isOpen: {
    type: Boolean,
    default: true,
  },
  isNew: {
    type: Boolean,
    default: false,
  },
  isRecurring: {
    type: Boolean,
    default: false,
  },
  infoItems: [InfoItemSchema],
}, {
  suppressReservedKeysWarning: true // Suppress warning for 'isNew' field
});

// Participant Schema
const ParticipantSchema = new Schema<IParticipant>({
  userId: {
    type: String,
    required: true,
  },
  attendance: {
    type: String,
    enum: ['present', 'excused', 'absent'],
    default: 'present',
  },
});

// Minutes Schema
const MinutesSchema = new Schema<IMinutes>(
  {
    meetingSeries_id: {
      type: Schema.Types.ObjectId,
      ref: 'MeetingSeries',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    time: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },

    // Status
    isFinalized: {
      type: Boolean,
      default: false,
      index: true,
    },
    finalizedAt: {
      type: Date,
    },
    finalizedBy: {
      type: String,
    },
    reopeningHistory: [{
      reopenedAt: {
        type: Date,
        required: true,
      },
      reopenedBy: {
        type: String,
        required: true,
      },
      reason: {
        type: String,
        required: true,
        trim: true,
      },
    }],

    // Access Control
    visibleFor: [{
      type: String,
      required: true,
    }],
    informedUsers: [{
      type: String,
    }],

    // Participants
    participants: [{
      type: String,
    }],
    participantsAdditional: {
      type: String,
      trim: true,
    },
    participantsWithStatus: {
      type: [ParticipantSchema],
      default: [],
    },

    // Content
    topics: [TopicSchema],
    globalNote: {
      type: String,
      trim: true,
    },

    // Agenda
    agendaSentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'minutes',
    suppressReservedKeysWarning: true, // Suppress warning for 'isNew' field
  }
);

// Indexes
MinutesSchema.index({ meetingSeries_id: 1, date: -1 });
MinutesSchema.index({ visibleFor: 1 });
MinutesSchema.index({ createdAt: -1 });

// Virtual for open action items count
MinutesSchema.virtual('openActionItemsCount').get(function () {
  return this.topics.reduce((count, topic) => {
    return count + (topic.infoItems?.filter(item =>
      item.itemType === 'actionItem' && item.isOpen
    ).length || 0);
  }, 0);
});

// Method to check if user has access
MinutesSchema.methods.hasAccess = function (userId: string): boolean {
  return this.visibleFor.includes(userId);
};

// Method to finalize minutes
MinutesSchema.methods.finalize = function (userId: string) {
  this.isFinalized = true;
  this.finalizedAt = new Date();
  this.finalizedBy = userId;
};

// Export the model
const Minutes: Model<IMinutes> =
  mongoose.models.Minutes ||
  mongoose.model<IMinutes>('Minutes', MinutesSchema);

export default Minutes;
