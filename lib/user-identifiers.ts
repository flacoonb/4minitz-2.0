import mongoose from 'mongoose';
import User from '@/models/User';
import { isValidEmailAddress } from '@/lib/input-validation';

export type LookupUser = {
  _id: string | { toString(): string };
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  preferences?: Record<string, unknown>;
  notificationSettings?: Record<string, unknown>;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isEmail(value: string): boolean {
  return isValidEmailAddress(value);
}

export function normalizeIdentifier(value: string): string {
  return normalize(value);
}

export function isEmailIdentifier(value: string): boolean {
  return isEmail(value.trim());
}

export async function lookupUsersByIdentifiers(
  identifiers: string[],
  select = '_id email username firstName lastName preferences notificationSettings'
): Promise<Map<string, LookupUser>> {
  const cleaned = identifiers
    .map((identifier) => identifier?.trim())
    .filter((identifier): identifier is string => Boolean(identifier));

  if (cleaned.length === 0) return new Map<string, LookupUser>();

  const normalized = Array.from(new Set(cleaned.map(normalize)));
  const emails = normalized.filter((value) => isEmail(value));
  const objectIds = normalized.filter((value) => mongoose.isValidObjectId(value));
  const usernames = normalized.filter((value) => !isEmail(value) && !mongoose.isValidObjectId(value));

  const queryOr: Array<Record<string, unknown>> = [];
  if (emails.length > 0) queryOr.push({ email: { $in: emails } });
  if (objectIds.length > 0) queryOr.push({ _id: { $in: objectIds } });
  if (usernames.length > 0) queryOr.push({ username: { $in: usernames } });

  if (queryOr.length === 0) return new Map<string, LookupUser>();

  const users = await User.find({ $or: queryOr }).select(select).lean();
  const lookup = new Map<string, LookupUser>();

  for (const user of users as unknown as LookupUser[]) {
    const idValue = typeof user._id === 'string' ? user._id : user._id.toString();
    lookup.set(normalize(idValue), user);
    if (user.email) lookup.set(normalize(user.email), user);
    if (user.username) lookup.set(normalize(user.username), user);
  }

  return lookup;
}

export async function resolveEmailsFromIdentifiers(identifiers: string[]): Promise<string[]> {
  const cleaned = identifiers
    .map((identifier) => identifier?.trim())
    .filter((identifier): identifier is string => Boolean(identifier));

  if (cleaned.length === 0) return [];

  const lookup = await lookupUsersByIdentifiers(cleaned, '_id email username');
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const identifier of cleaned) {
    const resolvedUser = lookup.get(normalize(identifier));
    const email = resolvedUser?.email || (isEmail(identifier) ? identifier : '');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || seen.has(normalizedEmail)) continue;
    seen.add(normalizedEmail);
    emails.push(normalizedEmail);
  }

  return emails;
}
