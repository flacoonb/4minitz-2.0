"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

// Types for PDF Settings (Content & Style)
interface PdfSettings {
  _id?: string;
  logoUrl: string;
  logoPosition: 'left' | 'center' | 'right';
  showLogo: boolean;
  companyName: string;
  headerText: string;
  showHeader: boolean;
  footerText: string;
  showPageNumbers: boolean;
  showFooter: boolean;
  primaryColor: string;
  secondaryColor: string;
  includeTableOfContents: boolean;
  includeParticipants: boolean;
  includeResponsibles: boolean;
  includeStatusBadges: boolean;
  includePriorityBadges: boolean;
  includeNotes: boolean;
  fontSize: number;
  fontFamily: 'helvetica' | 'times' | 'courier';
}

// Types for PDF Layout
interface LayoutElement {
  id: string;
  type: 'header' | 'title' | 'info-box' | 'topic-title' | 'item-label' | 'separator' | 'logo';
  label: string;
  enabled: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  style: {
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    padding?: number;
    alignment?: 'left' | 'center' | 'right';
  };
}

interface PdfLayoutSettings {
  _id?: string;
  elements: LayoutElement[];
  pageMargins: { top: number; right: number; bottom: number; left: number };
  itemSpacing: number;
  sectionSpacing: number;
  labelColors: { info: string; task: string };
  logo?: {
    enabled: boolean;
    url: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
  };
}

export default function PdfConfigPage() {
  const t = useTranslations('admin.pdf');
  const [activeTab, setActiveTab] = useState<'content' | 'layout'>('content');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Content & Style settings
  const [contentSettings, setContentSettings] = useState<PdfSettings>({
    logoUrl: '',
    logoPosition: 'left',
    showLogo: true,
    companyName: '',
    headerText: '',
    showHeader: true,
    footerText: '',
    showPageNumbers: true,
    showFooter: true,
    primaryColor: '#3B82F6',
    secondaryColor: '#6B7280',
    includeTableOfContents: false,
    includeParticipants: true,
    includeResponsibles: true,
    includeStatusBadges: true,
    includePriorityBadges: true,
    includeNotes: true,
    fontSize: 10,
    fontFamily: 'helvetica'
  });

  // Layout settings
  const [layoutSettings, setLayoutSettings] = useState<PdfLayoutSettings>({
    elements: [
      {
        id: 'header',
        type: 'header',
        label: 'Kopfzeile',
        enabled: true,
        position: { x: 20, y: 20 },
        size: { width: 170, height: 25 },
        style: { borderWidth: 0.5, borderColor: '#000000' }
      },
      {
        id: 'protocol-title',
        type: 'title',
        label: 'Protokoll-Titel',
        enabled: true,
        position: { x: 55, y: 27 },
        size: { width: 100, height: 10 },
        style: { fontSize: 24, fontWeight: 'bold', alignment: 'center' }
      },
      {
        id: 'info-box',
        type: 'info-box',
        label: 'Info-Box (Ort/Datum/Zeit)',
        enabled: true,
        position: { x: 20, y: 50 },
        size: { width: 170, height: 10 },
        style: { borderWidth: 0.5, borderColor: '#000000', fontSize: 9 }
      },
      {
        id: 'topic-title',
        type: 'topic-title',
        label: 'Themen-Titel',
        enabled: true,
        position: { x: 20, y: 70 },
        size: { width: 170, height: 8 },
        style: { fontSize: 11, fontWeight: 'bold', backgroundColor: '#F3F4F6', borderWidth: 0.5 }
      },
      {
        id: 'item-label',
        type: 'item-label',
        label: 'Item-Label (1a, 1b, etc.)',
        enabled: true,
        position: { x: 22, y: 85 },
        size: { width: 12, height: 5.5 },
        style: { fontSize: 8, fontWeight: 'bold', alignment: 'center', backgroundColor: '#3B82F6', color: '#FFFFFF' }
      },
      {
        id: 'separator',
        type: 'separator',
        label: 'Trennlinie zwischen Items',
        enabled: true,
        position: { x: 20, y: 95 },
        size: { width: 170, height: 0.3 },
        style: { borderWidth: 0.3, borderColor: '#E6E6E6', backgroundColor: '#E6E6E6' }
      }
    ],
    pageMargins: { top: 20, right: 20, bottom: 20, left: 20 },
    itemSpacing: 5,
    sectionSpacing: 5,
    labelColors: { info: '#3B82F6', task: '#F97316' },
    logo: { enabled: false, url: '', position: { x: 25, y: 25 }, size: { width: 40, height: 15 } }
  });

  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [contentResponse, layoutResponse] = await Promise.all([
        fetch('/api/pdf-settings'),
        fetch('/api/pdf-layout-settings')
      ]);

      const contentResult = await contentResponse.json();
      const layoutResult = await layoutResponse.json();

      if (contentResult.success && contentResult.data) {
        setContentSettings(contentResult.data);
      }

      if (layoutResult.success && layoutResult.data) {
        setLayoutSettings({
          ...layoutResult.data,
          logo: layoutResult.data.logo || {
            enabled: false,
            url: '',
            position: { x: 25, y: 25 },
            size: { width: 40, height: 15 }
          }
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    setSaving(true);
    
    try {
      const response = await fetch('/api/upload/logo', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        setContentSettings({ ...contentSettings, logoUrl: result.url });
        setMessage({ type: 'success', text: t('messages.logoUploaded') });
      } else {
        setMessage({ type: 'error', text: result.error || t('messages.uploadFailed') });
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('messages.uploadFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const endpoint = activeTab === 'content' ? '/api/pdf-settings' : '/api/pdf-layout-settings';
      const data = activeTab === 'content' ? contentSettings : layoutSettings;

      // Remove MongoDB-specific fields
      const { _id, __v, createdAt, updatedAt, ...cleanData } = data as any;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanData)
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: t('messages.settingsSaved') });
        if (result.data) {
          if (activeTab === 'content') {
            setContentSettings(result.data);
          } else {
            setLayoutSettings(result.data);
          }
        }
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: t('messages.saveFailed') });
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('messages.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const updateElement = (id: string, updates: Partial<LayoutElement>) => {
    setLayoutSettings(prev => ({
      ...prev,
      elements: prev.elements.map(el => 
        el.id === id ? { ...el, ...updates } : el
      )
    }));
  };

  const updateElementStyle = (id: string, styleUpdates: Partial<LayoutElement['style']>) => {
    setLayoutSettings(prev => ({
      ...prev,
      elements: prev.elements.map(el => 
        el.id === id ? { ...el, style: { ...el.style, ...styleUpdates } } : el
      )
    }));
  };

  const updateLogo = (updates: Partial<PdfLayoutSettings['logo']>) => {
    setLayoutSettings(prev => ({
      ...prev,
      logo: {
        enabled: prev.logo?.enabled || false,
        url: prev.logo?.url || '',
        position: prev.logo?.position || { x: 25, y: 25 },
        size: prev.logo?.size || { width: 40, height: 15 },
        ...updates
      }
    }));
  };

  const selectedEl = selectedElement ? layoutSettings.elements.find(el => el.id === selectedElement) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      {/* Success/Error Message Toast - Fixed at top */}
      {message && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top">
          <div className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[400px] ${
            message.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            {message.type === 'success' ? (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div className="flex-1">
              <p className="font-semibold text-sm">{message.text}</p>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
              <p className="text-gray-600 mt-2">{t('subtitle')}</p>
            </div>
            <Link
              href="/admin/settings"
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              {t('back')}
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('content')}
              className={`pb-3 px-4 font-semibold transition-all border-b-2 ${
                activeTab === 'content'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('tabs.content')}
            </button>
            <button
              onClick={() => setActiveTab('layout')}
              className={`pb-3 px-4 font-semibold transition-all border-b-2 ${
                activeTab === 'layout'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('tabs.layout')}
            </button>
          </div>
        </div>

        {/* Content Tab */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Logo & Branding */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('content.branding.title')}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <input
                      type="checkbox"
                      checked={contentSettings.showLogo}
                      onChange={(e) => setContentSettings({ ...contentSettings, showLogo: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    {t('content.branding.showLogo')}
                  </label>
                </div>
                
                {contentSettings.showLogo && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('content.branding.uploadLogo')}</label>
                      <div className="flex items-center gap-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-sm file:font-semibold
                            file:bg-blue-50 file:text-blue-700
                            hover:file:bg-blue-100"
                        />
                      </div>
                      {contentSettings.logoUrl && (
                        <div className="mt-4 p-2 border rounded bg-gray-50 inline-block">
                          <img src={contentSettings.logoUrl} alt={t('content.branding.logoPreview')} className="h-16 object-contain" />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('content.branding.logoUrl')}</label>
                      <input
                        type="text"
                        value={contentSettings.logoUrl}
                        onChange={(e) => setContentSettings({ ...contentSettings, logoUrl: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('content.branding.logoPosition')}</label>
                      <select
                        value={contentSettings.logoPosition}
                        onChange={(e) => setContentSettings({ ...contentSettings, logoPosition: e.target.value as any })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="left">{t('content.branding.positions.left')}</option>
                        <option value="center">{t('content.branding.positions.center')}</option>
                        <option value="right">{t('content.branding.positions.right')}</option>
                      </select>
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('content.branding.companyName')}</label>
                  <input
                    type="text"
                    value={contentSettings.companyName}
                    onChange={(e) => setContentSettings({ ...contentSettings, companyName: e.target.value })}
                    placeholder={t('content.branding.companyNamePlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Header & Footer */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t('content.headerFooter.title')}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <input
                      type="checkbox"
                      checked={contentSettings.showHeader}
                      onChange={(e) => setContentSettings({ ...contentSettings, showHeader: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    {t('content.headerFooter.showHeader')}
                  </label>
                </div>
                
                {contentSettings.showHeader && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('content.headerFooter.headerText')}</label>
                    <input
                      type="text"
                      value={contentSettings.headerText}
                      onChange={(e) => setContentSettings({ ...contentSettings, headerText: e.target.value })}
                      placeholder={t('content.headerFooter.headerTextPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <input
                      type="checkbox"
                      checked={contentSettings.showFooter}
                      onChange={(e) => setContentSettings({ ...contentSettings, showFooter: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    {t('content.headerFooter.showFooter')}
                  </label>
                </div>
                
                {contentSettings.showFooter && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('content.headerFooter.footerText')}</label>
                      <input
                        type="text"
                        value={contentSettings.footerText}
                        onChange={(e) => setContentSettings({ ...contentSettings, footerText: e.target.value })}
                        placeholder={t('content.headerFooter.footerTextPlaceholder')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={contentSettings.showPageNumbers}
                          onChange={(e) => setContentSettings({ ...contentSettings, showPageNumbers: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        {t('content.headerFooter.showPageNumbers')}
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Content Options */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {t('content.options.title')}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={contentSettings.includeTableOfContents}
                    onChange={(e) => setContentSettings({ ...contentSettings, includeTableOfContents: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  {t('content.options.toc')}
                </label>
                
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={contentSettings.includeParticipants}
                    onChange={(e) => setContentSettings({ ...contentSettings, includeParticipants: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  {t('content.options.participants')}
                </label>
                
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={contentSettings.includeResponsibles}
                    onChange={(e) => setContentSettings({ ...contentSettings, includeResponsibles: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  {t('content.options.responsibles')}
                </label>
                
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={contentSettings.includeStatusBadges}
                    onChange={(e) => setContentSettings({ ...contentSettings, includeStatusBadges: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  {t('content.options.statusBadges')}
                </label>
                
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={contentSettings.includePriorityBadges}
                    onChange={(e) => setContentSettings({ ...contentSettings, includePriorityBadges: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  {t('content.options.priorityBadges')}
                </label>
                
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={contentSettings.includeNotes}
                    onChange={(e) => setContentSettings({ ...contentSettings, includeNotes: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  {t('content.options.notes')}
                </label>
              </div>
            </div>

            {/* Colors & Fonts */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                {t('content.style.title')}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('content.style.primaryColor')}</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={contentSettings.primaryColor}
                      onChange={(e) => setContentSettings({ ...contentSettings, primaryColor: e.target.value })}
                      className="w-16 h-10 rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={contentSettings.primaryColor}
                      onChange={(e) => setContentSettings({ ...contentSettings, primaryColor: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('content.style.secondaryColor')}</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={contentSettings.secondaryColor}
                      onChange={(e) => setContentSettings({ ...contentSettings, secondaryColor: e.target.value })}
                      className="w-16 h-10 rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={contentSettings.secondaryColor}
                      onChange={(e) => setContentSettings({ ...contentSettings, secondaryColor: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('content.style.fontFamily')}</label>
                  <select
                    value={contentSettings.fontFamily}
                    onChange={(e) => setContentSettings({ ...contentSettings, fontFamily: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="helvetica">Helvetica</option>
                    <option value="times">Times New Roman</option>
                    <option value="courier">Courier</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('content.style.fontSize')}</label>
                  <input
                    type="number"
                    min="8"
                    max="16"
                    value={contentSettings.fontSize}
                    onChange={(e) => setContentSettings({ ...contentSettings, fontSize: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Layout Tab */}
        {activeTab === 'layout' && (
          <div className="space-y-6">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    {t('layout.warning')}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Element List */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">{t('layout.elementsTitle')}</h2>
                
                <div className="space-y-2">
                  {layoutSettings.elements.map((element) => (
                    <div
                      key={element.id}
                      onClick={() => setSelectedElement(element.id)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedElement === element.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={element.enabled}
                            onChange={(e) => updateElement(element.id, { enabled: e.target.checked })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4"
                          />
                          <span className="font-medium text-sm">{t(`layout.elementLabels.${element.id}`)}</span>
                        </div>
                        <span className="text-xs text-gray-500">{element.type}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Global Settings */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="font-bold text-gray-800 mb-3">{t('layout.globalSettings.title')}</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('layout.globalSettings.margins')}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder={t('layout.globalSettings.top')}
                          value={layoutSettings.pageMargins.top}
                          onChange={(e) => setLayoutSettings(prev => ({
                            ...prev,
                            pageMargins: { ...prev.pageMargins, top: Number(e.target.value) }
                          }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <input
                          type="number"
                          placeholder={t('layout.globalSettings.right')}
                          value={layoutSettings.pageMargins.right}
                          onChange={(e) => setLayoutSettings(prev => ({
                            ...prev,
                            pageMargins: { ...prev.pageMargins, right: Number(e.target.value) }
                          }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <input
                          type="number"
                          placeholder={t('layout.globalSettings.bottom')}
                          value={layoutSettings.pageMargins.bottom}
                          onChange={(e) => setLayoutSettings(prev => ({
                            ...prev,
                            pageMargins: { ...prev.pageMargins, bottom: Number(e.target.value) }
                          }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <input
                          type="number"
                          placeholder={t('layout.globalSettings.left')}
                          value={layoutSettings.pageMargins.left}
                          onChange={(e) => setLayoutSettings(prev => ({
                            ...prev,
                            pageMargins: { ...prev.pageMargins, left: Number(e.target.value) }
                          }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('layout.globalSettings.itemSpacing')}
                      </label>
                      <input
                        type="number"
                        value={layoutSettings.itemSpacing}
                        onChange={(e) => setLayoutSettings(prev => ({ ...prev, itemSpacing: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('layout.globalSettings.sectionSpacing')}
                      </label>
                      <input
                        type="number"
                        value={layoutSettings.sectionSpacing}
                        onChange={(e) => setLayoutSettings(prev => ({ ...prev, sectionSpacing: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('layout.globalSettings.labelColors')}
                      </label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm w-16">{t('layout.globalSettings.infoColor')}</span>
                          <input
                            type="color"
                            value={layoutSettings.labelColors.info}
                            onChange={(e) => setLayoutSettings(prev => ({
                              ...prev,
                              labelColors: { ...prev.labelColors, info: e.target.value }
                            }))}
                            className="w-16 h-8 rounded border border-gray-300"
                          />
                          <span className="text-xs text-gray-500">{layoutSettings.labelColors.info}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm w-16">{t('layout.globalSettings.taskColor')}</span>
                          <input
                            type="color"
                            value={layoutSettings.labelColors.task}
                            onChange={(e) => setLayoutSettings(prev => ({
                              ...prev,
                              labelColors: { ...prev.labelColors, task: e.target.value }
                            }))}
                            className="w-16 h-8 rounded border border-gray-300"
                          />
                          <span className="text-xs text-gray-500">{layoutSettings.labelColors.task}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Panel - Properties */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  {selectedEl ? selectedEl.label : t('layout.properties.title')}
                </h2>
                
                {selectedEl ? (
                  <div className="space-y-4">
                    {/* Position */}
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">{t('layout.properties.position')}</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.x')} (mm)</label>
                          <input
                            type="number"
                            value={selectedEl.position.x}
                            onChange={(e) => updateElement(selectedEl.id, {
                              position: { ...selectedEl.position, x: Number(e.target.value) }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.y')} (mm)</label>
                          <input
                            type="number"
                            value={selectedEl.position.y}
                            onChange={(e) => updateElement(selectedEl.id, {
                              position: { ...selectedEl.position, y: Number(e.target.value) }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Size */}
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">{t('layout.properties.size')}</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.width')} (mm)</label>
                          <input
                            type="number"
                            value={selectedEl.size.width}
                            onChange={(e) => updateElement(selectedEl.id, {
                              size: { ...selectedEl.size, width: Number(e.target.value) }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.height')} (mm)</label>
                          <input
                            type="number"
                            value={selectedEl.size.height}
                            onChange={(e) => updateElement(selectedEl.id, {
                              size: { ...selectedEl.size, height: Number(e.target.value) }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Style options shortened for brevity - add fontSize, fontWeight, etc. if needed */}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    {t('layout.properties.selectHint')}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Preview */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">{t('layout.preview.title')}</h2>
                
                <div className="border-2 border-gray-200 rounded-lg p-4 bg-white" style={{ minHeight: '600px' }}>
                  <div className="text-xs text-gray-500 mb-2">{t('layout.preview.paperSize')}</div>
                  
                  <div className="relative bg-white border-2 border-gray-400" style={{ 
                    width: '100%', 
                    aspectRatio: '210/297',
                    fontSize: '8px'
                  }}>
                    {/* Show margins */}
                    <div 
                      className="absolute border border-dashed border-blue-300 pointer-events-none"
                      style={{
                        top: `${(layoutSettings.pageMargins.top / 297) * 100}%`,
                        left: `${(layoutSettings.pageMargins.left / 210) * 100}%`,
                        right: `${(layoutSettings.pageMargins.right / 210) * 100}%`,
                        bottom: `${(layoutSettings.pageMargins.bottom / 297) * 100}%`,
                      }}
                    />
                    
                    {/* Elements preview */}
                    {layoutSettings.elements.filter(el => el.enabled).map((element) => {
                      const left = (element.position.x / 210) * 100;
                      const top = (element.position.y / 297) * 100;
                      const width = (element.size.width / 210) * 100;
                      const height = element.size.height > 0 ? (element.size.height / 297) * 100 : 0.1;
                      
                      return (
                        <div
                          key={element.id}
                          className={`absolute cursor-pointer transition-all ${
                            selectedElement === element.id 
                              ? 'border-2 border-blue-500 shadow-lg z-10' 
                              : 'border border-gray-400 hover:border-blue-400'
                          }`}
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                            backgroundColor: element.style.backgroundColor || 'rgba(255, 255, 255, 0.8)',
                            borderColor: element.style.borderColor || '#9ca3af',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: element.style.alignment === 'center' ? 'center' : element.style.alignment === 'right' ? 'flex-end' : 'flex-start',
                            padding: '2px 4px',
                            fontSize: element.style.fontSize ? `${Math.max(6, element.style.fontSize / 3)}px` : '6px',
                            fontWeight: element.style.fontWeight || 'normal',
                            color: element.style.color || '#000000',
                            overflow: 'hidden'
                          }}
                          onClick={() => setSelectedElement(element.id)}
                        >
                          <span className="truncate">{element.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('save.saving') : t('save.button')}
          </button>
        </div>
      </div>
    </div>
  );
}
