"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  getMinutesMarkdownTemplate,
  parseMinutesMarkdown,
  serializeTopicsToMarkdown,
} from '@/lib/minutesMarkdown';
import { humanizeFunctionToken, parseFunctionToken } from '@/lib/club-function-client';
import { useAuth } from '@/contexts/AuthContext';
import AttachmentUpload from '@/components/AttachmentUpload';
import AttachmentList from '@/components/AttachmentList';

const MAX_ENTRY_DURATION_MINUTES = 1440;

function normalizeDurationMinutes(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const rounded = Math.round(parsed);
  if (rounded <= 0) return 0;
  return Math.min(rounded, MAX_ENTRY_DURATION_MINUTES);
}

function sumInfoItemDurations(items: Array<{ durationMinutes?: unknown }> = []): number {
  return items.reduce((sum, item) => sum + normalizeDurationMinutes(item.durationMinutes), 0);
}

function addMinutesToClockTime(timeValue: string | undefined, minutesToAdd: number): string | null {
  const raw = String(timeValue || '').trim();
  if (!raw) return null;
  const duration = normalizeDurationMinutes(minutesToAdd);
  if (duration <= 0) return null;

  const [hoursRaw, minutesRaw] = raw.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const total = (hours * 60) + minutes + duration;
  const wrappedTotal = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  const outHours = String(Math.floor(wrappedTotal / 60)).padStart(2, '0');
  const outMinutes = String(wrappedTotal % 60).padStart(2, '0');
  return `${outHours}:${outMinutes}`;
}

interface SortableTopicProps {
  id: string;
  topicIndex: number;
  topic: Topic;
  minuteId: string | null;
  meetingSeriesMembers: Member[];
  clubFunctions: ClubFunctionEntry[];
  allUsers: User[];
  canUploadDocuments: boolean;
  attachmentsRefreshToken: number;
  triggerAttachmentRefresh: () => void;
  updateTopic: (index: number, field: keyof Topic, value: any) => void;
  deleteTopic: (index: number) => void;
  addInfoItem: (index: number) => void;
  updateInfoItem: (topicIndex: number, itemIndex: number, field: keyof InfoItem, value: any) => void;
  deleteInfoItem: (topicIndex: number, itemIndex: number) => void;
  handleDragEndInfoItem: (topicIndex: number) => (event: DragEndEvent) => void;
  agendaItemLabelMode: 'manual' | 'topic-alpha';
  saveMinuteInPlace: () => Promise<boolean>;
  isSavingMinute: boolean;
}

function SortableTopic({
  id,
  topicIndex,
  topic,
  minuteId,
  meetingSeriesMembers,
  clubFunctions,
  allUsers,
  canUploadDocuments,
  attachmentsRefreshToken,
  triggerAttachmentRefresh,
  updateTopic,
  deleteTopic,
  addInfoItem,
  updateInfoItem,
  deleteInfoItem,
  handleDragEndInfoItem,
  agendaItemLabelMode,
  saveMinuteInPlace,
  isSavingMinute,
}: SortableTopicProps) {
  const t = useTranslations('minutes');
  const tCommon = useTranslations('common');
  const topicPlannedMinutes = sumInfoItemDurations(topic.infoItems || []);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Drag Handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={t('dragToMove')}
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('topic')} {topicIndex + 1} *
              </label>
              {topicPlannedMinutes > 0 && (
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-sky-100 text-sky-800">
                  {t('topicPlannedDuration', { minutes: topicPlannedMinutes })}
                </span>
              )}
            </div>
            <input
              type="text"
              value={topic.subject}
              onChange={(e) => updateTopic(topicIndex, 'subject', e.target.value)}
              placeholder={t('topicTitlePlaceholder')}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent font-semibold"
              required
            />
          </div>
        </div>

        {/* Delete Button */}
        <button
          type="button"
          onClick={() => deleteTopic(topicIndex)}
          className="self-start sm:self-auto p-2 min-h-11 min-w-11 text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center"
          title={tCommon('delete')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Info Items with Drag & Drop */}
      <SortableInfoItems
        topicIndex={topicIndex}
        topicId={topic._id}
        minuteId={minuteId}
        infoItems={topic.infoItems || []}
        meetingSeriesMembers={meetingSeriesMembers}
        clubFunctions={clubFunctions}
        allUsers={allUsers}
        canUploadDocuments={canUploadDocuments}
        attachmentsRefreshToken={attachmentsRefreshToken}
        triggerAttachmentRefresh={triggerAttachmentRefresh}
        addInfoItem={addInfoItem}
        updateInfoItem={updateInfoItem}
        deleteInfoItem={deleteInfoItem}
        handleDragEndInfoItem={handleDragEndInfoItem}
        agendaItemLabelMode={agendaItemLabelMode}
        saveMinuteInPlace={saveMinuteInPlace}
        isSavingMinute={isSavingMinute}
      />
    </div>
  );
}

interface SortableInfoItemsProps {
  topicIndex: number;
  topicId?: string;
  minuteId: string | null;
  infoItems: InfoItem[];
  meetingSeriesMembers: Member[];
  clubFunctions: ClubFunctionEntry[];
  allUsers: User[];
  canUploadDocuments: boolean;
  attachmentsRefreshToken: number;
  triggerAttachmentRefresh: () => void;
  addInfoItem: (index: number) => void;
  updateInfoItem: (topicIndex: number, itemIndex: number, field: keyof InfoItem, value: any) => void;
  deleteInfoItem: (topicIndex: number, itemIndex: number) => void;
  handleDragEndInfoItem: (topicIndex: number) => (event: DragEndEvent) => void;
  agendaItemLabelMode: 'manual' | 'topic-alpha';
  saveMinuteInPlace: () => Promise<boolean>;
  isSavingMinute: boolean;
}

function SortableInfoItems({
  topicIndex,
  topicId,
  minuteId,
  infoItems,
  meetingSeriesMembers,
  clubFunctions,
  allUsers,
  canUploadDocuments,
  attachmentsRefreshToken,
  triggerAttachmentRefresh,
  addInfoItem,
  updateInfoItem,
  deleteInfoItem,
  handleDragEndInfoItem,
  agendaItemLabelMode,
  saveMinuteInPlace,
  isSavingMinute,
}: SortableInfoItemsProps) {
  const t = useTranslations('minutes');
  const itemIds = infoItems.map((_, i) => `item-${topicIndex}-${i}`);
  const itemsContainerRef = React.useRef<HTMLDivElement | null>(null);
  const pendingScrollItemIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    const targetId = pendingScrollItemIdRef.current;
    if (!targetId) return;

    requestAnimationFrame(() => {
      const newItem = itemsContainerRef.current?.querySelector<HTMLElement>(`[data-info-item-id="${targetId}"]`);
      if (!newItem) return;

      pendingScrollItemIdRef.current = null;
      newItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [itemIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <label className="text-sm font-medium text-gray-700">{t('infoItems')}</label>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEndInfoItem(topicIndex)}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div ref={itemsContainerRef} className="space-y-2 min-h-[50px] p-2 border-2 border-dashed border-gray-200 rounded-lg">
            {infoItems.map((item, itemIndex) => (
              <SortableInfoItem
                key={`item-${topicIndex}-${itemIndex}`}
                id={`item-${topicIndex}-${itemIndex}`}
                topicIndex={topicIndex}
                itemIndex={itemIndex}
                item={item}
                topicId={topicId}
                minuteId={minuteId}
                meetingSeriesMembers={meetingSeriesMembers}
                clubFunctions={clubFunctions}
                allUsers={allUsers}
                canUploadDocuments={canUploadDocuments}
                attachmentsRefreshToken={attachmentsRefreshToken}
                triggerAttachmentRefresh={triggerAttachmentRefresh}
                updateInfoItem={updateInfoItem}
                deleteInfoItem={deleteInfoItem}
                agendaItemLabelMode={agendaItemLabelMode}
                saveMinuteInPlace={saveMinuteInPlace}
                isSavingMinute={isSavingMinute}
              />
            ))}
            {infoItems.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                {t('noInfoItems')}
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            pendingScrollItemIdRef.current = `item-${topicIndex}-${infoItems.length}`;
            addInfoItem(topicIndex);
          }}
          className="w-full sm:w-auto min-h-11 px-4 py-2.5 bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)] hover:bg-[var(--brand-primary-soft)] rounded-lg text-sm font-semibold transition-colors"
        >
          + {t('add')}
        </button>
      </div>
    </div>
  );
}

interface SortableInfoItemProps {
  id: string;
  topicIndex: number;
  itemIndex: number;
  item: InfoItem;
  topicId?: string;
  minuteId: string | null;
  meetingSeriesMembers: Member[];
  clubFunctions: ClubFunctionEntry[];
  allUsers: User[];
  canUploadDocuments: boolean;
  attachmentsRefreshToken: number;
  triggerAttachmentRefresh: () => void;
  updateInfoItem: (topicIndex: number, itemIndex: number, field: keyof InfoItem, value: any) => void;
  deleteInfoItem: (topicIndex: number, itemIndex: number) => void;
  agendaItemLabelMode: 'manual' | 'topic-alpha';
  saveMinuteInPlace: () => Promise<boolean>;
  isSavingMinute: boolean;
}

function SortableInfoItem({
  id,
  topicIndex,
  itemIndex,
  item,
  topicId,
  minuteId,
  meetingSeriesMembers,
  clubFunctions,
  allUsers,
  canUploadDocuments,
  attachmentsRefreshToken,
  triggerAttachmentRefresh,
  updateInfoItem,
  deleteInfoItem,
  agendaItemLabelMode,
  saveMinuteInPlace,
  isSavingMinute,
}: SortableInfoItemProps) {
  const t = useTranslations('minutes');
  const tAttachments = useTranslations('attachments');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [isEditing, setIsEditing] = React.useState(!item.subject); // Auto-edit if new (no subject)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getUserById = (userId: string): User | undefined => {
    return allUsers.find(u => u._id === userId || u.username === userId);
  };

  const getAssignedUserForFunction = (functionToken: string): User | undefined => {
    const assignedUserId = clubFunctions.find((entry) => entry.token === functionToken)?.assignedUserId;
    if (!assignedUserId) return undefined;
    return getUserById(assignedUserId);
  };

  const getInitialsFromName = (value: string, fallback = '?'): string => {
    const parts = value
      .replace(/^guest:/i, '')
      .replace(/[()]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return fallback;

    const first = parts[0].charAt(0).toUpperCase();
    if (parts.length === 1) return first || fallback;

    const last = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${first}${last}` || fallback;
  };

  // Helper function to get user initials
  const getUserInitials = (userId: string): string => {
    const user = getUserById(userId);
    if (user) {
      return getInitialsFromName(`${user.firstName || ''} ${user.lastName || ''}`, '?');
    }

    const functionSlug = parseFunctionToken(userId);
    if (functionSlug) {
      const assignedUser = getAssignedUserForFunction(userId);
      if (assignedUser) {
        return getInitialsFromName(`${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`, '?');
      }
      const functionLabel =
        clubFunctions.find((entry) => entry.token === userId)?.name || humanizeFunctionToken(userId);
      return getInitialsFromName(functionLabel, 'F');
    }

    if (userId.startsWith('guest:')) {
      const guestName = userId.replace('guest:', '').trim();
      return getInitialsFromName(guestName, 'G');
    }

    // Fallback for legacy/non-id values (e.g. plain names/usernames)
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(userId);
    if (!isMongoId && userId.trim().length > 0) {
      return getInitialsFromName(userId, '?');
    }

    return '?';
  };

  // Helper function to format multiple users as initials
  const formatUsersAsInitials = (userIds: string[]): string => {
    return userIds.map(id => getUserInitials(id)).join(', ');
  };

  const toAlphabetSuffix = (index: number): string => {
    let n = index + 1;
    let result = '';
    while (n > 0) {
      const remainder = (n - 1) % 26;
      result = String.fromCharCode(97 + remainder) + result;
      n = Math.floor((n - 1) / 26);
    }
    return result;
  };

  const automaticEntryLabel = `${topicIndex + 1}${toAlphabetSuffix(itemIndex)}`;
  const shouldUseAutomaticLabel = agendaItemLabelMode === 'topic-alpha';
  const isAutoGeneratedSubject = shouldUseAutomaticLabel && (item.subject?.trim() === automaticEntryLabel);
  const displayTitle = shouldUseAutomaticLabel
    ? ((item.subject?.trim() && !isAutoGeneratedSubject) ? `${automaticEntryLabel} ${item.subject.trim()}` : automaticEntryLabel)
    : (item.subject?.trim() || (item.itemType === 'infoItem' ? `(${t('info')})` : t('task')));

  const functionEntries = clubFunctions.map((fn) => {
    const assignmentUserId = fn.assignedUserId;
    const assignedUser = assignmentUserId
      ? allUsers.find((user) => user._id === assignmentUserId || user.username === assignmentUserId)
      : undefined;
    const assignedLabel = assignedUser
      ? `${assignedUser.firstName} ${assignedUser.lastName}`
      : assignmentUserId;
    return {
      id: fn.token,
      label: assignedLabel ? `${fn.name} -> ${assignedLabel}` : fn.name,
      kind: 'function' as const,
      isActive: fn.isActive,
      hasAssignment: Boolean(assignmentUserId),
    };
  });

  const guestEntries = Array.from(
    new Set(
      (meetingSeriesMembers || [])
        .map((member) => String(member?.userId || '').trim())
        .filter((userId) => userId.startsWith('guest:'))
    )
  ).map((guestId) => {
    const guestName = guestId.replace(/^guest:/, '').trim();
    const initials = guestName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
    return {
      id: guestId,
      label: guestName ? `${guestName} (${t('guest')})` : t('guest'),
      kind: 'guest' as const,
      isActive: true,
      hasAssignment: true,
      initials: initials || 'G',
    };
  });

  const responsibleEntries = [
    ...functionEntries.filter((entry) => entry.isActive && entry.hasAssignment),
    ...guestEntries,
  ];

  const selectableResponsibleIds = responsibleEntries.map((entry) => entry.id);

  // Color schemes based on type and priority
  const getItemColors = () => {
    if (item.itemType === 'actionItem') {
      return 'from-orange-50 to-amber-50 border-orange-300';
    }
    return 'from-gray-50 to-slate-50 border-gray-300';
  };

  const getStatusBadge = () => {
    const badges = {
      open: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '○', label: t('open') },
      'in-progress': { bg: 'bg-[var(--brand-primary-soft)]', text: 'text-[var(--brand-primary-strong)]', icon: '◐', label: t('inProgress') },
      completed: { bg: 'bg-green-100', text: 'text-green-800', icon: '✓', label: t('completed') },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '✗', label: t('cancelled') },
    };
    return badges[item.status || 'open'];
  };

  const getPriorityBadge = () => {
    const badges = {
      high: { bg: 'bg-red-100', text: 'text-red-800', icon: '🔥', label: t('high') },
      medium: { bg: 'bg-orange-100', text: 'text-orange-800', icon: '⚠️', label: t('medium') },
      low: { bg: 'bg-green-100', text: 'text-green-800', icon: '✓', label: t('low') },
    };
    return badges[item.priority || 'medium'];
  };

  const hasAttachmentBinding = Boolean(minuteId && topicId && item._id);
  const canUploadForItem = hasAttachmentBinding && canUploadDocuments;

  const renderAttachmentSection = () => (
    <div className="mt-3 bg-white/70 backdrop-blur-sm p-3 rounded-lg border border-white/50">
      <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
        📎 {tAttachments('title')}
      </label>

      {!hasAttachmentBinding ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
          <p>{t('attachmentsSaveItemFirst')}</p>
          <button
            type="button"
            onClick={() => { void saveMinuteInPlace(); }}
            disabled={isSavingMinute}
            className="inline-flex items-center justify-center gap-2 min-h-10 px-3 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSavingMinute ? t('saving') : t('saveItemButton')}
          </button>
        </div>
      ) : (
        <>
          {canUploadForItem ? (
            <div className="mb-3">
              <AttachmentUpload
                minuteId={minuteId!}
                topicId={topicId}
                infoItemId={item._id}
                onUploadComplete={triggerAttachmentRefresh}
              />
            </div>
          ) : (
            <p className="text-xs text-gray-600 mb-2">{t('attachmentsNoUploadPermission')}</p>
          )}

          <AttachmentList
            minuteId={minuteId!}
            topicId={topicId}
            infoItemId={item._id}
            onDelete={triggerAttachmentRefresh}
            refreshKey={attachmentsRefreshToken}
            limit={50}
            hideWhenEmpty
          />
        </>
      )}
    </div>
  );

  // Compact view when not editing
  if (!isEditing) {
    const statusBadge = getStatusBadge();
    const priorityBadge = getPriorityBadge();
    const durationMinutes = normalizeDurationMinutes(item.durationMinutes);

    return (
      <div
        ref={setNodeRef}
        style={{ ...style, scrollMarginTop: '130px' }}
        data-info-item-card="true"
        data-info-item-id={id}
        className={`bg-white border-l-4 ${item.itemType === 'actionItem'
          ? 'border-orange-500'
          : 'border-[var(--brand-primary-border)]'
          } p-4 rounded-lg shadow-sm hover:shadow-md transition-all`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded transition-colors mt-0.5"
              title={t('dragToMove')}
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </button>

            <div className="flex-1 min-w-0">
              {/* Type Label and Title */}
              <div className="mb-2">
                {item.itemType === 'actionItem' ? (
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-600 uppercase tracking-wide">
                      {t('task')}
                    </span>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${priorityBadge.bg} ${priorityBadge.text}`}>
                      {priorityBadge.icon} {priorityBadge.label}
                    </span>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${statusBadge.bg} ${statusBadge.text}`}>
                      {statusBadge.icon} {statusBadge.label}
                    </span>
                    {durationMinutes > 0 && (
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-100 text-sky-800">
                        {t('plannedDurationShort', { minutes: durationMinutes })}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)] uppercase tracking-wide">
                      ℹ️ {t('info')}
                    </span>
                    {durationMinutes > 0 && (
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-100 text-sky-800">
                        {t('plannedDurationShort', { minutes: durationMinutes })}
                      </span>
                    )}
                  </div>
                )}
                <h4 className="font-bold text-gray-900 text-base break-words">{displayTitle}</h4>
              </div>

              {item.details && (
                <p className="text-sm text-gray-700 mb-3 leading-relaxed">{item.details}</p>
              )}

              {/* Info Items - Show responsible persons if available */}
              {item.itemType === 'infoItem' && item.responsibles && item.responsibles.length > 0 && (
                <div className="mt-3 p-2.5 bg-[var(--brand-primary-soft)] border border-[var(--brand-primary-border)] rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-[var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="font-semibold text-[var(--brand-primary-strong)]">{t('participantsLabel')}</span>
                    <span className="text-[var(--brand-primary-strong)] font-medium">
                      {formatUsersAsInitials(item.responsibles)}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Items - Structured info boxes */}
              {item.itemType === 'actionItem' && (() => {
                const hasDueDate = Boolean(item.dueDate);
                const hasResponsibles = Boolean(item.responsibles && item.responsibles.length > 0);
                const dueDateClass = hasResponsibles ? 'flex-1 min-w-[240px]' : 'w-full';
                const responsibleClass = hasDueDate ? 'flex-1 min-w-[240px]' : 'w-full';

                if (!hasDueDate && !hasResponsibles) return null;

                return (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      {hasDueDate ? (
                        <div className={`${dueDateClass} px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className="w-4 h-4 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs font-semibold text-orange-900 whitespace-nowrap">
                              {t('dueOn')}:
                            </span>
                            <span className="text-sm font-bold text-orange-800 truncate">
                              {new Date(item.dueDate!).toLocaleDateString(locale, {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {hasResponsibles ? (
                        <div className={`${responsibleClass} px-3 py-2 bg-[var(--brand-primary-soft)] border border-[var(--brand-primary-border)] rounded-lg`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className="w-4 h-4 text-[var(--brand-primary)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-xs font-semibold text-[var(--brand-primary-strong)] whitespace-nowrap">
                              {t('responsible')}{item.responsibles!.length > 1 ? 's' : ''}:
                            </span>
                            <span className="text-sm font-bold text-[var(--brand-primary-strong)] truncate">
                              {formatUsersAsInitials(item.responsibles!)}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })()}

              {item.notes && (
                <div className="mt-3 p-3 bg-gray-50 border-l-4 border-gray-400 rounded-r-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {item.itemType === 'actionItem' ? t('resolutionLabel') : t('informationLabel')}
                      </p>
                      <p className="text-sm text-gray-800">{item.notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {renderAttachmentSection()}
            </div>
          </div>

          <div className="flex gap-1 flex-shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-1.5 min-h-11 min-w-11 text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] rounded-lg transition-colors inline-flex items-center justify-center"
              title={tCommon('edit')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => deleteInfoItem(topicIndex, itemIndex)}
              className="p-1.5 min-h-11 min-w-11 text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center"
              title={tCommon('delete')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Edit mode (full form)
  const durationMinutes = normalizeDurationMinutes(item.durationMinutes);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, scrollMarginTop: '130px' }}
      data-info-item-card="true"
      data-info-item-id={id}
      className={`bg-gradient-to-br ${getItemColors()} p-4 rounded-xl border-2 shadow-sm hover:shadow-md transition-all`}
    >
      <div className="space-y-3">
        {/* Header: Drag Handle, Type Badge, Save/Delete Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-white/50 rounded-lg transition-colors"
              title={t('dragToMove')}
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </button>

            {/* Type Badge */}
            {item.itemType === 'actionItem' ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getPriorityBadge().bg} ${getPriorityBadge().text}`}>
                  {getPriorityBadge().icon} {getPriorityBadge().label}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadge().bg} ${getStatusBadge().text}`}>
                  {getStatusBadge().icon} {getStatusBadge().label}
                </span>
                {durationMinutes > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
                    {t('plannedDurationShort', { minutes: durationMinutes })}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">
                  ℹ️ {t('info')}
                </span>
                {durationMinutes > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
                    {t('plannedDurationShort', { minutes: durationMinutes })}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-1 self-end sm:self-auto">

            <button
              type="button"
              onClick={() => deleteInfoItem(topicIndex, itemIndex)}
                className="p-1.5 min-h-11 min-w-11 text-red-600 hover:bg-red-100 rounded-lg transition-colors inline-flex items-center justify-center"
              title={tCommon('delete')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Header: Drag Handle, Type Badge, Delete Button */}
        <div className="flex items-center justify-between gap-2" style={{ display: 'none' }}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-white/50 rounded-lg transition-colors"
              title={t('dragToMove')}
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </button>

            {/* Type Badge */}
            {item.itemType === 'actionItem' ? (
              <div className="flex items-center gap-1.5">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getPriorityBadge().bg} ${getPriorityBadge().text}`}>
                  {getPriorityBadge().icon} {getPriorityBadge().label}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadge().bg} ${getStatusBadge().text}`}>
                  {getStatusBadge().icon} {getStatusBadge().label}
                </span>
              </div>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">
                ℹ️ {t('info')}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => deleteInfoItem(topicIndex, itemIndex)}
            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
            title={tCommon('delete')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step 1: Type Selection */}
        <div className="bg-white/70 backdrop-blur-sm p-3 rounded-lg border border-white/50">
          <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            {t('step1SelectType')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateInfoItem(topicIndex, itemIndex, 'itemType', 'infoItem')}
              className={`p-3 rounded-lg border-2 transition-all ${item.itemType === 'infoItem'
                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] shadow-md'
                : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
            >
              <div className="text-center">
                <div className="text-2xl mb-1">ℹ️</div>
                <div className="text-sm font-semibold">{t('info')}</div>
                <div className="text-xs text-gray-500">{t('noteDiscussion')}</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => updateInfoItem(topicIndex, itemIndex, 'itemType', 'actionItem')}
              className={`p-3 rounded-lg border-2 transition-all ${item.itemType === 'actionItem'
                ? 'border-orange-500 bg-orange-50 shadow-md'
                : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
            >
              <div className="text-center">
                <div className="text-2xl mb-1">✓</div>
                <div className="text-sm font-semibold">{t('task')}</div>
                <div className="text-xs text-gray-500">{t('todo')}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Step 2: Title / Automatic Label */}
        {agendaItemLabelMode === 'manual' ? (
          <div className="bg-white/70 backdrop-blur-sm p-3 rounded-lg border border-white/50">
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              {t(item.itemType === 'actionItem' ? 'step2TitleAction' : 'step2TitleInfo')}
            </label>
            <input
              type="text"
              value={item.subject}
              onChange={(e) => updateInfoItem(topicIndex, itemIndex, 'subject', e.target.value)}
              placeholder={t(item.itemType === 'actionItem' ? 'step2PlaceholderAction' : 'step2PlaceholderInfo')}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] text-sm font-semibold bg-white"
              required={item.itemType === 'actionItem' && agendaItemLabelMode === 'manual'}
            />
          </div>
        ) : (
          <div className="bg-white/70 backdrop-blur-sm p-3 rounded-lg border border-white/50">
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              {`${t('topic')} ${topicIndex + 1} – ${t('infoItems')}`}
            </label>
            <div className="grid grid-cols-1 min-[520px]:grid-cols-[120px_minmax(0,1fr)] gap-2">
              <div className="w-full px-3 py-2.5 border-2 border-dashed border-[var(--brand-primary-border)] rounded-lg bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)] text-sm font-bold">
                {automaticEntryLabel}
              </div>
              <input
                type="text"
                value={isAutoGeneratedSubject ? '' : (item.subject || '')}
                onChange={(e) => updateInfoItem(topicIndex, itemIndex, 'subject', e.target.value)}
                placeholder={t(item.itemType === 'actionItem' ? 'step2PlaceholderAction' : 'step2PlaceholderInfo')}
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] text-sm font-semibold bg-white"
              />
            </div>
          </div>
        )}

        {/* Step 3: Content */}
        <div className="bg-white/70 backdrop-blur-sm p-3 rounded-lg border border-white/50">
          <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            {t(item.itemType === 'actionItem' ? 'step3TitleAction' : 'step3TitleInfo')}
          </label>
          <textarea
            value={item.details || ''}
            onChange={(e) => updateInfoItem(topicIndex, itemIndex, 'details', e.target.value)}
            placeholder={t(item.itemType === 'actionItem' ? 'step3PlaceholderAction' : 'step3PlaceholderInfo')}
            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] text-sm bg-white resize-none"
            rows={3}
          />
        </div>

        <div className="bg-white/70 backdrop-blur-sm p-3 rounded-lg border border-white/50">
          <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            🕒 {t('plannedDurationMinutes')}
          </label>
          <div className="grid grid-cols-1 min-[460px]:grid-cols-[180px_minmax(0,1fr)] gap-2 items-center">
            <input
              type="number"
              min={0}
              max={MAX_ENTRY_DURATION_MINUTES}
              step={5}
              value={item.durationMinutes ?? ''}
              onChange={(e) => {
                const rawValue = e.target.value.trim();
                if (!rawValue) {
                  updateInfoItem(topicIndex, itemIndex, 'durationMinutes', undefined);
                  return;
                }

                const parsedValue = Number.parseInt(rawValue, 10);
                if (!Number.isFinite(parsedValue)) return;
                const normalizedValue = normalizeDurationMinutes(parsedValue);
                updateInfoItem(
                  topicIndex,
                  itemIndex,
                  'durationMinutes',
                  normalizedValue > 0 ? normalizedValue : undefined
                );
              }}
              placeholder={t('plannedDurationPlaceholder')}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] text-sm bg-white"
            />
            <p className="text-xs text-gray-500 break-words">{t('plannedDurationHint')}</p>
          </div>
        </div>

        {/* Step 4: Task-specific fields (only for action items) */}
        {item.itemType === 'actionItem' && (
          <div className="space-y-3">
            {/* Priority, Due Date, Status */}
            <div className="bg-white/70 backdrop-blur-sm p-2.5 sm:p-3 rounded-lg border border-white/50">
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                {t('step4Title')}
              </label>

              <div className="space-y-2.5">
                {/* Priority */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    🔥 {t('urgency')}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['low', 'medium', 'high'].map((priority) => {
                      const colors = {
                        low: { bg: 'bg-green-100 hover:bg-green-200', border: 'border-green-400', text: 'text-green-800', label: t('low'), icon: '✓' },
                        medium: { bg: 'bg-orange-100 hover:bg-orange-200', border: 'border-orange-400', text: 'text-orange-800', label: t('medium'), icon: '⚠️' },
                        high: { bg: 'bg-red-100 hover:bg-red-200', border: 'border-red-400', text: 'text-red-800', label: t('high'), icon: '🔥' },
                      }[priority] as any;

                      return (
                        <button
                          key={priority}
                          type="button"
                          onClick={() => updateInfoItem(topicIndex, itemIndex, 'priority', priority)}
                          className={`min-h-11 p-2 rounded-lg border-2 transition-all ${(item.priority || 'medium') === priority
                            ? `${colors.bg} ${colors.border} shadow-md`
                            : 'bg-white border-gray-300 hover:border-gray-400'
                            }`}
                        >
                          <div className={`text-center text-xs sm:text-sm font-semibold ${(item.priority || 'medium') === priority ? colors.text : 'text-gray-600'}`}>
                            <div className="text-base sm:text-lg mb-0.5">{colors.icon}</div>
                            {colors.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    📅 {t('dueDate')}
                  </label>
                  <input
                    type="date"
                    value={item.dueDate?.split('T')[0] || ''}
                    onChange={(e) => updateInfoItem(topicIndex, itemIndex, 'dueDate', e.target.value)}
                    className="w-full px-3 py-2 text-sm min-h-11 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] bg-white"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    📊 {t('status')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['open', 'in-progress', 'completed', 'cancelled'].map((status) => {
                      const statusConfig = {
                        open: { bg: 'bg-yellow-100 hover:bg-yellow-200', border: 'border-yellow-400', text: 'text-yellow-800', label: t('open'), icon: '○' },
                        'in-progress': { bg: 'bg-[var(--brand-primary-soft)] hover:bg-[var(--brand-primary-soft)]', border: 'border-[var(--brand-primary-border)]', text: 'text-[var(--brand-primary-strong)]', label: t('inProgress'), icon: '◐' },
                        completed: { bg: 'bg-green-100 hover:bg-green-200', border: 'border-green-400', text: 'text-green-800', label: t('completed'), icon: '✓' },
                        cancelled: { bg: 'bg-gray-100 hover:bg-gray-200', border: 'border-gray-400', text: 'text-gray-800', label: t('cancelled'), icon: '✗' },
                      }[status] as any;

                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateInfoItem(topicIndex, itemIndex, 'status', status)}
                          className={`w-full min-h-11 p-2 rounded-lg border-2 transition-all ${(item.status || 'open') === status
                            ? `${statusConfig.bg} ${statusConfig.border} shadow-md`
                            : 'bg-white border-gray-300 hover:border-gray-400'
                            }`}
                        >
                          <div className={`flex flex-col items-center justify-center text-center text-xs font-semibold leading-tight ${(item.status || 'open') === status ? statusConfig.text : 'text-gray-600'}`}>
                            <span className="text-sm leading-none">{statusConfig.icon}</span>
                            <span className="mt-0.5">{statusConfig.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Responsible Persons - Available for both Info and Action Items */}
        <div className="bg-white/70 backdrop-blur-sm p-3 sm:p-4 rounded-lg border border-white/50">
            <div className="flex flex-col min-[360px]:flex-row min-[360px]:items-start gap-2 mb-3">
            <div className="w-8 h-8 brand-gradient-bg rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-bold text-gray-800">
                {t(item.itemType === 'actionItem' ? 'responsiblesTitleAction' : 'responsiblesTitleInfo')}
              </label>
              <p className="text-xs text-gray-500 break-words">
                {t(item.itemType === 'actionItem' ? 'responsiblesHelpAction' : 'responsiblesHelpInfo')}
              </p>
            </div>
            {item.responsibles && item.responsibles.length > 0 && (
              <span className="self-start min-[360px]:self-center px-2 py-1 bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)] rounded-full text-xs font-semibold">
                {t('selectedCount', { count: item.responsibles.length })}
              </span>
            )}
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto [scrollbar-gutter:stable] border-2 border-[var(--brand-primary-border)] rounded-lg p-2 bg-[var(--brand-primary-soft)]">
            {/* Alle Option */}
            <label className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 p-2.5 bg-white hover:bg-[var(--brand-primary-soft)] rounded-lg cursor-pointer transition-all border border-transparent hover:border-[var(--brand-primary-border)] group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={
                    selectableResponsibleIds.length > 0 &&
                    selectableResponsibleIds.every((value) => (item.responsibles || []).includes(value))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateInfoItem(topicIndex, itemIndex, 'responsibles', selectableResponsibleIds);
                    } else {
                      updateInfoItem(topicIndex, itemIndex, 'responsibles', []);
                    }
                  }}
                  className="w-5 h-5 text-[var(--brand-primary)] border-2 border-gray-300 rounded focus:ring-2 focus:ring-[var(--brand-primary)] cursor-pointer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-[var(--brand-primary-strong)] group-hover:text-[var(--brand-primary-strong)]">
                  ✓ {t('selectAll')}
                </span>
                <p className="text-xs text-gray-500 break-words">{t('addAllMembers')}</p>
              </div>
            </label>

            <div className="border-t-2 border-[var(--brand-primary-border)] my-2"></div>

            {responsibleEntries.map((entry) => {
              const isSelected = item.responsibles?.includes(entry.id) || false;
              const initials = entry.kind === 'guest'
                ? entry.initials
                : (entry.label
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part.charAt(0).toUpperCase())
                  .join('') || 'F');

              return (
                <label
                  key={entry.id}
                    className={`grid grid-cols-[auto_minmax(0,1fr)] min-[360px]:grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-1.5 sm:gap-2 p-2.5 rounded-lg transition-all border ${
                    isSelected
                      ? 'bg-[var(--brand-primary-soft)] border-[var(--brand-primary-border)] shadow-sm'
                      : 'bg-white border-transparent'
                  } ${entry.isActive && entry.hasAssignment ? 'cursor-pointer hover:bg-gray-50 hover:border-gray-300' : 'opacity-70'}`}
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={(!entry.isActive || !entry.hasAssignment) && !isSelected}
                      onChange={(e) => {
                        const currentResponsibles = item.responsibles || [];
                        let newResponsibles: string[];
                        if (e.target.checked) {
                          newResponsibles = [...currentResponsibles, entry.id];
                        } else {
                          newResponsibles = currentResponsibles.filter((id) => id !== entry.id);
                        }
                        updateInfoItem(topicIndex, itemIndex, 'responsibles', newResponsibles);
                      }}
                      className="w-5 h-5 text-[var(--brand-primary)] border-2 border-gray-300 rounded focus:ring-2 focus:ring-[var(--brand-primary)] cursor-pointer disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="min-w-0 flex items-start gap-1.5 sm:gap-2">
                    <div className={`w-6 h-6 mt-0.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                      isSelected ? 'brand-gradient-bg' : entry.kind === 'guest' ? 'bg-gradient-to-br from-orange-500 to-pink-500' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                    }`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`block text-sm font-semibold leading-tight break-words ${isSelected ? 'text-[var(--brand-primary-strong)]' : 'text-gray-700'}`}>
                        {entry.label}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {entry.kind === 'guest'
                          ? t('guest')
                          : `@${entry.id}${!entry.isActive ? ' · inaktiv (historisch)' : ''}${entry.isActive && !entry.hasAssignment ? ' · keine Person zugeordnet' : ''}`}
                      </span>
                    </div>
                  </div>
                </label>
              );
            })}

            {responsibleEntries.length === 0 && (
              <div className="text-center py-6">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <p className="text-sm text-gray-500 font-medium">{t('noMembersAvailable')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Notes - Available for both types */}
        <div className="bg-white/70 backdrop-blur-sm p-3 rounded-lg border border-white/50">
          <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            📝 {item.itemType === 'actionItem' ? t('resolutionLabel') : t('informationLabel')}
          </label>
          <textarea
            value={item.notes || ''}
            onChange={(e) => updateInfoItem(topicIndex, itemIndex, 'notes', e.target.value)}
            placeholder={item.itemType === 'actionItem' ? t('resolutionPlaceholder') : t('informationPlaceholder')}
            className="w-full min-h-[96px] px-3 py-2.5 text-sm leading-snug border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)] bg-white resize-y"
            rows={4}
          />
        </div>

        {renderAttachmentSection()}

        {/* Save Button at the bottom */}
        <div className="flex justify-center pt-4 border-t border-white/30">
          <button
            type="button"
            onClick={async () => {
              const canSave = agendaItemLabelMode === 'topic-alpha' || item.itemType !== 'actionItem' || Boolean(item.subject?.trim());
              if (canSave) {
                const persisted = await saveMinuteInPlace();
                if (persisted) {
                  setIsEditing(false);
                }
              }
            }}
            disabled={isSavingMinute || (agendaItemLabelMode !== 'topic-alpha' && item.itemType === 'actionItem' && !item.subject?.trim())}
            className="w-full sm:w-auto px-6 py-2.5 min-h-11 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm inline-flex items-center justify-center gap-2 shadow-md"
            title={t('saveItemButton')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {isSavingMinute ? t('saving') : t('saveItemButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface InfoItem {
  _id?: string;
  subject: string;
  details?: string;
  itemType: 'actionItem' | 'infoItem';
  status?: 'open' | 'in-progress' | 'completed' | 'cancelled';
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  durationMinutes?: number;
  responsibles?: string[];
  estimatedHours?: number;
  actualHours?: number;
  notes?: string;
  parentMinutesId?: string;
  parentItemId?: string;
  // Import tracking
  isImported?: boolean; // Mark entries imported from previous protocol
  originalTaskId?: string; // Original task ID to prevent duplicate imports
  externalTaskId?: string; // Reference to Central Task Registry
}

interface Topic {
  _id?: string;
  subject: string;
  responsibles?: string[];
  infoItems?: InfoItem[];
}

interface Member {
  userId: string;
}

interface User {
  _id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'moderator' | 'user';
}

interface ClubFunctionEntry {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  token: string;
  assignedUserId?: string;
}

interface MentionCandidate {
  value: string;
  label: string;
}

function getTextareaCaretCoordinates(
  textarea: HTMLTextAreaElement,
  caretPosition: number
): { top: number; left: number } {
  const mirror = document.createElement('div');
  const style = window.getComputedStyle(textarea);

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.font = style.font;
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;

  const before = textarea.value.slice(0, caretPosition);
  const after = textarea.value.slice(caretPosition) || ' ';
  mirror.textContent = before;

  const marker = document.createElement('span');
  marker.textContent = after[0];
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const top = marker.offsetTop - textarea.scrollTop;
  const left = marker.offsetLeft - textarea.scrollLeft;

  document.body.removeChild(mirror);

  return { top, left };
}

interface Participant {
  userId: string;
  attendance: 'present' | 'excused' | 'absent';
}

interface Minute {
  _id: string;
  meetingSeries_id: any;
  date: string;
  time?: string;
  endTime?: string;
  location?: string;
  participants: string[];
  participantsWithStatus?: Participant[];
  topics: Topic[];
  globalNote: string;
  isFinalized: boolean;
  reopeningHistory?: {
    reopenedAt: string;
    reopenedBy: string;
    reason: string;
  }[];
}

interface FormData {
  date: string;
  time?: string;
  endTime?: string;
  location?: string;
  title?: string;
  participants: string[];
  participantsWithStatus: Participant[];
  topics: Topic[];
  globalNote: string;
}

export default function EditMinutePage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations('minutes');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const { hasPermission, refreshUser } = useAuth();
  const [minute, setMinute] = useState<Minute | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minuteId, setMinuteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    date: '',
    time: '',
    endTime: '',
    location: '',
    participants: [],
    participantsWithStatus: [],
    topics: [],
    globalNote: ''
  });
  const [_newParticipant, _setNewParticipant] = useState('');
  const [_availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [clubFunctions, setClubFunctions] = useState<ClubFunctionEntry[]>([]);
  const [meetingSeriesMembers, setMeetingSeriesMembers] = useState<Member[]>([]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [showPendingTasks, setShowPendingTasks] = useState(false);
  const [loadingPendingTasks, setLoadingPendingTasks] = useState(false);
  const [_importingPendingTasks, _setImportingPendingTasks] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [agendaItemLabelMode, setAgendaItemLabelMode] = useState<'manual' | 'topic-alpha'>('topic-alpha');
  const [editorMode, setEditorMode] = useState<'visual' | 'markdown'>('visual');
  const [markdownText, setMarkdownText] = useState('');
  const [markdownWarnings, setMarkdownWarnings] = useState<string[]>([]);
  const [markdownImportInfo, setMarkdownImportInfo] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionCandidate[]>([]);
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [mentionCaretIndex, setMentionCaretIndex] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionMenuPosition, setMentionMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [attachmentsRefreshToken, setAttachmentsRefreshToken] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const canUploadDocuments = hasPermission('canUploadDocuments');
  const triggerAttachmentRefresh = useCallback(() => {
    setAttachmentsRefreshToken((prev) => prev + 1);
  }, []);

  // Use a ref to track imported task IDs to prevent duplicates
  const importedTaskIdsRef = useRef<Set<string>>(new Set());
  const markdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const markdownSyncTargetRef = useRef<string | null>(null);
  const suppressUnsavedTrackingRef = useRef(false);

  // Use a ref to track if an import is currently in progress
  const importInProgressRef = useRef<boolean>(false);

  // Use a ref to track the currently processing task ID (for ultra-fast duplicate detection)
  const currentlyProcessingTaskIdRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setMinuteId(resolvedParams.id);
    };
    getParams();
  }, [params]);

  useEffect(() => {
    if (minuteId) {
      const loadData = async () => {
        setLoading(true);
        try {
          // 1. Fetch Users first
          const usersResponse = await fetch('/api/users?limit=1000', { credentials: 'include' });
          let users: User[] = [];
          if (usersResponse.ok) {
            const res = await usersResponse.json();
            users = res.data || [];
            setAllUsers(users);
            setAvailableUsers(users.map(u => u.username));
          }

          const clubFunctionsResponse = await fetch('/api/club-functions?includeInactive=true', {
            credentials: 'include',
          });
          if (clubFunctionsResponse.ok) {
            const clubFunctionsResult = await clubFunctionsResponse.json();
            setClubFunctions(clubFunctionsResult.data || []);
          }

          // 2. Fetch Minute
          const response = await fetch(`/api/minutes/${minuteId}`, { credentials: 'include' });
          if (!response.ok) throw new Error(t('notFound'));
          const result = await response.json();
          const minuteData = result.data;


          setMinute(minuteData);

          // 3. Fetch Series and Sync Participants
          if (minuteData.meetingSeries_id) {
            const seriesId = minuteData.meetingSeries_id._id || minuteData.meetingSeries_id;
            const seriesResponse = await fetch(`/api/meeting-series/${seriesId}`, { credentials: 'include' });

            if (seriesResponse.ok) {
              const seriesData = await seriesResponse.json();
              const members = seriesData.data?.members || [];
              const seriesParticipants = seriesData.data?.participants || [];

              // A. Add new members from series to minute
              const currentParticipantIds = new Set(minuteData.participantsWithStatus?.map((p: any) => p.userId) || []);
              members.forEach((member: any) => {
                if (!currentParticipantIds.has(member.userId)) {
                  // Only add if user exists in system
                  if (users.some(u => u._id === member.userId)) {
                    minuteData.participantsWithStatus = minuteData.participantsWithStatus || [];
                    minuteData.participantsWithStatus.push({
                      userId: member.userId,
                      attendance: 'present'
                    });
                  }
                }
              });

              // B. Update members list for dropdown (ensure all current participants are in the list)
              if (minuteData.participantsWithStatus) {
                const existingIds = new Set(members.map((m: any) => m.userId));
                minuteData.participantsWithStatus.forEach((p: any) => {
                  if (!existingIds.has(p.userId)) {
                    members.push({ userId: p.userId });
                    existingIds.add(p.userId);
                  }
                });
              }

              setMeetingSeriesMembers(members);

              suppressUnsavedTrackingRef.current = true;
              setFormData({
                date: minuteData.date?.split('T')[0] || '',
                time: minuteData.time || '',
                endTime: minuteData.endTime || '',
                location: minuteData.location || '',
                title: minuteData.title || '',
                participants: minuteData.participants && minuteData.participants.length > 0
                  ? minuteData.participants
                  : seriesParticipants,
                participantsWithStatus: minuteData.participantsWithStatus || [],
                topics: minuteData.topics || [],
                globalNote: minuteData.globalNote || ''
              });
              setHasUnsavedChanges(false);
              setLoading(false);
              return;
            }
          }

          // Fallback if no series or series fetch failed
          suppressUnsavedTrackingRef.current = true;
          setFormData({
            date: minuteData.date?.split('T')[0] || '',
            time: minuteData.time || '',
            endTime: minuteData.endTime || '',
            location: minuteData.location || '',
            title: minuteData.title || '',
            participants: minuteData.participants || [],
            participantsWithStatus: minuteData.participantsWithStatus || [],
            topics: minuteData.topics || [],
            globalNote: minuteData.globalNote || ''
          });
          setHasUnsavedChanges(false);

        } catch (err) {
          setError(err instanceof Error ? err.message : t('loadError'));
        } finally {
          setLoading(false);
        }
      };

      loadData();
    }
  }, [minuteId, t]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const loadPublicSettings = async () => {
      try {
        const response = await fetch('/api/settings/public', { credentials: 'include' });
        if (!response.ok) return;
        const result = await response.json();
        const mode = result?.data?.system?.agendaItemLabelMode;
        if (mode === 'manual' || mode === 'topic-alpha') {
          setAgendaItemLabelMode(mode);
        }
      } catch {
        // Fallback to default mode
      }
    };

    loadPublicSettings();
  }, []);

  const fetchPendingTasks = useCallback(async () => {
    if (!minute?.meetingSeries_id || !minuteId) return;

    setLoadingPendingTasks(true);
    try {
      const seriesId = minute.meetingSeries_id._id || minute.meetingSeries_id;

      // Include minuteId to filter out already imported tasks
      const url = `/api/meeting-series/${seriesId}/pending-tasks?minuteId=${minuteId}`;

      const response = await fetch(url, {
        credentials: 'include', // Cookie-based authentication
      });

      if (response.ok) {
        const result = await response.json();
        setPendingTasks(result.data || []);
        setShowPendingTasks(true); // Always set to true after loading, regardless of results
      }
    } catch (err) {
      console.error('Error fetching pending tasks:', err);
    } finally {
      setLoadingPendingTasks(false);
    }
  }, [minute, minuteId]);

  // Auto-load pending tasks when minute is loaded
  useEffect(() => {
    if (minute && minuteId && !minute.isFinalized) {
      fetchPendingTasks();
    }
  }, [minute, minuteId, fetchPendingTasks]); // Run when minute is loaded or changes

  // Track unsaved changes (skip the initial load)
  const isInitialLoad = useRef(true);
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    if (suppressUnsavedTrackingRef.current) {
      suppressUnsavedTrackingRef.current = false;
      return;
    }
    setHasUnsavedChanges(true);
  }, [formData]);

  useEffect(() => {
    if (editorMode !== 'markdown') return;
    const serialized = serializeTopicsToMarkdown(formData.topics as any);
    markdownSyncTargetRef.current = serialized;
    setMarkdownText(serialized);
    closeMentionSuggestions();
  }, [editorMode, formData.topics]);

  useEffect(() => {
    if (editorMode !== 'markdown') return;

    if (markdownSyncTargetRef.current !== null) {
      if (markdownText === markdownSyncTargetRef.current) {
        markdownSyncTargetRef.current = null;
        return;
      }
      markdownSyncTargetRef.current = null;
    }

    setHasUnsavedChanges(true);
  }, [editorMode, markdownText]);

  const mentionCandidates = useMemo(() => {
    const seen = new Set<string>();
    const result: MentionCandidate[] = [];

    allUsers.forEach((user) => {
      const rawUsername = String(user.username || '').trim();
      const mentionToken = rawUsername && !/\s/.test(rawUsername) ? rawUsername : String(user._id || '').trim();
      const value = mentionToken.trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      result.push({
        value,
        label: `${user.firstName} ${user.lastName} (@${rawUsername || value})`,
      });
    });

    clubFunctions.forEach((fn) => {
      const hasAssignment = Boolean(fn.assignedUserId);
      const value = (fn.token || '').trim();
      if (!value || seen.has(value)) return;
      if (!hasAssignment && fn.isActive) return;
      seen.add(value);
      result.push({
        value,
        label: `${fn.name} (@${value})${fn.isActive ? '' : ' [inaktiv]'}${hasAssignment ? '' : ' [ohne Zuordnung]'}`,
      });
    });

    return result;
  }, [allUsers, clubFunctions]);

  const closeMentionSuggestions = () => {
    setMentionSuggestions([]);
    setMentionStartIndex(null);
    setMentionCaretIndex(null);
    setSelectedMentionIndex(0);
    setMentionMenuPosition(null);
  };

  const updateMentionSuggestions = (text: string, caretPos: number) => {
    const textarea = markdownTextareaRef.current;
    if (!textarea) {
      closeMentionSuggestions();
      return;
    }

    const before = text.slice(0, caretPos);
    const atIndex = before.lastIndexOf('@');
    if (atIndex === -1) {
      closeMentionSuggestions();
      return;
    }

    const prefix = before.slice(atIndex + 1);
    if (prefix.includes(' ') || prefix.includes('\n') || prefix.includes('\t')) {
      closeMentionSuggestions();
      return;
    }

    const query = prefix.trim().toLowerCase();
    const suggestions = mentionCandidates
      .filter((candidate) => {
        if (!query) return true;
        return (
          candidate.value.toLowerCase().includes(query) ||
          candidate.label.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);

    if (suggestions.length === 0) {
      closeMentionSuggestions();
      return;
    }

    setMentionSuggestions(suggestions);
    setMentionStartIndex(atIndex);
    setMentionCaretIndex(caretPos);
    setSelectedMentionIndex(0);
    const caret = getTextareaCaretCoordinates(textarea, caretPos);
    const dropdownTop = Math.max(8, caret.top + 24);
    const dropdownLeft = Math.max(8, Math.min(caret.left, textarea.clientWidth - 260));
    setMentionMenuPosition({ top: dropdownTop, left: dropdownLeft });
  };

  // Initialize importedTaskIdsRef with already imported tasks from formData
  useEffect(() => {
    const importedIds = new Set<string>();
    formData.topics.forEach(topic => {
      topic.infoItems?.forEach(item => {
        if (item.originalTaskId && item.isImported) {
          importedIds.add(item.originalTaskId);
        }
      });
    });

    importedTaskIdsRef.current = importedIds;
  }, [formData.topics]); // Re-run when topics change

  // Warn on page leave if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const totalPlannedMinutes = useMemo(() => {
    return formData.topics.reduce((sum, topic) => {
      return sum + sumInfoItemDurations(topic.infoItems || []);
    }, 0);
  }, [formData.topics]);

  const plannedEndTime = useMemo(() => {
    return addMinutesToClockTime(formData.time, totalPlannedMinutes);
  }, [formData.time, totalPlannedMinutes]);

  const importPendingTask = (e: React.MouseEvent<HTMLButtonElement>, task: any) => {
    const taskId = task._id || task.id;

    // ULTRA-FAST GUARD: Check if this exact task is CURRENTLY being processed in this very moment
    if (currentlyProcessingTaskIdRef.current === taskId) {
      return; // Silent block - no alert needed
    }

    // Set as currently processing IMMEDIATELY
    currentlyProcessingTaskIdRef.current = taskId;

    // FIRST GUARD: Check if this specific task is already being imported or was imported
    const hasTask = importedTaskIdsRef.current.has(taskId);

    if (hasTask) {
      currentlyProcessingTaskIdRef.current = null; // Release ultra-fast lock
      return;
    }

    // SECOND GUARD: Check if ANY import is in progress
    if (importInProgressRef.current) {
      currentlyProcessingTaskIdRef.current = null;
      return;
    }

    // Set import in progress flag
    importInProgressRef.current = true;

    // Add to imported set after lock acquisition
    importedTaskIdsRef.current.add(taskId);

    const isAlreadyImportedInState = formData.topics.some(topic =>
      topic.infoItems?.some(item => item.originalTaskId === taskId)
    );

    if (isAlreadyImportedInState) {
      // Remove from ref since state already has it
      importedTaskIdsRef.current.delete(taskId);
      importInProgressRef.current = false; // Release lock
      currentlyProcessingTaskIdRef.current = null; // Release ultra-fast lock
      return;
    }

    // Remove task from pending list IMMEDIATELY to prevent double clicks
    setPendingTasks(prev => {
      const filtered = prev.filter(t => (t._id || t.id) !== taskId);
      return filtered;
    });

    // Add task to the first topic or create a "Pendenzen" topic
    const newInfoItem: InfoItem = {
      subject: task.subject,
      details: task.details,
      itemType: 'actionItem',
      priority: task.priority || 'medium',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : undefined,
      responsibles: task.responsibles || [],
      status: task.status || 'open',
      notes: task.notes,
      parentMinutesId: task.parentMinutesId,
      parentItemId: task.parentItemId || taskId, // Link to parent (root) or previous task
      isImported: true, // Mark as imported
      originalTaskId: taskId, // Store original task ID
      externalTaskId: task.externalTaskId, // Link to Central Task Registry
    };

    setFormData(prev => {
      const topics = [...prev.topics];

      // CRITICAL: Check if this task is already in the topics (React StrictMode protection)
      const alreadyExists = topics.some(topic =>
        topic.infoItems?.some(item => item.originalTaskId === taskId)
      );

      if (alreadyExists) {
        return prev; // Return unchanged state
      }

      // Find or create "Pendenzen" topic
      const pendenzenIndex = topics.findIndex(t => t.subject === 'Pendenzen aus letztem Protokoll');

      if (pendenzenIndex === -1) {
        // Create new topic at the beginning
        topics.unshift({
          subject: 'Pendenzen aus letztem Protokoll',
          responsibles: [],
          infoItems: [newInfoItem],
        });
      } else {
        // Add to existing topic
        if (!topics[pendenzenIndex].infoItems) {
          topics[pendenzenIndex].infoItems = [];
        }
        topics[pendenzenIndex].infoItems!.push(newInfoItem);
      }

      return { ...prev, topics };
    });

    // Release import lock after a short delay to ensure React has processed the state update
    setTimeout(() => {
      importInProgressRef.current = false;
      currentlyProcessingTaskIdRef.current = null; // Release ultra-fast lock
    }, 100);
  };

  const addGuest = () => {
    if (!newGuestName.trim()) return;
    
    const guestId = `guest:${newGuestName.trim()}`;
    
    // Check if already exists
    if (formData.participantsWithStatus.some(p => p.userId === guestId)) {
      alert(t('guestAlreadyInList'));
      return;
    }

    setFormData(prev => ({
      ...prev,
      participants: [...prev.participants, newGuestName.trim()],
      participantsWithStatus: [
        ...prev.participantsWithStatus,
        { userId: guestId, attendance: 'present' }
      ]
    }));
    setMeetingSeriesMembers(prev =>
      prev.some((member) => member.userId === guestId)
        ? prev
        : [...prev, { userId: guestId }]
    );
    
    setNewGuestName('');
    setShowGuestInput(false);
  };

  const importMarkdownToTopics = () => {
    closeMentionSuggestions();
    const parsed = parseMinutesMarkdown(markdownText);
    if (parsed.topics.length === 0) {
      setError(t('markdownNoTopicsError'));
      setMarkdownWarnings(parsed.warnings);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      topics: parsed.topics as Topic[],
    }));
    setMarkdownWarnings(parsed.warnings);
    setMarkdownImportInfo(
      t('markdownImportSuccess', {
        topicCount: parsed.topics.length,
        entryCount: parsed.topics.reduce((sum, topic) => sum + (topic.infoItems?.length || 0), 0),
      })
    );
    setError(null);
  };

  const resetMarkdownTemplate = () => {
    setMarkdownText(getMinutesMarkdownTemplate());
    setMarkdownWarnings([]);
    setMarkdownImportInfo(null);
    closeMentionSuggestions();
  };

  const insertMarkdownSnippet = (snippet: string) => {
    const textarea = markdownTextareaRef.current;
    const currentValue = markdownText;
    const selectionStart = textarea?.selectionStart ?? currentValue.length;
    const selectionEnd = textarea?.selectionEnd ?? currentValue.length;

    const beforeRaw = currentValue.slice(0, selectionStart);
    const afterRaw = currentValue.slice(selectionEnd);
    const before = beforeRaw.length > 0 && !beforeRaw.endsWith('\n') ? `${beforeRaw}\n` : beforeRaw;
    const after = afterRaw.length > 0 && !afterRaw.startsWith('\n') ? `\n${afterRaw}` : afterRaw;
    const insertion = snippet.endsWith('\n') ? snippet : `${snippet}\n`;
    const newValue = `${before}${insertion}${after}`;
    const cursorPosition = before.length + insertion.length;

    setMarkdownText(newValue);
    setMarkdownImportInfo(null);

    requestAnimationFrame(() => {
      if (!markdownTextareaRef.current) return;
      markdownTextareaRef.current.focus();
      markdownTextareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const buildInfoTemplate = () =>
    ['- [i] Informationstitel @userId', '  Details zur Information', '  information: Kontext oder Info'].join('\n');

  const buildTaskTemplate = (status: 'open' | 'in-progress' | 'done') => {
    const token = status === 'open' ? ' ' : status === 'in-progress' ? '~' : 'x';
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return [
      `- [${token}] Aufgabentitel !medium due:${dueDate} @userId`,
      '  Details zur Aufgabe',
      '  beschluss: Nächster Schritt / Kommentar',
    ].join('\n');
  };

  const applyMentionSuggestion = (candidate: MentionCandidate) => {
    if (mentionStartIndex === null || mentionCaretIndex === null) return;
    const currentValue = markdownText;
    const before = currentValue.slice(0, mentionStartIndex);
    const after = currentValue.slice(mentionCaretIndex);
    const insertion = `@${candidate.value}`;
    const needsSpace = after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n');
    const nextValue = `${before}${insertion}${needsSpace ? ' ' : ''}${after}`;
    const nextCursor = before.length + insertion.length + (needsSpace ? 1 : 0);

    setMarkdownText(nextValue);
    setMarkdownImportInfo(null);
    closeMentionSuggestions();

    requestAnimationFrame(() => {
      if (!markdownTextareaRef.current) return;
      markdownTextareaRef.current.focus();
      markdownTextareaRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const persistMinute = useCallback(
    async ({ redirectOnSuccess }: { redirectOnSuccess: boolean }): Promise<boolean> => {
      if (!minuteId) return false;

      // Keep explicit empty strings so users can clear optional fields.
      const dataToSave = {
        ...formData,
        time: (formData.time || '').trim(),
        endTime: (formData.endTime || '').trim(),
        location: (formData.location || '').trim(),
        title: (formData.title || '').trim(),
      };

      if (editorMode === 'markdown') {
        const parsed = parseMinutesMarkdown(markdownText);
        if (parsed.topics.length === 0) {
          setError(t('markdownNoTopicsError'));
          setMarkdownWarnings(parsed.warnings);
          return false;
        }
        dataToSave.topics = parsed.topics as Topic[];
        setMarkdownWarnings(parsed.warnings);
      }

      setSaving(true);
      setError(null);
      try {
        const response = await fetch(`/api/minutes/${minuteId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSave),
        });

        const result = await response.json();

        if (response.ok) {
          const savedMinute = result?.data;
          if (savedMinute) {
            setMinute(savedMinute);
            suppressUnsavedTrackingRef.current = true;
            setFormData({
              date: savedMinute.date?.split('T')[0] || '',
              time: savedMinute.time || '',
              endTime: savedMinute.endTime || '',
              location: savedMinute.location || '',
              title: savedMinute.title || '',
              participants: savedMinute.participants || [],
              participantsWithStatus: savedMinute.participantsWithStatus || [],
              topics: savedMinute.topics || [],
              globalNote: savedMinute.globalNote || '',
            });
          }
          setHasUnsavedChanges(false);
          if (redirectOnSuccess) {
            router.push(`/minutes/${minuteId}`);
          }
          return true;
        }

        setError(result.error || t('saveError'));
        return false;
      } catch (_error) {
        setError(t('saveError'));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [editorMode, formData, markdownText, minuteId, router, t]
  );

  const saveMinuteInPlace = useCallback(() => {
    return persistMinute({ redirectOnSuccess: false });
  }, [persistMinute]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistMinute({ redirectOnSuccess: true });
  };

  const getUserById = (userId: string): User | undefined => {
    return allUsers.find(u => u._id === userId);
  };

  const getUserFunctionLabel = (userId: string): string => {
    const names = clubFunctions
      .filter((entry) => String(entry.assignedUserId || '') === userId)
      .map((entry) => String(entry.name || '').trim())
      .filter(Boolean);
    return Array.from(new Set(names)).join(', ');
  };

  const addTopic = () => {
    setFormData(prev => ({
      ...prev,
      topics: [...prev.topics, { subject: '', responsibles: [], infoItems: [] }]
    }));
  };

  const updateTopic = (index: number, field: keyof Topic, value: any) => {
    setFormData(prev => ({
      ...prev,
      topics: prev.topics.map((topic, i) =>
        i === index ? { ...topic, [field]: value } : topic
      )
    }));
  };

  const addInfoItem = (topicIndex: number) => {
    setFormData(prev => ({
      ...prev,
      topics: prev.topics.map((topic, i) =>
        i === topicIndex
          ? {
            ...topic,
            infoItems: [
              ...(topic.infoItems || []),
              {
                subject: '',
                details: '',
                itemType: 'infoItem' as const,
                status: 'open',
                priority: 'medium',
                responsibles: []
              }
            ]
          }
          : topic
      )
    }));
  };

  const updateInfoItem = (topicIndex: number, itemIndex: number, field: keyof InfoItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      topics: prev.topics.map((topic, i) =>
        i === topicIndex
          ? {
            ...topic,
            infoItems: topic.infoItems?.map((item, j) =>
              j === itemIndex ? { ...item, [field]: value } : item
            ) || []
          }
          : topic
      )
    }));
  };

  const handleDragEndTopic = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFormData(prev => {
        const oldIndex = prev.topics.findIndex((_, i) => `topic-${i}` === active.id);
        const newIndex = prev.topics.findIndex((_, i) => `topic-${i}` === over.id);

        return {
          ...prev,
          topics: arrayMove(prev.topics, oldIndex, newIndex)
        };
      });
    }
  };

  const handleDragEndInfoItem = (topicIndex: number) => (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFormData(prev => ({
        ...prev,
        topics: prev.topics.map((topic, i) => {
          if (i !== topicIndex || !topic.infoItems) return topic;

          const oldIndex = topic.infoItems.findIndex((_, j) => `item-${topicIndex}-${j}` === active.id);
          const newIndex = topic.infoItems.findIndex((_, j) => `item-${topicIndex}-${j}` === over.id);

          return {
            ...topic,
            infoItems: arrayMove(topic.infoItems, oldIndex, newIndex)
          };
        })
      }));
    }
  };

  const deleteTopic = (topicIndex: number) => {
    setConfirmDialog({
      message: t('confirmDeleteTopic'),
      onConfirm: () => {
        setFormData(prev => ({
          ...prev,
          topics: prev.topics.filter((_, i) => i !== topicIndex)
        }));
        setConfirmDialog(null);
      },
    });
  };

  const deleteInfoItem = (topicIndex: number, itemIndex: number) => {
    setConfirmDialog({
      message: t('confirmDeleteInfoItem'),
      onConfirm: () => {
        setFormData(prev => ({
          ...prev,
          topics: prev.topics.map((topic, i) =>
            i === topicIndex
              ? {
                ...topic,
                infoItems: topic.infoItems?.filter((_, j) => j !== itemIndex) || []
              }
              : topic
          )
        }));
        setConfirmDialog(null);
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen brand-page-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)]"></div>
      </div>
    );
  }

  if (error || !minute) {
    return (
      <div className="min-h-screen brand-page-gradient flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">{tCommon('error')}</h1>
          <p className="text-gray-600">{error || t('notFound')}</p>
          <Link href="/meeting-series" className="text-[var(--brand-primary)] hover:text-[var(--brand-primary-strong)] mt-4 inline-block">
            {t('backToOverview')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen brand-page-gradient py-6 sm:py-8 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-5 sm:p-8 border border-gray-100">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-3 flex-wrap">
            <Link href="/meeting-series" className="hover:text-[var(--brand-primary)] transition-colors">
              {tNav('meetingSeries')}
            </Link>
            {minute?.meetingSeries_id?._id && (
              <>
                <span className="text-gray-400">›</span>
                <Link href={`/meeting-series/${minute.meetingSeries_id._id}`} className="hover:text-[var(--brand-primary)] transition-colors">
                  {minute.meetingSeries_id.project && minute.meetingSeries_id.name
                    ? `${minute.meetingSeries_id.project} – ${minute.meetingSeries_id.name}`
                    : minute.meetingSeries_id.name || minute.meetingSeries_id.project || 'Series'}
                </Link>
              </>
            )}
            <span className="text-gray-400">›</span>
            <Link href={`/minutes/${minuteId}`} className="hover:text-[var(--brand-primary)] transition-colors">
              {minute?.date ? new Date(minute.date).toLocaleDateString() : 'Protokoll'}
            </Link>
            <span className="text-gray-400">›</span>
            <span className="text-gray-900 font-medium">{tCommon('edit')}</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 break-words">{t('editMinute')}</h1>
        </div>

        {/* Sticky Save Button */}
        <div className="hidden sm:block fixed bottom-6 right-6 z-40">
          <button
            type="submit"
            form="edit-form"
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-white"
          >
            <div className="flex items-center gap-2">
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="hidden sm:inline">{saving ? t('saving') : tCommon('save')}</span>
            </div>
          </button>
        </div>

        {/* Mobile Save Button */}
        <div className="sm:hidden fixed bottom-3 inset-x-3 z-40 pb-[env(safe-area-inset-bottom)]">
          <button
            type="submit"
            form="edit-form"
            disabled={saving}
            className="w-full px-6 py-3 min-h-11 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed border border-white/60"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {saving ? t('saving') : tCommon('save')}
            </span>
          </button>
        </div>

        <form id="edit-form" onSubmit={handleSubmit} className="space-y-8 pb-28 sm:pb-8">
          {/* Title */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('minuteTitle')}</label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder={t('minuteTitlePlaceholder')}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
            />
          </div>

          {/* Date, Time and Location */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('date')} *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('time')}</label>
                <input
                  type="time"
                  value={formData.time || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  placeholder="HH:MM"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('location')}</label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder={t('locationPlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {totalPlannedMinutes > 0 && (
            <div className="bg-sky-50/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-sky-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">{t('sessionPlan')}</h2>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold bg-sky-100 text-sky-800">
                  {t('totalPlannedDuration', { minutes: totalPlannedMinutes })}
                </span>
              </div>
              {plannedEndTime && (
                <p className="mt-2 text-sm text-slate-700">
                  {t('plannedEndTime', { time: plannedEndTime })}
                </p>
              )}
            </div>
          )}

          {/* Attendance List */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 brand-gradient-bg rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{t('attendanceList')}</h2>
            </div>
            <div className="space-y-3">
              {formData.participantsWithStatus.map((participant, index) => {
                const user = getUserById(participant.userId);
                const isGuest = participant.userId.startsWith('guest:');
                const guestName = isGuest ? participant.userId.replace('guest:', '') : '';
                const functionLabel = user ? getUserFunctionLabel(user._id) : '';

                return (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isGuest ? 'bg-gradient-to-br from-orange-400 to-pink-500' : 'brand-gradient-bg'}`}>
                        {user ? user.firstName.charAt(0).toUpperCase() : (isGuest ? guestName.charAt(0).toUpperCase() : '?')}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 break-words">
                          {user
                            ? `${user.firstName} ${user.lastName}${functionLabel ? ` (${functionLabel})` : ''}`
                            : (isGuest ? `${guestName} (${t('guest')})` : `${t('userId')}: ${participant.userId}`)}
                        </p>
                        {user && (
                          <p className="text-sm text-gray-600 break-all">{user.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="w-full sm:w-auto grid grid-cols-1 min-[480px]:grid-cols-2 lg:flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...formData.participantsWithStatus];
                          updated[index] = { ...updated[index], attendance: 'present' };
                          setFormData(prev => ({ ...prev, participantsWithStatus: updated }));
                        }}
                        className={`w-full lg:w-auto px-4 py-2.5 min-h-11 rounded-lg font-medium text-sm transition-all ${participant.attendance === 'present'
                          ? 'bg-green-500 text-white shadow-md'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                      >
                        ✓ {t('present')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...formData.participantsWithStatus];
                          updated[index] = { ...updated[index], attendance: 'excused' };
                          setFormData(prev => ({ ...prev, participantsWithStatus: updated }));
                        }}
                        className={`w-full lg:w-auto px-4 py-2.5 min-h-11 rounded-lg font-medium text-sm transition-all ${participant.attendance === 'excused'
                          ? 'bg-yellow-500 text-white shadow-md'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                      >
                        ⓘ {t('excused')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...formData.participantsWithStatus];
                          updated[index] = { ...updated[index], attendance: 'absent' };
                          setFormData(prev => ({ ...prev, participantsWithStatus: updated }));
                        }}
                        className={`w-full lg:w-auto px-4 py-2.5 min-h-11 rounded-lg font-medium text-sm transition-all ${participant.attendance === 'absent'
                          ? 'bg-red-500 text-white shadow-md'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                      >
                        ✗ {t('absent')}
                      </button>
                      {isGuest && (
                        <button
                          type="button"
                          onClick={() => {
                            const guestId = participant.userId;
                            const updatedStatus = formData.participantsWithStatus.filter((_, i) => i !== index);
                            const updatedParticipants = formData.participants.filter(p => p !== guestName);
                            setFormData(prev => ({ 
                              ...prev, 
                              participantsWithStatus: updatedStatus,
                              participants: updatedParticipants,
                              topics: prev.topics.map((topic) => ({
                                ...topic,
                                infoItems: topic.infoItems?.map((item) => ({
                                  ...item,
                                  responsibles: item.responsibles?.filter((id) => id !== guestId) || []
                                })) || []
                              }))
                            }));
                            setMeetingSeriesMembers(prev => prev.filter((member) => member.userId !== guestId));
                          }}
                          className="w-full lg:w-auto px-3 py-2.5 min-h-11 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center"
                          title={t('removeGuest')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              {!showGuestInput ? (
                <button
                  type="button"
                  onClick={() => setShowGuestInput(true)}
                  className="text-sm text-[var(--brand-primary)] hover:text-[var(--brand-primary-strong)] font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('addGuest')}
                </button>
              ) : (
                <div className="flex flex-col min-[420px]:flex-row items-stretch gap-2">
                  <input
                    type="text"
                    value={newGuestName}
                    onChange={(e) => setNewGuestName(e.target.value)}
                    placeholder={t('guestNamePlaceholder')}
                    className="w-full min-[420px]:flex-1 px-3 py-2.5 min-h-11 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addGuest();
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={addGuest}
                    disabled={!newGuestName.trim()}
                    className="w-full min-[420px]:w-auto px-3 py-2.5 min-h-11 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brand-primary-strong)] disabled:opacity-50"
                  >
                    {t('add')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGuestInput(false);
                      setNewGuestName('');
                    }}
                    className="w-full min-[420px]:w-auto px-3 py-2.5 min-h-11 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                  >
                    {tCommon('cancel')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pending Tasks from Previous Minutes */}
          {!minute.isFinalized && (!showPendingTasks || (showPendingTasks && pendingTasks.length > 0)) && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-gray-900">{t('pendingTasksTitle')}</h2>
                    <p className="text-sm text-gray-600">{t('pendingTasksSubtitle')}</p>
                  </div>
                </div>
                {!showPendingTasks && (
                  <button
                    type="button"
                    onClick={fetchPendingTasks}
                    disabled={loadingPendingTasks}
                    className="w-full sm:w-auto px-4 py-2.5 min-h-11 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    {loadingPendingTasks ? tCommon('loading') : t('loadPendingTasks')}
                  </button>
                )}
              </div>

              {showPendingTasks && pendingTasks.length > 0 && (
                <div className="space-y-3">
                  {(
                    <>
                      <p className="text-sm text-gray-700 mb-3">
                        <strong>{pendingTasks.length}</strong> {t('pendingTasksFound')}
                      </p>
                      {pendingTasks.map((task) => {
                        const taskId = task._id || task.id;
                        return (
                          <div key={taskId} className="bg-white rounded-xl border-2 border-amber-300 p-4 hover:shadow-md transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <h3 className="font-semibold text-gray-900 break-words">{task.subject}</h3>
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                    }`}>
                                    {task.status === 'in-progress' ? `⏳ ${t('inProgress')}` : `○ ${t('open')}`}
                                  </span>
                                  {task.priority && (
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${task.priority === 'high' ? 'bg-red-100 text-red-800' :
                                      task.priority === 'medium' ? 'bg-orange-100 text-orange-800' :
                                        'bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)]'
                                      }`}>
                                      {task.priority === 'high' ? `🔴 ${t('high')}` :
                                        task.priority === 'medium' ? `🟡 ${t('medium')}` :
                                          `🔵 ${t('low')}`}
                                    </span>
                                  )}
                                </div>

                                {task.details && (
                                  <p className="text-sm text-gray-700 mb-2">{task.details}</p>
                                )}

                                <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-2">
                                  <span>📋 {t('topicLabel')} {task.topicSubject}</span>
                                  {task.dueDate && (
                                    <span>• ⏰ {t('dueLabel')} {new Date(task.dueDate).toLocaleDateString(locale)}</span>
                                  )}
                                  {task.responsibles && task.responsibles.length > 0 && (
                                    <span>• 👤 {task.responsibles.length} {t('responsibles')}</span>
                                  )}
                                </div>

                                {task.notes && (
                                  <div className="mt-2 p-2 bg-[var(--brand-primary-soft)] border border-[var(--brand-primary-border)] rounded-lg">
                                    <p className="text-xs font-medium text-[var(--brand-primary-strong)] mb-1">💬 {t('lastComment')}</p>
                                    <p className="text-sm text-[var(--brand-primary-strong)]">{task.notes}</p>
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={(e) => importPendingTask(e, task)}
                                className="w-full sm:w-auto px-4 py-2.5 min-h-11 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors inline-flex items-center justify-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                {t('import')}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{t('topics')}</h2>
              <div className="grid grid-cols-2 w-full sm:w-auto rounded-lg border border-gray-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setEditorMode('visual')}
                  className={`px-4 py-2.5 min-h-11 text-sm font-semibold transition-colors ${
                    editorMode === 'visual' ? 'bg-[var(--brand-primary)] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t('visualMode')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('markdown')}
                  className={`px-4 py-2.5 min-h-11 text-sm font-semibold transition-colors ${
                    editorMode === 'markdown' ? 'bg-[var(--brand-primary)] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t('markdownMode')}
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-3">{t('editorModeHint')}</p>
          </div>

          {editorMode === 'visual' ? (
            <>
              {/* Topics */}
              <div className="space-y-6">
                <div className="sticky top-32 sm:top-36 z-30 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4 border border-gray-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900">{t('topics')}</h2>
                  <button
                    type="button"
                    onClick={addTopic}
                    className="w-full sm:w-auto px-4 py-2.5 min-h-11 brand-button-primary rounded-lg font-semibold hover:shadow-lg transition-all border-2 border-white inline-flex items-center justify-center gap-2 text-center"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="leading-tight">{t('addTopic')}</span>
                  </button>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEndTopic}
                >
                  <SortableContext
                    items={formData.topics.map((_, i) => `topic-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {formData.topics.map((topic, topicIndex) => (
                      <SortableTopic
                        key={`topic-${topicIndex}`}
                        id={`topic-${topicIndex}`}
                        topicIndex={topicIndex}
                        topic={topic}
                        minuteId={minuteId}
                        meetingSeriesMembers={meetingSeriesMembers}
                        clubFunctions={clubFunctions}
                        allUsers={allUsers}
                        canUploadDocuments={canUploadDocuments}
                        attachmentsRefreshToken={attachmentsRefreshToken}
                        triggerAttachmentRefresh={triggerAttachmentRefresh}
                        updateTopic={updateTopic}
                        deleteTopic={deleteTopic}
                        addInfoItem={addInfoItem}
                        updateInfoItem={updateInfoItem}
                        deleteInfoItem={deleteInfoItem}
                        handleDragEndInfoItem={handleDragEndInfoItem}
                        agendaItemLabelMode={agendaItemLabelMode}
                        saveMinuteInPlace={saveMinuteInPlace}
                        isSavingMinute={saving}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>

              {/* Add Topic Button */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={addTopic}
                  className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-5 sm:px-8 py-3.5 min-h-11 brand-button-primary rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl sm:hover:scale-105 text-center"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="leading-tight">{formData.topics.length === 0 ? t('createFirstTopic') : t('addAnotherTopic')}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100 space-y-4">
              <div className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 border border-gray-200 rounded-lg p-3">
                {t('markdownLegend')}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => insertMarkdownSnippet('## Neues Traktandum')}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('markdownInsertTopic')}
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSnippet(buildInfoTemplate())}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white border border-[var(--brand-primary-border)] text-[var(--brand-primary-strong)] rounded-lg hover:bg-[var(--brand-primary-soft)] transition-colors"
                >
                  {t('markdownInsertInfo')}
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSnippet(buildTaskTemplate('open'))}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  {t('markdownInsertTaskOpen')}
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSnippet(buildTaskTemplate('in-progress'))}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white border border-[var(--brand-primary-border)] text-[var(--brand-primary-strong)] rounded-lg hover:bg-[var(--brand-primary-soft)] transition-colors"
                >
                  {t('markdownInsertTaskInProgress')}
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSnippet(buildTaskTemplate('done'))}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
                >
                  {t('markdownInsertTaskDone')}
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSnippet('!high')}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                >
                  {t('markdownInsertPriority')}
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSnippet('due:2026-03-20')}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white border border-[var(--brand-primary-border)] text-[var(--brand-primary-strong)] rounded-lg hover:bg-[var(--brand-primary-soft)] transition-colors"
                >
                  {t('markdownInsertDueDate')}
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSnippet('@userId')}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white border border-teal-300 text-teal-700 rounded-lg hover:bg-teal-50 transition-colors"
                >
                  {t('markdownInsertResponsible')}
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownSnippet('  beschluss: Kommentar')}
                  className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('markdownInsertNote')}
                </button>
              </div>
              <div className="relative">
                <textarea
                  ref={markdownTextareaRef}
                  value={markdownText}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    const caretPos = e.target.selectionStart ?? nextValue.length;
                    setMarkdownText(nextValue);
                    setMarkdownImportInfo(null);
                    updateMentionSuggestions(nextValue, caretPos);
                  }}
                  onKeyUp={(e) => {
                    const target = e.currentTarget;
                    const caretPos = target.selectionStart ?? markdownText.length;
                    updateMentionSuggestions(target.value, caretPos);
                  }}
                  onClick={(e) => {
                    const target = e.currentTarget;
                    const caretPos = target.selectionStart ?? markdownText.length;
                    updateMentionSuggestions(target.value, caretPos);
                  }}
                  onScroll={(e) => {
                    if (mentionSuggestions.length === 0) return;
                    const target = e.currentTarget;
                    const caretPos = target.selectionStart ?? markdownText.length;
                    updateMentionSuggestions(target.value, caretPos);
                  }}
                  onKeyDown={(e) => {
                    if (mentionSuggestions.length === 0) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedMentionIndex((prev) =>
                        prev + 1 >= mentionSuggestions.length ? 0 : prev + 1
                      );
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedMentionIndex((prev) =>
                        prev - 1 < 0 ? mentionSuggestions.length - 1 : prev - 1
                      );
                      return;
                    }
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault();
                      applyMentionSuggestion(mentionSuggestions[selectedMentionIndex]);
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      closeMentionSuggestions();
                    }
                  }}
                  placeholder={getMinutesMarkdownTemplate()}
                  className="w-full min-h-[320px] px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent font-mono text-sm"
                />
                {mentionSuggestions.length > 0 && mentionMenuPosition && (
                  <div
                    className="absolute mt-1 w-64 max-h-52 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg z-20"
                    style={{ top: mentionMenuPosition.top, left: mentionMenuPosition.left }}
                  >
                    {mentionSuggestions.map((candidate, index) => (
                      <button
                        key={candidate.value}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyMentionSuggestion(candidate)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          index === selectedMentionIndex
                            ? 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary-strong)]'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {candidate.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={importMarkdownToTopics}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-11 bg-[var(--brand-primary)] text-white rounded-lg font-semibold hover:bg-[var(--brand-primary-strong)] transition-colors"
                >
                  {t('importMarkdown')}
                </button>
                <button
                  type="button"
                  onClick={resetMarkdownTemplate}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-11 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  {t('loadMarkdownTemplate')}
                </button>
              </div>
              {markdownImportInfo && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  {markdownImportInfo}
                </p>
              )}
              {markdownWarnings.length > 0 && (
                <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="font-semibold mb-1">{t('markdownWarningsTitle')}</p>
                  <p>{markdownWarnings.slice(0, 3).join(' ')}</p>
                </div>
              )}
            </div>
          )}

          {/* Reopening History */}
          {minute?.reopeningHistory && minute.reopeningHistory.length > 0 && (
            <div className="bg-amber-50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-amber-200">
              <h3 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('reopeningHistory')}
              </h3>
              <div className="space-y-3">
                {minute.reopeningHistory.map((entry, index) => (
                  <div key={index} className="bg-white/60 p-3 rounded-lg border border-amber-100 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-amber-900">
                        {allUsers.find(u => u._id === entry.reopenedBy) 
                          ? `${allUsers.find(u => u._id === entry.reopenedBy)?.firstName} ${allUsers.find(u => u._id === entry.reopenedBy)?.lastName}`
                          : entry.reopenedBy}
                      </span>
                      <span className="text-amber-700 text-xs">
                        {new Date(entry.reopenedAt).toLocaleString(locale, {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-amber-800">{entry.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Global Note */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('globalNotes')}</label>
            <textarea
              value={formData.globalNote}
              onChange={(e) => setFormData(prev => ({ ...prev, globalNote: e.target.value }))}
              placeholder={t('globalNotesPlaceholder')}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
              rows={4}
            />
          </div>

          {/* Protocol End Time (always at bottom) */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('endTime')}</label>
            <input
              type="time"
              value={formData.endTime || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
              placeholder="HH:MM"
              className="w-full sm:max-w-xs px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
            />
          </div>
        </form>

        {/* Confirm Dialog Modal */}
        {confirmDialog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 rounded-full p-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{t('confirmTitle')}</h3>
              </div>
              <p className="text-gray-600 text-sm mb-6">{confirmDialog.message}</p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-5 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={confirmDialog.onConfirm}
                  className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
