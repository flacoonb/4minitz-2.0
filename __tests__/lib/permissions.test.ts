import { describe, it, expect } from 'vitest';
import { hasRole, getDefaultPermissions, canModifyResource } from '@/lib/permissions';

describe('hasRole', () => {
  it('admin has admin role', () => {
    expect(hasRole({ _id: '1', role: 'admin' }, 'admin')).toBe(true);
  });

  it('admin has moderator role (hierarchy)', () => {
    expect(hasRole({ _id: '1', role: 'admin' }, 'moderator')).toBe(true);
  });

  it('admin has user role (hierarchy)', () => {
    expect(hasRole({ _id: '1', role: 'admin' }, 'user')).toBe(true);
  });

  it('moderator does NOT have admin role', () => {
    expect(hasRole({ _id: '1', role: 'moderator' }, 'admin')).toBe(false);
  });

  it('moderator has moderator role', () => {
    expect(hasRole({ _id: '1', role: 'moderator' }, 'moderator')).toBe(true);
  });

  it('moderator has user role', () => {
    expect(hasRole({ _id: '1', role: 'moderator' }, 'user')).toBe(true);
  });

  it('user does NOT have moderator role', () => {
    expect(hasRole({ _id: '1', role: 'user' }, 'moderator')).toBe(false);
  });

  it('user has user role', () => {
    expect(hasRole({ _id: '1', role: 'user' }, 'user')).toBe(true);
  });
});

describe('getDefaultPermissions', () => {
  it('admin gets all permissions true', () => {
    const perms = getDefaultPermissions('admin');
    expect(perms.canCreateMeetings).toBe(true);
    expect(perms.canManageUsers).toBe(true);
    expect(perms.canDeleteMinutes).toBe(true);
    expect(perms.canExportData).toBe(true);
    expect(perms.canManageGlobalTemplates).toBe(true);
  });

  it('moderator gets limited permissions', () => {
    const perms = getDefaultPermissions('moderator');
    expect(perms.canCreateMeetings).toBe(true);
    expect(perms.canManageUsers).toBe(false);
    expect(perms.canDeleteMinutes).toBe(false);
    expect(perms.canExportData).toBe(true);
    expect(perms.canManageSeriesTemplates).toBe(true);
    expect(perms.canManageGlobalTemplates).toBe(false);
  });

  it('user gets minimal permissions', () => {
    const perms = getDefaultPermissions('user');
    expect(perms.canCreateMeetings).toBe(false);
    expect(perms.canManageUsers).toBe(false);
    expect(perms.canUploadDocuments).toBe(true);
    expect(perms.canExportData).toBe(false);
  });

  it('unknown role falls back to user defaults', () => {
    const perms = getDefaultPermissions('unknown');
    expect(perms).toEqual(getDefaultPermissions('user'));
  });
});

describe('canModifyResource', () => {
  it('owner can modify own resource', () => {
    expect(canModifyResource({ _id: 'abc123', role: 'user' }, 'abc123')).toBe(true);
  });

  it('non-owner user cannot modify others resource', () => {
    expect(canModifyResource({ _id: 'abc123', role: 'user' }, 'other456')).toBe(false);
  });

  it('moderator can modify others resource (default requiredRole)', () => {
    expect(canModifyResource({ _id: 'abc123', role: 'moderator' }, 'other456')).toBe(true);
  });

  it('admin can modify any resource', () => {
    expect(canModifyResource({ _id: 'abc123', role: 'admin' }, 'other456')).toBe(true);
  });

  it('works with ObjectId-like _id that has toString()', () => {
    const fakeObjectId = { toString: () => 'abc123' };
    expect(canModifyResource({ _id: fakeObjectId, role: 'user' }, 'abc123')).toBe(true);
  });
});
