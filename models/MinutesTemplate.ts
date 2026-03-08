import mongoose, { Document, Model, Schema } from 'mongoose';

type TemplateScope = 'global' | 'series';
type TemplateItemType = 'actionItem' | 'infoItem';

interface ITemplateInfoItem {
  subject: string;
  details?: string;
  itemType: TemplateItemType;
  status?: 'open' | 'in-progress' | 'completed' | 'cancelled';
  priority?: 'high' | 'medium' | 'low';
  dueDate?: Date;
  responsibles?: string[];
  notes?: string;
}

interface ITemplateTopic {
  subject: string;
  responsibles?: string[];
  infoItems?: ITemplateInfoItem[];
}

interface ITemplateContent {
  title?: string;
  time?: string;
  endTime?: string;
  location?: string;
  globalNote?: string;
  topics: ITemplateTopic[];
}

export interface IMinutesTemplate extends Document {
  name: string;
  description?: string;
  scope: TemplateScope;
  meetingSeriesId?: mongoose.Types.ObjectId;
  isActive: boolean;
  content: ITemplateContent;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateInfoItemSchema = new Schema<ITemplateInfoItem>(
  {
    subject: { type: String, required: true, trim: true },
    details: { type: String, trim: true },
    itemType: { type: String, enum: ['actionItem', 'infoItem'], default: 'infoItem' },
    status: { type: String, enum: ['open', 'in-progress', 'completed', 'cancelled'], default: 'open' },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    dueDate: { type: Date },
    responsibles: [{ type: String }],
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const TemplateTopicSchema = new Schema<ITemplateTopic>(
  {
    subject: { type: String, required: true, trim: true },
    responsibles: [{ type: String }],
    infoItems: [TemplateInfoItemSchema],
  },
  { _id: false }
);

const TemplateContentSchema = new Schema<ITemplateContent>(
  {
    title: { type: String, trim: true },
    time: { type: String, trim: true },
    endTime: { type: String, trim: true },
    location: { type: String, trim: true },
    globalNote: { type: String, trim: true },
    topics: { type: [TemplateTopicSchema], default: [] },
  },
  { _id: false }
);

const MinutesTemplateSchema = new Schema<IMinutesTemplate>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    scope: { type: String, enum: ['global', 'series'], required: true, index: true },
    meetingSeriesId: {
      type: Schema.Types.ObjectId,
      ref: 'MeetingSeries',
      required: false,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    content: { type: TemplateContentSchema, required: true },
    createdBy: { type: String, required: true, index: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true, collection: 'minutesTemplates' }
);

MinutesTemplateSchema.pre('validate', function (next) {
  if (this.scope === 'series' && !this.meetingSeriesId) {
    this.invalidate('meetingSeriesId', 'meetingSeriesId is required for series templates');
  }
  if (this.scope === 'global') {
    this.meetingSeriesId = undefined;
  }
  next();
});

MinutesTemplateSchema.index({ scope: 1, meetingSeriesId: 1, isActive: 1, name: 1 });

const MinutesTemplate: Model<IMinutesTemplate> =
  mongoose.models.MinutesTemplate ||
  mongoose.model<IMinutesTemplate>('MinutesTemplate', MinutesTemplateSchema);

export default MinutesTemplate;
