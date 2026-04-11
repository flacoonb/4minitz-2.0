import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createMeetingSeriesSchema,
  createMinutesSchema,
  createTaskSchema,
  updateTaskSchema,
  validateBody,
} from '@/lib/validations';

describe('loginSchema', () => {
  it('accepts valid login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'secret' }).success).toBe(true);
  });

  it('rejects missing email', () => {
    expect(loginSchema.safeParse({ password: 'secret' }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });

  it('rejects empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });

  it('rejects overly long email', () => {
    const longEmail = 'a'.repeat(200) + '@b.com';
    expect(loginSchema.safeParse({ email: longEmail, password: 'x' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts valid registration', () => {
    const data = { email: 'a@b.com', password: '12345678', firstName: 'Max', lastName: 'Muster' };
    expect(registerSchema.safeParse(data).success).toBe(true);
  });

  it('rejects short password', () => {
    const data = { email: 'a@b.com', password: '1234567', firstName: 'Max', lastName: 'Muster' };
    expect(registerSchema.safeParse(data).success).toBe(false);
  });

  it('rejects missing firstName', () => {
    const data = { email: 'a@b.com', password: '12345678', lastName: 'Muster' };
    expect(registerSchema.safeParse(data).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'x@y.com' }).success).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid reset data', () => {
    expect(resetPasswordSchema.safeParse({ token: 'abc123', password: '12345678' }).success).toBe(true);
  });

  it('rejects empty token', () => {
    expect(resetPasswordSchema.safeParse({ token: '', password: '12345678' }).success).toBe(false);
  });

  it('rejects short password', () => {
    expect(resetPasswordSchema.safeParse({ token: 'abc', password: 'short' }).success).toBe(false);
  });
});

describe('createMeetingSeriesSchema', () => {
  it('accepts minimal valid series', () => {
    expect(createMeetingSeriesSchema.safeParse({ project: 'My Project' }).success).toBe(true);
  });

  it('rejects missing project', () => {
    expect(createMeetingSeriesSchema.safeParse({}).success).toBe(false);
  });

  it('rejects empty project', () => {
    expect(createMeetingSeriesSchema.safeParse({ project: '' }).success).toBe(false);
  });

  it('accepts with optional arrays', () => {
    const data = { project: 'P', visibleFor: ['u1'], moderators: ['u2'], participants: ['u3'] };
    expect(createMeetingSeriesSchema.safeParse(data).success).toBe(true);
  });
});

describe('createMinutesSchema', () => {
  it('accepts minimal minutes', () => {
    expect(createMinutesSchema.safeParse({ meetingSeries_id: 'abc123', date: '2025-01-01' }).success).toBe(true);
  });

  it('rejects missing meetingSeries_id', () => {
    expect(createMinutesSchema.safeParse({ date: '2025-01-01' }).success).toBe(false);
  });

  it('rejects missing date', () => {
    expect(createMinutesSchema.safeParse({ meetingSeries_id: 'abc123' }).success).toBe(false);
  });

  it('accepts with topics', () => {
    const data = {
      meetingSeries_id: 'abc',
      date: '2025-06-15',
      topics: [{ subject: 'Topic 1', infoItems: [{ subject: 'Item', itemType: 'actionItem' }] }],
    };
    expect(createMinutesSchema.safeParse(data).success).toBe(true);
  });
});

describe('createTaskSchema / updateTaskSchema', () => {
  it('accepts valid task', () => {
    expect(createTaskSchema.safeParse({ subject: 'Do something' }).success).toBe(true);
  });

  it('rejects missing subject for create', () => {
    expect(createTaskSchema.safeParse({}).success).toBe(false);
  });

  it('accepts partial update', () => {
    expect(updateTaskSchema.safeParse({ status: 'completed' }).success).toBe(true);
  });

  it('rejects invalid priority', () => {
    expect(updateTaskSchema.safeParse({ priority: 'urgent' }).success).toBe(false);
  });

  it('rejects invalid status', () => {
    expect(createTaskSchema.safeParse({ subject: 'x', status: 'invalid' }).success).toBe(false);
  });
});

describe('validateBody helper', () => {
  it('returns parsed data on success', () => {
    const result = validateBody(loginSchema, { email: 'a@b.com', password: 'secret' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('a@b.com');
    }
  });

  it('returns error string on failure', () => {
    const result = validateBody(loginSchema, { email: 'bad' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Validation error');
    }
  });
});
