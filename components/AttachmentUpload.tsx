'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, X } from 'lucide-react';

interface AttachmentUploadProps {
  minuteId: string;
  topicId?: string;
  infoItemId?: string;
  onUploadComplete?: () => void;
}

export default function AttachmentUpload({ 
  minuteId, 
  topicId, 
  infoItemId,
  onUploadComplete 
}: AttachmentUploadProps) {
  const t = useTranslations('attachments');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('minuteId', minuteId);
      if (topicId) formData.append('topicId', topicId);
      if (infoItemId) formData.append('infoItemId', infoItemId);

      const response = await fetch('/api/attachments', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Callback
      onUploadComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <Upload className={`w-8 h-8 ${uploading ? 'text-gray-400' : 'text-gray-600'}`} />
          
          {uploading ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">{t('uploading')}</p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <button
                  onClick={onButtonClick}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {t('clickToUpload')}
                </button>
                <p className="text-sm text-gray-600 mt-1">
                  {t('orDragAndDrop')}
                </p>
              </div>
              <p className="text-xs text-gray-500">
                {t('allowedTypes')}
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
