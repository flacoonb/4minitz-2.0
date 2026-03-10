import { Types } from 'mongoose';

export type PdfFontFamily = 'helvetica' | 'times' | 'courier';
export type LogoPosition = 'left' | 'center' | 'right';
export type LayoutPositionMode = 'absolute' | 'anchored';
export type LayoutAnchorX = 'left' | 'center' | 'right';
export type LayoutAnchorY = 'top' | 'center' | 'bottom';

export interface PdfContentSettings {
  logoUrl: string;
  logoPosition: LogoPosition;
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
  fontFamily: PdfFontFamily;
}

export interface PdfLayoutElement {
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

export interface PdfLayoutSettings {
  elements: PdfLayoutElement[];
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
  logo: {
    enabled: boolean;
    url: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    positionMode: LayoutPositionMode;
    anchorX: LayoutAnchorX;
    anchorY: LayoutAnchorY;
  };
}

export interface PdfTemplateData {
  name: string;
  description: string;
  isActive: boolean;
  contentSettings: PdfContentSettings;
  layoutSettings: PdfLayoutSettings;
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const PDF_FONT_FAMILIES: PdfFontFamily[] = ['helvetica', 'times', 'courier'];
const LOGO_POSITIONS: LogoPosition[] = ['left', 'center', 'right'];
const LAYOUT_POSITION_MODES: LayoutPositionMode[] = ['absolute', 'anchored'];
const LAYOUT_ANCHOR_X: LayoutAnchorX[] = ['left', 'center', 'right'];
const LAYOUT_ANCHOR_Y: LayoutAnchorY[] = ['top', 'center', 'bottom'];

const DEFAULT_LAYOUT_ELEMENTS: PdfLayoutElement[] = [
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

export const DEFAULT_PDF_CONTENT_SETTINGS: PdfContentSettings = {
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

export const DEFAULT_PDF_LAYOUT_SETTINGS: PdfLayoutSettings = {
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

function toFiniteNumber(input: unknown, fallback: number): number {
  const numericValue = typeof input === 'number' ? input : Number(input);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function sanitizeHexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

function sanitizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function createDefaultPdfContentSettings(): PdfContentSettings {
  return deepClone(DEFAULT_PDF_CONTENT_SETTINGS);
}

export function createDefaultPdfLayoutSettings(): PdfLayoutSettings {
  return deepClone(DEFAULT_PDF_LAYOUT_SETTINGS);
}

export function sanitizePdfContentSettings(input: unknown): PdfContentSettings {
  const source = (input && typeof input === 'object' ? input : {}) as Partial<PdfContentSettings>;
  const defaults = createDefaultPdfContentSettings();
  const logoPosition = LOGO_POSITIONS.includes(source.logoPosition as LogoPosition)
    ? (source.logoPosition as LogoPosition)
    : defaults.logoPosition;
  const fontFamily = PDF_FONT_FAMILIES.includes(source.fontFamily as PdfFontFamily)
    ? (source.fontFamily as PdfFontFamily)
    : defaults.fontFamily;

  return {
    logoUrl: sanitizeString(source.logoUrl, defaults.logoUrl),
    logoPosition,
    showLogo: sanitizeBoolean(source.showLogo, defaults.showLogo),
    companyName: sanitizeString(source.companyName, defaults.companyName),
    headerText: sanitizeString(source.headerText, defaults.headerText),
    showHeader: sanitizeBoolean(source.showHeader, defaults.showHeader),
    footerLeftText: sanitizeString(source.footerLeftText, defaults.footerLeftText),
    footerText: sanitizeString(source.footerText, defaults.footerText),
    showPageNumbers: sanitizeBoolean(source.showPageNumbers, defaults.showPageNumbers),
    showFooter: sanitizeBoolean(source.showFooter, defaults.showFooter),
    primaryColor: sanitizeHexColor(source.primaryColor, defaults.primaryColor),
    secondaryColor: sanitizeHexColor(source.secondaryColor, defaults.secondaryColor),
    includeResponsibles: sanitizeBoolean(source.includeResponsibles, defaults.includeResponsibles),
    includeStatusBadges: sanitizeBoolean(source.includeStatusBadges, defaults.includeStatusBadges),
    includePriorityBadges: sanitizeBoolean(source.includePriorityBadges, defaults.includePriorityBadges),
    includeNotes: sanitizeBoolean(source.includeNotes, defaults.includeNotes),
    fontSize: Math.max(6, Math.min(20, toFiniteNumber(source.fontSize, defaults.fontSize))),
    fontFamily,
  };
}

function sanitizeLayoutElement(source: unknown, fallback: PdfLayoutElement): PdfLayoutElement {
  const element = (source && typeof source === 'object' ? source : {}) as Partial<PdfLayoutElement>;
  const style = (element.style && typeof element.style === 'object' ? element.style : {}) as PdfLayoutElement['style'];
  const fallbackStyle = fallback.style || {};

  return {
    id: fallback.id,
    type: fallback.type,
    label: sanitizeString(element.label, fallback.label),
    enabled: sanitizeBoolean(element.enabled, fallback.enabled),
    position: {
      x: toFiniteNumber(element.position?.x, fallback.position.x),
      y: toFiniteNumber(element.position?.y, fallback.position.y),
    },
    size: {
      width: toFiniteNumber(element.size?.width, fallback.size.width),
      height: toFiniteNumber(element.size?.height, fallback.size.height),
    },
    style: {
      fontSize: style.fontSize !== undefined ? toFiniteNumber(style.fontSize, fallbackStyle.fontSize ?? 10) : fallbackStyle.fontSize,
      fontWeight:
        style.fontWeight === 'normal' || style.fontWeight === 'bold'
          ? style.fontWeight
          : fallbackStyle.fontWeight,
      color: style.color ? sanitizeHexColor(style.color, fallbackStyle.color || '#000000') : fallbackStyle.color,
      backgroundColor: style.backgroundColor
        ? sanitizeHexColor(style.backgroundColor, fallbackStyle.backgroundColor || '#FFFFFF')
        : fallbackStyle.backgroundColor,
      borderColor: style.borderColor
        ? sanitizeHexColor(style.borderColor, fallbackStyle.borderColor || '#000000')
        : fallbackStyle.borderColor,
      borderWidth:
        style.borderWidth !== undefined
          ? toFiniteNumber(style.borderWidth, fallbackStyle.borderWidth ?? 0.5)
          : fallbackStyle.borderWidth,
      padding:
        style.padding !== undefined ? toFiniteNumber(style.padding, fallbackStyle.padding ?? 0) : fallbackStyle.padding,
      alignment:
        style.alignment === 'left' || style.alignment === 'center' || style.alignment === 'right'
          ? style.alignment
          : fallbackStyle.alignment,
      positionMode:
        LAYOUT_POSITION_MODES.includes(style.positionMode as LayoutPositionMode)
          ? (style.positionMode as LayoutPositionMode)
          : fallbackStyle.positionMode,
      anchorX:
        LAYOUT_ANCHOR_X.includes(style.anchorX as LayoutAnchorX)
          ? (style.anchorX as LayoutAnchorX)
          : fallbackStyle.anchorX,
      anchorY:
        LAYOUT_ANCHOR_Y.includes(style.anchorY as LayoutAnchorY)
          ? (style.anchorY as LayoutAnchorY)
          : fallbackStyle.anchorY,
    },
  };
}

function sanitizeLayoutElements(input: unknown, defaults: PdfLayoutElement[]): PdfLayoutElement[] {
  const source = Array.isArray(input) ? input : [];
  const sourceById = new Map<string, unknown>();
  for (const entry of source) {
    if (!entry || typeof entry !== 'object') continue;
    const id = sanitizeString((entry as { id?: string }).id, '');
    if (!id) continue;
    sourceById.set(id, entry);
  }
  return defaults.map((defaultElement) => sanitizeLayoutElement(sourceById.get(defaultElement.id), defaultElement));
}

export function sanitizePdfLayoutSettings(input: unknown): PdfLayoutSettings {
  const source = (input && typeof input === 'object' ? input : {}) as Partial<PdfLayoutSettings>;
  const defaults = createDefaultPdfLayoutSettings();
  return {
    elements: sanitizeLayoutElements(source.elements, defaults.elements),
    pageMargins: {
      top: Math.max(0, toFiniteNumber(source.pageMargins?.top, defaults.pageMargins.top)),
      right: Math.max(0, toFiniteNumber(source.pageMargins?.right, defaults.pageMargins.right)),
      bottom: Math.max(0, toFiniteNumber(source.pageMargins?.bottom, defaults.pageMargins.bottom)),
      left: Math.max(0, toFiniteNumber(source.pageMargins?.left, defaults.pageMargins.left)),
    },
    itemSpacing: Math.max(0, toFiniteNumber(source.itemSpacing, defaults.itemSpacing)),
    sectionSpacing: Math.max(0, toFiniteNumber(source.sectionSpacing, defaults.sectionSpacing)),
    labelColors: {
      info: sanitizeHexColor(source.labelColors?.info, defaults.labelColors.info),
      task: sanitizeHexColor(source.labelColors?.task, defaults.labelColors.task),
    },
    metrics: {
      showAttendanceBox: sanitizeBoolean(source.metrics?.showAttendanceBox, defaults.metrics.showAttendanceBox),
      attendanceWidth: Math.max(60, toFiniteNumber(source.metrics?.attendanceWidth, defaults.metrics.attendanceWidth)),
      responsibleColumnWidth: Math.max(
        18,
        toFiniteNumber(source.metrics?.responsibleColumnWidth, defaults.metrics.responsibleColumnWidth)
      ),
      pageFrameInset: Math.max(0, toFiniteNumber(source.metrics?.pageFrameInset, defaults.metrics.pageFrameInset)),
      attendanceFontSize: Math.max(6, toFiniteNumber(source.metrics?.attendanceFontSize, defaults.metrics.attendanceFontSize)),
      attendanceLegendFontSize: Math.max(
        4,
        toFiniteNumber(source.metrics?.attendanceLegendFontSize, defaults.metrics.attendanceLegendFontSize)
      ),
    },
    logo: {
      enabled: sanitizeBoolean(source.logo?.enabled, defaults.logo.enabled),
      url: sanitizeString(source.logo?.url, defaults.logo.url),
      position: {
        x: toFiniteNumber(source.logo?.position?.x, defaults.logo.position.x),
        y: toFiniteNumber(source.logo?.position?.y, defaults.logo.position.y),
      },
      size: {
        width: Math.max(1, toFiniteNumber(source.logo?.size?.width, defaults.logo.size.width)),
        height: Math.max(1, toFiniteNumber(source.logo?.size?.height, defaults.logo.size.height)),
      },
      positionMode: LAYOUT_POSITION_MODES.includes(source.logo?.positionMode as LayoutPositionMode)
        ? (source.logo?.positionMode as LayoutPositionMode)
        : defaults.logo.positionMode,
      anchorX: LAYOUT_ANCHOR_X.includes(source.logo?.anchorX as LayoutAnchorX)
        ? (source.logo?.anchorX as LayoutAnchorX)
        : defaults.logo.anchorX,
      anchorY: LAYOUT_ANCHOR_Y.includes(source.logo?.anchorY as LayoutAnchorY)
        ? (source.logo?.anchorY as LayoutAnchorY)
        : defaults.logo.anchorY,
    },
  };
}

export function createDefaultPdfTemplateData(name = 'Standard'): PdfTemplateData {
  return {
    name,
    description: '',
    isActive: true,
    contentSettings: createDefaultPdfContentSettings(),
    layoutSettings: createDefaultPdfLayoutSettings(),
  };
}

export function normalizeTemplateName(name: unknown, fallback = 'Neue PDF-Vorlage'): string {
  const normalized = sanitizeString(name, '').trim();
  return normalized || fallback;
}

export function ensureObjectIdString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return Types.ObjectId.isValid(value) ? value : null;
}
