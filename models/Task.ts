import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITask extends Document {
  subject: string;
  details?: string;
  status: 'open' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  dueDate?: Date;
  responsibles: string[];
  meetingSeriesId: string; // Reference to the series
  minutesId?: string; // Reference to the minute where it was created/last updated
  topicId?: string; // Reference to the topic
  
  // Import tracking
  sourceTaskId?: string; // Original task ID when imported from another series

  // Audit
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    subject: { type: String, required: true, trim: true },
    details: { type: String, trim: true },
    status: { 
      type: String, 
      enum: ['open', 'in-progress', 'completed', 'cancelled'], 
      default: 'open' 
    },
    priority: { 
      type: String, 
      enum: ['high', 'medium', 'low'], 
      default: 'medium' 
    },
    dueDate: { type: Date },
    responsibles: [{ type: String }], // User IDs
    meetingSeriesId: { type: String, required: true, index: true },
    minutesId: { type: String, index: true },
    topicId: { type: String }, // ID of the topic containing this task
    sourceTaskId: { type: String }, // Original task ID when imported from another series
    createdBy: { type: String },
  },
  {
    timestamps: true,
    collection: 'tasks'
  }
);

// Indexes
TaskSchema.index({ responsibles: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ dueDate: 1 });
TaskSchema.index({ meetingSeriesId: 1, status: 1 });

const Task: Model<ITask> = mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);

export default Task;
