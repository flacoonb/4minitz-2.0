/**
 * Enhanced Minutes Model with Agenda Items (Traktanden) and Labels
 * Supports categorization, drag & drop ordering, and custom labels
 */
import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for Agenda Item Entry (einzelne Einträge innerhalb eines Traktandums)
export interface IAgendaItemEntry {
  _id?: string;
  subject: string;
  content?: string;
  labelId?: string; // Reference to Label
  responsibles: string[];
  dueDate?: Date;
  isCompleted: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

// Interface for Agenda Item (Traktandum)
export interface IAgendaItem {
  _id?: string;
  orderIndex: number; // For drag & drop ordering
  title: string;
  description?: string;
  duration?: number; // in minutes
  responsible?: string;
  entries: IAgendaItemEntry[]; // Liste von Einträgen (Informationen, Aufgaben, etc.)
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for Enhanced Minutes document
export interface IEnhancedMinutes extends Document {
  meetingSeries_id: string;
  date: Date;
  title?: string; // Optional custom title
  createdAt: Date;
  updatedAt: Date;
  
  // Status
  isFinalized: boolean;
  finalizedAt?: Date;
  finalizedBy?: string;
  
  // Access Control
  visibleFor: string[];
  informedUsers?: string[];
  
  // Participants
  participants: string[];
  participantsAdditional?: string;
  
  // Enhanced Content Structure
  agendaItems: IAgendaItem[];
  globalNote?: string;
  
  // Meeting Info
  location?: string;
  startTime?: string;
  endTime?: string;
  
  // Legacy support for migration
  topics?: any[]; // Keep old topics during migration
}

// Schema for Agenda Item Entry
const AgendaItemEntrySchema = new Schema<IAgendaItemEntry>({
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  content: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  labelId: {
    type: String,
    // index: true, // Removed - will be indexed at schema level
  },
  responsibles: [{
    type: String,
    trim: true,
  }],
  dueDate: {
    type: Date,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
}, {
  timestamps: true,
});

// Schema for Agenda Item (Traktandum)
const AgendaItemSchema = new Schema<IAgendaItem>({
  orderIndex: {
    type: Number,
    required: true,
    default: 0,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  duration: {
    type: Number,
    min: 1,
    max: 480, // 8 hours max
  },
  responsible: {
    type: String,
    trim: true,
  },
  entries: [AgendaItemEntrySchema],
  isCompleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Enhanced Minutes Schema
const EnhancedMinutesSchema = new Schema<IEnhancedMinutes>(
  {
    meetingSeries_id: {
      type: String,
      required: true,
      // index: true, // Removed - will be indexed with compound index
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
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
    
    // Enhanced Content
    agendaItems: [AgendaItemSchema],
    globalNote: {
      type: String,
      trim: true,
    },
    
    // Meeting Info
    location: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    startTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    endTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    
    // Legacy support
    topics: [Schema.Types.Mixed],
  },
  {
    timestamps: true,
    collection: 'enhanced_minutes',
    suppressReservedKeysWarning: true, // Suppress warning for reserved keys like 'isNew'
  }
);

// Indexes for performance (avoid duplicate indexes)
EnhancedMinutesSchema.index({ meetingSeries_id: 1, date: -1 });
EnhancedMinutesSchema.index({ visibleFor: 1 });
// isFinalized already has index from schema definition
EnhancedMinutesSchema.index({ 'agendaItems.orderIndex': 1 });
EnhancedMinutesSchema.index({ 'agendaItems.entries.labelId': 1 });

// Virtual properties
EnhancedMinutesSchema.virtual('totalDuration').get(function() {
  return this.agendaItems.reduce((total, item) => total + (item.duration || 0), 0);
});

EnhancedMinutesSchema.virtual('openEntriesCount').get(function() {
  return this.agendaItems.reduce((count, item) => {
    return count + item.entries.filter(entry => !entry.isCompleted).length;
  }, 0);
});

EnhancedMinutesSchema.virtual('completedAgendaItemsCount').get(function() {
  return this.agendaItems.filter(item => item.isCompleted).length;
});

// Methods
EnhancedMinutesSchema.methods.hasAccess = function(userId: string): boolean {
  return this.visibleFor.includes(userId);
};

EnhancedMinutesSchema.methods.finalize = function(userId: string) {
  this.isFinalized = true;
  this.finalizedAt = new Date();
  this.finalizedBy = userId;
};

EnhancedMinutesSchema.methods.reorderAgendaItems = function(newOrder: string[]) {
  newOrder.forEach((itemId, index) => {
    const item = this.agendaItems.id(itemId);
    if (item) {
      item.orderIndex = index;
    }
  });
  
  // Sort by new order
  this.agendaItems.sort((a: IAgendaItem, b: IAgendaItem) => a.orderIndex - b.orderIndex);
};

EnhancedMinutesSchema.methods.addAgendaItem = function(itemData: Partial<IAgendaItem>) {
  const maxOrder = Math.max(...this.agendaItems.map((item: IAgendaItem) => item.orderIndex), -1);
  
  const newItem = {
    ...itemData,
    orderIndex: maxOrder + 1,
    entries: itemData.entries || [],
    isCompleted: false,
  };
  
  this.agendaItems.push(newItem);
  return this.agendaItems[this.agendaItems.length - 1];
};

// Export the model
const EnhancedMinutes: Model<IEnhancedMinutes> = 
  mongoose.models.EnhancedMinutes || 
  mongoose.model<IEnhancedMinutes>('EnhancedMinutes', EnhancedMinutesSchema);

export default EnhancedMinutes;