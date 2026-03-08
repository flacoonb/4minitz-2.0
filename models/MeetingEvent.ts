import mongoose, { Document, Model, Schema } from 'mongoose';

export type InviteeResponseStatus = 'pending' | 'accepted' | 'declined' | 'tentative';
export type MeetingEventStatus = 'draft' | 'invited' | 'confirmed' | 'cancelled' | 'completed';

export interface IMeetingEventInvitee {
  userId: string;
  emailSnapshot?: string;
  responseStatus: InviteeResponseStatus;
  respondedAt?: Date;
  responseSource?: 'magic-link' | 'internal';
  rsvpTokenHash?: string;
  rsvpTokenExpires?: Date;
  invitedAt?: Date;
}

export interface IMeetingEvent extends Document {
  meetingSeriesId: string;
  title: string;
  scheduledDate: Date;
  startTime: string;
  endTime?: string;
  location?: string;
  note?: string;
  invitees: IMeetingEventInvitee[];
  status: MeetingEventStatus;
  linkedMinutesId?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MeetingEventInviteeSchema = new Schema<IMeetingEventInvitee>(
  {
    userId: { type: String, required: true, trim: true },
    emailSnapshot: { type: String, trim: true },
    responseStatus: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'tentative'],
      default: 'pending',
      required: true,
    },
    respondedAt: { type: Date },
    responseSource: {
      type: String,
      enum: ['magic-link', 'internal'],
    },
    rsvpTokenHash: { type: String, trim: true },
    rsvpTokenExpires: { type: Date },
    invitedAt: { type: Date },
  },
  { _id: false }
);

const MeetingEventSchema = new Schema<IMeetingEvent>(
  {
    meetingSeriesId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    scheduledDate: { type: Date, required: true, index: true },
    startTime: { type: String, required: true, trim: true, maxlength: 10 },
    endTime: { type: String, trim: true, maxlength: 10 },
    location: { type: String, trim: true, maxlength: 500 },
    note: { type: String, trim: true, maxlength: 5000 },
    invitees: { type: [MeetingEventInviteeSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'invited', 'confirmed', 'cancelled', 'completed'],
      default: 'draft',
      index: true,
    },
    linkedMinutesId: { type: String, index: true },
    createdBy: { type: String, index: true },
    updatedBy: { type: String, index: true },
  },
  {
    timestamps: true,
    collection: 'meetingEvents',
  }
);

MeetingEventSchema.index({ meetingSeriesId: 1, scheduledDate: 1 });
MeetingEventSchema.index({ 'invitees.userId': 1 });
MeetingEventSchema.index({ 'invitees.rsvpTokenHash': 1 });

const MeetingEvent: Model<IMeetingEvent> =
  mongoose.models.MeetingEvent || mongoose.model<IMeetingEvent>('MeetingEvent', MeetingEventSchema);

export default MeetingEvent;
