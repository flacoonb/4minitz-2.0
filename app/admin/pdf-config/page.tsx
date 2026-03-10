"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  footerLeftText: string;
  footerText: string;
  showPageNumbers: boolean;
  showFooter: boolean;
  primaryColor: string;
  secondaryColor: string;
  includeResponsibles: boolean;
  includeStatusBadges: boolean;
  includePriorityBadges: boolean;
  includeNotes: boolean;
  fontSize: number;
  fontFamily: 'helvetica' | 'times' | 'courier';
}

type LayoutPositionMode = 'absolute' | 'anchored';
type LayoutAnchorX = 'left' | 'center' | 'right';
type LayoutAnchorY = 'top' | 'center' | 'bottom';

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
    positionMode?: LayoutPositionMode;
    anchorX?: LayoutAnchorX;
    anchorY?: LayoutAnchorY;
  };
}

interface PdfLayoutSettings {
  _id?: string;
  elements: LayoutElement[];
  pageMargins: { top: number; right: number; bottom: number; left: number };
  itemSpacing: number;
  sectionSpacing: number;
  labelColors: { info: string; task: string };
  metrics: {
    showAttendanceBox: boolean;
    attendanceWidth: number;
    responsibleColumnWidth: number;
    pageFrameInset: number;
    attendanceFontSize: number;
    attendanceLegendFontSize: number;
  };
  logo?: {
    enabled: boolean;
    url: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    positionMode: LayoutPositionMode;
    anchorX: LayoutAnchorX;
    anchorY: LayoutAnchorY;
  };
}

interface PdfTemplateRecord {
  _id: string;
  name: string;
  description: string;
  isActive: boolean;
  contentSettings: PdfSettings;
  layoutSettings: PdfLayoutSettings;
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const LAYOUT_POSITION_MODES: LayoutPositionMode[] = ['absolute', 'anchored'];
const LAYOUT_ANCHOR_X: LayoutAnchorX[] = ['left', 'center', 'right'];
const LAYOUT_ANCHOR_Y: LayoutAnchorY[] = ['top', 'center', 'bottom'];
const HEADER_POSITION_PRESETS: Array<{
  id: string;
  anchorX: LayoutAnchorX;
  anchorY: LayoutAnchorY;
  labelKey: string;
}> = [
  { id: 'top-left', anchorX: 'left', anchorY: 'top', labelKey: 'layout.properties.presetTopLeft' },
  { id: 'top-center', anchorX: 'center', anchorY: 'top', labelKey: 'layout.properties.presetTopCenter' },
  { id: 'top-right', anchorX: 'right', anchorY: 'top', labelKey: 'layout.properties.presetTopRight' },
  { id: 'middle-left', anchorX: 'left', anchorY: 'center', labelKey: 'layout.properties.presetMiddleLeft' },
  { id: 'middle-center', anchorX: 'center', anchorY: 'center', labelKey: 'layout.properties.presetMiddleCenter' },
  { id: 'middle-right', anchorX: 'right', anchorY: 'center', labelKey: 'layout.properties.presetMiddleRight' },
  { id: 'bottom-left', anchorX: 'left', anchorY: 'bottom', labelKey: 'layout.properties.presetBottomLeft' },
  { id: 'bottom-center', anchorX: 'center', anchorY: 'bottom', labelKey: 'layout.properties.presetBottomCenter' },
  { id: 'bottom-right', anchorX: 'right', anchorY: 'bottom', labelKey: 'layout.properties.presetBottomRight' },
];

const DEFAULT_LAYOUT_ELEMENTS: LayoutElement[] = [
  {
    id: 'page-frame',
    type: 'separator',
    label: 'Seitenrahmen',
    enabled: true,
    position: { x: 8, y: 8 },
    size: { width: 194, height: 281 },
    style: { borderWidth: 0.3, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' },
  },
  {
    id: 'header',
    type: 'header',
    label: 'Kopfzeile',
    enabled: true,
    position: { x: 20, y: 20 },
    size: { width: 170, height: 64 },
    style: { borderWidth: 0.35, borderColor: '#94A3B8', backgroundColor: '#FFFFFF', padding: 0 },
  },
  {
    id: 'protocol-title',
    type: 'title',
    label: 'Protokoll-Titel',
    enabled: true,
    position: { x: 55, y: 27 },
    size: { width: 100, height: 10 },
    style: {
      fontSize: 20,
      fontWeight: 'bold',
      alignment: 'left',
      color: '#334155',
      padding: 1,
      positionMode: 'absolute',
      anchorX: 'left',
      anchorY: 'top',
    },
  },
  {
    id: 'protocol-title-top',
    type: 'title',
    label: 'Protokoll-Titel oben',
    enabled: true,
    position: { x: 55, y: 22 },
    size: { width: 100, height: 4 },
    style: {
      fontSize: 9,
      fontWeight: 'normal',
      alignment: 'left',
      color: '#6B7280',
      padding: 0.5,
      positionMode: 'absolute',
      anchorX: 'left',
      anchorY: 'top',
    },
  },
  {
    id: 'protocol-title-bottom',
    type: 'title',
    label: 'Protokoll-Titel unten',
    enabled: true,
    position: { x: 55, y: 38 },
    size: { width: 100, height: 5 },
    style: {
      fontSize: 9,
      fontWeight: 'normal',
      alignment: 'left',
      color: '#111827',
      padding: 0.5,
      positionMode: 'absolute',
      anchorX: 'left',
      anchorY: 'top',
    },
  },
  {
    id: 'info-box',
    type: 'info-box',
    label: 'Info-Box (Ort/Datum/Zeit)',
    enabled: true,
    position: { x: 20, y: 50 },
    size: { width: 170, height: 15 },
    style: {
      borderWidth: 0.5,
      borderColor: '#94A3B8',
      fontSize: 9,
      fontWeight: 'normal',
      color: '#1F2937',
      backgroundColor: '#FFFFFF',
      padding: 2,
    },
  },
  {
    id: 'topic-title',
    type: 'topic-title',
    label: 'Themen-Titel',
    enabled: true,
    position: { x: 20, y: 70 },
    size: { width: 170, height: 10 },
    style: {
      fontSize: 11,
      fontWeight: 'bold',
      alignment: 'left',
      color: '#111827',
      backgroundColor: '#F3F4F6',
      borderColor: '#CBD5E1',
      borderWidth: 0.5,
      padding: 2,
    },
  },
  {
    id: 'item-label',
    type: 'item-label',
    label: 'Item-Label (1a, 1b, etc.)',
    enabled: true,
    position: { x: 22, y: 85 },
    size: { width: 12, height: 5.5 },
    style: {
      fontSize: 8,
      fontWeight: 'bold',
      alignment: 'center',
      backgroundColor: '#3B82F6',
      color: '#FFFFFF',
      borderColor: '#3B82F6',
      borderWidth: 0,
      padding: 1,
    },
  },
  {
    id: 'separator',
    type: 'separator',
    label: 'Trennlinie zwischen Items',
    enabled: true,
    position: { x: 20, y: 95 },
    size: { width: 170, height: 0.3 },
    style: { borderWidth: 0.3, borderColor: '#E6E6E6', backgroundColor: '#E6E6E6' },
  },
  {
    id: 'global-notes-title',
    type: 'topic-title',
    label: 'Notizen-Titel',
    enabled: true,
    position: { x: 20, y: 228 },
    size: { width: 170, height: 10 },
    style: {
      fontSize: 11,
      fontWeight: 'bold',
      alignment: 'left',
      color: '#111827',
      backgroundColor: '#F3F4F6',
      borderColor: '#CBD5E1',
      borderWidth: 0.5,
      padding: 2,
    },
  },
  {
    id: 'global-notes-body',
    type: 'info-box',
    label: 'Notizen-Inhalt',
    enabled: true,
    position: { x: 20, y: 238 },
    size: { width: 170, height: 32 },
    style: {
      fontSize: 9,
      fontWeight: 'normal',
      color: '#1F2937',
      backgroundColor: '#FFFFFF',
      borderColor: '#CBD5E1',
      borderWidth: 0.5,
      padding: 3,
    },
  },
  {
    id: 'reopening-history-title',
    type: 'topic-title',
    label: 'Wiedereröffnung Titel',
    enabled: true,
    position: { x: 20, y: 272 },
    size: { width: 170, height: 7 },
    style: {
      fontSize: 9,
      fontWeight: 'bold',
      alignment: 'left',
      color: '#78350F',
      backgroundColor: '#FFFBEB',
      borderColor: '#F59E0B',
      borderWidth: 0.5,
      padding: 2,
    },
  },
  {
    id: 'reopening-history-body',
    type: 'info-box',
    label: 'Wiedereröffnung Inhalt',
    enabled: true,
    position: { x: 20, y: 279 },
    size: { width: 170, height: 24 },
    style: {
      fontSize: 9,
      fontWeight: 'normal',
      color: '#1F2937',
      backgroundColor: '#FFFFFF',
      borderColor: '#F59E0B',
      borderWidth: 0.5,
      padding: 3,
    },
  },
  {
    id: 'footer',
    type: 'info-box',
    label: 'Fußzeile',
    enabled: true,
    position: { x: 20, y: 284 },
    size: { width: 170, height: 8 },
    style: {
      fontSize: 8,
      fontWeight: 'normal',
      color: '#505050',
      borderColor: '#C8C8C8',
      borderWidth: 0.2,
      padding: 2,
    },
  },
];

const DEFAULT_CONTENT_SETTINGS: PdfSettings = {
  logoUrl: '',
  logoPosition: 'left',
  showLogo: true,
  companyName: '',
  headerText: '',
  showHeader: true,
  footerLeftText: 'Vertraulich',
  footerText: '',
  showPageNumbers: true,
  showFooter: true,
  primaryColor: '#3B82F6',
  secondaryColor: '#6B7280',
  includeResponsibles: true,
  includeStatusBadges: true,
  includePriorityBadges: true,
  includeNotes: true,
  fontSize: 10,
  fontFamily: 'helvetica',
};

const DEFAULT_LAYOUT_SETTINGS: PdfLayoutSettings = {
  elements: DEFAULT_LAYOUT_ELEMENTS,
  pageMargins: { top: 20, right: 20, bottom: 20, left: 20 },
  itemSpacing: 5,
  sectionSpacing: 5,
  labelColors: { info: '#3B82F6', task: '#F97316' },
  metrics: {
    showAttendanceBox: true,
    attendanceWidth: 94,
    responsibleColumnWidth: 35,
    pageFrameInset: 8,
    attendanceFontSize: 8,
    attendanceLegendFontSize: 6,
  },
  logo: {
    enabled: false,
    url: '',
    position: { x: 25, y: 25 },
    size: { width: 40, height: 15 },
    positionMode: 'absolute',
    anchorX: 'left',
    anchorY: 'top',
  },
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(input: unknown, fallback: number): number {
  const numericValue = typeof input === 'number' ? input : Number(input);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function sanitizeHexColor(input: unknown, fallback: string): string {
  return typeof input === 'string' && HEX_COLOR_PATTERN.test(input) ? input : fallback;
}

function createDefaultContentSettings(): PdfSettings {
  return deepClone(DEFAULT_CONTENT_SETTINGS);
}

function createDefaultLayoutSettings(): PdfLayoutSettings {
  return deepClone(DEFAULT_LAYOUT_SETTINGS);
}

function normalizeContentSettings(input: unknown): PdfSettings {
  const source = isObject(input) ? input : {};
  const defaults = createDefaultContentSettings();
  const logoPosition =
    source.logoPosition === 'left' || source.logoPosition === 'center' || source.logoPosition === 'right'
      ? source.logoPosition
      : defaults.logoPosition;
  const fontFamily =
    source.fontFamily === 'helvetica' || source.fontFamily === 'times' || source.fontFamily === 'courier'
      ? source.fontFamily
      : defaults.fontFamily;

  return {
    logoUrl: typeof source.logoUrl === 'string' ? source.logoUrl : defaults.logoUrl,
    logoPosition,
    showLogo: typeof source.showLogo === 'boolean' ? source.showLogo : defaults.showLogo,
    companyName: typeof source.companyName === 'string' ? source.companyName : defaults.companyName,
    headerText: typeof source.headerText === 'string' ? source.headerText : defaults.headerText,
    showHeader: typeof source.showHeader === 'boolean' ? source.showHeader : defaults.showHeader,
    footerLeftText: typeof source.footerLeftText === 'string' ? source.footerLeftText : defaults.footerLeftText,
    footerText: typeof source.footerText === 'string' ? source.footerText : defaults.footerText,
    showPageNumbers: typeof source.showPageNumbers === 'boolean' ? source.showPageNumbers : defaults.showPageNumbers,
    showFooter: typeof source.showFooter === 'boolean' ? source.showFooter : defaults.showFooter,
    primaryColor: sanitizeHexColor(source.primaryColor, defaults.primaryColor),
    secondaryColor: sanitizeHexColor(source.secondaryColor, defaults.secondaryColor),
    includeResponsibles:
      typeof source.includeResponsibles === 'boolean' ? source.includeResponsibles : defaults.includeResponsibles,
    includeStatusBadges:
      typeof source.includeStatusBadges === 'boolean' ? source.includeStatusBadges : defaults.includeStatusBadges,
    includePriorityBadges:
      typeof source.includePriorityBadges === 'boolean' ? source.includePriorityBadges : defaults.includePriorityBadges,
    includeNotes: typeof source.includeNotes === 'boolean' ? source.includeNotes : defaults.includeNotes,
    fontSize: Math.max(6, Math.min(20, toFiniteNumber(source.fontSize, defaults.fontSize))),
    fontFamily,
  };
}

function normalizeLayoutSettings(input: unknown): PdfLayoutSettings {
  const source = isObject(input) ? input : {};
  const defaults = createDefaultLayoutSettings();
  const sourceElements = Array.isArray(source.elements) ? source.elements : [];
  const sourceById = new Map<string, Record<string, unknown>>();

  for (const entry of sourceElements) {
    if (!isObject(entry)) continue;
    const id = typeof entry.id === 'string' ? entry.id : '';
    if (!id || sourceById.has(id)) continue;
    sourceById.set(id, entry);
  }

  const elements = defaults.elements.map((defaultElement) => {
    const sourceElement = sourceById.get(defaultElement.id) || {};
    const sourceStyle = isObject(sourceElement.style) ? sourceElement.style : {};

    return {
      ...defaultElement,
      label: typeof sourceElement.label === 'string' ? sourceElement.label : defaultElement.label,
      enabled: typeof sourceElement.enabled === 'boolean' ? sourceElement.enabled : defaultElement.enabled,
      position: {
        x: toFiniteNumber(sourceElement.position && isObject(sourceElement.position) ? sourceElement.position.x : undefined, defaultElement.position.x),
        y: toFiniteNumber(sourceElement.position && isObject(sourceElement.position) ? sourceElement.position.y : undefined, defaultElement.position.y),
      },
      size: {
        width: toFiniteNumber(sourceElement.size && isObject(sourceElement.size) ? sourceElement.size.width : undefined, defaultElement.size.width),
        height: toFiniteNumber(sourceElement.size && isObject(sourceElement.size) ? sourceElement.size.height : undefined, defaultElement.size.height),
      },
      style: {
        ...defaultElement.style,
        fontSize:
          sourceStyle.fontSize !== undefined
            ? toFiniteNumber(sourceStyle.fontSize, defaultElement.style.fontSize ?? 10)
            : defaultElement.style.fontSize,
        fontWeight:
          sourceStyle.fontWeight === 'normal' || sourceStyle.fontWeight === 'bold'
            ? sourceStyle.fontWeight
            : defaultElement.style.fontWeight,
        color:
          sourceStyle.color !== undefined
            ? sanitizeHexColor(sourceStyle.color, defaultElement.style.color || '#000000')
            : defaultElement.style.color,
        backgroundColor:
          sourceStyle.backgroundColor !== undefined
            ? sanitizeHexColor(sourceStyle.backgroundColor, defaultElement.style.backgroundColor || '#FFFFFF')
            : defaultElement.style.backgroundColor,
        borderColor:
          sourceStyle.borderColor !== undefined
            ? sanitizeHexColor(sourceStyle.borderColor, defaultElement.style.borderColor || '#000000')
            : defaultElement.style.borderColor,
        borderWidth:
          sourceStyle.borderWidth !== undefined
            ? toFiniteNumber(sourceStyle.borderWidth, defaultElement.style.borderWidth ?? 0.5)
            : defaultElement.style.borderWidth,
        padding:
          sourceStyle.padding !== undefined
            ? toFiniteNumber(sourceStyle.padding, defaultElement.style.padding ?? 0)
            : defaultElement.style.padding,
        alignment:
          sourceStyle.alignment === 'left' || sourceStyle.alignment === 'center' || sourceStyle.alignment === 'right'
            ? sourceStyle.alignment
            : defaultElement.style.alignment,
        positionMode: LAYOUT_POSITION_MODES.includes(sourceStyle.positionMode as LayoutPositionMode)
          ? (sourceStyle.positionMode as LayoutPositionMode)
          : defaultElement.style.positionMode,
        anchorX: LAYOUT_ANCHOR_X.includes(sourceStyle.anchorX as LayoutAnchorX)
          ? (sourceStyle.anchorX as LayoutAnchorX)
          : defaultElement.style.anchorX,
        anchorY: LAYOUT_ANCHOR_Y.includes(sourceStyle.anchorY as LayoutAnchorY)
          ? (sourceStyle.anchorY as LayoutAnchorY)
          : defaultElement.style.anchorY,
      },
    };
  });

  const pageMarginsSource = isObject(source.pageMargins) ? source.pageMargins : {};
  const labelColorsSource = isObject(source.labelColors) ? source.labelColors : {};
  const metricsSource = isObject(source.metrics) ? source.metrics : {};
  const logoSource = isObject(source.logo) ? source.logo : {};
  const logoPositionSource = isObject(logoSource.position) ? logoSource.position : {};
  const logoSizeSource = isObject(logoSource.size) ? logoSource.size : {};

  return {
    elements,
    pageMargins: {
      top: Math.max(0, toFiniteNumber(pageMarginsSource.top, defaults.pageMargins.top)),
      right: Math.max(0, toFiniteNumber(pageMarginsSource.right, defaults.pageMargins.right)),
      bottom: Math.max(0, toFiniteNumber(pageMarginsSource.bottom, defaults.pageMargins.bottom)),
      left: Math.max(0, toFiniteNumber(pageMarginsSource.left, defaults.pageMargins.left)),
    },
    itemSpacing: Math.max(0, toFiniteNumber(source.itemSpacing, defaults.itemSpacing)),
    sectionSpacing: Math.max(0, toFiniteNumber(source.sectionSpacing, defaults.sectionSpacing)),
    labelColors: {
      info: sanitizeHexColor(labelColorsSource.info, defaults.labelColors.info),
      task: sanitizeHexColor(labelColorsSource.task, defaults.labelColors.task),
    },
    metrics: {
      showAttendanceBox:
        typeof metricsSource.showAttendanceBox === 'boolean'
          ? metricsSource.showAttendanceBox
          : defaults.metrics.showAttendanceBox,
      attendanceWidth: Math.max(60, toFiniteNumber(metricsSource.attendanceWidth, defaults.metrics.attendanceWidth)),
      responsibleColumnWidth: Math.max(
        18,
        toFiniteNumber(metricsSource.responsibleColumnWidth, defaults.metrics.responsibleColumnWidth)
      ),
      pageFrameInset: Math.max(0, toFiniteNumber(metricsSource.pageFrameInset, defaults.metrics.pageFrameInset)),
      attendanceFontSize: Math.max(6, toFiniteNumber(metricsSource.attendanceFontSize, defaults.metrics.attendanceFontSize)),
      attendanceLegendFontSize: Math.max(
        4,
        toFiniteNumber(metricsSource.attendanceLegendFontSize, defaults.metrics.attendanceLegendFontSize)
      ),
    },
    logo: {
      enabled: typeof logoSource.enabled === 'boolean' ? logoSource.enabled : defaults.logo?.enabled ?? false,
      url: typeof logoSource.url === 'string' ? logoSource.url : defaults.logo?.url ?? '',
      position: {
        x: toFiniteNumber(logoPositionSource.x, defaults.logo?.position.x ?? 25),
        y: toFiniteNumber(logoPositionSource.y, defaults.logo?.position.y ?? 25),
      },
      size: {
        width: Math.max(1, toFiniteNumber(logoSizeSource.width, defaults.logo?.size.width ?? 40)),
        height: Math.max(1, toFiniteNumber(logoSizeSource.height, defaults.logo?.size.height ?? 15)),
      },
      positionMode: LAYOUT_POSITION_MODES.includes(logoSource.positionMode as LayoutPositionMode)
        ? (logoSource.positionMode as LayoutPositionMode)
        : defaults.logo?.positionMode ?? 'absolute',
      anchorX: LAYOUT_ANCHOR_X.includes(logoSource.anchorX as LayoutAnchorX)
        ? (logoSource.anchorX as LayoutAnchorX)
        : defaults.logo?.anchorX ?? 'left',
      anchorY: LAYOUT_ANCHOR_Y.includes(logoSource.anchorY as LayoutAnchorY)
        ? (logoSource.anchorY as LayoutAnchorY)
        : defaults.logo?.anchorY ?? 'top',
    },
  };
}

function normalizeTemplateRecord(input: unknown): PdfTemplateRecord | null {
  const source = isObject(input) ? input : null;
  if (!source) return null;
  const id = typeof source._id === 'string' ? source._id : '';
  if (!id) return null;

  return {
    _id: id,
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'Standard',
    description: typeof source.description === 'string' ? source.description : '',
    isActive: source.isActive === true,
    contentSettings: normalizeContentSettings(source.contentSettings),
    layoutSettings: normalizeLayoutSettings(source.layoutSettings),
  };
}

function buildTemplateExportFilename(templateName: string): string {
  const baseName = templateName.trim() || 'pdf-template';
  const sanitizedName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const finalName = sanitizedName || 'pdf-template';
  return `${finalName}.json`;
}

export default function PdfConfigPage() {
  const t = useTranslations('admin.pdf');
  const [activeTab, setActiveTab] = useState<'content' | 'layout'>('content');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [templates, setTemplates] = useState<PdfTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [elementPresetSelection, setElementPresetSelection] = useState('');
  const [logoPresetSelection, setLogoPresetSelection] = useState('');

  // Content & Style settings
  const [contentSettings, setContentSettings] = useState<PdfSettings>(() => createDefaultContentSettings());

  // Layout settings
  const [layoutSettings, setLayoutSettings] = useState<PdfLayoutSettings>(() => createDefaultLayoutSettings());

  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  useEffect(() => {
    setElementPresetSelection('');
    setLogoPresetSelection('');
  }, [selectedElement]);

  const applyTemplateToEditor = useCallback((template: PdfTemplateRecord | null) => {
    if (!template) {
      setTemplateName('Standard');
      setTemplateDescription('');
      setContentSettings(createDefaultContentSettings());
      setLayoutSettings(createDefaultLayoutSettings());
      setSelectedElement(null);
      return;
    }

    setTemplateName(template.name);
    setTemplateDescription(template.description || '');
    setContentSettings(normalizeContentSettings(template.contentSettings));
    setLayoutSettings(normalizeLayoutSettings(template.layoutSettings));
    setSelectedElement(null);
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pdf-templates', { cache: 'no-store' });
      const result = await response.json();

      if (!result?.success || !Array.isArray(result.data)) {
        throw new Error(result?.error || 'Failed to load templates');
      }

      const normalizedTemplates = result.data
        .map((entry: unknown) => normalizeTemplateRecord(entry))
        .filter((entry: PdfTemplateRecord | null): entry is PdfTemplateRecord => Boolean(entry));

      setTemplates(normalizedTemplates);

      const activeTemplateId = typeof result.activeTemplateId === 'string' ? result.activeTemplateId : '';
      const initialTemplate =
        normalizedTemplates.find((template: PdfTemplateRecord) => template._id === activeTemplateId) ||
        normalizedTemplates.find((template: PdfTemplateRecord) => template.isActive) ||
        normalizedTemplates[0] ||
        null;

      setSelectedTemplateId(initialTemplate?._id || '');
      applyTemplateToEditor(initialTemplate);
    } catch (error) {
      console.error('Error loading PDF templates:', error);
      setMessage({ type: 'error', text: t('messages.loadFailed') });
      setTemplates([]);
      setSelectedTemplateId('');
      applyTemplateToEditor(null);
    } finally {
      setLoading(false);
    }
  }, [applyTemplateToEditor, t]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleTemplateChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextTemplateId = event.target.value;
    setSelectedTemplateId(nextTemplateId);
    const selectedTemplate = templates.find((template) => template._id === nextTemplateId) || null;
    applyTemplateToEditor(selectedTemplate);
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
        setContentSettings((prev) => ({ ...prev, logoUrl: result.url }));
        setMessage({ type: 'success', text: t('messages.logoUploaded') });
      } else {
        setMessage({ type: 'error', text: result.error || t('messages.uploadFailed') });
      }
    } catch (_error) {
      setMessage({ type: 'error', text: t('messages.uploadFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedTemplateId) {
      setMessage({ type: 'error', text: t('messages.templateMissing') });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/pdf-templates/${selectedTemplateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim() || 'Standard',
          description: templateDescription,
          contentSettings: normalizeContentSettings(contentSettings),
          layoutSettings: normalizeLayoutSettings(layoutSettings),
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        const updatedTemplate = normalizeTemplateRecord(result.data);
        if (updatedTemplate) {
          setTemplates((prev) =>
            prev.map((template) => (template._id === updatedTemplate._id ? updatedTemplate : template))
          );
          setSelectedTemplateId(updatedTemplate._id);
          applyTemplateToEditor(updatedTemplate);
        }
        setMessage({ type: 'success', text: t('messages.settingsSaved') });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: result.error || t('messages.saveFailed') });
      }
    } catch (_error) {
      setMessage({ type: 'error', text: t('messages.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTemplate = async () => {
    const suggestedName = templateName.trim()
      ? `${templateName.trim()} Copy`
      : t('templates.defaultTemplateName');
    const enteredName = window.prompt(t('templates.createPrompt'), suggestedName);
    if (enteredName === null) return;

    const newTemplateName = enteredName.trim();
    if (!newTemplateName) {
      setMessage({ type: 'error', text: t('messages.invalidTemplateName') });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/pdf-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName,
          description: templateDescription,
          contentSettings: normalizeContentSettings(contentSettings),
          layoutSettings: normalizeLayoutSettings(layoutSettings),
        }),
      });

      const result = await response.json();
      if (result.success && result.data) {
        const createdTemplate = normalizeTemplateRecord(result.data);
        if (createdTemplate) {
          setTemplates((prev) => [createdTemplate, ...prev]);
          setSelectedTemplateId(createdTemplate._id);
          applyTemplateToEditor(createdTemplate);
          setMessage({ type: 'success', text: t('messages.templateCreated') });
        } else {
          setMessage({ type: 'error', text: t('messages.createTemplateFailed') });
        }
      } else {
        setMessage({ type: 'error', text: result.error || t('messages.createTemplateFailed') });
      }
    } catch (error) {
      console.error('Error creating template:', error);
      setMessage({ type: 'error', text: t('messages.createTemplateFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleActivateTemplate = async () => {
    if (!selectedTemplateId) {
      setMessage({ type: 'error', text: t('messages.templateMissing') });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/pdf-templates/active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });
      const result = await response.json();

      if (result.success) {
        const activeTemplate = normalizeTemplateRecord(result.data);
        setTemplates((prev) =>
          prev.map((template) => {
            if (template._id === selectedTemplateId) {
              return activeTemplate ? { ...activeTemplate, isActive: true } : { ...template, isActive: true };
            }
            return { ...template, isActive: false };
          })
        );
        setMessage({ type: 'success', text: t('messages.templateActivated') });
      } else {
        setMessage({ type: 'error', text: result.error || t('messages.activateTemplateFailed') });
      }
    } catch (error) {
      console.error('Error activating template:', error);
      setMessage({ type: 'error', text: t('messages.activateTemplateFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    if (!selectedTemplateId) {
      setMessage({ type: 'error', text: t('messages.templateMissing') });
      return;
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      template: {
        name: templateName.trim() || 'Standard',
        description: templateDescription,
        contentSettings: normalizeContentSettings(contentSettings),
        layoutSettings: normalizeLayoutSettings(layoutSettings),
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = buildTemplateExportFilename(templateName);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadUrl);
    setMessage({ type: 'success', text: t('messages.templateDownloaded') });
  };

  const handleUploadTemplate = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setSaving(true);
    setMessage(null);
    try {
      const rawContent = await file.text();
      const parsedContent = JSON.parse(rawContent) as unknown;
      const sourceTemplate = isObject(parsedContent) && isObject(parsedContent.template) ? parsedContent.template : parsedContent;

      if (!isObject(sourceTemplate)) {
        throw new Error('Invalid template file');
      }

      const importedName =
        typeof sourceTemplate.name === 'string' && sourceTemplate.name.trim()
          ? sourceTemplate.name.trim()
          : file.name.replace(/\.[^/.]+$/, '') || t('templates.importedTemplateName');

      const response = await fetch('/api/pdf-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: importedName,
          description: typeof sourceTemplate.description === 'string' ? sourceTemplate.description : '',
          contentSettings: normalizeContentSettings(sourceTemplate.contentSettings),
          layoutSettings: normalizeLayoutSettings(sourceTemplate.layoutSettings),
        }),
      });

      const result = await response.json();
      if (result.success && result.data) {
        const createdTemplate = normalizeTemplateRecord(result.data);
        if (createdTemplate) {
          setTemplates((prev) => [createdTemplate, ...prev]);
          setSelectedTemplateId(createdTemplate._id);
          applyTemplateToEditor(createdTemplate);
          setMessage({ type: 'success', text: t('messages.templateUploaded') });
        } else {
          setMessage({ type: 'error', text: t('messages.uploadTemplateFailed') });
        }
      } else {
        setMessage({ type: 'error', text: result.error || t('messages.uploadTemplateFailed') });
      }
    } catch (error) {
      console.error('Error uploading template:', error);
      setMessage({ type: 'error', text: t('messages.uploadTemplateFailed') });
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

  const updateElementSize = (id: string, sizeUpdates: Partial<LayoutElement['size']>) => {
    setLayoutSettings(prev => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? { ...el, size: { ...el.size, ...sizeUpdates } } : el
      ),
    }));
  };

  const updateElementPosition = (id: string, positionUpdates: Partial<LayoutElement['position']>) => {
    setLayoutSettings(prev => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? { ...el, position: { ...el.position, ...positionUpdates } } : el
      ),
    }));
  };

  const updateElementStyle = (id: string, styleUpdates: Partial<LayoutElement['style']>) => {
    setLayoutSettings(prev => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? { ...el, style: { ...el.style, ...styleUpdates } } : el
      ),
    }));
  };

  const updateLayoutLogo = (
    updates: Omit<Partial<NonNullable<PdfLayoutSettings['logo']>>, 'position' | 'size'> & {
      position?: Partial<NonNullable<PdfLayoutSettings['logo']>['position']>;
      size?: Partial<NonNullable<PdfLayoutSettings['logo']>['size']>;
    }
  ) => {
    setLayoutSettings((prev) => {
      const baseLogo = prev.logo || {
        enabled: false,
        url: '',
        position: { x: 25, y: 25 },
        size: { width: 40, height: 15 },
        positionMode: 'absolute' as LayoutPositionMode,
        anchorX: 'left' as LayoutAnchorX,
        anchorY: 'top' as LayoutAnchorY,
      };

      return {
        ...prev,
        logo: {
          ...baseLogo,
          ...updates,
          position: {
            ...baseLogo.position,
            ...(updates.position || {}),
          },
          size: {
            ...baseLogo.size,
            ...(updates.size || {}),
          },
        },
      };
    });
  };

  const applyPositionPresetToElement = (id: string, presetId: string) => {
    const preset = HEADER_POSITION_PRESETS.find((entry) => entry.id === presetId);
    if (!preset) return;
    setLayoutSettings((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id
          ? {
              ...el,
              position: { ...el.position, x: 0, y: 0 },
              style: {
                ...el.style,
                positionMode: 'anchored',
                anchorX: preset.anchorX,
                anchorY: preset.anchorY,
              },
            }
          : el
      ),
    }));
  };

  const applyPositionPresetToLogo = (presetId: string) => {
    const preset = HEADER_POSITION_PRESETS.find((entry) => entry.id === presetId);
    if (!preset) return;
    setLayoutSettings((prev) => {
      const baseLogo = prev.logo || {
        enabled: false,
        url: '',
        position: { x: 25, y: 25 },
        size: { width: 40, height: 15 },
        positionMode: 'absolute' as LayoutPositionMode,
        anchorX: 'left' as LayoutAnchorX,
        anchorY: 'top' as LayoutAnchorY,
      };
      return {
        ...prev,
        logo: {
          ...baseLogo,
          enabled: true,
          positionMode: 'anchored',
          anchorX: preset.anchorX,
          anchorY: preset.anchorY,
          position: { ...baseLogo.position, x: 0, y: 0 },
        },
      };
    });
  };

  const updateContentSetting = <K extends keyof PdfSettings>(key: K, value: PdfSettings[K]) => {
    setContentSettings((prev) => ({ ...prev, [key]: value }));
  };

  const selectedTemplate = useMemo(
    () => templates.find((template) => template._id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );
  const uniqueLayoutElements = useMemo(() => {
    const seen = new Set<string>();
    return layoutSettings.elements.filter((element) => {
      if (!element?.id || seen.has(element.id)) return false;
      seen.add(element.id);
      return true;
    });
  }, [layoutSettings.elements]);
  const selectedEl = selectedElement ? uniqueLayoutElements.find((el) => el.id === selectedElement) : null;
  const selectedLogo = selectedElement === 'logo';
  const elementById = useMemo(() => {
    return new Map(uniqueLayoutElements.map((element) => [element.id, element] as const));
  }, [uniqueLayoutElements]);

  const safeNumber = (value: number | undefined, fallback: number) => {
    const numericValue = typeof value === 'number' ? value : Number.NaN;
    return Number.isFinite(numericValue) ? numericValue : fallback;
  };

  const defaultStyleByElementId: Record<string, LayoutElement['style']> = {
    'page-frame': {
      borderWidth: 0.3,
      borderColor: '#CBD5E1',
      backgroundColor: '#FFFFFF',
    },
    header: { borderWidth: 0.35, borderColor: '#94A3B8', backgroundColor: '#FFFFFF', padding: 0 },
    'protocol-title': {
      fontSize: 20,
      fontWeight: 'bold',
      alignment: 'left',
      color: '#334155',
      padding: 1,
      positionMode: 'absolute',
      anchorX: 'left',
      anchorY: 'top',
    },
    'protocol-title-top': {
      fontSize: 9,
      fontWeight: 'normal',
      alignment: 'left',
      color: '#6B7280',
      padding: 0.5,
      positionMode: 'absolute',
      anchorX: 'left',
      anchorY: 'top',
    },
    'protocol-title-bottom': {
      fontSize: 9,
      fontWeight: 'normal',
      alignment: 'left',
      color: '#111827',
      padding: 0.5,
      positionMode: 'absolute',
      anchorX: 'left',
      anchorY: 'top',
    },
    'info-box': {
      fontSize: 9,
      fontWeight: 'normal',
      color: '#1F2937',
      borderWidth: 0.5,
      borderColor: '#94A3B8',
      backgroundColor: '#FFFFFF',
      padding: 2,
    },
    'topic-title': {
      fontSize: 11,
      fontWeight: 'bold',
      alignment: 'left',
      color: '#111827',
      backgroundColor: '#F3F4F6',
      borderColor: '#CBD5E1',
      borderWidth: 0.5,
      padding: 2,
    },
    'item-label': {
      fontSize: 8,
      fontWeight: 'bold',
      alignment: 'center',
      color: '#FFFFFF',
      backgroundColor: '#3B82F6',
      borderColor: '#3B82F6',
      borderWidth: 0,
      padding: 1,
    },
    separator: {
      borderWidth: 0.3,
      borderColor: '#E6E6E6',
      backgroundColor: '#E6E6E6',
    },
    'global-notes-title': {
      fontSize: 11,
      fontWeight: 'bold',
      alignment: 'left',
      color: '#111827',
      backgroundColor: '#F3F4F6',
      borderColor: '#CBD5E1',
      borderWidth: 0.5,
      padding: 2,
    },
    'global-notes-body': {
      fontSize: 9,
      fontWeight: 'normal',
      color: '#1F2937',
      backgroundColor: '#FFFFFF',
      borderColor: '#CBD5E1',
      borderWidth: 0.5,
      padding: 3,
    },
    'reopening-history-title': {
      fontSize: 9,
      fontWeight: 'bold',
      alignment: 'left',
      color: '#78350F',
      backgroundColor: '#FFFBEB',
      borderColor: '#F59E0B',
      borderWidth: 0.5,
      padding: 2,
    },
    'reopening-history-body': {
      fontSize: 9,
      fontWeight: 'normal',
      color: '#1F2937',
      backgroundColor: '#FFFFFF',
      borderColor: '#F59E0B',
      borderWidth: 0.5,
      padding: 3,
    },
    footer: {
      fontSize: 8,
      fontWeight: 'normal',
      color: '#505050',
      borderColor: '#C8C8C8',
      borderWidth: 0.2,
      padding: 2,
    },
  };

  const selectedStyleDefaults = selectedEl ? (defaultStyleByElementId[selectedEl.id] || {}) : {};
  const selectedFontSize = safeNumber(selectedEl?.style.fontSize, safeNumber(selectedStyleDefaults.fontSize, 10));
  const selectedFontWeight = (selectedEl?.style.fontWeight || selectedStyleDefaults.fontWeight || 'normal') as
    | 'normal'
    | 'bold';
  const selectedAlignment = (selectedEl?.style.alignment || selectedStyleDefaults.alignment || 'left') as
    | 'left'
    | 'center'
    | 'right';
  const selectedTextColor = selectedEl?.style.color || selectedStyleDefaults.color || '#111827';
  const selectedBackgroundColor = selectedEl?.style.backgroundColor || selectedStyleDefaults.backgroundColor || '#FFFFFF';
  const selectedBorderColor = selectedEl?.style.borderColor || selectedStyleDefaults.borderColor || '#CBD5E1';
  const selectedBorderWidth = safeNumber(
    selectedEl?.style.borderWidth,
    safeNumber(selectedStyleDefaults.borderWidth, selectedEl?.id === 'separator' ? 0.3 : 0.5)
  );
  const selectedPadding = safeNumber(selectedEl?.style.padding, safeNumber(selectedStyleDefaults.padding, 0));
  const selectedSizeWidth = safeNumber(selectedEl?.size?.width, 60);
  const selectedSizeHeight = safeNumber(selectedEl?.size?.height, 8);
  const textStyleElementIds = new Set([
    'protocol-title',
    'protocol-title-top',
    'protocol-title-bottom',
    'info-box',
    'topic-title',
    'item-label',
    'global-notes-title',
    'global-notes-body',
    'reopening-history-title',
    'reopening-history-body',
    'footer',
  ]);
  const alignmentElementIds = new Set([
    'protocol-title',
    'protocol-title-top',
    'protocol-title-bottom',
    'topic-title',
    'item-label',
    'global-notes-title',
    'reopening-history-title',
  ]);
  const paddingElementIds = new Set([
    'header',
    'protocol-title',
    'protocol-title-top',
    'protocol-title-bottom',
    'info-box',
    'topic-title',
    'item-label',
    'global-notes-title',
    'global-notes-body',
    'reopening-history-title',
    'reopening-history-body',
    'footer',
  ]);
  const positionElementIds = new Set([
    'protocol-title',
    'protocol-title-top',
    'protocol-title-bottom',
  ]);
  const backgroundElementIds = new Set([
    'header',
    'protocol-title',
    'protocol-title-top',
    'protocol-title-bottom',
    'info-box',
    'topic-title',
    'item-label',
    'separator',
    'global-notes-title',
    'global-notes-body',
    'reopening-history-title',
    'reopening-history-body',
  ]);
  const selectedSupportsText = Boolean(selectedEl && textStyleElementIds.has(selectedEl.id));
  const selectedSupportsWeight = Boolean(selectedEl && textStyleElementIds.has(selectedEl.id));
  const selectedSupportsAlignment = Boolean(selectedEl && alignmentElementIds.has(selectedEl.id));
  const selectedSupportsPadding = Boolean(selectedEl && paddingElementIds.has(selectedEl.id));
  const selectedSupportsBackground = Boolean(selectedEl && backgroundElementIds.has(selectedEl.id));
  const selectedSupportsPosition = Boolean(selectedEl && positionElementIds.has(selectedEl.id));
  const selectedPositionX = safeNumber(selectedEl?.position?.x, 25);
  const selectedPositionY = safeNumber(selectedEl?.position?.y, 28);
  const selectedPositionMode = ((selectedEl?.style?.positionMode || selectedStyleDefaults.positionMode || 'absolute') as LayoutPositionMode);
  const selectedAnchorX = ((selectedEl?.style?.anchorX || selectedStyleDefaults.anchorX || 'left') as LayoutAnchorX);
  const selectedAnchorY = ((selectedEl?.style?.anchorY || selectedStyleDefaults.anchorY || 'top') as LayoutAnchorY);

  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const mmToX = (mm: number) => `${(mm / pageWidthMm) * 100}%`;
  const mmToY = (mm: number) => `${(mm / pageHeightMm) * 100}%`;
  const showAttendanceBoxInHeader = layoutSettings.metrics?.showAttendanceBox !== false;

  const marginTopMm = safeNumber(layoutSettings.pageMargins.top, 20);
  const marginRightMm = safeNumber(layoutSettings.pageMargins.right, 20);
  const marginBottomMm = safeNumber(layoutSettings.pageMargins.bottom, 20);
  const marginLeftMm = safeNumber(layoutSettings.pageMargins.left, 20);
  const contentWidthMm = pageWidthMm - marginLeftMm - marginRightMm;
  const attendanceWidthMm = showAttendanceBoxInHeader ? Math.max(60, safeNumber(layoutSettings.metrics?.attendanceWidth, 94)) : 0;
  const responsibleColumnWidthMm = Math.max(18, safeNumber(layoutSettings.metrics?.responsibleColumnWidth, 35));
  const pageFrameInsetMm = Math.max(0, safeNumber(layoutSettings.metrics?.pageFrameInset, 8));

  const pageFramePreviewEl = elementById.get('page-frame');
  const headerPreviewEl = elementById.get('header');
  const titleTopPreviewEl = elementById.get('protocol-title-top');
  const titlePreviewEl = elementById.get('protocol-title');
  const titleBottomPreviewEl = elementById.get('protocol-title-bottom');
  const infoPreviewEl = elementById.get('info-box');
  const topicPreviewEl = elementById.get('topic-title');
  const itemLabelPreviewEl = elementById.get('item-label');
  const separatorPreviewEl = elementById.get('separator');
  const footerPreviewEl = elementById.get('footer');
  const logoSettings = layoutSettings.logo || {
    enabled: false,
    url: '',
    position: { x: 25, y: 25 },
    size: { width: 40, height: 15 },
    positionMode: 'absolute' as LayoutPositionMode,
    anchorX: 'left' as LayoutAnchorX,
    anchorY: 'top' as LayoutAnchorY,
  };
  const logoPositionMode = (logoSettings.positionMode || 'absolute') as LayoutPositionMode;
  const logoAnchorX = (logoSettings.anchorX || 'left') as LayoutAnchorX;
  const logoAnchorY = (logoSettings.anchorY || 'top') as LayoutAnchorY;

  const pageFrameEnabled = pageFramePreviewEl?.enabled !== false;
  const headerEnabled = headerPreviewEl?.enabled !== false;
  const titleTopEnabled = titleTopPreviewEl?.enabled !== false;
  const titleMainEnabled = titlePreviewEl?.enabled !== false;
  const titleBottomEnabled = titleBottomPreviewEl?.enabled !== false;
  const infoEnabled = infoPreviewEl?.enabled !== false;
  const topicEnabled = topicPreviewEl?.enabled !== false;
  const itemLabelEnabled = itemLabelPreviewEl?.enabled !== false;
  const separatorEnabled = separatorPreviewEl?.enabled !== false;
  const footerEnabled = footerPreviewEl?.enabled !== false && contentSettings.showFooter;
  const logoSourceUrl = contentSettings.logoUrl || '';
  const logoVisible = contentSettings.showLogo && Boolean(logoSourceUrl);
  const logoCustomPlacementEnabled = logoSettings.enabled === true;

  const previewAttendanceRows = 3;
  const previewLegendRows = 1;
  const previewGuestsRows = 0;
  const previewAttendanceFontPt = Math.max(6, safeNumber(layoutSettings.metrics?.attendanceFontSize, 8));
  const previewLegendFontPt = Math.max(4, safeNumber(layoutSettings.metrics?.attendanceLegendFontSize, 6));
  const previewAttendanceLineMm = Math.max(3.8, previewAttendanceFontPt * 0.52);
  const previewLegendLineMm = Math.max(3, previewLegendFontPt * 0.58);
  const previewAttendanceContentHeightMm =
    showAttendanceBoxInHeader
      ? 18 + previewAttendanceRows * previewAttendanceLineMm + previewGuestsRows * 4 + 2 + previewLegendRows * previewLegendLineMm + 4
      : 0;
  const previewTitleTopFontPt = safeNumber(titleTopPreviewEl?.style?.fontSize, 9);
  const previewTitleMainFontPt = safeNumber(titlePreviewEl?.style?.fontSize, 20);
  const previewTitleBottomFontPt = safeNumber(titleBottomPreviewEl?.style?.fontSize, 9);
  const previewTitlePaddingMm = Math.max(0, safeNumber(titlePreviewEl?.style?.padding, 1));
  const previewTitleTopMm = titleTopEnabled ? Math.max(3, previewTitleTopFontPt * 0.3528) + 0.8 : 0;
  const previewTitleMainMm = titleMainEnabled ? Math.max(6, previewTitleMainFontPt * 0.3528) + 1 : 0;
  const previewTitleBottomMm = titleBottomEnabled ? Math.max(3, previewTitleBottomFontPt * 0.3528) + 0.8 : 0;
  const previewTitleTextHeightMm =
    previewTitlePaddingMm * 2 + previewTitleTopMm + previewTitleMainMm + previewTitleBottomMm;
  const headerTopMm = marginTopMm;
  const attendanceDividerMm = pageWidthMm - marginRightMm - attendanceWidthMm;
  const titleAreaLeftMm = marginLeftMm + 5;
  const titleAreaRightMm = attendanceDividerMm - 4;
  const titleAreaWidthMm = Math.max(20, titleAreaRightMm - titleAreaLeftMm);
  const maxTitleWidthMm = Math.max(20, titleAreaWidthMm);
  const titleTopWidthMm = Math.max(20, Math.min(maxTitleWidthMm, safeNumber(titleTopPreviewEl?.size?.width, maxTitleWidthMm)));
  const titleMainWidthMm = Math.max(20, Math.min(maxTitleWidthMm, safeNumber(titlePreviewEl?.size?.width, maxTitleWidthMm)));
  const titleBottomWidthMm = Math.max(20, Math.min(maxTitleWidthMm, safeNumber(titleBottomPreviewEl?.size?.width, maxTitleWidthMm)));
  const configuredHeaderMinHeightMm = safeNumber(headerPreviewEl?.size?.height, 24);
  const baseHeaderHeightMm = Math.max(24, configuredHeaderMinHeightMm, previewAttendanceContentHeightMm);

  const resolveAnchoredX = (
    anchorX: LayoutAnchorX,
    offsetX: number,
    widthMm: number,
    areaLeftMm: number,
    areaWidthMm: number
  ): number => {
    if (anchorX === 'center') return areaLeftMm + (areaWidthMm - widthMm) / 2 + offsetX;
    if (anchorX === 'right') return areaLeftMm + areaWidthMm - widthMm + offsetX;
    return areaLeftMm + offsetX;
  };

  const resolveTitlePlacement = (
    element: LayoutElement | undefined,
    widthMm: number,
    fallbackBaselineYMm: number,
    currentHeaderHeightMm: number
  ) => {
    const mode = ((element?.style?.positionMode || 'absolute') as LayoutPositionMode);
    const anchorX = ((element?.style?.anchorX || 'left') as LayoutAnchorX);
    const anchorY = ((element?.style?.anchorY || 'top') as LayoutAnchorY);
    const rawX = safeNumber(element?.position?.x, titleAreaLeftMm);
    const rawY = safeNumber(element?.position?.y, fallbackBaselineYMm);

    if (mode === 'anchored') {
      const anchoredX = resolveAnchoredX(anchorX, rawX, widthMm, titleAreaLeftMm, titleAreaWidthMm);
      const topBaselineMm = headerTopMm + 8 + rawY;
      const centerBaselineMm = headerTopMm + currentHeaderHeightMm / 2 + rawY;
      const bottomBaselineMm = headerTopMm + currentHeaderHeightMm - 4 + rawY;
      const baselineY =
        anchorY === 'center' ? centerBaselineMm : anchorY === 'bottom' ? bottomBaselineMm : topBaselineMm;
      return { xMm: anchoredX, baselineYMm: baselineY };
    }

    return { xMm: rawX, baselineYMm: rawY };
  };

  const leftSectionWidthMm = Math.max(20, contentWidthMm - attendanceWidthMm);
  const logoAreaLeftMm = marginLeftMm + 3;
  const logoAreaWidthMm = Math.max(20, leftSectionWidthMm - 6);
  const logoWmm = Math.max(1, safeNumber(logoSettings.size?.width, 40));
  const logoHmm = Math.max(1, safeNumber(logoSettings.size?.height, 15));
  const flowLogoWidthMm = 26;
  const flowLogoHeightMm = 12;

  const resolveCustomLogoPlacement = (currentHeaderHeightMm: number) => {
    const mode = logoPositionMode;
    const rawX = safeNumber(logoSettings.position?.x, 25);
    const rawY = safeNumber(logoSettings.position?.y, 25);
    if (mode === 'anchored') {
      const xMm = resolveAnchoredX(logoAnchorX, rawX, logoWmm, logoAreaLeftMm, logoAreaWidthMm);
      const yMm =
        logoAnchorY === 'center'
          ? headerTopMm + (currentHeaderHeightMm - logoHmm) / 2 + rawY
          : logoAnchorY === 'bottom'
            ? headerTopMm + currentHeaderHeightMm - logoHmm - 4 + rawY
            : headerTopMm + 4 + rawY;
      return { xMm, yMm };
    }
    return { xMm: rawX, yMm: rawY };
  };

  const computeHeaderPreviewLayout = (currentHeaderHeightMm: number) => {
    const top = resolveTitlePlacement(titleTopPreviewEl, titleTopWidthMm, headerTopMm + 8, currentHeaderHeightMm);
    const main = resolveTitlePlacement(titlePreviewEl, titleMainWidthMm, headerTopMm + 14, currentHeaderHeightMm);
    const bottom = resolveTitlePlacement(titleBottomPreviewEl, titleBottomWidthMm, headerTopMm + 20, currentHeaderHeightMm);
    const previewManualTitleBottomMm = Math.max(
      titleTopEnabled ? (top.baselineYMm + previewTitleTopMm * 0.25) : 0,
      titleMainEnabled ? (main.baselineYMm + previewTitleMainMm * 0.25) : 0,
      titleBottomEnabled ? (bottom.baselineYMm + previewTitleBottomMm * 0.25) : 0
    );
    const previewLogoFlowReserveMm = logoVisible && !logoCustomPlacementEnabled ? 12 + 6 : 0;
    const previewTitleContentHeightMm = Math.max(
      8 + previewLogoFlowReserveMm + previewTitleTextHeightMm,
      (previewManualTitleBottomMm > 0 ? previewManualTitleBottomMm - headerTopMm : 0) + 4
    );
    const customLogoPlacement = logoCustomPlacementEnabled
      ? resolveCustomLogoPlacement(currentHeaderHeightMm)
      : null;
    const logoBottomMm =
      logoVisible
        ? logoCustomPlacementEnabled
          ? (customLogoPlacement?.yMm ?? headerTopMm) + logoHmm
          : headerTopMm + 4 + flowLogoHeightMm
        : headerTopMm;
    const previewLogoContentHeightMm = Math.max(0, logoBottomMm - headerTopMm + 4);
    const contentHeightMm = Math.max(previewTitleContentHeightMm, previewLogoContentHeightMm);

    return {
      titleTopXMm: top.xMm,
      titleMainXMm: main.xMm,
      titleBottomXMm: bottom.xMm,
      titleTopBaselineYMm: top.baselineYMm,
      titleMainBaselineYMm: main.baselineYMm,
      titleBottomBaselineYMm: bottom.baselineYMm,
      contentHeightMm,
      customLogoPlacement,
    };
  };

  let headerHeightMm = baseHeaderHeightMm;
  let headerPreviewLayout = computeHeaderPreviewLayout(headerHeightMm);
  headerHeightMm = Math.max(baseHeaderHeightMm, headerPreviewLayout.contentHeightMm);
  headerPreviewLayout = computeHeaderPreviewLayout(headerHeightMm);
  headerHeightMm = Math.max(baseHeaderHeightMm, headerPreviewLayout.contentHeightMm);

  const titleTopXmm = headerPreviewLayout.titleTopXMm;
  const titleMainXmm = headerPreviewLayout.titleMainXMm;
  const titleBottomXmm = headerPreviewLayout.titleBottomXMm;
  const titleTopBaselineYmm = headerPreviewLayout.titleTopBaselineYMm;
  const titleMainBaselineYmm = headerPreviewLayout.titleMainBaselineYMm;
  const titleBottomBaselineYmm = headerPreviewLayout.titleBottomBaselineYMm;
  const titleTopTopMm = titleTopBaselineYmm - previewTitleTopMm * 0.78;
  const titleMainTopMm = titleMainBaselineYmm - previewTitleMainMm * 0.78;
  const titleBottomTopMm = titleBottomBaselineYmm - previewTitleBottomMm * 0.78;
  const titleTopHeightMm = Math.max(3, previewTitleTopMm + 1.2);
  const titleMainHeightMm = Math.max(4, previewTitleMainMm + 1.4);
  const titleBottomHeightMm = Math.max(3, previewTitleBottomMm + 1.2);
  const infoHeightMm = safeNumber(infoPreviewEl?.size?.height, 15);
  const topicHeightMm = topicEnabled ? safeNumber(topicPreviewEl?.size?.height, 10) : 6;
  const sectionSpacingMm = safeNumber(layoutSettings.sectionSpacing, 5);
  const itemSpacingMm = safeNumber(layoutSettings.itemSpacing, 5);
  const itemLabelWidthMm = itemLabelEnabled ? safeNumber(itemLabelPreviewEl?.size?.width, 12) : 0;
  const itemLabelHeightMm = itemLabelEnabled ? Math.max(3, safeNumber(itemLabelPreviewEl?.size?.height, 5.5)) : 0;
  const titleTopFontWeight = titleTopPreviewEl?.style?.fontWeight === 'bold' ? 700 : 500;
  const titleFontWeight = titlePreviewEl?.style?.fontWeight === 'bold' ? 700 : 500;
  const titleBottomFontWeight = titleBottomPreviewEl?.style?.fontWeight === 'bold' ? 700 : 500;
  const titleTopTextColor = titleTopPreviewEl?.style?.color || '#6B7280';
  const titleTextColor = titlePreviewEl?.style?.color || '#334155';
  const titleBottomTextColor = titleBottomPreviewEl?.style?.color || '#111827';
  const previewTopTitleText = contentSettings.companyName.trim() || 'Turnverein St.Georgen';
  const previewMainTitleText =
    (contentSettings.showHeader && contentSettings.headerText.trim()) ? contentSettings.headerText.trim() : 'Protokoll';
  const previewBottomTitleText = 'Hauptversammlung – 2026';
  const topicAlignment = (topicPreviewEl?.style?.alignment || 'left') as 'left' | 'center' | 'right';
  const topicJustify = topicAlignment === 'left' ? 'flex-start' : topicAlignment === 'right' ? 'flex-end' : 'center';
  const topicFontWeight = topicPreviewEl?.style?.fontWeight === 'normal' ? 500 : 700;
  const topicPaddingPx = Math.max(2, safeNumber(topicPreviewEl?.style?.padding, 2) * 2);
  const topicTextColor = topicPreviewEl?.style?.color || '#111827';
  const topicBorderColor = topicPreviewEl?.style?.borderColor || '#CBD5E1';
  const itemLabelBackground = itemLabelPreviewEl?.style?.backgroundColor || layoutSettings.labelColors.info;
  const itemLabelColor = itemLabelPreviewEl?.style?.color || '#FFFFFF';
  const itemLabelFontWeight = itemLabelPreviewEl?.style?.fontWeight === 'normal' ? 500 : 700;
  const itemLabelFontSizePx = Math.max(6, safeNumber(itemLabelPreviewEl?.style?.fontSize, 8) / 1.4);
  const itemLabelAlignment = (itemLabelPreviewEl?.style?.alignment || 'center') as 'left' | 'center' | 'right';
  const itemLabelJustify =
    itemLabelAlignment === 'left' ? 'flex-start' : itemLabelAlignment === 'right' ? 'flex-end' : 'center';
  const separatorWidthPx = Math.max(
    1,
    safeNumber(separatorPreviewEl?.style?.borderWidth, safeNumber(separatorPreviewEl?.size?.height, 0.3))
  );
  const separatorColor = separatorPreviewEl?.style?.borderColor || separatorPreviewEl?.style?.backgroundColor || '#E6E6E6';

  let flowYMm = marginTopMm;
  if (headerEnabled) flowYMm += headerHeightMm + 4;
  const infoTopMm = flowYMm;
  flowYMm += infoEnabled ? infoHeightMm + sectionSpacingMm : sectionSpacingMm;
  const topicTopMm = flowYMm;
  const itemStartMm = topicTopMm + topicHeightMm + itemSpacingMm;
  const itemContentStartMm = marginLeftMm + (itemLabelEnabled ? itemLabelWidthMm + 6 : 4);
  const separatorYMm = itemStartMm + 12;

  let flowLogoXmm = logoAreaLeftMm;
  if (contentSettings.logoPosition === 'center') {
    flowLogoXmm = logoAreaLeftMm + (logoAreaWidthMm - flowLogoWidthMm) / 2;
  } else if (contentSettings.logoPosition === 'right') {
    flowLogoXmm = logoAreaLeftMm + logoAreaWidthMm - flowLogoWidthMm;
  }
  const flowLogoYmm = headerTopMm + 4;
  const customPreviewLogoPlacement = headerPreviewLayout.customLogoPlacement || resolveCustomLogoPlacement(headerHeightMm);
  const previewLogoXmm = logoCustomPlacementEnabled ? customPreviewLogoPlacement.xMm : flowLogoXmm;
  const previewLogoYmm = logoCustomPlacementEnabled ? customPreviewLogoPlacement.yMm : flowLogoYmm;
  const previewLogoWmm = logoCustomPlacementEnabled ? logoWmm : flowLogoWidthMm;
  const previewLogoHmm = logoCustomPlacementEnabled ? logoHmm : flowLogoHeightMm;
  const toHeaderX = (mm: number) => `${contentWidthMm > 0 ? ((mm - marginLeftMm) / contentWidthMm) * 100 : 0}%`;
  const toHeaderY = (mm: number) => `${headerHeightMm > 0 ? ((mm - headerTopMm) / headerHeightMm) * 100 : 0}%`;
  const toHeaderW = (mm: number) => `${contentWidthMm > 0 ? (mm / contentWidthMm) * 100 : 0}%`;
  const toHeaderH = (mm: number) => `${headerHeightMm > 0 ? (mm / headerHeightMm) * 100 : 0}%`;
  const maxSeparatorWidthMm = Math.max(
    20,
    contentWidthMm - (itemContentStartMm - marginLeftMm) - 4 - Math.min(20, responsibleColumnWidthMm * 0.15)
  );
  const separatorWidthMm = Math.max(
    20,
    Math.min(maxSeparatorWidthMm, safeNumber(separatorPreviewEl?.size?.width, maxSeparatorWidthMm))
  );
  const footerPaddingMm = Math.max(1, safeNumber(footerPreviewEl?.style?.padding, 2));
  const footerTextYmm = pageHeightMm - Math.max(8, marginBottomMm - footerPaddingMm);
  const footerLineYmm = footerTextYmm - Math.max(3, safeNumber(footerPreviewEl?.size?.height, 8) * 0.6);
  const footerLineWidthPx = Math.max(1, safeNumber(footerPreviewEl?.style?.borderWidth, 0.2));
  const footerLineColor = footerPreviewEl?.style?.borderColor || '#C8C8C8';
  const footerTextColor = footerPreviewEl?.style?.color || '#505050';
  const footerFontSizePx = Math.max(6, safeNumber(footerPreviewEl?.style?.fontSize, 8) / 1.6);

  const previewIsSelected = (id: string) => selectedElement === id;
  const previewBoxClass = (id: string) =>
    `absolute transition-all cursor-pointer ${previewIsSelected(id) ? 'ring-2 ring-[var(--brand-primary)] ring-offset-1 z-20' : 'z-10 hover:ring-1 hover:ring-[var(--brand-primary)]'}`;

  if (loading) {
    return (
      <div className="min-h-screen brand-page-gradient brandize-admin flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen brand-page-gradient brandize-admin py-8 px-4">
      {/* Success/Error Message Toast - Fixed at top */}
      {message && (
        <div className="fixed top-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 animate-in slide-in-from-top">
          <div className={`px-4 sm:px-6 py-4 rounded-xl shadow-2xl flex items-start gap-3 w-[min(92vw,28rem)] min-w-0 ${
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
              className="text-white hover:text-gray-200 transition-colors min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg"
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
              <p className="text-gray-600 mt-2">{t('subtitle')}</p>
            </div>
            <Link
              href="/admin/settings"
              className="w-full sm:w-auto px-4 py-2 min-h-11 text-gray-600 hover:text-gray-900 transition-colors inline-flex items-center justify-center"
            >
              {t('back')}
            </Link>
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">{t('templates.title')}</h2>
              {selectedTemplate?.isActive && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  {t('templates.activeBadge')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('templates.selectLabel')}</label>
                <select
                  value={selectedTemplateId}
                  onChange={handleTemplateChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)]"
                >
                  {templates.length === 0 ? (
                    <option value="">{t('templates.empty')}</option>
                  ) : (
                    templates.map((template) => (
                      <option key={template._id} value={template._id}>
                        {template.name}{template.isActive ? ` (${t('templates.activeShort')})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('templates.nameLabel')}</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder={t('templates.namePlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('templates.descriptionLabel')}</label>
              <input
                type="text"
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                placeholder={t('templates.descriptionPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleActivateTemplate}
                disabled={saving || !selectedTemplateId || selectedTemplate?.isActive}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('templates.activateButton')}
              </button>
              <button
                type="button"
                onClick={handleCreateTemplate}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('templates.createButton')}
              </button>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={saving || !selectedTemplateId}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('templates.downloadButton')}
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('templates.uploadButton')}
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleUploadTemplate}
                className="hidden"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 sm:gap-4 mt-6 border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('content')}
              className={`shrink-0 pb-3 px-3 sm:px-4 font-semibold transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'content'
                  ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('tabs.content')}
            </button>
            <button
              onClick={() => setActiveTab('layout')}
              className={`shrink-0 pb-3 px-3 sm:px-4 font-semibold transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'layout'
                  ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('tabs.layout')}
            </button>
          </div>
        </div>

        {/* Content Tab */}
        {activeTab === 'content' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-lg p-5 border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('content.branding.title')}
              </h2>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 h-10">
                    <input
                      type="checkbox"
                      checked={contentSettings.showLogo}
                      onChange={(e) => setContentSettings({ ...contentSettings, showLogo: e.target.checked })}
                      className="w-4 h-4 text-[var(--brand-primary)] rounded"
                    />
                    {t('content.branding.showLogo')}
                  </label>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('content.branding.companyName')}</label>
                    <input
                      type="text"
                      value={contentSettings.companyName}
                      onChange={(e) => setContentSettings({ ...contentSettings, companyName: e.target.value })}
                      placeholder={t('content.branding.companyNamePlaceholder')}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)]"
                    />
                  </div>
                </div>

                {contentSettings.showLogo && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t('content.branding.uploadLogo')}</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="block w-full text-xs text-gray-500
                          file:mr-3 file:py-1.5 file:px-3
                          file:rounded-full file:border-0
                          file:text-xs file:font-semibold
                          file:bg-[var(--brand-primary-soft)] file:text-[var(--brand-primary-strong)]
                          hover:file:brightness-95"
                      />
                    </div>
                    {contentSettings.logoUrl && (
                      <div className="p-2 border border-gray-200 rounded bg-white inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={contentSettings.logoUrl} alt={t('content.branding.logoPreview')} className="h-12 object-contain" />
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('content.branding.logoUrl')}</label>
                        <input
                          type="url"
                          value={contentSettings.logoUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/')) {
                              setContentSettings({ ...contentSettings, logoUrl: val });
                            }
                          }}
                          placeholder="https://..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('content.branding.logoPosition')}</label>
                        <select
                          value={contentSettings.logoPosition}
                          onChange={(e) => setContentSettings({ ...contentSettings, logoPosition: e.target.value as any })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)]"
                        >
                          <option value="left">{t('content.branding.positions.left')}</option>
                          <option value="center">{t('content.branding.positions.center')}</option>
                          <option value="right">{t('content.branding.positions.right')}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-gray-200">
                <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t('content.headerFooter.title')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 h-10">
                    <input
                      type="checkbox"
                      checked={contentSettings.showHeader}
                      onChange={(e) => setContentSettings({ ...contentSettings, showHeader: e.target.checked })}
                      className="w-4 h-4 text-[var(--brand-primary)] rounded"
                    />
                    {t('content.headerFooter.showHeader')}
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 h-10">
                    <input
                      type="checkbox"
                      checked={contentSettings.showFooter}
                      onChange={(e) => setContentSettings({ ...contentSettings, showFooter: e.target.checked })}
                      className="w-4 h-4 text-[var(--brand-primary)] rounded"
                    />
                    {t('content.headerFooter.showFooter')}
                  </label>
                </div>

                {contentSettings.showHeader && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('content.headerFooter.headerText')}</label>
                    <input
                      type="text"
                      value={contentSettings.headerText}
                      onChange={(e) => setContentSettings({ ...contentSettings, headerText: e.target.value })}
                      placeholder={t('content.headerFooter.headerTextPlaceholder')}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)]"
                    />
                  </div>
                )}

                {contentSettings.showFooter && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t('content.headerFooter.footerLeftText')}</label>
                      <input
                        type="text"
                        value={contentSettings.footerLeftText || ''}
                        onChange={(e) => setContentSettings({ ...contentSettings, footerLeftText: e.target.value })}
                        placeholder={t('content.headerFooter.footerLeftTextPlaceholder')}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t('content.headerFooter.footerText')}</label>
                      <input
                        type="text"
                        value={contentSettings.footerText}
                        onChange={(e) => setContentSettings({ ...contentSettings, footerText: e.target.value })}
                        placeholder={t('content.headerFooter.footerTextPlaceholder')}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)]"
                      />
                    </div>
                    <label className="sm:col-span-2 flex items-center gap-2 text-sm font-medium text-gray-700 h-10">
                      <input
                        type="checkbox"
                        checked={contentSettings.showPageNumbers}
                        onChange={(e) => setContentSettings({ ...contentSettings, showPageNumbers: e.target.checked })}
                        className="w-4 h-4 text-[var(--brand-primary)] rounded"
                      />
                      {t('content.headerFooter.showPageNumbers')}
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-5 border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {t('content.options.title')}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 h-10">
                  <input
                    type="checkbox"
                    checked={contentSettings.includeResponsibles}
                    onChange={(e) => setContentSettings({ ...contentSettings, includeResponsibles: e.target.checked })}
                    className="w-4 h-4 text-[var(--brand-primary)] rounded"
                  />
                  {t('content.options.responsibles')}
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 h-10">
                  <input
                    type="checkbox"
                    checked={contentSettings.includeStatusBadges}
                    onChange={(e) => setContentSettings({ ...contentSettings, includeStatusBadges: e.target.checked })}
                    className="w-4 h-4 text-[var(--brand-primary)] rounded"
                  />
                  {t('content.options.statusBadges')}
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 h-10">
                  <input
                    type="checkbox"
                    checked={contentSettings.includePriorityBadges}
                    onChange={(e) => setContentSettings({ ...contentSettings, includePriorityBadges: e.target.checked })}
                    className="w-4 h-4 text-[var(--brand-primary)] rounded"
                  />
                  {t('content.options.priorityBadges')}
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 h-10">
                  <input
                    type="checkbox"
                    checked={contentSettings.includeNotes}
                    onChange={(e) => setContentSettings({ ...contentSettings, includeNotes: e.target.checked })}
                    className="w-4 h-4 text-[var(--brand-primary)] rounded"
                  />
                  {t('content.options.notes')}
                </label>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-200">
                <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  {t('content.style.title')}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('content.style.primaryColor')}</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={contentSettings.primaryColor}
                        onChange={(e) => setContentSettings({ ...contentSettings, primaryColor: e.target.value })}
                        className="w-12 h-9 rounded border border-gray-300"
                      />
                      <input
                        type="text"
                        value={contentSettings.primaryColor}
                        onChange={(e) => setContentSettings({ ...contentSettings, primaryColor: e.target.value })}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('content.style.secondaryColor')}</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={contentSettings.secondaryColor}
                        onChange={(e) => setContentSettings({ ...contentSettings, secondaryColor: e.target.value })}
                        className="w-12 h-9 rounded border border-gray-300"
                      />
                      <input
                        type="text"
                        value={contentSettings.secondaryColor}
                        onChange={(e) => setContentSettings({ ...contentSettings, secondaryColor: e.target.value })}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('content.style.fontFamily')}</label>
                    <select
                      value={contentSettings.fontFamily}
                      onChange={(e) => setContentSettings({ ...contentSettings, fontFamily: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)]"
                    >
                      <option value="helvetica">Helvetica</option>
                      <option value="times">Times New Roman</option>
                      <option value="courier">Courier</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('content.style.fontSize')}</label>
                    <input
                      type="number"
                      min="8"
                      max="16"
                      value={contentSettings.fontSize}
                      onChange={(e) => setContentSettings({ ...contentSettings, fontSize: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)]"
                    />
                  </div>
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
                  {uniqueLayoutElements.map((element) => (
                    <div
                      key={element.id}
                      onClick={() => setSelectedElement(element.id)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedElement === element.id
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]'
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

                  <div
                    onClick={() => setSelectedElement('logo')}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedElement === 'logo'
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={contentSettings.showLogo}
                          onChange={(e) => updateContentSetting('showLogo', e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4"
                        />
                        <span className="font-medium text-sm">{t('layout.elementLabels.logo')}</span>
                      </div>
                      <span className="text-xs text-gray-500">logo</span>
                    </div>
                  </div>
                </div>

                {/* Global Settings */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="font-bold text-gray-800 mb-3">{t('layout.globalSettings.title')}</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('layout.globalSettings.margins')}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('layout.globalSettings.generatorMetrics')}
                      </label>
                      <label className="mb-2 flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={layoutSettings.metrics.showAttendanceBox}
                          onChange={(e) =>
                            setLayoutSettings((prev) => ({
                              ...prev,
                              metrics: {
                                ...prev.metrics,
                                showAttendanceBox: e.target.checked,
                              },
                            }))
                          }
                          className="w-4 h-4"
                        />
                        {t('layout.globalSettings.showAttendanceBox')}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1 leading-tight">
                            {t('layout.globalSettings.attendanceWidth')}
                          </label>
                          <input
                            type="number"
                            value={layoutSettings.metrics.attendanceWidth}
                            onChange={(e) =>
                              setLayoutSettings((prev) => ({
                                ...prev,
                                metrics: {
                                  ...prev.metrics,
                                  attendanceWidth: Number(e.target.value),
                                },
                              }))
                            }
                            disabled={!layoutSettings.metrics.showAttendanceBox}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm ${
                              !layoutSettings.metrics.showAttendanceBox ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1 leading-tight">
                            {t('layout.globalSettings.responsibleColumnWidth')}
                          </label>
                          <input
                            type="number"
                            value={layoutSettings.metrics.responsibleColumnWidth}
                            onChange={(e) =>
                              setLayoutSettings((prev) => ({
                                ...prev,
                                metrics: {
                                  ...prev.metrics,
                                  responsibleColumnWidth: Number(e.target.value),
                                },
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1 leading-tight">
                            {t('layout.globalSettings.pageFrameInset')}
                          </label>
                          <input
                            type="number"
                            value={layoutSettings.metrics.pageFrameInset}
                            onChange={(e) =>
                              setLayoutSettings((prev) => ({
                                ...prev,
                                metrics: {
                                  ...prev.metrics,
                                  pageFrameInset: Number(e.target.value),
                                },
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1 leading-tight">
                            {t('layout.globalSettings.attendanceFontSize')}
                          </label>
                          <input
                            type="number"
                            value={layoutSettings.metrics.attendanceFontSize}
                            onChange={(e) =>
                              setLayoutSettings((prev) => ({
                                ...prev,
                                metrics: {
                                  ...prev.metrics,
                                  attendanceFontSize: Number(e.target.value),
                                },
                              }))
                            }
                            disabled={!layoutSettings.metrics.showAttendanceBox}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm ${
                              !layoutSettings.metrics.showAttendanceBox ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                            }`}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-gray-600 mb-1 leading-tight">
                            {t('layout.globalSettings.attendanceLegendFontSize')}
                          </label>
                          <input
                            type="number"
                            value={layoutSettings.metrics.attendanceLegendFontSize}
                            onChange={(e) =>
                              setLayoutSettings((prev) => ({
                                ...prev,
                                metrics: {
                                  ...prev.metrics,
                                  attendanceLegendFontSize: Number(e.target.value),
                                },
                              }))
                            }
                            disabled={!layoutSettings.metrics.showAttendanceBox}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm ${
                              !layoutSettings.metrics.showAttendanceBox ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                            }`}
                          />
                        </div>
                      </div>
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
                  {selectedEl ? selectedEl.label : selectedLogo ? t('layout.elementLabels.logo') : t('layout.properties.title')}
                </h2>
                
                {selectedEl || selectedLogo ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                      {t('layout.properties.flowNote')}
                    </div>

                    {selectedEl && (
                      <>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={selectedEl.enabled}
                            onChange={(e) => updateElement(selectedEl.id, { enabled: e.target.checked })}
                            className="w-4 h-4"
                          />
                          {t('layout.properties.enabled')}
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.width')} (mm)</label>
                            <input
                              type="number"
                              value={selectedSizeWidth}
                              onChange={(e) => updateElementSize(selectedEl.id, { width: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.height')} (mm)</label>
                            <input
                              type="number"
                              value={selectedSizeHeight}
                              onChange={(e) => updateElementSize(selectedEl.id, { height: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                        </div>

                        {selectedEl.id === 'header' && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                            {t('layout.properties.headerAutoHeightHint')}
                          </div>
                        )}

                        {selectedSupportsPosition && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.positionPreset')}</label>
                              <select
                                value={elementPresetSelection}
                                onChange={(e) => {
                                  const presetId = e.target.value;
                                  setElementPresetSelection(presetId);
                                  if (presetId) {
                                    applyPositionPresetToElement(selectedEl.id, presetId);
                                    setElementPresetSelection('');
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              >
                                <option value="">{t('layout.properties.selectPreset')}</option>
                                {HEADER_POSITION_PRESETS.map((preset) => (
                                  <option key={preset.id} value={preset.id}>
                                    {t(preset.labelKey)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.positionMode')}</label>
                                <select
                                  value={selectedPositionMode}
                                  onChange={(e) =>
                                    updateElementStyle(selectedEl.id, { positionMode: e.target.value as LayoutPositionMode })
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                  <option value="absolute">{t('layout.properties.positionModeAbsolute')}</option>
                                  <option value="anchored">{t('layout.properties.positionModeAnchored')}</option>
                                </select>
                              </div>

                              {selectedPositionMode === 'anchored' && (
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.anchorX')}</label>
                                  <select
                                    value={selectedAnchorX}
                                    onChange={(e) =>
                                      updateElementStyle(selectedEl.id, { anchorX: e.target.value as LayoutAnchorX })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                  >
                                    <option value="left">{t('content.branding.positions.left')}</option>
                                    <option value="center">{t('content.branding.positions.center')}</option>
                                    <option value="right">{t('content.branding.positions.right')}</option>
                                  </select>
                                </div>
                              )}
                            </div>

                            {selectedPositionMode === 'anchored' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.anchorY')}</label>
                                  <select
                                    value={selectedAnchorY}
                                    onChange={(e) =>
                                      updateElementStyle(selectedEl.id, { anchorY: e.target.value as LayoutAnchorY })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                  >
                                    <option value="top">{t('layout.properties.anchorTop')}</option>
                                    <option value="center">{t('layout.properties.anchorCenter')}</option>
                                    <option value="bottom">{t('layout.properties.anchorBottom')}</option>
                                  </select>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">
                                  {selectedPositionMode === 'anchored' ? t('layout.properties.offsetX') : t('layout.properties.x')} (mm)
                                </label>
                                <input
                                  type="number"
                                  value={selectedPositionX}
                                  onChange={(e) => updateElementPosition(selectedEl.id, { x: Number(e.target.value) })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">
                                  {selectedPositionMode === 'anchored' ? t('layout.properties.offsetY') : t('layout.properties.y')} (mm)
                                </label>
                                <input
                                  type="number"
                                  value={selectedPositionY}
                                  onChange={(e) => updateElementPosition(selectedEl.id, { y: Number(e.target.value) })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedSupportsText && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.fontSize')} (pt)</label>
                              <input
                                type="number"
                                value={selectedFontSize}
                                onChange={(e) => updateElementStyle(selectedEl.id, { fontSize: Number(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                            {selectedSupportsAlignment && (
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.titleAlignment')}</label>
                                <select
                                  value={selectedAlignment}
                                  onChange={(e) =>
                                    updateElementStyle(selectedEl.id, { alignment: e.target.value as 'left' | 'center' | 'right' })
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                  <option value="left">{t('content.branding.positions.left')}</option>
                                  <option value="center">{t('content.branding.positions.center')}</option>
                                  <option value="right">{t('content.branding.positions.right')}</option>
                                </select>
                              </div>
                            )}
                          </div>
                        )}

                        {(selectedSupportsWeight || selectedSupportsPadding) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedSupportsWeight && (
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.fontWeight')}</label>
                                <select
                                  value={selectedFontWeight}
                                  onChange={(e) =>
                                    updateElementStyle(selectedEl.id, { fontWeight: e.target.value as 'normal' | 'bold' })
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                  <option value="normal">{t('layout.properties.fontWeightNormal')}</option>
                                  <option value="bold">{t('layout.properties.fontWeightBold')}</option>
                                </select>
                              </div>
                            )}
                            {selectedSupportsPadding && (
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.padding')} (mm)</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={selectedPadding}
                                  onChange={(e) => updateElementStyle(selectedEl.id, { padding: Number(e.target.value) })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {(selectedSupportsText || selectedSupportsBackground) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedSupportsText && (
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.textColor')}</label>
                                <input
                                  type="color"
                                  value={selectedTextColor}
                                  onChange={(e) => updateElementStyle(selectedEl.id, { color: e.target.value })}
                                  className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg"
                                />
                              </div>
                            )}
                            {selectedSupportsBackground && (
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.backgroundColor')}</label>
                                <input
                                  type="color"
                                  value={selectedBackgroundColor}
                                  onChange={(e) => updateElementStyle(selectedEl.id, { backgroundColor: e.target.value })}
                                  className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              {selectedEl.id === 'separator' ? t('layout.properties.lineWidth') : t('layout.properties.borderWidth')} (mm)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={selectedBorderWidth}
                              onChange={(e) => updateElementStyle(selectedEl.id, { borderWidth: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              {selectedEl.id === 'separator' ? t('layout.properties.lineColor') : t('layout.properties.borderColor')}
                            </label>
                            <input
                              type="color"
                              value={selectedBorderColor}
                              onChange={(e) => updateElementStyle(selectedEl.id, { borderColor: e.target.value })}
                              className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {selectedLogo && (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                          <h3 className="text-sm font-semibold text-gray-800">{t('layout.properties.layoutLogoTitle')}</h3>
                          <p className="text-xs text-gray-500">{t('layout.properties.logoContentSettingsHint')}</p>

                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={logoSettings.enabled}
                              onChange={(e) => updateLayoutLogo({ enabled: e.target.checked })}
                              className="w-4 h-4"
                            />
                            {t('layout.properties.customPlacement')}
                          </label>

                          <div>
                            <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.positionPreset')}</label>
                            <select
                              value={logoPresetSelection}
                              onChange={(e) => {
                                const presetId = e.target.value;
                                setLogoPresetSelection(presetId);
                                if (presetId) {
                                  applyPositionPresetToLogo(presetId);
                                  setLogoPresetSelection('');
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="">{t('layout.properties.selectPreset')}</option>
                              {HEADER_POSITION_PRESETS.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                  {t(preset.labelKey)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.positionMode')}</label>
                              <select
                                value={logoPositionMode}
                                onChange={(e) => updateLayoutLogo({ positionMode: e.target.value as LayoutPositionMode })}
                                disabled={!logoSettings.enabled}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                                  !logoSettings.enabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                                }`}
                              >
                                <option value="absolute">{t('layout.properties.positionModeAbsolute')}</option>
                                <option value="anchored">{t('layout.properties.positionModeAnchored')}</option>
                              </select>
                            </div>

                            {logoPositionMode === 'anchored' && (
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.anchorX')}</label>
                                <select
                                  value={logoAnchorX}
                                  onChange={(e) => updateLayoutLogo({ anchorX: e.target.value as LayoutAnchorX })}
                                  disabled={!logoSettings.enabled}
                                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                                    !logoSettings.enabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                                  }`}
                                >
                                  <option value="left">{t('content.branding.positions.left')}</option>
                                  <option value="center">{t('content.branding.positions.center')}</option>
                                  <option value="right">{t('content.branding.positions.right')}</option>
                                </select>
                              </div>
                            )}
                          </div>

                          {logoPositionMode === 'anchored' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.anchorY')}</label>
                                <select
                                  value={logoAnchorY}
                                  onChange={(e) => updateLayoutLogo({ anchorY: e.target.value as LayoutAnchorY })}
                                  disabled={!logoSettings.enabled}
                                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                                    !logoSettings.enabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                                  }`}
                                >
                                  <option value="top">{t('layout.properties.anchorTop')}</option>
                                  <option value="center">{t('layout.properties.anchorCenter')}</option>
                                  <option value="bottom">{t('layout.properties.anchorBottom')}</option>
                                </select>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                {logoPositionMode === 'anchored' ? t('layout.properties.offsetX') : t('layout.properties.x')} (mm)
                              </label>
                              <input
                                type="number"
                                value={logoSettings.position?.x ?? 25}
                                onChange={(e) => updateLayoutLogo({ position: { x: Number(e.target.value) } })}
                                disabled={!logoSettings.enabled}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                                  !logoSettings.enabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                                }`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                {logoPositionMode === 'anchored' ? t('layout.properties.offsetY') : t('layout.properties.y')} (mm)
                              </label>
                              <input
                                type="number"
                                value={logoSettings.position?.y ?? 25}
                                onChange={(e) => updateLayoutLogo({ position: { y: Number(e.target.value) } })}
                                disabled={!logoSettings.enabled}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                                  !logoSettings.enabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                                }`}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.width')} (mm)</label>
                              <input
                                type="number"
                                value={logoSettings.size?.width ?? 40}
                                onChange={(e) => updateLayoutLogo({ size: { width: Number(e.target.value) } })}
                                disabled={!logoSettings.enabled}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                                  !logoSettings.enabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                                }`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">{t('layout.properties.height')} (mm)</label>
                              <input
                                type="number"
                                value={logoSettings.size?.height ?? 15}
                                onChange={(e) => updateLayoutLogo({ size: { height: Number(e.target.value) } })}
                                disabled={!logoSettings.enabled}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                                  !logoSettings.enabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                          {t('layout.properties.logoFallbackHint')}
                        </div>
                      </div>
                    )}
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
                    {/* Page Frame */}
                    {pageFrameEnabled && (
                      <div
                        className={previewBoxClass('page-frame')}
                        style={{
                          left: mmToX(pageFrameInsetMm),
                          top: mmToY(pageFrameInsetMm),
                          width: mmToX(Math.max(20, pageWidthMm - pageFrameInsetMm * 2)),
                          height: mmToY(Math.max(20, pageHeightMm - pageFrameInsetMm * 2)),
                          border: `${Math.max(1, safeNumber(pageFramePreviewEl?.style?.borderWidth, 0.3))}px solid ${
                            pageFramePreviewEl?.style?.borderColor || '#CBD5E1'
                          }`,
                          backgroundColor: 'transparent',
                        }}
                        onClick={() => setSelectedElement('page-frame')}
                      />
                    )}

                    {/* Show margins */}
                    <div 
                      className="absolute border border-dashed border-[var(--brand-primary-border)] pointer-events-none"
                      style={{
                        top: mmToY(marginTopMm),
                        left: mmToX(marginLeftMm),
                        right: mmToX(marginRightMm),
                        bottom: mmToY(marginBottomMm),
                      }}
                    />

                    {/* Header */}
                    {headerEnabled && (
                      <div
                        className={previewBoxClass('header')}
                        style={{
                          left: mmToX(marginLeftMm),
                          top: mmToY(headerTopMm),
                          width: mmToX(contentWidthMm),
                          height: mmToY(headerHeightMm),
                          border: `${Math.max(1, safeNumber(headerPreviewEl?.style.borderWidth, 0.35))}px solid ${headerPreviewEl?.style.borderColor || '#94a3b8'}`,
                          backgroundColor: headerPreviewEl?.style.backgroundColor || '#ffffff',
                        }}
                        onClick={() => setSelectedElement('header')}
                      >
                        {showAttendanceBoxInHeader && (
                          <div
                            className="absolute top-0 bottom-0"
                            style={{
                              left: `${contentWidthMm > 0 ? ((contentWidthMm - attendanceWidthMm) / contentWidthMm) * 100 : 50}%`,
                              width: '1px',
                              backgroundColor: '#cbd5e1',
                            }}
                          />
                        )}
                        {titleTopEnabled && (
                          <div
                            className={previewBoxClass('protocol-title-top')}
                            style={{
                              left: toHeaderX(titleTopXmm),
                              top: toHeaderY(titleTopTopMm),
                              width: toHeaderW(titleTopWidthMm),
                              height: toHeaderH(titleTopHeightMm),
                              color: titleTopTextColor,
                              fontWeight: titleTopFontWeight,
                              fontSize: `${Math.max(6, (titleTopPreviewEl?.style?.fontSize ?? 9) / 1.8)}px`,
                              textAlign: (titleTopPreviewEl?.style?.alignment || titlePreviewEl?.style?.alignment || 'left') as 'left' | 'center' | 'right',
                              backgroundColor: titleTopPreviewEl?.style?.backgroundColor || 'transparent',
                              display: 'flex',
                              alignItems: 'flex-start',
                              padding: '1px 2px',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedElement('protocol-title-top');
                            }}
                          >
                            {previewTopTitleText}
                          </div>
                        )}

                        {titleMainEnabled && (
                          <div
                            className={previewBoxClass('protocol-title')}
                            style={{
                              left: toHeaderX(titleMainXmm),
                              top: toHeaderY(titleMainTopMm),
                              width: toHeaderW(titleMainWidthMm),
                              height: toHeaderH(titleMainHeightMm),
                              color: titleTextColor,
                              fontWeight: titleFontWeight,
                              fontSize: `${Math.max(8, (titlePreviewEl?.style?.fontSize ?? 20) / 2.6)}px`,
                              textAlign: (titlePreviewEl?.style?.alignment || 'left') as 'left' | 'center' | 'right',
                              backgroundColor: titlePreviewEl?.style?.backgroundColor || 'transparent',
                              display: 'flex',
                              alignItems: 'flex-start',
                              padding: '1px 2px',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedElement('protocol-title');
                            }}
                          >
                            {previewMainTitleText}
                          </div>
                        )}

                        {titleBottomEnabled && (
                          <div
                            className={previewBoxClass('protocol-title-bottom')}
                            style={{
                              left: toHeaderX(titleBottomXmm),
                              top: toHeaderY(titleBottomTopMm),
                              width: toHeaderW(titleBottomWidthMm),
                              height: toHeaderH(titleBottomHeightMm),
                              color: titleBottomTextColor,
                              fontWeight: titleBottomFontWeight,
                              fontSize: `${Math.max(6, (titleBottomPreviewEl?.style?.fontSize ?? 9) / 1.8)}px`,
                              textAlign: (titleBottomPreviewEl?.style?.alignment || titlePreviewEl?.style?.alignment || 'left') as 'left' | 'center' | 'right',
                              backgroundColor: titleBottomPreviewEl?.style?.backgroundColor || 'transparent',
                              display: 'flex',
                              alignItems: 'flex-start',
                              padding: '1px 2px',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedElement('protocol-title-bottom');
                            }}
                          >
                            {previewBottomTitleText}
                          </div>
                        )}
                        {showAttendanceBoxInHeader && (
                          <div className="absolute right-[2%] top-[8%] w-[42%] h-[84%] text-[6px] text-gray-600">
                            <div className="font-semibold text-[6px] mb-1">Anwesenheit</div>
                            <div className="h-[1px] bg-gray-300 mb-1" />
                            <div className="space-y-[2px]">
                              <div className="h-[2px] bg-gray-200 rounded-sm" />
                              <div className="h-[2px] bg-gray-200 rounded-sm" />
                              <div className="h-[2px] bg-gray-200 rounded-sm" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Logo */}
                    {logoVisible && (
                      <div
                        className={previewBoxClass('logo')}
                        style={{
                          left: mmToX(previewLogoXmm),
                          top: mmToY(previewLogoYmm),
                          width: mmToX(previewLogoWmm),
                          height: mmToY(previewLogoHmm),
                          border: '1px dashed #3b82f6',
                          backgroundColor: 'rgba(59,130,246,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                        onClick={() => setSelectedElement('logo')}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoSourceUrl}
                          alt="Logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}

                    {/* Info Box */}
                    {infoEnabled && (
                      <div
                        className={previewBoxClass('info-box')}
                        style={{
                          left: mmToX(marginLeftMm),
                          top: mmToY(infoTopMm),
                          width: mmToX(contentWidthMm),
                          height: mmToY(infoHeightMm),
                          border: `${Math.max(1, safeNumber(infoPreviewEl?.style.borderWidth, 0.5))}px solid ${infoPreviewEl?.style.borderColor || '#94a3b8'}`,
                          backgroundColor: infoPreviewEl?.style.backgroundColor || '#ffffff',
                          color: infoPreviewEl?.style.color || '#374151',
                          fontSize: `${Math.max(6, (infoPreviewEl?.style.fontSize ?? 9) / 1.6)}px`,
                          padding: `${Math.max(2, safeNumber(infoPreviewEl?.style.padding, 1) * 2)}px`,
                        }}
                        onClick={() => setSelectedElement('info-box')}
                      >
                        <div className="absolute top-0 bottom-0 left-1/3 w-px bg-gray-300" />
                        <div className="absolute top-0 bottom-0 left-2/3 w-px bg-gray-300" />
                        <div className="grid grid-cols-3 h-full">
                          <div className="flex flex-col justify-center">
                            <span className="font-semibold">Ort</span>
                            <span className="text-gray-500">Sitzungssaal</span>
                          </div>
                          <div className="flex flex-col justify-center">
                            <span className="font-semibold">Datum</span>
                            <span className="text-gray-500">10.03.2026</span>
                          </div>
                          <div className="flex flex-col justify-center">
                            <span className="font-semibold">Zeit</span>
                            <span className="text-gray-500">18:00 - 20:00</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Topic Title */}
                    <div
                      className={previewBoxClass('topic-title')}
                      style={{
                        left: mmToX(marginLeftMm),
                        top: mmToY(topicTopMm),
                        width: mmToX(contentWidthMm),
                        height: mmToY(topicHeightMm),
                        border: topicEnabled
                          ? `${Math.max(1, safeNumber(topicPreviewEl?.style.borderWidth, 0.5))}px solid ${topicBorderColor}`
                          : 'none',
                        backgroundColor: topicEnabled ? (topicPreviewEl?.style.backgroundColor || '#F3F4F6') : 'transparent',
                        borderBottom: topicEnabled ? undefined : '1px solid #cbd5e1',
                        color: topicTextColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: topicJustify,
                        textAlign: topicAlignment,
                        padding: `${topicPaddingPx}px`,
                        fontWeight: topicFontWeight,
                        fontSize: `${Math.max(7, (topicPreviewEl?.style.fontSize ?? 11) / 2.2)}px`,
                      }}
                      onClick={() => setSelectedElement('topic-title')}
                    >
                      1. Thema / Agenda
                    </div>

                    {/* Item Label */}
                    {itemLabelEnabled && (
                      <div
                        className={previewBoxClass('item-label')}
                        style={{
                          left: mmToX(marginLeftMm + 2),
                          top: mmToY(itemStartMm - 3),
                          width: mmToX(itemLabelWidthMm),
                          height: mmToY(itemLabelHeightMm),
                          borderRadius: '4px',
                          backgroundColor: itemLabelBackground,
                          color: itemLabelColor,
                          border: `${Math.max(0, safeNumber(itemLabelPreviewEl?.style.borderWidth, 0))}px solid ${
                            itemLabelPreviewEl?.style.borderColor || itemLabelBackground
                          }`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: itemLabelJustify,
                          textAlign: itemLabelAlignment,
                          padding: '0 2px',
                          fontSize: `${itemLabelFontSizePx}px`,
                          fontWeight: itemLabelFontWeight,
                        }}
                        onClick={() => setSelectedElement('item-label')}
                      >
                        1a)
                      </div>
                    )}

                    {/* Sample content lines */}
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: mmToX(itemContentStartMm),
                        top: mmToY(itemStartMm),
                        width: mmToX(Math.max(30, contentWidthMm - (itemContentStartMm - marginLeftMm) - 8)),
                      }}
                    >
                      <div className="h-[3px] bg-gray-300 rounded-sm mb-2 w-4/5" />
                      <div className="h-[3px] bg-gray-200 rounded-sm mb-2 w-full" />
                      <div className="h-[3px] bg-gray-200 rounded-sm mb-1 w-3/4" />
                    </div>

                    {/* Separator */}
                    {separatorEnabled && (
                      <div
                        className={previewBoxClass('separator')}
                        style={{
                          left: mmToX(itemContentStartMm),
                          top: mmToY(separatorYMm),
                          width: mmToX(separatorWidthMm),
                          height: `${separatorWidthPx}px`,
                          backgroundColor: separatorColor,
                        }}
                        onClick={() => setSelectedElement('separator')}
                      />
                    )}

                    {/* Footer */}
                    {footerEnabled && (
                      <div
                        className={previewBoxClass('footer')}
                        style={{
                          left: mmToX(marginLeftMm),
                          top: mmToY(footerLineYmm),
                          width: mmToX(contentWidthMm),
                          height: mmToY(Math.max(6, pageHeightMm - footerLineYmm)),
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          color: footerTextColor,
                          fontSize: `${footerFontSizePx}px`,
                          pointerEvents: 'auto',
                        }}
                        onClick={() => setSelectedElement('footer')}
                      >
                        <div
                          className="absolute left-0 right-0"
                          style={{
                            top: 0,
                            height: `${footerLineWidthPx}px`,
                            backgroundColor: footerLineColor,
                          }}
                        />
                        <div className="pt-[3px] text-gray-500">Vertraulich</div>
                        <div className="pt-[3px]">Fußzeilentext</div>
                        <div className="pt-[3px]">Seite 1/3</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Save Button */}
        <div className="sticky bottom-3 z-40 pb-[env(safe-area-inset-bottom)]">
          <div className="rounded-2xl bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg p-3">
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || !selectedTemplateId}
                className="w-full sm:w-auto px-8 py-3 min-h-11 brand-button-primary rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? t('save.saving') : t('save.button')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
