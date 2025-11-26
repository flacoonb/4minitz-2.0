"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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

interface SortableTopicProps {
  id: string;
  topicIndex: number;
  topic: Topic;
  meetingSeriesMembers: Member[];
  allUsers: User[];
  updateTopic: (index: number, field: keyof Topic, value: any) => void;
  deleteTopic: (index: number) => void;
  addInfoItem: (index: number) => void;
  updateInfoItem: (topicIndex: number, itemIndex: number, field: keyof InfoItem, value: any) => void;
  deleteInfoItem: (topicIndex: number, itemIndex: number) => void;
  handleDragEndInfoItem: (topicIndex: number) => (event: DragEndEvent) => void;
}

function SortableTopic({
  id,
  topicIndex,
  topic,
  meetingSeriesMembers,
  allUsers,
  updateTopic,
  deleteTopic,
  addInfoItem,
  updateInfoItem,
  deleteInfoItem,
  handleDragEndInfoItem,
}: SortableTopicProps) {
  const t = useTranslations('minutes');
  const tCommon = useTranslations('common');
  const _locale = useLocale();
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
    return allUsers.find(u => u._id === userId);
  };

  // Helper function to get user initials
  const getUserInitials = (userId: string): string => {
    const user = getUserById(userId);
    if (!user) return '?';
    return `${user.firstName.charAt(0).toUpperCase()}${user.lastName.charAt(0).toUpperCase()}`;
  };

  // Helper function to format multiple users as initials
  const _formatUsersAsInitials = (userIds: string[]): string => {
    return userIds.map(id => getUserInitials(id)).join(', ');
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-100">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3 flex-1 mr-4">
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

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('topic')} {topicIndex + 1}
            </label>
            <input
              type="text"
              value={topic.subject}
              onChange={(e) => updateTopic(topicIndex, 'subject', e.target.value)}
              placeholder={t('topicTitlePlaceholder')}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
              required
            />
          </div>
        </div>

        {/* Delete Button */}
        <button
          type="button"
          onClick={() => deleteTopic(topicIndex)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        infoItems={topic.infoItems || []}
        meetingSeriesMembers={meetingSeriesMembers}
        allUsers={allUsers}
        addInfoItem={addInfoItem}
        updateInfoItem={updateInfoItem}
        deleteInfoItem={deleteInfoItem}
        handleDragEndInfoItem={handleDragEndInfoItem}
      />
    </div>
  );
}

interface SortableInfoItemsProps {
  topicIndex: number;
  infoItems: InfoItem[];
  meetingSeriesMembers: Member[];
  allUsers: User[];
  addInfoItem: (index: number) => void;
  updateInfoItem: (topicIndex: number, itemIndex: number, field: keyof InfoItem, value: any) => void;
  deleteInfoItem: (topicIndex: number, itemIndex: number) => void;
  handleDragEndInfoItem: (topicIndex: number) => (event: DragEndEvent) => void;
}

function SortableInfoItems({
  topicIndex,
  infoItems,
  meetingSeriesMembers,
  allUsers,
  addInfoItem,
  updateInfoItem,
  deleteInfoItem,
  handleDragEndInfoItem,
}: SortableInfoItemsProps) {
  const t = useTranslations('minutes');
  const itemIds = infoItems.map((_, i) => `item-${topicIndex}-${i}`);

  const sensors = useSensors(
    useSensor(PointerSensor)
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">{t('infoItems')}</label>
        <button
          type="button"
          onClick={() => addInfoItem(topicIndex)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          + {t('add')}
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEndInfoItem(topicIndex)}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[50px] p-2 border-2 border-dashed border-gray-200 rounded-lg">
            {infoItems.map((item, itemIndex) => (
              <SortableInfoItem
                key={`item-${topicIndex}-${itemIndex}`}
                id={`item-${topicIndex}-${itemIndex}`}
                topicIndex={topicIndex}
                itemIndex={itemIndex}
                item={item}
                meetingSeriesMembers={meetingSeriesMembers}
                allUsers={allUsers}
                updateInfoItem={updateInfoItem}
                deleteInfoItem={deleteInfoItem}
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
    </div>
  );
}

interface SortableInfoItemProps {
  id: string;
  topicIndex: number;
  itemIndex: number;
  item: InfoItem;
  meetingSeriesMembers: Member[];
  allUsers: User[];
  updateInfoItem: (topicIndex: number, itemIndex: number, field: keyof InfoItem, value: any) => void;
  deleteInfoItem: (topicIndex: number, itemIndex: number) => void;
}

function SortableInfoItem({
  id,
  topicIndex,
  itemIndex,
  item,
  meetingSeriesMembers,
  allUsers,
  updateInfoItem,
  deleteInfoItem,
}: SortableInfoItemProps) {
  const t = useTranslations('minutes');
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
    return allUsers.find(u => u._id === userId);
  };

  // Helper function to get user initials
  const getUserInitials = (userId: string): string => {
    const user = getUserById(userId);
    if (!user) return '?';
    return `${user.firstName.charAt(0).toUpperCase()}${user.lastName.charAt(0).toUpperCase()}`;
  };

  // Helper function to format multiple users as initials
  const formatUsersAsInitials = (userIds: string[]): string => {
    return userIds.map(id => getUserInitials(id)).join(', ');
  };

  // Color schemes based on type and priority
  const getItemColors = () => {
    if (item.itemType === 'actionItem') {
      const priorityColors = {
        high: 'from-red-50 to-pink-50 border-red-300',
        medium: 'from-orange-50 to-amber-50 border-orange-300',
        low: 'from-blue-50 to-cyan-50 border-blue-300',
      };
      return priorityColors[item.priority || 'medium'];
    }
    return 'from-gray-50 to-slate-50 border-gray-300';
  };

  const getStatusBadge = () => {
    const badges = {
      open: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '○', label: t('open') },
      'in-progress': { bg: 'bg-blue-100', text: 'text-blue-800', icon: '◐', label: t('inProgress') },
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

  // Compact view when not editing
  if (!isEditing) {
    const statusBadge = getStatusBadge();
    const priorityBadge = getPriorityBadge();

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`bg-white border-l-4 ${item.itemType === 'actionItem'
          ? item.priority === 'high' ? 'border-red-500'
            : item.priority === 'low' ? 'border-blue-500'
              : 'border-orange-500'
          : 'border-blue-400'
          } p-4 rounded-lg shadow-sm hover:shadow-md transition-all`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1">
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

            <div className="flex-1">
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
                  </div>
                ) : (
                  <div className="mb-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">
                      ℹ️ {t('info')}
                    </span>
                  </div>
                )}
                <h4 className="font-bold text-gray-900 text-base">{item.subject}</h4>
              </div>

              {item.details && (
                <p className="text-sm text-gray-700 mb-3 leading-relaxed">{item.details}</p>
              )}

              {/* Info Items - Show responsible persons if available */}
              {item.itemType === 'infoItem' && item.responsibles && item.responsibles.length > 0 && (
                <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="font-semibold text-blue-900">{t('participantsLabel')}</span>
                    <span className="text-blue-800 font-medium">
                      {formatUsersAsInitials(item.responsibles)}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Items - Structured info boxes */}
              {item.itemType === 'actionItem' && (
                <div className="mt-3 space-y-2">
                  {/* Due Date & Responsible in a grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {item.dueDate && (
                      <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-orange-900">{t('dueOn')}</p>
                            <p className="text-sm font-bold text-orange-800">
                              {new Date(item.dueDate).toLocaleDateString(locale, {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {item.responsibles && item.responsibles.length > 0 && (
                      <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-indigo-900">
                              {t('responsible')}{item.responsibles.length > 1 ? 's' : ''}
                            </p>
                            <p className="text-sm font-bold text-indigo-800">
                              {formatUsersAsInitials(item.responsibles)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {item.notes && (
                <div className="mt-3 p-3 bg-gray-50 border-l-4 border-gray-400 rounded-r-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-700 mb-1">{t('note')}</p>
                      <p className="text-sm text-gray-800">{item.notes}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title={tCommon('edit')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => deleteInfoItem(topicIndex, itemIndex)}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gradient-to-br ${getItemColors()} p-4 rounded-xl border-2 shadow-sm hover:shadow-md transition-all`}
    >
      <div className="space-y-3">
        {/* Header: Drag Handle, Type Badge, Save/Delete Buttons */}
        <div className="flex items-center justify-between gap-2">
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

          <div className="flex gap-1">

            <button
              type="button"
              onClick={() => deleteInfoItem(topicIndex, itemIndex)}
              className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateInfoItem(topicIndex, itemIndex, 'itemType', 'infoItem')}
              className={`p-3 rounded-lg border-2 transition-all ${item.itemType === 'infoItem'
                ? 'border-blue-500 bg-blue-50 shadow-md'
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

        {/* Step 2: Title */}
        <div className="bg-white/70 backdrop-blur-sm p-3 rounded-lg border border-white/50">
          <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            {t(item.itemType === 'actionItem' ? 'step2TitleAction' : 'step2TitleInfo')}
          </label>
          <input
            type="text"
            value={item.subject}
            onChange={(e) => updateInfoItem(topicIndex, itemIndex, 'subject', e.target.value)}
            placeholder={t(item.itemType === 'actionItem' ? 'step2PlaceholderAction' : 'step2PlaceholderInfo')}
            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold bg-white"
            required
          />
        </div>

        {/* Step 3: Content */}
        <div className="bg-white/70 backdrop-blur-sm p-3 rounded-lg border border-white/50">
          <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            {t(item.itemType === 'actionItem' ? 'step3TitleAction' : 'step3TitleInfo')}
          </label>
          <textarea
            value={item.details || ''}
            onChange={(e) => updateInfoItem(topicIndex, itemIndex, 'details', e.target.value)}
            placeholder={t(item.itemType === 'actionItem' ? 'step3PlaceholderAction' : 'step3PlaceholderInfo')}
            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white resize-none"
            rows={3}
          />
        </div>

        {/* Step 4: Task-specific fields (only for action items) */}
        {item.itemType === 'actionItem' && (
          <div className="space-y-3">
            {/* Priority, Due Date, Status */}
            <div className="bg-white/70 backdrop-blur-sm p-3 rounded-lg border border-white/50">
              <label className="block text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                {t('step4Title')}
              </label>

              <div className="space-y-3">
                {/* Priority */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
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
                          className={`p-2.5 rounded-lg border-2 transition-all ${(item.priority || 'medium') === priority
                            ? `${colors.bg} ${colors.border} shadow-md`
                            : 'bg-white border-gray-300 hover:border-gray-400'
                            }`}
                        >
                          <div className={`text-center text-sm font-semibold ${(item.priority || 'medium') === priority ? colors.text : 'text-gray-600'}`}>
                            <div className="text-lg mb-0.5">{colors.icon}</div>
                            {colors.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    📅 {t('dueDate')}
                  </label>
                  <input
                    type="date"
                    value={item.dueDate?.split('T')[0] || ''}
                    onChange={(e) => updateInfoItem(topicIndex, itemIndex, 'dueDate', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    📊 {t('status')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['open', 'in-progress', 'completed', 'cancelled'].map((status) => {
                      const statusConfig = {
                        open: { bg: 'bg-yellow-100 hover:bg-yellow-200', border: 'border-yellow-400', text: 'text-yellow-800', label: t('open'), icon: '○' },
                        'in-progress': { bg: 'bg-blue-100 hover:bg-blue-200', border: 'border-blue-400', text: 'text-blue-800', label: t('inProgress'), icon: '◐' },
                        completed: { bg: 'bg-green-100 hover:bg-green-200', border: 'border-green-400', text: 'text-green-800', label: t('completed'), icon: '✓' },
                        cancelled: { bg: 'bg-gray-100 hover:bg-gray-200', border: 'border-gray-400', text: 'text-gray-800', label: t('cancelled'), icon: '✗' },
                      }[status] as any;

                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateInfoItem(topicIndex, itemIndex, 'status', status)}
                          className={`p-2 rounded-lg border-2 transition-all ${(item.status || 'open') === status
                            ? `${statusConfig.bg} ${statusConfig.border} shadow-md`
                            : 'bg-white border-gray-300 hover:border-gray-400'
                            }`}
                        >
                          <div className={`text-center text-xs font-semibold ${(item.status || 'open') === status ? statusConfig.text : 'text-gray-600'}`}>
                            <span className="text-base mr-1">{statusConfig.icon}</span>
                            {statusConfig.label}
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
        <div className="bg-white/70 backdrop-blur-sm p-4 rounded-lg border border-white/50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-800">
                {t(item.itemType === 'actionItem' ? 'responsiblesTitleAction' : 'responsiblesTitleInfo')}
              </label>
              <p className="text-xs text-gray-500">
                {t(item.itemType === 'actionItem' ? 'responsiblesHelpAction' : 'responsiblesHelpInfo')}
              </p>
            </div>
            {item.responsibles && item.responsibles.length > 0 && (
              <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                {t('selectedCount', { count: item.responsibles.length })}
              </span>
            )}
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto border-2 border-indigo-200 rounded-lg p-2.5 bg-gradient-to-br from-indigo-50/50 to-purple-50/50">
            {/* Alle Option */}
            <label className="flex items-center gap-3 p-2.5 bg-white hover:bg-indigo-50 rounded-lg cursor-pointer transition-all border border-transparent hover:border-indigo-300 group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={
                    item.responsibles?.length === meetingSeriesMembers.length &&
                    meetingSeriesMembers.length > 0
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      const allUserIds = meetingSeriesMembers.map(m => m.userId);
                      updateInfoItem(topicIndex, itemIndex, 'responsibles', allUserIds);
                    } else {
                      updateInfoItem(topicIndex, itemIndex, 'responsibles', []);
                    }
                  }}
                  className="w-5 h-5 text-indigo-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <span className="text-sm font-bold text-indigo-700 group-hover:text-indigo-800">
                  ✓ {t('selectAll')}
                </span>
                <p className="text-xs text-gray-500">{t('addAllMembers')}</p>
              </div>
            </label>

            <div className="border-t-2 border-indigo-200 my-2"></div>

            {meetingSeriesMembers.map(member => {
              const user = getUserById(member.userId);
              // if (!user) return null;

              const isSelected = item.responsibles?.includes(member.userId) || false;

              return (
                <label
                  key={member.userId}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border ${isSelected
                    ? 'bg-indigo-100 border-indigo-300 shadow-sm'
                    : 'bg-white hover:bg-gray-50 border-transparent hover:border-gray-300'
                    }`}
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        const currentResponsibles = item.responsibles || [];
                        let newResponsibles: string[];

                        if (e.target.checked) {
                          newResponsibles = [...currentResponsibles, member.userId];
                        } else {
                          newResponsibles = currentResponsibles.filter(id => id !== member.userId);
                        }

                        updateInfoItem(topicIndex, itemIndex, 'responsibles', newResponsibles);
                      }}
                      className="w-5 h-5 text-indigo-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${isSelected ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-gray-400 to-gray-500'
                      }`}>
                      {user ? (user.firstName.charAt(0).toUpperCase() + user.lastName.charAt(0).toUpperCase()) : '?'}
                    </div>
                    <div className="flex-1">
                      <span className={`text-sm font-semibold ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                        {user ? `${user.firstName} ${user.lastName}` : `${t('userId')}: ${member.userId}`}
                      </span>
                      {user?.email && (
                        <p className="text-xs text-gray-500">{user.email}</p>
                      )}
                    </div>
                    {isSelected && (
                      <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </label>
              );
            })}

            {meetingSeriesMembers.length === 0 && (
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
            📝 {t('additionalNotes')}
          </label>
          <textarea
            value={item.notes || ''}
            onChange={(e) => updateInfoItem(topicIndex, itemIndex, 'notes', e.target.value)}
            placeholder={t('additionalNotesPlaceholder')}
            className="w-full px-3 py-2.5 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white resize-none"
            rows={2}
          />
        </div>

        {/* Save Button at the bottom */}
        <div className="flex justify-end pt-4 border-t border-white/30">
          <button
            type="button"
            onClick={() => {
              if (item.subject) {
                setIsEditing(false);
              }
            }}
            disabled={!item.subject}
            className="px-6 py-2.5 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2 shadow-md"
            title={t('saveButton')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t('saveButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface InfoItem {
  subject: string;
  details?: string;
  itemType: 'actionItem' | 'infoItem';
  isComplete?: boolean;
  isOpen?: boolean;
  // Task management fields
  status?: 'open' | 'in-progress' | 'completed' | 'cancelled';
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
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

interface Participant {
  userId: string;
  attendance: 'present' | 'excused' | 'absent';
}

interface Minute {
  _id: string;
  meetingSeries_id: any;
  date: string;
  time?: string;
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
  const locale = useLocale();
  const router = useRouter();
  const [minute, setMinute] = useState<Minute | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minuteId, setMinuteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    date: '',
    time: '',
    location: '',
    participants: [],
    participantsWithStatus: [],
    topics: [],
    globalNote: ''
  });
  const [_newParticipant, _setNewParticipant] = useState('');
  const [_availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [meetingSeriesMembers, setMeetingSeriesMembers] = useState<Member[]>([]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [showPendingTasks, setShowPendingTasks] = useState(false);
  const [loadingPendingTasks, setLoadingPendingTasks] = useState(false);
  const [_importingPendingTasks, _setImportingPendingTasks] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);

  // Use a ref to track imported task IDs to prevent duplicates
  const importedTaskIdsRef = useRef<Set<string>>(new Set());

  // Use a ref to track if an import is currently in progress
  const importInProgressRef = useRef<boolean>(false);

  // Use a ref to track the currently processing task ID (for ultra-fast duplicate detection)
  const currentlyProcessingTaskIdRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
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

          // 2. Fetch Minute
          const response = await fetch(`/api/minutes/${minuteId}`, { credentials: 'include' });
          if (!response.ok) throw new Error(t('notFound'));
          const result = await response.json();
          const minuteData = result.data;

          // Convert duedate to dueDate for all infoItems
          if (minuteData.topics) {
            minuteData.topics = minuteData.topics.map((topic: any) => ({
              ...topic,
              infoItems: topic.infoItems?.map((item: any) => {
                const updatedItem = { ...item };
                if (item.duedate !== undefined) {
                  updatedItem.dueDate = item.duedate;
                  delete updatedItem.duedate;
                }
                return updatedItem;
              })
            }));
          }

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

              // B. Filter out deleted users from minute (users not in allUsers), but keep guests
              if (minuteData.participantsWithStatus) {
                minuteData.participantsWithStatus = minuteData.participantsWithStatus.filter((p: any) =>
                  p.userId.startsWith('guest:') || users.some(u => u._id === p.userId)
                );
              }

              // C. Update members list for dropdown (ensure all current participants are in the list)
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

              setFormData({
                date: minuteData.date?.split('T')[0] || '',
                time: minuteData.time || '',
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
          setFormData({
            date: minuteData.date?.split('T')[0] || '',
            time: minuteData.time || '',
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

  const fetchPendingTasks = useCallback(async () => {
    if (!minute?.meetingSeries_id || !minuteId) return;

    setLoadingPendingTasks(true);
    try {
      const seriesId = minute.meetingSeries_id._id || minute.meetingSeries_id;
      console.log('=== Fetching pending tasks ===');
      console.log('Series ID:', seriesId);
      console.log('Current Minute ID:', minuteId);

      // Include minuteId to filter out already imported tasks
      const url = `/api/meeting-series/${seriesId}/pending-tasks?minuteId=${minuteId}`;
      console.log('Fetching from URL:', url);

      const response = await fetch(url, {
        credentials: 'include', // Cookie-based authentication
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Pending tasks response:', result);
        console.log('Tasks count:', result.data?.length || 0);
        if (result.debug) {
          console.log('Debug info from API:', result.debug);
        }
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

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [formData]);

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

    if (importedIds.size > 0) {
      importedTaskIdsRef.current = importedIds;
      console.log('Initialized importedTaskIdsRef with existing imports:', Array.from(importedIds));
    }
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

  const importPendingTask = (e: React.MouseEvent<HTMLButtonElement>, task: any) => {
    const taskId = task._id || task.id;

    console.log('=== importPendingTask called ===');
    console.log('Task ID:', taskId);

    // ULTRA-FAST GUARD: Check if this exact task is CURRENTLY being processed in this very moment
    if (currentlyProcessingTaskIdRef.current === taskId) {
      console.log('🚫 ULTRA-FAST BLOCK: This task is being processed RIGHT NOW!');
      console.log('Currently processing:', currentlyProcessingTaskIdRef.current);
      return; // Silent block - no alert needed
    }

    // Set as currently processing IMMEDIATELY
    currentlyProcessingTaskIdRef.current = taskId;
    console.log('🔒 Locked task for processing:', taskId);

    console.log('Task ID type:', typeof taskId);
    console.log('Task ID length:', taskId?.length);
    console.log('Task._id:', task._id, 'type:', typeof task._id);
    console.log('Task.id:', task.id, 'type:', typeof task.id);

    // FIRST GUARD: Check if this specific task is already being imported or was imported
    const hasTask = importedTaskIdsRef.current.has(taskId);
    console.log('Has task in Set?', hasTask);
    console.log('Set contents:', Array.from(importedTaskIdsRef.current));
    console.log('Set size:', importedTaskIdsRef.current.size);

    if (hasTask) {
      console.log('⚠️ BLOCKED: Task already imported:', taskId);
      currentlyProcessingTaskIdRef.current = null; // Release ultra-fast lock
      return;
    }

    // Add to imported set IMMEDIATELY - this is our PRIMARY guard
    importedTaskIdsRef.current.add(taskId);
    console.log('✓ Added task to importedTaskIdsRef:', taskId);
    console.log('Set after add:', Array.from(importedTaskIdsRef.current));
    console.log('Set size after add:', importedTaskIdsRef.current.size);

    // SECOND GUARD: Check if ANY import is in progress
    if (importInProgressRef.current) {
      console.log('⚠️ BLOCKED: Another import is already in progress');
      // Don't remove from imported set - we want to keep it marked as imported
      return;
    }

    // Set import in progress flag
    importInProgressRef.current = true;
    console.log('✓ Import lock acquired');

    console.log('Task to import:', task);

    // Also check formData state as backup
    const existingIds: string[] = [];
    formData.topics.forEach((topic, topicIndex) => {
      topic.infoItems?.forEach((item, itemIndex) => {
        if (item.originalTaskId) {
          existingIds.push(item.originalTaskId);
          console.log(`Found existing import in state: Topic ${topicIndex}, Item ${itemIndex}, ID: ${item.originalTaskId}`);
        }
      });
    });
    console.log('Already imported task IDs (from state):', existingIds);

    const isAlreadyImportedInState = formData.topics.some(topic =>
      topic.infoItems?.some(item => item.originalTaskId === taskId)
    );

    console.log('Is already imported in state?', isAlreadyImportedInState);

    if (isAlreadyImportedInState) {
      console.log('=== importPendingTask aborted (duplicate in state) ===');
      // Remove from ref since state already has it
      importedTaskIdsRef.current.delete(taskId);
      importInProgressRef.current = false; // Release lock
      currentlyProcessingTaskIdRef.current = null; // Release ultra-fast lock
      console.log('✓ Import lock released (duplicate in state)');
      return;
    }

    // Remove task from pending list IMMEDIATELY to prevent double clicks
    console.log('Removing task from pending list (immediate)');
    setPendingTasks(prev => {
      const filtered = prev.filter(t => (t._id || t.id) !== taskId);
      console.log('Pending tasks before removal:', prev.length);
      console.log('Pending tasks after removal:', filtered.length);
      return filtered;
    });

    // Add task to the first topic or create a "Pendenzen" topic
    const newInfoItem: InfoItem = {
      subject: task.subject,
      details: task.details,
      itemType: 'actionItem',
      priority: task.priority || 'medium',
      dueDate: task.duedate ? new Date(task.duedate).toISOString().split('T')[0] : undefined,
      responsibles: task.responsibles || [],
      status: task.status || 'open',
      notes: task.notes,
      isOpen: true,
      parentMinutesId: task.parentMinutesId,
      parentItemId: task.parentItemId || taskId, // Link to parent (root) or previous task
      isImported: true, // Mark as imported
      originalTaskId: taskId, // Store original task ID
      externalTaskId: task.externalTaskId, // Link to Central Task Registry
    };

    console.log('Creating new InfoItem with originalTaskId:', newInfoItem.originalTaskId);

    setFormData(prev => {
      const topics = [...prev.topics];

      // CRITICAL: Check if this task is already in the topics (React StrictMode protection)
      const alreadyExists = topics.some(topic =>
        topic.infoItems?.some(item => item.originalTaskId === taskId)
      );

      if (alreadyExists) {
        console.log('⚠️ Task already exists in formData - skipping add (StrictMode protection)');
        return prev; // Return unchanged state
      }

      // Find or create "Pendenzen" topic
      const pendenzenIndex = topics.findIndex(t => t.subject === 'Pendenzen aus letztem Protokoll');

      if (pendenzenIndex === -1) {
        console.log('Creating new "Pendenzen aus letztem Protokoll" topic');
        // Create new topic at the beginning
        topics.unshift({
          subject: 'Pendenzen aus letztem Protokoll',
          responsibles: [],
          infoItems: [newInfoItem],
        });
      } else {
        console.log('Adding to existing "Pendenzen aus letztem Protokoll" topic at index:', pendenzenIndex);
        // Add to existing topic
        if (!topics[pendenzenIndex].infoItems) {
          topics[pendenzenIndex].infoItems = [];
        }
        topics[pendenzenIndex].infoItems!.push(newInfoItem);
        console.log('Total items in topic now:', topics[pendenzenIndex].infoItems!.length);
      }

      return { ...prev, topics };
    });

    // Release import lock after a short delay to ensure React has processed the state update
    setTimeout(() => {
      importInProgressRef.current = false;
      currentlyProcessingTaskIdRef.current = null; // Release ultra-fast lock
      console.log('✓ Import lock released (successful import)');
      console.log('✓ Ultra-fast lock released');
    }, 100);

    console.log('=== importPendingTask completed successfully ===');
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
    
    setNewGuestName('');
    setShowGuestInput(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!minuteId) return;

    // Prepare data for saving - convert empty strings to undefined
    const dataToSave = {
      ...formData,
      time: formData.time?.trim() || undefined,
      location: formData.location?.trim() || undefined,
    };

    setSaving(true);
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
        setHasUnsavedChanges(false); // Reset unsaved changes flag
        router.push(`/minutes/${minuteId}`);
      } else {
        setError(result.error || t('saveError'));
      }
    } catch (_error) {
      setError(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const getUserById = (userId: string): User | undefined => {
    return allUsers.find(u => u._id === userId);
  };

  const _getUserDisplayName = (userId: string): string => {
    const user = getUserById(userId);
    return user ? `${user.firstName} ${user.lastName}` : userId;
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
                isComplete: false,
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
    if (confirm(t('confirmDeleteTopic'))) {
      setFormData(prev => ({
        ...prev,
        topics: prev.topics.filter((_, i) => i !== topicIndex)
      }));
    }
  };

  const deleteInfoItem = (topicIndex: number, itemIndex: number) => {
    if (confirm(t('confirmDeleteInfoItem'))) {
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
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !minute) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">{tCommon('error')}</h1>
          <p className="text-gray-600">{error || t('notFound')}</p>
          <Link href="/minutes" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            {t('backToOverview')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center gap-4 mb-6">
            <Link href={`/minutes/${minuteId}`} className="text-blue-600 hover:text-blue-800 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{t('editMinute')}</h1>
          </div>
        </div>

        {/* Sticky Save Button */}
        <div className="fixed top-6 right-6 z-50">
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

        <form id="edit-form" onSubmit={handleSubmit} className="space-y-8">
          {/* Title */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('minuteTitle')}</label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder={t('minuteTitlePlaceholder')}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Date, Time and Location */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('date')}</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('location')}</label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder={t('locationPlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Attendance List */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
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

                return (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isGuest ? 'bg-gradient-to-br from-orange-400 to-pink-500' : 'bg-gradient-to-br from-blue-400 to-indigo-500'}`}>
                        {user ? user.firstName.charAt(0).toUpperCase() : (isGuest ? guestName.charAt(0).toUpperCase() : '?')}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {user ? `${user.firstName} ${user.lastName}` : (isGuest ? `${guestName} (${t('guest')})` : `${t('userId')}: ${participant.userId}`)}
                        </p>
                        {user && (
                          <p className="text-sm text-gray-600">{user.email} • {user.role}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...formData.participantsWithStatus];
                          updated[index] = { ...updated[index], attendance: 'present' };
                          setFormData(prev => ({ ...prev, participantsWithStatus: updated }));
                        }}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${participant.attendance === 'present'
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
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${participant.attendance === 'excused'
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
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${participant.attendance === 'absent'
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
                            const updatedStatus = formData.participantsWithStatus.filter((_, i) => i !== index);
                            const updatedParticipants = formData.participants.filter(p => p !== guestName);
                            setFormData(prev => ({ 
                              ...prev, 
                              participantsWithStatus: updatedStatus,
                              participants: updatedParticipants
                            }));
                          }}
                          className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
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
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('addGuest')}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newGuestName}
                    onChange={(e) => setNewGuestName(e.target.value)}
                    placeholder={t('guestNamePlaceholder')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {t('add')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGuestInput(false);
                      setNewGuestName('');
                    }}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                  >
                    {tCommon('cancel')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pending Tasks from Previous Minutes */}
          {!minute.isFinalized && (!showPendingTasks || (showPendingTasks && pendingTasks.length > 0)) && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{t('pendingTasksTitle')}</h2>
                    <p className="text-sm text-gray-600">{t('pendingTasksSubtitle')}</p>
                  </div>
                </div>
                {!showPendingTasks && (
                  <button
                    type="button"
                    onClick={fetchPendingTasks}
                    disabled={loadingPendingTasks}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
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
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold text-gray-900">{task.subject}</h3>
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                    }`}>
                                    {task.status === 'in-progress' ? `⏳ ${t('inProgress')}` : `○ ${t('open')}`}
                                  </span>
                                  {task.priority && (
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${task.priority === 'high' ? 'bg-red-100 text-red-800' :
                                      task.priority === 'medium' ? 'bg-orange-100 text-orange-800' :
                                        'bg-blue-100 text-blue-800'
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
                                  {task.duedate && (
                                    <span>• ⏰ {t('dueLabel')} {new Date(task.duedate).toLocaleDateString(locale)}</span>
                                  )}
                                  {task.responsibles && task.responsibles.length > 0 && (
                                    <span>• 👤 {task.responsibles.length} {t('responsibles')}</span>
                                  )}
                                </div>

                                {task.notes && (
                                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-xs font-medium text-blue-900 mb-1">💬 {t('lastComment')}</p>
                                    <p className="text-sm text-blue-800">{task.notes}</p>
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={(e) => importPendingTask(e, task)}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center gap-2 whitespace-nowrap"
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

          {/* Topics */}
          <div className="space-y-6">
            <div className="sticky top-6 z-40 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4 border border-gray-100 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">{t('topics')}</h2>
              <button
                type="button"
                onClick={addTopic}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all border-2 border-white"
              >
                + {t('addTopic')}
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
                    meetingSeriesMembers={meetingSeriesMembers}
                    allUsers={allUsers}
                    updateTopic={updateTopic}
                    deleteTopic={deleteTopic}
                    addInfoItem={addInfoItem}
                    updateInfoItem={updateInfoItem}
                    deleteInfoItem={deleteInfoItem}
                    handleDragEndInfoItem={handleDragEndInfoItem}
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
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {formData.topics.length === 0 ? t('createFirstTopic') : t('addAnotherTopic')}
            </button>
          </div>

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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
