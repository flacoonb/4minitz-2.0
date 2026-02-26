import { z } from 'zod';

// Reusable string validators
const safeString = (max: number = 500) => z.string().trim().max(max);
const requiredString = (max: number = 500) => safeString(max).min(1);

// Auth schemas
export const loginSchema = z.object({
  username: requiredString(100),
  password: requiredString(200),
});

export const registerSchema = z.object({
  username: requiredString(50).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid username format'),
  email: z.string().email().max(200),
  password: requiredString(200).min(8, 'Password must be at least 8 characters'),
  firstName: requiredString(100),
  lastName: requiredString(100),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(200),
});

export const resetPasswordSchema = z.object({
  token: requiredString(500),
  password: requiredString(200).min(8),
});

// Meeting Series schemas
export const createMeetingSeriesSchema = z.object({
  project: requiredString(200),
  name: safeString(200).optional(),
  visibleFor: z.array(safeString(100)).optional(),
  moderators: z.array(safeString(100)).optional(),
  participants: z.array(safeString(100)).optional(),
});

export const updateMeetingSeriesSchema = z.object({
  project: safeString(200).optional(),
  name: safeString(200).optional(),
  visibleFor: z.array(safeString(100)).optional(),
  moderators: z.array(safeString(100)).optional(),
  participants: z.array(safeString(100)).optional(),
});

// Minutes schemas
const infoItemSchema = z.object({
  subject: safeString(500).optional(),
  details: safeString(5000).optional(),
  itemType: z.enum(['infoItem', 'actionItem']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['open', 'in-progress', 'completed', 'cancelled']).optional(),
  dueDate: z.string().optional().nullable(),
  responsibles: z.array(safeString(100)).optional(),
  notes: z.string().max(5000).optional(),
  originalTaskId: z.string().optional(),
  externalTaskId: z.string().optional(),
  isImported: z.boolean().optional(),
}).passthrough();

const topicSchema = z.object({
  subject: safeString(500).optional(),
  responsibles: z.array(safeString(100)).optional(),
  infoItems: z.array(infoItemSchema).optional(),
}).passthrough();

export const createMinutesSchema = z.object({
  meetingSeries_id: requiredString(50),
  date: z.string().optional(),
  time: safeString(20).optional(),
  location: safeString(500).optional(),
  topics: z.array(topicSchema).optional(),
  participants: z.array(z.string()).optional(),
  participantsWithStatus: z.array(z.object({
    userId: safeString(100),
    attendance: z.enum(['present', 'absent', 'excused', 'guest']).optional(),
  }).passthrough()).optional(),
  globalNote: z.string().max(10000).optional(),
  agendaItems: z.array(z.any()).optional(),
}).passthrough();

// Task schemas
export const createTaskSchema = z.object({
  subject: requiredString(500),
  details: safeString(5000).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['open', 'in-progress', 'completed', 'cancelled']).optional(),
  dueDate: z.string().optional().nullable(),
  responsibles: z.array(safeString(100)).optional(),
  meetingSeriesId: safeString(50).optional(),
  minutesId: safeString(50).optional(),
});

export const updateTaskSchema = z.object({
  subject: safeString(500).optional(),
  details: safeString(5000).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['open', 'in-progress', 'completed', 'cancelled']).optional(),
  dueDate: z.string().optional().nullable(),
  responsibles: z.array(safeString(100)).optional(),
  notes: z.string().max(5000).optional(),
}).passthrough();

// Helper to validate and return parsed data or error response
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return {
      success: false,
      error: `Validation error: ${firstError.path.join('.')} - ${firstError.message}`,
    };
  }
  return { success: true, data: result.data };
}
