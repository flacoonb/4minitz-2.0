import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UserOptions } from 'jspdf-autotable';
import { IPdfLayoutSettings } from '@/models/PdfLayoutSettings';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: UserOptions) => jsPDF;
    lastAutoTable?: { finalY: number };
  }
}

interface PdfSettings {
  logoUrl: string;
  logoPosition: 'left' | 'center' | 'right';
  showLogo: boolean;
  companyName: string;
  headerText: string;
  showHeader: boolean;
  footerLeftText?: string;
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
  locale?: string;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
}

interface ClubFunctionEntry {
  _id: string;
  name: string;
  token: string;
  isActive: boolean;
  assignedUserId?: string;
}

interface IParticipant {
  userId: string;
  attendance: 'present' | 'excused' | 'absent' | 'guest';
}

interface InfoItem {
  subject: string;
  details?: string;
  itemType: 'actionItem' | 'infoItem';
  status?: 'open' | 'in-progress' | 'completed' | 'cancelled';
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  responsibles?: string[];
  notes?: string;
}

interface Topic {
  subject: string;
  responsibles?: string[];
  infoItems?: InfoItem[];
}

interface Minute {
  _id: string;
  meetingSeries_id: {
    _id: string;
    name: string;
    project?: string;
    location?: string;
  } | any;
  date: string;
  time?: string;
  endTime?: string;
  location?: string;
  participants: string[];
  participantsAdditional?: string;
  participantsWithStatus?: IParticipant[];
  topics: Topic[];
  globalNote: string;
  isFinalized: boolean;
  reopeningHistory?: Array<{
    reopenedAt: string;
    reopenedBy: string;
    reason: string;
  }>;
}

// Helper to convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [59, 130, 246]; // Default blue
}

function getInitialsFromName(value: string, fallback = '?'): string {
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
}

// Helper to get user initials
function getUserInitials(userId: string, allUsers: User[]): string {
  const user = allUsers.find(u => u._id === userId);
  if (user) {
    const first = String(user.firstName || '').trim();
    const last = String(user.lastName || '').trim();
    return getInitialsFromName(`${first} ${last}`, '?');
  }

  if (userId.startsWith('function:')) {
    const functionName = userId
      .replace(/^function:/, '')
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    return getInitialsFromName(functionName, 'F');
  }
  
  // Fallback: If userId is not a MongoID (24 hex chars), assume it's a name
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(userId);
  if (!isMongoId && userId.length > 0) {
    return getInitialsFromName(userId, '?');
  }
  
  return '?';
}

// Helper to format users as initials
function formatUsersAsInitials(userIds: string[], allUsers: User[]): string {
  return userIds.map(id => getUserInitials(id, allUsers)).join(', ');
}

function buildUserFunctionLabelMap(clubFunctions: ClubFunctionEntry[] = []): Map<string, string> {
  const labelsByUserId = new Map<string, string[]>();
  for (const fn of clubFunctions) {
    const assignedUserId = String(fn.assignedUserId || '').trim();
    const functionName = String(fn.name || '').trim();
    if (!assignedUserId || !functionName) continue;
    const existing = labelsByUserId.get(assignedUserId) || [];
    existing.push(functionName);
    labelsByUserId.set(assignedUserId, existing);
  }

  const labelMap = new Map<string, string>();
  for (const [userId, names] of labelsByUserId.entries()) {
    const uniqueNames = Array.from(new Set(names));
    labelMap.set(userId, uniqueNames.join(', '));
  }
  return labelMap;
}

function getUserDisplayName(
  userId: string,
  allUsers: User[],
  functionLabelsByUserId: Map<string, string>
): string {
  const user = allUsers.find((entry) => entry._id === userId);
  if (!user) return userId;
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const functionLabel = functionLabelsByUserId.get(userId);
  if (!functionLabel) return fullName || userId;
  return `${fullName || userId} (${functionLabel})`;
}

// i18n labels for PDF content
function getLabels(locale: string) {
  const isEn = locale.startsWith('en');
  return {
    draft: isEn ? 'DRAFT' : 'ENTWURF',
    protocol: isEn ? 'Protocol' : 'Protokoll',
    attendance: isEn ? 'Board Attendance' : 'Anwesenheit des Vorstandes',
    present: isEn ? 'p' : 'a',
    excused: isEn ? 'e' : 'e',
    absent: isEn ? 'ne' : 'ne',
    legendPresent: isEn ? 'p: present' : 'a: anwesend',
    legendExcused: isEn ? 'e: excused' : 'e: entschuldigt',
    legendAbsent: isEn ? 'ne: not excused' : 'ne: nicht entschuldigt',
    location: isEn ? 'Location:' : 'Ort:',
    date: isEn ? 'Date:' : 'Datum:',
    time: isEn ? 'Time:' : 'Zeit:',
    from: isEn ? 'from' : 'von',
    to: isEn ? 'to' : 'bis',
    notSpecified: isEn ? 'Not specified' : 'Nicht angegeben',
    guests: isEn ? 'Guests:' : 'Gast:',
    more: isEn ? 'more' : 'weitere',
    noEntries: isEn ? 'No entries' : 'Keine Einträge',
    generalNotes: isEn ? 'General Notes' : 'Allgemeine Notizen',
    reopeningHistory: isEn ? 'Reopening History' : 'Wiedereröffnungs-Historie',
    confidential: isEn ? 'Confidential' : 'Vertraulich',
    pageOf: isEn ? (i: number, n: number) => `Page ${i} of ${n}` : (i: number, n: number) => `Seite ${i} von ${n}`,
    due: isEn ? 'Due:' : 'Fällig:',
    note: isEn ? 'Note:' : 'Notiz:',
    noNote: isEn ? 'Note: none' : 'Notiz: keine',
    statusLabels: isEn
      ? { open: 'Open', 'in-progress': 'In Progress', completed: 'Completed', cancelled: 'Cancelled' } as Record<string, string>
      : { open: 'Offen', 'in-progress': 'In Arbeit', completed: 'Erledigt', cancelled: 'Abgebrochen' } as Record<string, string>,
    priorityLabels: isEn
      ? { high: 'High', medium: 'Medium', low: 'Low' } as Record<string, string>
      : { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' } as Record<string, string>,
  };
}

const STATUS_TEXT_COLORS: Record<'open' | 'in-progress' | 'completed' | 'cancelled', string> = {
  open: '#B45309',
  'in-progress': '#2563EB',
  completed: '#15803D',
  cancelled: '#4B5563',
};

const PRIORITY_TEXT_COLORS: Record<'high' | 'medium' | 'low', string> = {
  high: '#DC2626',
  medium: '#D97706',
  low: '#6B7280',
};

function getStatusTextColor(status: InfoItem['status'], primaryColor?: string): [number, number, number] {
  if (status === 'in-progress' && primaryColor) {
    return hexToRgb(primaryColor);
  }
  const colorHex = STATUS_TEXT_COLORS[status || 'open'] || STATUS_TEXT_COLORS.open;
  return hexToRgb(colorHex);
}

function getPriorityTextColor(priority: InfoItem['priority']): [number, number, number] {
  const colorHex = PRIORITY_TEXT_COLORS[priority || 'medium'] || PRIORITY_TEXT_COLORS.medium;
  return hexToRgb(colorHex);
}

function toAlphabetSuffix(index: number): string {
  let n = index + 1;
  let result = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

// Helper to add draft watermark
function addDraftWatermark(doc: jsPDF, draftText: string): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Save current state
  const currentFontSize = doc.getFontSize();
  const currentFont = doc.getFont();
  
  // Set watermark style
  doc.setFontSize(60);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 200, 200); // Light gray
  
  // Rotate and center the text
  const centerX = pageWidth / 2;
  const centerY = pageHeight / 2;
  
  // Add watermark at 45-degree angle with reduced opacity
  const angle = -45;
  
  doc.text(draftText, centerX, centerY, {
    align: 'center',
    angle: angle,
  });
  
  // Restore previous state
  doc.setFontSize(currentFontSize);
  doc.setFont(currentFont.fontName, currentFont.fontStyle);
  doc.setTextColor(0, 0, 0);
}

export async function generateMinutePdf(
  minute: Minute,
  settings: PdfSettings,
  allUsers: User[],
  layoutSettings?: IPdfLayoutSettings,
  clubFunctions: ClubFunctionEntry[] = []
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginTop = layoutSettings?.pageMargins?.top ?? 20;
  const marginRight = layoutSettings?.pageMargins?.right ?? 20;
  const marginBottom = layoutSettings?.pageMargins?.bottom ?? 22;
  const marginLeft = layoutSettings?.pageMargins?.left ?? 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const pageBottomLimit = pageHeight - marginBottom;
  const showAttendanceBox = layoutSettings?.metrics?.showAttendanceBox !== false;
  const attendanceWidth = showAttendanceBox
    ? Math.max(60, layoutSettings?.metrics?.attendanceWidth ?? 94)
    : 0;
  const responsibleColumnWidth = Math.max(18, layoutSettings?.metrics?.responsibleColumnWidth ?? 35);
  const pageFrameInset = Math.max(0, layoutSettings?.metrics?.pageFrameInset ?? 8);
  let yPosition = marginTop;

  const findLayoutElement = (id: string) => layoutSettings?.elements?.find((element) => element.id === id);
  const pageFrameElement = findLayoutElement('page-frame');
  const headerElement = findLayoutElement('header');
  const protocolTitleTopElement = findLayoutElement('protocol-title-top');
  const protocolTitleElement = findLayoutElement('protocol-title');
  const protocolTitleBottomElement = findLayoutElement('protocol-title-bottom');
  const infoBoxElement = findLayoutElement('info-box');
  const topicTitleElement = findLayoutElement('topic-title');
  const itemLabelElement = findLayoutElement('item-label');
  const separatorElement = findLayoutElement('separator');
  const globalNotesTitleElement = findLayoutElement('global-notes-title');
  const globalNotesBodyElement = findLayoutElement('global-notes-body');
  const reopeningHistoryTitleElement = findLayoutElement('reopening-history-title');
  const reopeningHistoryBodyElement = findLayoutElement('reopening-history-body');
  const footerElement = findLayoutElement('footer');
  const pageFrameEnabled = pageFrameElement?.enabled !== false;
  const headerEnabled = headerElement?.enabled !== false;
  const protocolTitleTopEnabled = protocolTitleTopElement?.enabled !== false;
  const protocolTitleEnabled = protocolTitleElement?.enabled !== false;
  const infoBoxEnabled = infoBoxElement?.enabled !== false;
  const protocolTitleBottomEnabled = protocolTitleBottomElement?.enabled !== false;
  const topicTitleEnabled = topicTitleElement?.enabled !== false;
  const itemLabelEnabled = itemLabelElement?.enabled !== false;
  const separatorEnabled = separatorElement?.enabled !== false;
  const globalNotesTitleEnabled = globalNotesTitleElement?.enabled !== false;
  const globalNotesBodyEnabled = globalNotesBodyElement?.enabled !== false;
  const reopeningHistoryTitleEnabled = reopeningHistoryTitleElement?.enabled !== false;
  const reopeningHistoryBodyEnabled = reopeningHistoryBodyElement?.enabled !== false;
  const footerLayoutEnabled = footerElement?.enabled !== false;

  // Set font
  doc.setFont(settings.fontFamily);

  // Base font size from settings (used for body text)
  const baseFontSize = settings.fontSize ?? 10;

  // i18n labels
  const locale = settings.locale || 'de-DE';
  const labels = getLabels(locale);
  const primaryRgb = hexToRgb(settings.primaryColor || '#3b82f6');
  const secondaryRgb = hexToRgb(settings.secondaryColor || '#e2e8f0');

  const softenColor = (rgb: [number, number, number], amount: number): [number, number, number] => {
    const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
    return [
      clamp(rgb[0] + (255 - rgb[0]) * amount),
      clamp(rgb[1] + (255 - rgb[1]) * amount),
      clamp(rgb[2] + (255 - rgb[2]) * amount),
    ];
  };

  const parseColor = (hex: string | undefined, fallback: [number, number, number]): [number, number, number] => {
    return hex ? hexToRgb(hex) : fallback;
  };

  const toFontStyle = (weight?: 'normal' | 'bold'): 'normal' | 'bold' => {
    return weight === 'bold' ? 'bold' : 'normal';
  };

  const subtleLineRgb = softenColor(secondaryRgb, 0.28);
  const softHeaderFillRgb = softenColor(secondaryRgb, 0.5);

  const drawPageFrame = () => {
    if (!pageFrameEnabled) return;
    const frameColor = parseColor(pageFrameElement?.style?.borderColor, subtleLineRgb);
    const frameWidth = Math.max(0.1, pageFrameElement?.style?.borderWidth ?? 0.3);
    doc.setDrawColor(frameColor[0], frameColor[1], frameColor[2]);
    doc.setLineWidth(frameWidth);
    doc.roundedRect(pageFrameInset, pageFrameInset, pageWidth - pageFrameInset * 2, pageHeight - pageFrameInset * 2, 1.5, 1.5);
  };

  const beginNewPage = () => {
    doc.addPage();
    yPosition = marginTop;
    drawPageFrame();
    if (!minute.isFinalized) {
      addDraftWatermark(doc, labels.draft);
    }
  };

  const ensurePageSpace = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageBottomLimit) {
      beginNewPage();
      return true;
    }
    return false;
  };

  // Add draft watermark if not finalized
  drawPageFrame();
  if (!minute.isFinalized) {
    addDraftWatermark(doc, labels.draft);
  }

  // ===== HEADER SECTION WITH BORDER =====
  if (headerEnabled) {
    // Use participantsWithStatus if available, otherwise fall back to participants.
    const participantsList = showAttendanceBox
      ? (
          minute.participantsWithStatus ||
          minute.participants.map((p) => ({ userId: p, attendance: 'present' as const }))
        )
      : [];
    const legendText = `${labels.legendPresent}; ${labels.legendExcused}; ${labels.legendAbsent}`;
    const attendanceNameFontSize = Math.max(6, layoutSettings?.metrics?.attendanceFontSize ?? 8);
    const legendFontSize = Math.max(
      4,
      layoutSettings?.metrics?.attendanceLegendFontSize ?? Math.max(5, attendanceNameFontSize - 2)
    );
    const attendanceLineHeight = Math.max(3.8, attendanceNameFontSize * 0.52);
    const legendLineHeight = Math.max(3, legendFontSize * 0.58);
    doc.setFont(settings.fontFamily, 'normal');
    doc.setFontSize(legendFontSize);
    const legendLines = showAttendanceBox ? doc.splitTextToSize(legendText, attendanceWidth - 10) : [];
    doc.setFontSize(attendanceNameFontSize);
    const functionLabelsByUserId = buildUserFunctionLabelMap(clubFunctions);
    const participantRows = participantsList.map((participant) => {
      const participantName = getUserDisplayName(participant.userId, allUsers, functionLabelsByUserId);
      const nameLines = doc.splitTextToSize(participantName, attendanceWidth - 20);
      return {
        participant,
        participantName,
        nameLines: nameLines.length > 0 ? nameLines : [participantName],
      };
    });

    // Expand header height dynamically so all attendance lines and guests fit.
    const guestLines = showAttendanceBox && minute.participantsAdditional
      ? doc.splitTextToSize(minute.participantsAdditional, attendanceWidth - 10)
      : [];
    const participantsHeight = participantRows.reduce((sum, row) => sum + row.nameLines.length * attendanceLineHeight + 1, 0);
    const guestsHeight = guestLines.length > 0 ? 1 + 4 + guestLines.length * 4 : 0;
    const legendHeight = legendLines.length * legendLineHeight;
    const attendanceContentHeight = showAttendanceBox
      ? 18 + participantsHeight + guestsHeight + 2 + legendHeight + 4
      : 0;
    const sessionName = minute.meetingSeries_id?.project || '';
    const yearName = minute.meetingSeries_id?.name || '';
    const protocolName = yearName ? `${sessionName} – ${yearName}` : sessionName;
    const topTitleText = settings.companyName?.trim() || '';
    const mainTitleText = protocolTitleEnabled
      ? ((settings.showHeader && settings.headerText) ? settings.headerText : labels.protocol)
      : '';
    const bottomTitleText = protocolName.trim();
    const ptToMm = (pt: number) => pt * 0.3528;
    const attendanceDividerX = pageWidth - marginRight - attendanceWidth;
    const leftSectionWidth = contentWidth - attendanceWidth;
    const titleAreaLeft = marginLeft + 5;
    const titleRightLimit = attendanceDividerX - 4;
    const titleAreaWidth = Math.max(20, titleRightLimit - titleAreaLeft);
    const titleDefaultX = marginLeft + 5;
    const titleDefaultAlignment = (protocolTitleElement?.style?.alignment ?? 'left') as 'left' | 'center' | 'right';
    const logoUrlToAdd = settings.logoUrl || '';
    const logoVisible = settings.showLogo && Boolean(logoUrlToAdd);
    const useLayoutLogoPlacement = logoVisible && layoutSettings?.logo?.enabled === true;
    const logoAreaLeft = marginLeft + 3;
    const logoAreaWidth = Math.max(20, leftSectionWidth - 6);

    type HeaderTitleLayout = {
      enabled: boolean;
      text: string;
      x: number;
      y: number;
      width: number;
      alignment: 'left' | 'center' | 'right';
      fontSize: number;
      fontStyle: 'normal' | 'bold';
      colorRgb: [number, number, number];
      topY: number;
      bottomY: number;
    };

    const resolveAnchoredX = (
      anchorX: 'left' | 'center' | 'right',
      offsetX: number,
      width: number,
      areaLeft: number,
      areaWidth: number
    ) => {
      if (anchorX === 'center') return areaLeft + (areaWidth - width) / 2 + offsetX;
      if (anchorX === 'right') return areaLeft + areaWidth - width + offsetX;
      return areaLeft + offsetX;
    };

    const resolveCustomLogoPlacement = (currentHeaderHeight: number, logoWidth: number, logoHeight: number) => {
      const logoMode = layoutSettings?.logo?.positionMode === 'anchored' ? 'anchored' : 'absolute';
      const logoAnchorX = (layoutSettings?.logo?.anchorX ?? 'left') as 'left' | 'center' | 'right';
      const logoAnchorY = (layoutSettings?.logo?.anchorY ?? 'top') as 'top' | 'center' | 'bottom';
      const rawX = layoutSettings?.logo?.position?.x ?? 25;
      const rawY = layoutSettings?.logo?.position?.y ?? 25;

      if (logoMode === 'anchored') {
        const x = resolveAnchoredX(logoAnchorX, rawX, logoWidth, logoAreaLeft, logoAreaWidth);
        const y =
          logoAnchorY === 'center'
            ? yPosition + (currentHeaderHeight - logoHeight) / 2 + rawY
            : logoAnchorY === 'bottom'
              ? yPosition + currentHeaderHeight - logoHeight - 4 + rawY
              : yPosition + 4 + rawY;
        return { x, y };
      }

      return {
        x: layoutSettings?.logo?.position?.x ?? marginLeft + 5,
        y: layoutSettings?.logo?.position?.y ?? yPosition + 5,
      };
    };

    const resolveTitleLayout = (
      element: typeof protocolTitleElement | undefined,
      options: {
        enabled: boolean;
        text: string;
        defaultY: number;
        defaultFontSize: number;
        defaultFontWeight: 'normal' | 'bold';
        defaultAlignment: 'left' | 'center' | 'right';
        defaultColor: [number, number, number];
        defaultPadding: number;
      },
      currentHeaderHeight: number
    ): HeaderTitleLayout => {
      const fontSize = Math.max(6, element?.style?.fontSize ?? options.defaultFontSize);
      const fontStyle = toFontStyle(element?.style?.fontWeight || options.defaultFontWeight);
      const alignment = (element?.style?.alignment ?? options.defaultAlignment) as 'left' | 'center' | 'right';
      const colorRgb = parseColor(element?.style?.color, options.defaultColor);
      const padding = Math.max(0, element?.style?.padding ?? options.defaultPadding);
      const mode = element?.style?.positionMode === 'anchored' ? 'anchored' : 'absolute';
      const anchorX = (element?.style?.anchorX ?? 'left') as 'left' | 'center' | 'right';
      const anchorY = (element?.style?.anchorY ?? 'top') as 'top' | 'center' | 'bottom';
      const preferredWidth = Math.max(20, Math.min(titleAreaWidth, element?.size?.width ?? titleAreaWidth));
      const rawX = element?.position?.x ?? (mode === 'anchored' ? 0 : titleDefaultX);
      const rawY = element?.position?.y ?? (mode === 'anchored' ? 0 : options.defaultY);
      let x =
        mode === 'anchored'
          ? resolveAnchoredX(anchorX, rawX, preferredWidth, titleAreaLeft, titleAreaWidth)
          : rawX;
      x = Math.max(marginLeft + 2, Math.min(x, titleRightLimit - preferredWidth));
      const maxWidthAtX = Math.max(20, titleRightLimit - x);
      const width = Math.max(20, Math.min(maxWidthAtX, preferredWidth));
      const y =
        mode === 'anchored'
          ? anchorY === 'center'
            ? yPosition + currentHeaderHeight / 2 + rawY
            : anchorY === 'bottom'
              ? yPosition + currentHeaderHeight - 4 + rawY
              : yPosition + 8 + rawY
          : rawY;
      const enabled = options.enabled && Boolean(options.text.trim());
      const lineText = enabled ? String(doc.splitTextToSize(options.text, width)[0] || options.text) : '';
      const lineHeightMm = Math.max(3, ptToMm(fontSize));
      const topY = y - lineHeightMm * 0.78 - padding;
      const bottomY = y + lineHeightMm * 0.25 + padding;

      return {
        enabled: enabled && Boolean(lineText),
        text: lineText,
        x,
        y,
        width,
        alignment,
        fontSize,
        fontStyle,
        colorRgb,
        topY,
        bottomY,
      };
    };

    const computeHeaderLayout = (currentHeaderHeight: number) => {
      const titleTopLayout = resolveTitleLayout(
        protocolTitleTopElement,
        {
          enabled: protocolTitleTopEnabled,
          text: topTitleText,
          defaultY: yPosition + 8,
          defaultFontSize: 9,
          defaultFontWeight: 'normal',
          defaultAlignment: titleDefaultAlignment,
          defaultColor: [100, 100, 100],
          defaultPadding: 0.5,
        },
        currentHeaderHeight
      );
      const titleMainLayout = resolveTitleLayout(
        protocolTitleElement,
        {
          enabled: protocolTitleEnabled,
          text: mainTitleText,
          defaultY: yPosition + 14,
          defaultFontSize: 20,
          defaultFontWeight: 'bold',
          defaultAlignment: titleDefaultAlignment,
          defaultColor: primaryRgb,
          defaultPadding: 1,
        },
        currentHeaderHeight
      );
      const titleBottomLayout = resolveTitleLayout(
        protocolTitleBottomElement,
        {
          enabled: protocolTitleBottomEnabled,
          text: bottomTitleText,
          defaultY: yPosition + 20,
          defaultFontSize: 9,
          defaultFontWeight: 'normal',
          defaultAlignment: titleDefaultAlignment,
          defaultColor: [0, 0, 0],
          defaultPadding: 0.5,
        },
        currentHeaderHeight
      );
      const titleLayouts = [titleTopLayout, titleMainLayout, titleBottomLayout].filter((entry) => entry.enabled);
      const textBottomY = titleLayouts.reduce((maxY, entry) => Math.max(maxY, entry.bottomY), yPosition + 6);
      const textContentHeight = Math.max(8, textBottomY - yPosition + 4);
      const estimatedFlowLogoHeight = 12;
      const logoBottomYForHeight = logoVisible
        ? useLayoutLogoPlacement
          ? (() => {
              const estimateWidth = Math.max(1, layoutSettings?.logo?.size?.width ?? 40);
              const estimateHeight = Math.max(1, layoutSettings?.logo?.size?.height ?? 15);
              const estimatePlacement = resolveCustomLogoPlacement(currentHeaderHeight, estimateWidth, estimateHeight);
              return estimatePlacement.y + estimateHeight;
            })()
          : yPosition + 4 + estimatedFlowLogoHeight
        : yPosition;
      const logoContentHeight = Math.max(0, logoBottomYForHeight - yPosition + 4);
      return {
        titleTopLayout,
        titleMainLayout,
        titleBottomLayout,
        contentHeight: Math.max(textContentHeight, logoContentHeight),
      };
    };

    const configuredHeaderMinHeight = headerElement?.size?.height ?? 24;
    const baseHeaderHeight = Math.max(24, configuredHeaderMinHeight, attendanceContentHeight);
    let headerHeight = baseHeaderHeight;
    let headerComputedLayout = computeHeaderLayout(headerHeight);
    headerHeight = Math.max(baseHeaderHeight, headerComputedLayout.contentHeight);
    headerComputedLayout = computeHeaderLayout(headerHeight);
    headerHeight = Math.max(baseHeaderHeight, headerComputedLayout.contentHeight);
    const titleTopLayout = headerComputedLayout.titleTopLayout;
    const titleMainLayout = headerComputedLayout.titleMainLayout;
    const titleBottomLayout = headerComputedLayout.titleBottomLayout;
    const headerBorderWidth = headerElement?.style?.borderWidth ?? 0.35;
    const headerBorderColor = headerElement?.style?.borderColor;
    const headerBorderRgb = parseColor(headerBorderColor, subtleLineRgb);
    const headerBackgroundRgb = parseColor(headerElement?.style?.backgroundColor, [255, 255, 255]);

    const getAlignedAnchor = (alignment: 'left' | 'center' | 'right', x: number, width: number) => {
      if (alignment === 'center') return x + width / 2;
      if (alignment === 'right') return x + width;
      return x;
    };
    const getAlignedOptions = (alignment: 'left' | 'center' | 'right') => {
      return alignment === 'left' ? undefined : ({ align: alignment } as const);
    };

    // Draw outer box
    doc.setFillColor(headerBackgroundRgb[0], headerBackgroundRgb[1], headerBackgroundRgb[2]);
    doc.rect(marginLeft, yPosition, contentWidth, headerHeight, 'F');
    doc.setDrawColor(headerBorderRgb[0], headerBorderRgb[1], headerBorderRgb[2]);
    doc.setLineWidth(headerBorderWidth);
    doc.rect(marginLeft, yPosition, contentWidth, headerHeight);

    // Right section - Attendance table
    if (showAttendanceBox) {
      doc.line(attendanceDividerX, yPosition, attendanceDividerX, yPosition + headerHeight);
    }

    // Left section - Logo and Protocol info
    // Logo area constraints (max half the left section width)
    const logoMaxWidth = Math.max(18, (leftSectionWidth / 2) - 8);
    const logoMaxHeight = Math.max(3, (headerHeight * 2 / 3) - 6);

    if (logoVisible) {
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('Failed to load logo image'));
          image.src = logoUrlToAdd;
        });

        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        const flowLogoTop = yPosition + 4;
        const flowLogoBoundsWidth = Math.min(26, logoMaxWidth);
        const flowLogoBoundsHeight = Math.min(12, logoMaxHeight);
        const logoBoundsWidth = useLayoutLogoPlacement
          ? (layoutSettings?.logo?.size?.width ?? logoMaxWidth)
          : flowLogoBoundsWidth;
        const logoBoundsHeight = useLayoutLogoPlacement
          ? (layoutSettings?.logo?.size?.height ?? logoMaxHeight)
          : flowLogoBoundsHeight;

        let logoWidth = logoBoundsWidth;
        let logoHeight = logoBoundsHeight;

        if (naturalWidth > 0 && naturalHeight > 0) {
          const aspectRatio = naturalWidth / naturalHeight;
          const maxAspect = logoBoundsWidth / logoBoundsHeight;

          if (aspectRatio > maxAspect) {
            logoWidth = logoBoundsWidth;
            logoHeight = logoBoundsWidth / aspectRatio;
          } else {
            logoHeight = logoBoundsHeight;
            logoWidth = logoBoundsHeight * aspectRatio;
          }
        }

        let logoX = marginLeft + 5;
        let logoY = flowLogoTop + (Math.max(3, logoBoundsHeight) - logoHeight) / 2;
        if (useLayoutLogoPlacement) {
          const customPlacement = resolveCustomLogoPlacement(headerHeight, logoWidth, logoHeight);
          logoX = customPlacement.x;
          logoY = customPlacement.y;
        } else if (settings.logoPosition === 'center') {
          logoX = marginLeft + (leftSectionWidth - logoWidth) / 2;
        } else if (settings.logoPosition === 'right') {
          logoX = marginLeft + leftSectionWidth - logoWidth - 5;
        }

        doc.addImage(img, 'PNG', logoX, logoY, logoWidth, logoHeight);
      } catch (error) {
        console.warn('Could not add logo to PDF:', error);
      }
    }

    const drawTitleLayout = (entry: HeaderTitleLayout) => {
      if (!entry.enabled || !entry.text) return;
      const anchorX = getAlignedAnchor(entry.alignment, entry.x, entry.width);
      const textOptions = getAlignedOptions(entry.alignment);
      doc.setFontSize(entry.fontSize);
      doc.setFont(settings.fontFamily, entry.fontStyle);
      doc.setTextColor(entry.colorRgb[0], entry.colorRgb[1], entry.colorRgb[2]);
      doc.text(entry.text, anchorX, entry.y, textOptions);
    };
    drawTitleLayout(titleTopLayout);
    drawTitleLayout(titleMainLayout);
    drawTitleLayout(titleBottomLayout);
    
    if (showAttendanceBox) {
      // Attendance header in right section
      doc.setFontSize(9);
      doc.setFont(settings.fontFamily, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(labels.attendance, pageWidth - marginRight - attendanceWidth + 5, yPosition + 8);

      // Attendance columns with better formatting
      const checkboxColumnSpacing = 5;
      const checkboxGroupRight = pageWidth - marginRight - 6;
      const colNeX = checkboxGroupRight;
      const colEX = colNeX - checkboxColumnSpacing;
      const colAX = colEX - checkboxColumnSpacing;

      // Draw column headers with borders
      doc.setFontSize(7);
      doc.setFont(settings.fontFamily, 'bold');
      const headerY = yPosition + 13;
      doc.setFillColor(softHeaderFillRgb[0], softHeaderFillRgb[1], softHeaderFillRgb[2]);
      doc.roundedRect(pageWidth - marginRight - attendanceWidth + 3, headerY - 4, attendanceWidth - 6, 4.8, 1, 1, 'F');

      // Column headers
      doc.text(labels.present, colAX - 0.5, headerY - 0.1);
      doc.text(labels.excused, colEX - 0.5, headerY - 0.1);
      doc.text(labels.absent, colNeX - 1.5, headerY - 0.1);

      // List participants with checkboxes
      doc.setFont(settings.fontFamily, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      let attendanceY = yPosition + 18;
      const hasGuests = !!minute.participantsAdditional;

      for (let i = 0; i < participantRows.length; i++) {
        const row = participantRows[i];
        const participant = row.participant;

        row.nameLines.forEach((line: string, lineIndex: number) => {
          doc.text(line, pageWidth - marginRight - attendanceWidth + 5, attendanceY + lineIndex * attendanceLineHeight);
        });

        // Draw checkboxes based on attendance status
        doc.setLineWidth(0.3);
        const checkY = attendanceY;

        // Anwesend (present) checkbox
        doc.rect(colAX - 2, checkY - 3, 3, 3);
        if (participant.attendance === 'present') {
          doc.setFontSize(8);
          doc.setFont(settings.fontFamily, 'bold');
          doc.text('x', colAX - 0.5, checkY - 0.3, { align: 'center' });
          doc.setFont(settings.fontFamily, 'normal');
          doc.setFontSize(8);
        }

        // Entschuldigt (excused) checkbox
        doc.rect(colEX - 2, checkY - 3, 3, 3);
        if (participant.attendance === 'excused') {
          doc.setFontSize(8);
          doc.setFont(settings.fontFamily, 'bold');
          doc.text('x', colEX - 0.5, checkY - 0.3, { align: 'center' });
          doc.setFont(settings.fontFamily, 'normal');
          doc.setFontSize(8);
        }

        // Nicht entschuldigt (absent/not excused) checkbox
        doc.rect(colNeX - 2, checkY - 3, 3, 3);
        if (participant.attendance === 'absent') {
          doc.setFontSize(8);
          doc.setFont(settings.fontFamily, 'bold');
          doc.text('x', colNeX - 0.5, checkY - 0.3, { align: 'center' });
          doc.setFont(settings.fontFamily, 'normal');
          doc.setFontSize(8);
        }

        attendanceY += row.nameLines.length * attendanceLineHeight + 1;
      }

      // Guests
      if (hasGuests && minute.participantsAdditional) {
        attendanceY += 1;
        doc.setFontSize(8);
        doc.setFont(settings.fontFamily, 'bold');
        doc.text(labels.guests, pageWidth - marginRight - attendanceWidth + 5, attendanceY);
        attendanceY += 4;

        doc.setFont(settings.fontFamily, 'normal');
        const guestLines = doc.splitTextToSize(minute.participantsAdditional, attendanceWidth - 10);

        for (const line of guestLines) {
          doc.text(line, pageWidth - marginRight - attendanceWidth + 5, attendanceY);
          attendanceY += 4;
        }
      }

      // Legend below attendance list
      attendanceY += 2;
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      doc.text(legendLines, pageWidth - marginRight - attendanceWidth + 5, attendanceY);
    }
    
    yPosition += headerHeight + 4;
  }
  
  // ===== INFO BOX (Ort, Datum, Zeit) =====
  const sectionSpacing = layoutSettings?.sectionSpacing ?? 5;
  if (infoBoxEnabled) {
    const infoBoxHeight = infoBoxElement?.size?.height ?? 15;
    const infoBoxBorderWidth = infoBoxElement?.style?.borderWidth ?? 0.5;
    const infoBoxBorderColor = infoBoxElement?.style?.borderColor;
    const infoBoxBorderRgb = parseColor(infoBoxBorderColor, subtleLineRgb);
    const infoBoxBackgroundRgb = parseColor(infoBoxElement?.style?.backgroundColor, [255, 255, 255]);
    const infoTextRgb = parseColor(infoBoxElement?.style?.color, [0, 0, 0]);
    const infoLabelFontSize = infoBoxElement?.style?.fontSize ?? baseFontSize;
    const infoPadding = Math.max(1, infoBoxElement?.style?.padding ?? 2);
    const infoValueFontStyle = toFontStyle(infoBoxElement?.style?.fontWeight);

    doc.setFillColor(infoBoxBackgroundRgb[0], infoBoxBackgroundRgb[1], infoBoxBackgroundRgb[2]);
    doc.rect(marginLeft, yPosition, contentWidth, infoBoxHeight, 'F');
    doc.setLineWidth(infoBoxBorderWidth);
    doc.setDrawColor(infoBoxBorderRgb[0], infoBoxBorderRgb[1], infoBoxBorderRgb[2]);
    doc.rect(marginLeft, yPosition, contentWidth, infoBoxHeight);
    
    // Divide into 3 columns
    const col1X = marginLeft;
    const col2X = marginLeft + contentWidth / 3;
    const col3X = marginLeft + (2 * contentWidth) / 3;
    
    doc.line(col2X, yPosition, col2X, yPosition + infoBoxHeight);
    doc.line(col3X, yPosition, col3X, yPosition + infoBoxHeight);
    
    const infoLabelY = yPosition + Math.max(infoPadding + 1.5, infoBoxHeight * 0.4);
    const infoValueY = yPosition + Math.max(infoPadding + 5.5, infoBoxHeight * 0.75);
    doc.setFontSize(infoLabelFontSize);
    doc.setFont(settings.fontFamily, 'bold');
    doc.setTextColor(infoTextRgb[0], infoTextRgb[1], infoTextRgb[2]);
    doc.text(labels.location, col1X + infoPadding, infoLabelY);
    doc.text(labels.date, col2X + infoPadding, infoLabelY);
    doc.text(labels.time, col3X + infoPadding, infoLabelY);

    doc.setFont(settings.fontFamily, infoValueFontStyle);
    const locationText = minute.location ||
      (minute.meetingSeries_id?.location) ||
      labels.notSpecified;
    doc.text(locationText, col1X + infoPadding, infoValueY);

    const dateStr = new Date(minute.date).toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    doc.text(dateStr, col2X + infoPadding, infoValueY);
    
    const timeText = minute.time && minute.endTime
      ? `${labels.from} ${minute.time} ${labels.to} ${minute.endTime}`
      : (minute.time ? minute.time : (minute.endTime ? `${labels.to} ${minute.endTime}` : labels.notSpecified));
    doc.text(timeText, col3X + infoPadding, infoValueY);
    
    yPosition += infoBoxHeight + sectionSpacing;
  } else {
    yPosition += sectionSpacing;
  }

  // ===== TOPICS AS NUMBERED SECTIONS =====
  minute.topics.forEach((topic, topicIndex) => {
    // Only require space for title + minimal content. Item-level breaks are handled precisely below.
    const titleBarHeight = topicTitleEnabled ? (topicTitleElement?.size?.height ?? 10) : 6;
    const minTopicSpace = titleBarHeight + 10;
    ensurePageSpace(minTopicSpace);

    // Section number and title with border
    const sectionNumber = topicIndex + 1;
    
    // Get topic title settings from layout
    const topicBgColor = topicTitleElement?.style?.backgroundColor || (settings.secondaryColor || '#F3F4F6');
    const topicFontSize = topicTitleElement?.style?.fontSize ?? 11;
    const topicBorderWidth = topicTitleElement?.style?.borderWidth ?? 0.5;
    const topicBorderRgb = parseColor(topicTitleElement?.style?.borderColor, secondaryRgb);
    const topicTextRgb = parseColor(topicTitleElement?.style?.color, [0, 0, 0]);
    const topicAlignment = topicTitleElement?.style?.alignment ?? 'left';
    const topicPadding = Math.max(1.5, topicTitleElement?.style?.padding ?? 2.5);
    const topicFontStyle = toFontStyle(topicTitleElement?.style?.fontWeight || 'bold');
    
    // Draw section border
    doc.setDrawColor(topicBorderRgb[0], topicBorderRgb[1], topicBorderRgb[2]);
    doc.setLineWidth(topicBorderWidth);
    
    const drawTopicHeader = () => {
      const topicSubject = (topic.subject || '').trim();
      // Avoid duplicated numbering like "1. 1. Begruessung".
      const normalizedSubject = topicSubject.replace(/^\d+(?:[.)]|\.\d+)?\s+/, '');
      const topicTitle = `${sectionNumber}. ${normalizedSubject || topicSubject || 'Untitled'}`;

      if (topicTitleEnabled) {
        // Fill background
        if (topicBgColor && topicBgColor !== '#FFFFFF') {
          const bgRgb = hexToRgb(topicBgColor);
          doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
          doc.roundedRect(marginLeft, yPosition, contentWidth, titleBarHeight, 1, 1, 'FD');
        } else {
          doc.setDrawColor(topicBorderRgb[0], topicBorderRgb[1], topicBorderRgb[2]);
          doc.roundedRect(marginLeft, yPosition, contentWidth, titleBarHeight, 1, 1);
        }
      } else {
        doc.setDrawColor(topicBorderRgb[0], topicBorderRgb[1], topicBorderRgb[2]);
        doc.line(marginLeft, yPosition + titleBarHeight, pageWidth - marginRight, yPosition + titleBarHeight);
      }
      doc.setFontSize(topicFontSize);
      doc.setFont(settings.fontFamily, topicFontStyle);
      doc.setTextColor(topicTextRgb[0], topicTextRgb[1], topicTextRgb[2]);
      const titleCenterY = yPosition + titleBarHeight / 2;
      const topicTextX = topicAlignment === 'center'
        ? marginLeft + contentWidth / 2
        : topicAlignment === 'right'
          ? pageWidth - marginRight - topicPadding
          : marginLeft + topicPadding;
      const topicTextOptions = topicAlignment === 'left'
        ? ({ baseline: 'middle' } as const)
        : ({ baseline: 'middle', align: topicAlignment } as const);
      doc.text(topicTitle, topicTextX, titleCenterY, topicTextOptions);
      yPosition += titleBarHeight;
    };

    drawTopicHeader();
    
    // Content area start position
    let contentStartY = yPosition;
    let contentHeight = 5; // Minimum padding

    // Info Items as subsections with improved layout
    if (topic.infoItems && topic.infoItems.length > 0) {
      topic.infoItems.forEach((item, itemIndex) => {
        const subLetter = toAlphabetSuffix(itemIndex);
        
        const labelWidth = itemLabelEnabled ? (itemLabelElement?.size?.width ?? 12) : 0;
        const labelHeight = itemLabelEnabled ? Math.max(3, itemLabelElement?.size?.height ?? 5.5) : 0;
        const itemContentX = marginLeft + (itemLabelEnabled ? (labelWidth + 6) : 4);
        const itemContentWidth = pageWidth - marginRight - responsibleColumnWidth - 12 - itemContentX;

        // Calculate a tighter, text-aware item height to avoid premature page breaks.
        const calculateItemHeight = () => {
          let estimatedHeight = (layoutSettings?.itemSpacing ?? 5) + 6; // top spacing + subject baseline

          const cleanedSubject = (item.subject || '').trim();
          const autoLabel = `${sectionNumber}${subLetter}`;
          const subjectText = cleanedSubject === autoLabel ? '' : cleanedSubject;
          if (subjectText) {
            const subjectLines = doc.splitTextToSize(subjectText, itemContentWidth);
            estimatedHeight += Math.max(subjectLines.length - 1, 0) * 4.5 + 6;
          } else {
            estimatedHeight += 2;
          }

          if (item.itemType === 'actionItem' && item.dueDate) {
            estimatedHeight += 5;
          }

          if (item.details) {
            const detailLines = doc.splitTextToSize(item.details, itemContentWidth);
            estimatedHeight += detailLines.length * 4 + 1;
          }

          if (item.itemType === 'actionItem') {
            const hasTaskInfo =
              (settings.includeStatusBadges && !!item.status) ||
              (settings.includePriorityBadges && !!item.priority);
            if (hasTaskInfo) estimatedHeight += 5;
          }

          if (settings.includeNotes) {
            if (item.notes) {
              const noteLines = doc.splitTextToSize(`${labels.note} ${item.notes}`, itemContentWidth);
              estimatedHeight += noteLines.length * 4;
            }
          }

          estimatedHeight += 9; // separator area
          return estimatedHeight;
        };

        const itemHeight = calculateItemHeight();

        if (yPosition + itemHeight > pageBottomLimit) {
          // Close current border before page break (if there is content to close)
          if (yPosition > contentStartY) {
            doc.rect(marginLeft, contentStartY, contentWidth, yPosition - contentStartY);
          }
          beginNewPage();
          // Continue section content directly on next page without repeating topic header.
          contentStartY = yPosition;
        }

        const itemStartY = yPosition + (layoutSettings?.itemSpacing ?? 5);
        yPosition = itemStartY;
        
        // Label on the LEFT side (outside the main content) with color coding
        const labelX = marginLeft + 2;
        
        // Responsible column on the right
        const responsibleX = pageWidth - marginRight - responsibleColumnWidth;
        
        // Main content area (between label and responsibles)
        const contentX = itemContentX;

        const autoLabel = `${sectionNumber}${subLetter}`;
        const labelText = `${autoLabel})`;
        
        // Get colors from layout settings
        const labelBgOverride = itemLabelElement?.style?.backgroundColor;
        const infoColor = layoutSettings?.labelColors?.info || labelBgOverride || (settings.primaryColor || '#3B82F6');
        const taskColor = layoutSettings?.labelColors?.task || labelBgOverride || '#F97316';
        const labelTextRgb = parseColor(itemLabelElement?.style?.color, [255, 255, 255]);
        const labelBorderWidth = itemLabelElement?.style?.borderWidth ?? 0;
        const labelFontSize = itemLabelElement?.style?.fontSize ?? 8;
        const labelFontStyle = toFontStyle(itemLabelElement?.style?.fontWeight || 'bold');
        const labelAlignment = itemLabelElement?.style?.alignment ?? 'center';
        const labelPadding = Math.max(0.8, itemLabelElement?.style?.padding ?? 1);

        if (itemLabelEnabled) {
          const labelFillHex = item.itemType === 'infoItem' ? infoColor : taskColor;
          const labelFillRgb = hexToRgb(labelFillHex);
          const labelBorderHex = itemLabelElement?.style?.borderColor || labelFillHex;
          const labelBorderRgb = hexToRgb(labelBorderHex);
          const labelTopY = yPosition - labelHeight + 2.5;

          doc.setFontSize(labelFontSize);
          doc.setFont(settings.fontFamily, labelFontStyle);
          doc.setFillColor(labelFillRgb[0], labelFillRgb[1], labelFillRgb[2]);
          doc.setDrawColor(labelBorderRgb[0], labelBorderRgb[1], labelBorderRgb[2]);
          doc.setLineWidth(Math.max(0, labelBorderWidth));
          doc.roundedRect(labelX, labelTopY, labelWidth, labelHeight, 1, 1, labelBorderWidth > 0 ? 'FD' : 'F');

          doc.setTextColor(labelTextRgb[0], labelTextRgb[1], labelTextRgb[2]);
          const labelTextX = labelAlignment === 'left'
            ? labelX + labelPadding
            : labelAlignment === 'right'
              ? labelX + labelWidth - labelPadding
              : labelX + labelWidth / 2;
          const labelTextOptions = { align: labelAlignment as 'left' | 'center' | 'right' };
          doc.text(labelText, labelTextX, yPosition, labelTextOptions);
        }
        
        // Subject - bold and prominent (without type label)
        doc.setFontSize(baseFontSize);
        doc.setFont(settings.fontFamily, 'bold');
        doc.setTextColor(0, 0, 0);
        
        const cleanedSubject = (item.subject || '').trim();
        const subjectText = cleanedSubject === autoLabel ? '' : cleanedSubject;
        if (subjectText) {
          const subjectLines = doc.splitTextToSize(subjectText, itemContentWidth);
          doc.text(subjectLines[0], contentX, yPosition);

          // Additional subject lines if wrapped
          if (subjectLines.length > 1) {
            yPosition += 4.5;
            for (let i = 1; i < subjectLines.length; i++) {
              doc.text(subjectLines[i], contentX, yPosition);
              yPosition += 4.5;
            }
          }
          yPosition += 6;
        } else {
          yPosition += 2;
        }

        // Due date for action items (displayed prominently below subject)
        if (item.itemType === 'actionItem' && item.dueDate) {
          doc.setFontSize(8);
          doc.setFont(settings.fontFamily, 'normal');
          const dueDateColor = hexToRgb(layoutSettings?.labelColors?.task || settings.primaryColor || '#DC2626');
          doc.setTextColor(dueDateColor[0], dueDateColor[1], dueDateColor[2]);
          const dueDate = new Date(item.dueDate).toLocaleDateString(locale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          doc.text(`${labels.due} ${dueDate}`, contentX, yPosition);
          yPosition += 5;
        }

        // Responsibles in right column (aligned with subject)
        if (settings.includeResponsibles && item.responsibles && item.responsibles.length > 0) {
          doc.setFontSize(8);
          doc.setFont(settings.fontFamily, 'normal');
          doc.setTextColor(100, 100, 100);
          
          const responsiblesText = formatUsersAsInitials(item.responsibles, allUsers);
          const responsibleLines = doc.splitTextToSize(responsiblesText, responsibleColumnWidth - 4);
          
          let respY = itemStartY + 1;
          responsibleLines.forEach((line: string) => {
            doc.text(line, responsibleX + 2, respY);
            respY += 3.5;
          });
        }

        // Details
        if (item.details) {
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(baseFontSize - 1);
          doc.setFont(settings.fontFamily, 'normal');
          
          const detailLines = doc.splitTextToSize(item.details, itemContentWidth);
          detailLines.forEach((line: string) => {
            doc.text(line, contentX, yPosition);
            yPosition += 4;
          });
          yPosition += 1;
        }

        // Task-specific information (status, priority) with value-based colors
        if (item.itemType === 'actionItem') {
          doc.setFontSize(8);
          doc.setFont(settings.fontFamily, 'normal');
          let hasTaskMetaLine = false;

          if (settings.includeStatusBadges && item.status) {
            yPosition += hasTaskMetaLine ? 0 : 1;
            const statusColor = getStatusTextColor(item.status, settings.primaryColor);
            doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
            doc.text(`Status: ${labels.statusLabels[item.status]}`, contentX, yPosition);
            yPosition += 4;
            hasTaskMetaLine = true;
          }

          if (settings.includePriorityBadges && item.priority) {
            const prioLabel = locale.startsWith('en') ? 'Priority' : 'Priorität';
            yPosition += hasTaskMetaLine ? 0 : 1;
            const priorityColor = getPriorityTextColor(item.priority);
            doc.setTextColor(priorityColor[0], priorityColor[1], priorityColor[2]);
            doc.text(`${prioLabel}: ${labels.priorityLabels[item.priority]}`, contentX, yPosition);
            yPosition += 4;
            hasTaskMetaLine = true;
          }
        }

        // Notes in italic gray
        if (settings.includeNotes && item.notes) {
          doc.setFontSize(8);
          doc.setFont(settings.fontFamily, 'italic');
          doc.setTextColor(120, 120, 120);
          
          const noteLines = doc.splitTextToSize(`${labels.note} ${item.notes}`, itemContentWidth);
          noteLines.forEach((line: string) => {
            doc.text(line, contentX, yPosition);
            yPosition += 4;
          });
        }

        // Separator line between items (with more spacing)
        yPosition += 4;

        if (separatorEnabled) {
          const separatorColor =
            separatorElement?.style?.borderColor ||
            separatorElement?.style?.backgroundColor ||
            (settings.secondaryColor || '#E6E6E6');
          const separatorWidth = separatorElement?.style?.borderWidth ?? separatorElement?.size?.height ?? 0.3;
          const separatorRgb = hexToRgb(separatorColor);
          const maxSeparatorLength = Math.max(20, contentWidth - (contentX - marginLeft) - 4);
          const configuredSeparatorLength = separatorElement?.size?.width ?? maxSeparatorLength;
          const separatorLength = Math.max(20, Math.min(maxSeparatorLength, configuredSeparatorLength));
          const separatorEndX = Math.min(pageWidth - marginRight - 4, contentX + separatorLength);
          
          doc.setDrawColor(separatorRgb[0], separatorRgb[1], separatorRgb[2]);
          doc.setLineWidth(separatorWidth);
          doc.line(contentX, yPosition, separatorEndX, yPosition);
        }
        yPosition += 4;
      });
    } else {
      // Empty section
      yPosition += 6;
      doc.setFontSize(9);
      doc.setFont(settings.fontFamily, 'italic');
      doc.setTextColor(150, 150, 150);
      doc.text(labels.noEntries, marginLeft + 4, yPosition);
      yPosition += 5;
    }

    // Close section border
    contentHeight = yPosition - contentStartY + 3;
    doc.rect(marginLeft, contentStartY, contentWidth, contentHeight);
    
    yPosition += Math.max(3, layoutSettings?.sectionSpacing ?? 4);
  });

  // Global Note
  // Filter out reopening notes from global note for PDF as they are shown in the history section
  const cleanGlobalNote = minute.globalNote
    ? minute.globalNote
        .split('\n\n')
        .filter(note => !note.startsWith('📝 Protokoll wiedereröffnet'))
        .join('\n\n')
        .trim()
    : '';

  if (cleanGlobalNote && globalNotesBodyEnabled) {
    ensurePageSpace(16);

    const globalNotesTitleHeight = Math.max(6, globalNotesTitleElement?.size?.height ?? 10);
    const globalNotesTitleFontSize = globalNotesTitleElement?.style?.fontSize ?? 11;
    const globalNotesTitleFontStyle = toFontStyle(globalNotesTitleElement?.style?.fontWeight || 'bold');
    const globalNotesTitleColor = parseColor(globalNotesTitleElement?.style?.color, [0, 0, 0]);
    const globalNotesTitleBg = parseColor(globalNotesTitleElement?.style?.backgroundColor, softHeaderFillRgb);
    const globalNotesTitleBorderColor = parseColor(globalNotesTitleElement?.style?.borderColor, secondaryRgb);
    const globalNotesTitleBorderWidth = Math.max(0.1, globalNotesTitleElement?.style?.borderWidth ?? 0.5);
    const globalNotesTitleAlign = globalNotesTitleElement?.style?.alignment ?? 'left';
    const globalNotesTitlePadding = Math.max(1.5, globalNotesTitleElement?.style?.padding ?? 2);

    if (globalNotesTitleEnabled) {
      doc.setFillColor(globalNotesTitleBg[0], globalNotesTitleBg[1], globalNotesTitleBg[2]);
      doc.setDrawColor(globalNotesTitleBorderColor[0], globalNotesTitleBorderColor[1], globalNotesTitleBorderColor[2]);
      doc.setLineWidth(globalNotesTitleBorderWidth);
      doc.roundedRect(marginLeft, yPosition, contentWidth, globalNotesTitleHeight, 1, 1, 'FD');

      doc.setFontSize(globalNotesTitleFontSize);
      doc.setFont(settings.fontFamily, globalNotesTitleFontStyle);
      doc.setTextColor(globalNotesTitleColor[0], globalNotesTitleColor[1], globalNotesTitleColor[2]);
      const titleCenterY = yPosition + globalNotesTitleHeight / 2;
      const titleTextX = globalNotesTitleAlign === 'center'
        ? marginLeft + contentWidth / 2
        : globalNotesTitleAlign === 'right'
          ? pageWidth - marginRight - globalNotesTitlePadding
          : marginLeft + globalNotesTitlePadding;
      const titleTextOptions = globalNotesTitleAlign === 'left'
        ? ({ baseline: 'middle' } as const)
        : ({ baseline: 'middle', align: globalNotesTitleAlign } as const);
      doc.text(labels.generalNotes, titleTextX, titleCenterY, titleTextOptions);
      yPosition += globalNotesTitleHeight;
    } else {
      doc.setFontSize(Math.max(9, globalNotesTitleFontSize));
      doc.setFont(settings.fontFamily, 'bold');
      doc.setTextColor(globalNotesTitleColor[0], globalNotesTitleColor[1], globalNotesTitleColor[2]);
      doc.text(labels.generalNotes, marginLeft + globalNotesTitlePadding, yPosition + 5);
      yPosition += 8;
    }

    const globalNotesBodyBorderColor = parseColor(globalNotesBodyElement?.style?.borderColor, secondaryRgb);
    const globalNotesBodyBorderWidth = Math.max(0.1, globalNotesBodyElement?.style?.borderWidth ?? 0.5);
    const globalNotesBodyTextColor = parseColor(globalNotesBodyElement?.style?.color, [0, 0, 0]);
    const globalNotesBodyFontSize = globalNotesBodyElement?.style?.fontSize ?? Math.max(8, baseFontSize - 1);
    const globalNotesBodyFontStyle = toFontStyle(globalNotesBodyElement?.style?.fontWeight);
    const globalNotesBodyPadding = Math.max(2, globalNotesBodyElement?.style?.padding ?? 3);

    const drawGlobalNotesBox = (startY: number, endY: number) => {
      const boxHeight = Math.max(0, endY - startY);
      if (boxHeight <= 0) return;
      doc.setDrawColor(globalNotesBodyBorderColor[0], globalNotesBodyBorderColor[1], globalNotesBodyBorderColor[2]);
      doc.setLineWidth(globalNotesBodyBorderWidth);
      doc.rect(marginLeft, startY, contentWidth, boxHeight);
    };

    let notesStartY = yPosition;
    yPosition += globalNotesBodyPadding;
    doc.setFontSize(globalNotesBodyFontSize);
    doc.setFont(settings.fontFamily, globalNotesBodyFontStyle);
    doc.setTextColor(globalNotesBodyTextColor[0], globalNotesBodyTextColor[1], globalNotesBodyTextColor[2]);
    const splitNote = doc.splitTextToSize(cleanGlobalNote, contentWidth - globalNotesBodyPadding * 2);
    splitNote.forEach((line: string) => {
      if (yPosition + 6 > pageBottomLimit) {
        drawGlobalNotesBox(notesStartY, yPosition + globalNotesBodyPadding * 0.5);
        beginNewPage();
        notesStartY = yPosition;
        yPosition += globalNotesBodyPadding;
        doc.setFontSize(globalNotesBodyFontSize);
        doc.setFont(settings.fontFamily, globalNotesBodyFontStyle);
        doc.setTextColor(globalNotesBodyTextColor[0], globalNotesBodyTextColor[1], globalNotesBodyTextColor[2]);
      }
      doc.text(line, marginLeft + globalNotesBodyPadding, yPosition);
      yPosition += 4;
    });

    yPosition += globalNotesBodyPadding;
    drawGlobalNotesBox(notesStartY, yPosition);
  }

  // Reopening History
  if (minute.reopeningHistory && minute.reopeningHistory.length > 0 && reopeningHistoryBodyEnabled) {
    ensurePageSpace(20);
    yPosition += 10;

    const reopeningTitleHeight = Math.max(6, reopeningHistoryTitleElement?.size?.height ?? 7);
    const reopeningTitleFontSize = reopeningHistoryTitleElement?.style?.fontSize ?? 9;
    const reopeningTitleFontStyle = toFontStyle(reopeningHistoryTitleElement?.style?.fontWeight || 'bold');
    const reopeningTitleColor = parseColor(reopeningHistoryTitleElement?.style?.color, [120, 53, 15]);
    const reopeningTitleBg = parseColor(reopeningHistoryTitleElement?.style?.backgroundColor, [255, 251, 235]);
    const reopeningTitleBorderColor = parseColor(reopeningHistoryTitleElement?.style?.borderColor, [245, 158, 11]);
    const reopeningTitleBorderWidth = Math.max(0.1, reopeningHistoryTitleElement?.style?.borderWidth ?? 0.5);
    const reopeningTitleAlign = reopeningHistoryTitleElement?.style?.alignment ?? 'left';
    const reopeningTitlePadding = Math.max(1.5, reopeningHistoryTitleElement?.style?.padding ?? 2);

    if (reopeningHistoryTitleEnabled) {
      doc.setFillColor(reopeningTitleBg[0], reopeningTitleBg[1], reopeningTitleBg[2]);
      doc.setDrawColor(reopeningTitleBorderColor[0], reopeningTitleBorderColor[1], reopeningTitleBorderColor[2]);
      doc.setLineWidth(reopeningTitleBorderWidth);
      doc.rect(marginLeft, yPosition, contentWidth, reopeningTitleHeight, 'FD');

      doc.setFontSize(reopeningTitleFontSize);
      doc.setFont(settings.fontFamily, reopeningTitleFontStyle);
      doc.setTextColor(reopeningTitleColor[0], reopeningTitleColor[1], reopeningTitleColor[2]);
      const titleCenterY = yPosition + reopeningTitleHeight / 2;
      const titleTextX = reopeningTitleAlign === 'center'
        ? marginLeft + contentWidth / 2
        : reopeningTitleAlign === 'right'
          ? pageWidth - marginRight - reopeningTitlePadding
          : marginLeft + reopeningTitlePadding;
      const titleTextOptions = reopeningTitleAlign === 'left'
        ? ({ baseline: 'middle' } as const)
        : ({ baseline: 'middle', align: reopeningTitleAlign } as const);
      doc.text(labels.reopeningHistory, titleTextX, titleCenterY, titleTextOptions);
      yPosition += reopeningTitleHeight;
    } else {
      doc.setFontSize(Math.max(8, reopeningTitleFontSize));
      doc.setFont(settings.fontFamily, 'bold');
      doc.setTextColor(reopeningTitleColor[0], reopeningTitleColor[1], reopeningTitleColor[2]);
      doc.text(labels.reopeningHistory, marginLeft + reopeningTitlePadding, yPosition + 5);
      yPosition += 8;
    }

    const reopeningBodyBorderColor = parseColor(reopeningHistoryBodyElement?.style?.borderColor, reopeningTitleBorderColor);
    const reopeningBodyBorderWidth = Math.max(0.1, reopeningHistoryBodyElement?.style?.borderWidth ?? 0.5);
    const reopeningBodyTextColor = parseColor(reopeningHistoryBodyElement?.style?.color, [31, 41, 55]);
    const reopeningBodyFontSize = reopeningHistoryBodyElement?.style?.fontSize ?? 9;
    const reopeningBodyPadding = Math.max(2, reopeningHistoryBodyElement?.style?.padding ?? 3);
    const reopeningMetaColor = softenColor(reopeningBodyTextColor, 0.35);

    const drawReopeningBox = (startY: number, endY: number) => {
      const boxHeight = Math.max(0, endY - startY);
      if (boxHeight <= 0) return;
      doc.setDrawColor(reopeningBodyBorderColor[0], reopeningBodyBorderColor[1], reopeningBodyBorderColor[2]);
      doc.setLineWidth(reopeningBodyBorderWidth);
      doc.rect(marginLeft, startY, contentWidth, boxHeight);
    };

    let reopeningStartY = yPosition;
    yPosition += reopeningBodyPadding + 2;

    minute.reopeningHistory.forEach((entry) => {
      if (yPosition + 10 > pageBottomLimit) {
        drawReopeningBox(reopeningStartY, yPosition);
        beginNewPage();
        reopeningStartY = yPosition;
        yPosition += reopeningBodyPadding + 2;
      }

      const date = new Date(entry.reopenedAt).toLocaleString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      doc.setFont(settings.fontFamily, 'bold');
      doc.setFontSize(Math.max(8, reopeningBodyFontSize - 1));
      doc.setTextColor(reopeningMetaColor[0], reopeningMetaColor[1], reopeningMetaColor[2]);
      doc.setFillColor(reopeningTitleBorderColor[0], reopeningTitleBorderColor[1], reopeningTitleBorderColor[2]);
      doc.circle(marginLeft + reopeningBodyPadding + 1.5, yPosition - 1, 0.8, 'F');
      doc.text(`${date} • ${entry.reopenedBy}`, marginLeft + reopeningBodyPadding + 5, yPosition);
      yPosition += 5;

      doc.setFont(settings.fontFamily, 'normal');
      doc.setFontSize(reopeningBodyFontSize);
      doc.setTextColor(reopeningBodyTextColor[0], reopeningBodyTextColor[1], reopeningBodyTextColor[2]);
      const reasonLines = doc.splitTextToSize(entry.reason, contentWidth - (reopeningBodyPadding + 5) * 2);
      reasonLines.forEach((line: string) => {
        doc.text(line, marginLeft + reopeningBodyPadding + 5, yPosition);
        yPosition += 4.5;
      });
      yPosition += 3;
    });

    yPosition += reopeningBodyPadding;
    drawReopeningBox(reopeningStartY, yPosition);
  }

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  if (settings.showFooter && footerLayoutEnabled && (settings.showPageNumbers || settings.footerText || settings.footerLeftText)) {
    const footerFontSize = Math.max(6, footerElement?.style?.fontSize ?? 8);
    const footerTextColor = parseColor(footerElement?.style?.color, [80, 80, 80]);
    const footerLineColor = parseColor(footerElement?.style?.borderColor, [200, 200, 200]);
    const footerLineWidth = Math.max(0.1, footerElement?.style?.borderWidth ?? 0.2);
    const footerPadding = Math.max(1, footerElement?.style?.padding ?? 2);
    const footerLineGap = Math.max(3, (footerElement?.size?.height ?? 8) * 0.6);
    const footerTextY = pageHeight - Math.max(8, marginBottom - footerPadding);
    const footerLineY = footerTextY - footerLineGap;
    const footerLeftColor = softenColor(footerTextColor, 0.35);

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(footerLineColor[0], footerLineColor[1], footerLineColor[2]);
      doc.setLineWidth(footerLineWidth);
      doc.line(marginLeft, footerLineY, pageWidth - marginRight, footerLineY);

      doc.setFontSize(footerFontSize);
      doc.setFont(settings.fontFamily, 'normal');
      doc.setTextColor(footerLeftColor[0], footerLeftColor[1], footerLeftColor[2]);
      doc.text((settings.footerLeftText || labels.confidential).trim(), marginLeft, footerTextY);

      if (settings.footerText) {
        const footerWidth = doc.getTextWidth(settings.footerText);
        doc.setTextColor(footerTextColor[0], footerTextColor[1], footerTextColor[2]);
        doc.text(settings.footerText, (pageWidth - footerWidth) / 2, footerTextY);
      }

      if (settings.showPageNumbers) {
        const pageText = labels.pageOf(i, pageCount);
        const textWidth = doc.getTextWidth(pageText);
        doc.setTextColor(footerTextColor[0], footerTextColor[1], footerTextColor[2]);
        doc.text(pageText, pageWidth - marginRight - textWidth, footerTextY);
      }
    }
  }

  // Save PDF with proper filename
  // Use ISO format for filename to be safe across OS
  const dateObj = new Date(minute.date);
  const formattedDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `Protokoll_${formattedDate}.pdf`;
  doc.save(filename);
}
