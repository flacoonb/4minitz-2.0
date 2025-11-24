import React, { useState } from 'react';

interface AgendaEntryItemProps {
  entry: any;
  entryIndex: number;
  getLabelById: (id: string) => any;
  t: (key: string) => string;
  labels: any[];
  selectedSeries: any;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
}

export const AgendaEntryItem: React.FC<AgendaEntryItemProps> = ({
  entry,
  entryIndex,
  getLabelById,
  t,
  labels,
  selectedSeries,
  onUpdate,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedEntry, setEditedEntry] = useState(entry);
  const isImportedEntry = entry.isImported === true;
  const label = getLabelById(entry.labelId);

  return (
    <div className={`p-4 rounded-xl ${isImportedEntry ? 'bg-yellow-50 border-2 border-yellow-200' : 'bg-gray-50'}`}>
      {isImportedEntry && (
        <div className="flex items-center gap-2 mb-2 text-xs text-yellow-800">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{t('importedFromLastSession')}</span>
        </div>
      )}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {label && (
              <span 
                className="px-2 py-1 rounded-lg text-xs font-medium text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.name}
              </span>
            )}
            <span className="text-sm text-gray-500">#{entryIndex + 1}</span>
          </div>
          
          {isEditing && !isImportedEntry ? (
            <div className="space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
              {/* Betreff */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('discussionPoint')}</label>
                <input
                  type="text"
                  value={editedEntry.subject}
                  onChange={(e) => setEditedEntry({ ...editedEntry, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder={`${t('discussionPoint')}...`}
                />
              </div>
              
              {/* Details */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('detailsOptional')}</label>
                <textarea
                  value={editedEntry.content || ''}
                  onChange={(e) => setEditedEntry({ ...editedEntry, content: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none text-sm bg-white"
                  placeholder={`${t('detailsOptional')}...`}
                />
              </div>
              
              {/* Type, Status, Priority and Due Date */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('type')}</label>
                  <select
                    value={editedEntry.labelId || ''}
                    onChange={(e) => setEditedEntry({ ...editedEntry, labelId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  >
                    <option value="">{t('type')}</option>
                    {labels.map((label) => (
                      <option key={label._id} value={label._id}>
                        {label.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('status')}</label>
                  <select
                    value={editedEntry.isCompleted ? 'completed' : 'open'}
                    onChange={(e) => setEditedEntry({ ...editedEntry, isCompleted: e.target.value === 'completed' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  >
                    <option value="open">{t('open')}</option>
                    <option value="completed">{t('completed')}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('priority')}</label>
                  <select
                    value={editedEntry.priority}
                    onChange={(e) => setEditedEntry({ ...editedEntry, priority: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  >
                    <option value="low">{t('low')}</option>
                    <option value="medium">{t('medium')}</option>
                    <option value="high">{t('high')}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('dueDate')}</label>
                  <input
                    type="date"
                    value={editedEntry.dueDate || ''}
                    onChange={(e) => setEditedEntry({ ...editedEntry, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  />
                </div>
              </div>
              
              {/* Verantwortliche */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('responsiblesLabel')}
                  <span className="text-xs text-gray-500 ml-2">{t('multiSelectHint')}</span>
                </label>
                <select
                  multiple
                  value={editedEntry.responsibles || []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setEditedEntry({ ...editedEntry, responsibles: selected });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  size={3}
                >
                  {(selectedSeries?.participants || []).map((participant: string) => (
                    <option key={participant} value={participant} className="py-1">
                      {participant}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Aktions-Buttons */}
              <div className="flex gap-2 pt-2 border-t border-blue-200">
                <button
                  onClick={() => {
                    onUpdate(entry.id, editedEntry);
                    setIsEditing(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  {t('save')}
                </button>
                <button
                  onClick={() => {
                    setEditedEntry(entry);
                    setIsEditing(false);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : isImportedEntry ? (
            /* Imported task: Name and description not editable */
            <>
              {/* Non-editable original information */}
              <div className="mb-4 pb-4 border-b border-yellow-300">
                <h4 className="font-medium text-gray-900">{entry.subject}</h4>
                {entry.content && (
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{entry.content}</p>
                )}
                {label && (
                  <span 
                    className="inline-block mt-2 px-2 py-1 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                  </span>
                )}
              </div>
              
              {/* Editable fields for imported task */}
              {isEditing ? (
                <div className="space-y-3 bg-white p-4 rounded-lg border border-blue-200">
                  <h5 className="text-sm font-semibold text-blue-900 mb-3">{t('updateForThisSession')}</h5>
                  
                  {/* Status und Datum */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">{t('status')}</label>
                      <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100">
                        <input
                          type="checkbox"
                          checked={editedEntry.isCompleted}
                          onChange={(e) => setEditedEntry({ ...editedEntry, isCompleted: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{t('completed')}</span>
                      </label>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">{t('dueDate')}</label>
                      <input
                        type="date"
                        value={editedEntry.dueDate || ''}
                        onChange={(e) => setEditedEntry({ ...editedEntry, dueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                  
                  {/* Verantwortliche */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{t('responsiblesLabel')}</label>
                    <select
                      multiple
                      value={editedEntry.responsibles || []}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setEditedEntry({ ...editedEntry, responsibles: selected });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      size={3}
                    >
                      {(selectedSeries?.participants || []).map((participant: string) => (
                        <option key={participant} value={participant} className="py-1">
                          {participant}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        onUpdate(entry.id, editedEntry);
                        setIsEditing(false);
                      }}
                      className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                      {t('save')}
                    </button>
                    <button
                      onClick={() => {
                        setEditedEntry(entry);
                        setIsEditing(false);
                      }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode for imported task */
                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-4">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${editedEntry.isCompleted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {editedEntry.isCompleted ? t('completed') : t('open')}
                    </div>
                    {editedEntry.dueDate && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(editedEntry.dueDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {t('edit')}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Normal task view mode */
            <div>
              <h4 className="font-medium text-gray-900">{entry.subject}</h4>
              {entry.content && (
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{entry.content}</p>
              )}
              
              <div className="flex flex-wrap gap-2 mt-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${entry.isCompleted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {entry.isCompleted ? t('completed') : t('open')}
                </span>
                
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  entry.priority === 'high' ? 'bg-red-100 text-red-800' :
                  entry.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {entry.priority === 'high' ? t('high') : entry.priority === 'medium' ? t('medium') : t('low')}
                </span>
                
                {entry.dueDate && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(entry.dueDate).toLocaleDateString()}
                  </span>
                )}
                
                {entry.responsibles && entry.responsibles.length > 0 && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {entry.responsibles.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-1 ml-2">
          {!isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title={t('edit')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(entry.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title={t('delete')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
