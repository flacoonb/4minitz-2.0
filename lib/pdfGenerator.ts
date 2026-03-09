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

// Helper to get user initials
function getUserInitials(userId: string, allUsers: User[]): string {
  const user = allUsers.find(u => u._id === userId);
  if (user) {
    return `${user.firstName.charAt(0).toUpperCase()}${user.lastName.charAt(0).toUpperCase()}`;
  }

  if (userId.startsWith('function:')) {
    const functionName = userId
      .replace(/^function:/, '')
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    const initials = functionName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
    return initials || 'F';
  }
  
  // Fallback: If userId is not a MongoID (24 hex chars), assume it's a name
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(userId);
  if (!isMongoId && userId.length > 0) {
    // Try to extract initials from name
    const parts = userId.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0).toUpperCase()}${parts[parts.length - 1].charAt(0).toUpperCase()}`;
    } else {
      return userId.substring(0, 2).toUpperCase();
    }
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
  let yPosition = marginTop;

  // Set font
  doc.setFont(settings.fontFamily);

  // Base font size from settings (used for body text)
  const baseFontSize = settings.fontSize || 10;

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

  const subtleLineRgb = softenColor(secondaryRgb, 0.28);
  const softHeaderFillRgb = softenColor(secondaryRgb, 0.5);
  const pageFrameInset = 8;

  const drawPageFrame = () => {
    doc.setDrawColor(subtleLineRgb[0], subtleLineRgb[1], subtleLineRgb[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(
      pageFrameInset,
      pageFrameInset,
      pageWidth - pageFrameInset * 2,
      pageHeight - pageFrameInset * 2,
      1.5,
      1.5
    );
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
  // Use participantsWithStatus if available, otherwise fall back to participants.
  const participantsList = minute.participantsWithStatus ||
    minute.participants.map((p) => ({ userId: p, attendance: 'present' as const }));
  // Keep more horizontal space for "Name (Funktion)" in attendance rows.
  const attendanceWidth = 94;
  const legendText = `${labels.legendPresent}; ${labels.legendExcused}; ${labels.legendAbsent}`;
  const attendanceNameFontSize = 8;
  const legendFontSize = 6;
  doc.setFont(settings.fontFamily, 'normal');
  doc.setFontSize(legendFontSize);
  const legendLines = doc.splitTextToSize(legendText, attendanceWidth - 10);
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
  const guestLines = minute.participantsAdditional
    ? doc.splitTextToSize(minute.participantsAdditional, attendanceWidth - 10)
    : [];
  const participantsHeight = participantRows.reduce((sum, row) => sum + row.nameLines.length * 4.2 + 1, 0);
  const guestsHeight = guestLines.length > 0 ? 1 + 4 + guestLines.length * 4 : 0;
  const legendHeight = legendLines.length * 3.5;
  const attendanceContentHeight = 18 + participantsHeight + guestsHeight + 2 + legendHeight + 4;
  const headerHeight = Math.max(64, attendanceContentHeight);
  
  // Draw outer border
  doc.setDrawColor(subtleLineRgb[0], subtleLineRgb[1], subtleLineRgb[2]);
  doc.setLineWidth(0.35);
  doc.rect(marginLeft, yPosition, contentWidth, headerHeight);
  
  // Right section - Attendance table
  doc.line(pageWidth - marginRight - attendanceWidth, yPosition, pageWidth - marginRight - attendanceWidth, yPosition + headerHeight);
  
  // Left section - Logo and Protocol info
  const leftSectionWidth = contentWidth - attendanceWidth;
  let logoBottomY = yPosition + 6;
  
  // Logo area constraints (max half the left section width, 2/3 of header height)
  const logoMaxWidth = (leftSectionWidth / 2) - 10;
  const logoMaxHeight = (headerHeight * 2 / 3) - 10;

  // Add logo
  // Priority: 1. Content Settings (if showLogo is true), 2. Layout Settings (legacy)
  let logoUrlToAdd = '';

  if (settings.showLogo && settings.logoUrl) {
    logoUrlToAdd = settings.logoUrl;
  } else if (layoutSettings?.logo?.enabled && layoutSettings.logo.url) {
    logoUrlToAdd = layoutSettings.logo.url;
  }

  if (logoUrlToAdd) {
    try {
      // Load image to get natural dimensions and preserve aspect ratio
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load logo image'));
        image.src = logoUrlToAdd;
      });

      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      // Scale to fit within max bounds while preserving aspect ratio
      let logoWidth = logoMaxWidth;
      let logoHeight = logoMaxHeight;

      if (naturalWidth > 0 && naturalHeight > 0) {
        const aspectRatio = naturalWidth / naturalHeight;
        const maxAspect = logoMaxWidth / logoMaxHeight;

        if (aspectRatio > maxAspect) {
          // Image is wider — constrain by width
          logoWidth = logoMaxWidth;
          logoHeight = logoMaxWidth / aspectRatio;
        } else {
          // Image is taller — constrain by height
          logoHeight = logoMaxHeight;
          logoWidth = logoMaxHeight * aspectRatio;
        }
      }

      // Calculate X position based on setting
      let logoX = marginLeft + 5;
      if (settings.logoPosition === 'center') {
        logoX = marginLeft + (leftSectionWidth - logoWidth) / 2;
      } else if (settings.logoPosition === 'right') {
        logoX = marginLeft + leftSectionWidth - logoWidth - 5;
      }

      // Center vertically within the logo area
      const logoY = yPosition + 5 + (logoMaxHeight - logoHeight) / 2;
      logoBottomY = Math.max(logoBottomY, logoY + logoHeight);

      doc.addImage(
        img,
        'PNG',
        logoX,
        logoY,
        logoWidth,
        logoHeight
      );
    } catch (error) {
      console.warn('Could not add logo to PDF:', error);
    }
  }

  // Keep text block in the left section under the logo.
  const titleX = marginLeft + 5;
  const attendanceDividerX = pageWidth - marginRight - attendanceWidth;
  const titleMaxWidth = Math.max(40, attendanceDividerX - titleX - 4);
  const hasVisibleLogo = Boolean(logoUrlToAdd);

  // Place text dynamically below logo area to prevent overlap.
  const minTextTop = hasVisibleLogo ? logoBottomY + 4 : yPosition + 18;
  const maxTextTop = yPosition + headerHeight - 18;
  let textTopY = Math.min(Math.max(minTextTop, yPosition + 18), maxTextTop);
  
  // Title "Protokoll" or custom header text
  let titleFontSize = 20;
  doc.setFontSize(titleFontSize);
  doc.setFont(settings.fontFamily, 'bold');
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  
  const titleText = (settings.showHeader && settings.headerText) ? settings.headerText : labels.protocol;
  while (titleFontSize > 14 && doc.getTextWidth(titleText) > titleMaxWidth) {
    titleFontSize -= 1;
    doc.setFontSize(titleFontSize);
  }
  let titleY = textTopY + 8;
  
  // Company Name (if set)
  let companyY = textTopY;
  if (settings.companyName) {
    doc.setFontSize(9);
    doc.setFont(settings.fontFamily, 'normal');
    doc.setTextColor(100, 100, 100);
    const companyLine = doc.splitTextToSize(settings.companyName, titleMaxWidth)[0];
    doc.text(companyLine, titleX, companyY);
  }
  
  // Meeting series and protocol name below "Protokoll" (left-aligned)
  const sessionName = minute.meetingSeries_id?.project || '';
  const yearName = minute.meetingSeries_id?.name || '';
  const protocolName = yearName ? `${sessionName} – ${yearName}` : sessionName;
  let protocolY = titleY + 8;

  // Keep text block within header bottom even when header is compact.
  const textBottomLimit = yPosition + headerHeight - 4;
  if (protocolName && protocolY > textBottomLimit) {
    const overflow = protocolY - textBottomLimit;
    textTopY -= overflow;
    companyY -= overflow;
    titleY -= overflow;
    protocolY -= overflow;
  }

  doc.setFontSize(titleFontSize);
  doc.setFont(settings.fontFamily, 'bold');
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(titleText, titleX, titleY);
  
  if (protocolName) {
    doc.setFontSize(11);
    doc.setFont(settings.fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    const protocolLine = doc.splitTextToSize(protocolName, titleMaxWidth)[0];
    doc.text(protocolLine, titleX, protocolY);
  }
  
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
      doc.text(line, pageWidth - marginRight - attendanceWidth + 5, attendanceY + lineIndex * 4.2);
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
    
    attendanceY += row.nameLines.length * 4.2 + 1;
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
  
  yPosition += headerHeight + 4;
  
  // ===== INFO BOX (Ort, Datum, Zeit) =====
  doc.setTextColor(0, 0, 0);
  const infoBoxHeight = 15;
  doc.rect(marginLeft, yPosition, contentWidth, infoBoxHeight);
  
  // Divide into 3 columns
  const col1X = marginLeft;
  const col2X = marginLeft + contentWidth / 3;
  const col3X = marginLeft + (2 * contentWidth) / 3;
  
  doc.line(col2X, yPosition, col2X, yPosition + infoBoxHeight);
  doc.line(col3X, yPosition, col3X, yPosition + infoBoxHeight);
  
  doc.setFontSize(baseFontSize);
  doc.setFont(settings.fontFamily, 'bold');
  doc.text(labels.location, col1X + 2, yPosition + 6);
  doc.text(labels.date, col2X + 2, yPosition + 6);
  doc.text(labels.time, col3X + 2, yPosition + 6);

  doc.setFont(settings.fontFamily, 'normal');
  const locationText = minute.location ||
    (minute.meetingSeries_id?.location) ||
    labels.notSpecified;
  doc.text(locationText, col1X + 2, yPosition + 11);

  const dateStr = new Date(minute.date).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  doc.text(dateStr, col2X + 2, yPosition + 11);
  
  const timeText = minute.time && minute.endTime
    ? `${labels.from} ${minute.time} ${labels.to} ${minute.endTime}`
    : (minute.time ? minute.time : (minute.endTime ? `${labels.to} ${minute.endTime}` : labels.notSpecified));
  doc.text(timeText, col3X + 2, yPosition + 11);
  
  yPosition += infoBoxHeight + (layoutSettings?.sectionSpacing || 5);

  // ===== TOPICS AS NUMBERED SECTIONS =====
  minute.topics.forEach((topic, topicIndex) => {
    // Only require space for title + minimal content. Item-level breaks are handled precisely below.
    const topicTitleElement = layoutSettings?.elements?.find((e) => e.id === 'topic-title');
    const minTopicSpace = (topicTitleElement?.size?.height || 10) + 10;
    ensurePageSpace(minTopicSpace);

    // Section number and title with border
    const sectionNumber = topicIndex + 1;
    
    // Get topic title settings from layout
    const topicBgColor = topicTitleElement?.style?.backgroundColor || (settings.secondaryColor || '#F3F4F6');
    const topicFontSize = topicTitleElement?.style?.fontSize || 11;
    const topicBorderWidth = topicTitleElement?.style?.borderWidth || 0.5;
    
    // Draw section border
    doc.setDrawColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
    doc.setLineWidth(topicBorderWidth);
    
    // Title bar with background color
    const titleBarHeight = topicTitleElement?.size?.height || 10;
    
    const drawTopicHeader = () => {
      const topicSubject = (topic.subject || '').trim();
      // Avoid duplicated numbering like "1. 1. Begruessung".
      const normalizedSubject = topicSubject.replace(/^\d+(?:[.)]|\.\d+)?\s+/, '');
      const topicTitle = `${sectionNumber}. ${normalizedSubject || topicSubject || 'Untitled'}`;
      // Fill background
      if (topicBgColor && topicBgColor !== '#FFFFFF') {
        const bgRgb = hexToRgb(topicBgColor);
        doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
        doc.roundedRect(marginLeft, yPosition, contentWidth, titleBarHeight, 1, 1, 'FD');
      } else {
        doc.setDrawColor(subtleLineRgb[0], subtleLineRgb[1], subtleLineRgb[2]);
        doc.roundedRect(marginLeft, yPosition, contentWidth, titleBarHeight, 1, 1);
      }
      doc.setFontSize(topicFontSize);
      doc.setFont(settings.fontFamily, 'bold');
      doc.setTextColor(0, 0, 0);
      const titleCenterY = yPosition + titleBarHeight / 2;
      doc.text(topicTitle, marginLeft + 2.5, titleCenterY, { baseline: 'middle' });
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
        
        const labelWidth = layoutSettings?.elements?.find((e) => e.id === 'item-label')?.size?.width || 12;
        const responsibleColumnWidth = 35;
        const contentWidth = pageWidth - marginLeft - marginRight - labelWidth - responsibleColumnWidth - 12;

        // Calculate a tighter, text-aware item height to avoid premature page breaks.
        const calculateItemHeight = () => {
          let estimatedHeight = (layoutSettings?.itemSpacing || 5) + 6; // top spacing + subject baseline

          const cleanedSubject = (item.subject || '').trim();
          const autoLabel = `${sectionNumber}${subLetter}`;
          const subjectText = cleanedSubject === autoLabel ? '' : cleanedSubject;
          if (subjectText) {
            const subjectLines = doc.splitTextToSize(subjectText, contentWidth);
            estimatedHeight += Math.max(subjectLines.length - 1, 0) * 4.5 + 6;
          } else {
            estimatedHeight += 2;
          }

          if (item.itemType === 'actionItem' && item.dueDate) {
            estimatedHeight += 5;
          }

          if (item.details) {
            const detailLines = doc.splitTextToSize(item.details, contentWidth);
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
              const noteLines = doc.splitTextToSize(`${labels.note} ${item.notes}`, contentWidth);
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
            doc.rect(marginLeft, contentStartY, contentWidth + labelWidth + responsibleColumnWidth + 12, yPosition - contentStartY);
          }
          beginNewPage();
          // Continue section content directly on next page without repeating topic header.
          contentStartY = yPosition;
        }

        const itemStartY = yPosition + (layoutSettings?.itemSpacing || 5);
        yPosition = itemStartY;
        
        // Label on the LEFT side (outside the main content) with color coding
        const labelX = marginLeft + 2;
        
        // Responsible column on the right
        const responsibleX = pageWidth - marginRight - responsibleColumnWidth;
        
        // Main content area (between label and responsibles)
        const contentX = marginLeft + labelWidth + 6;
        
        // Color-coded label on the left with rounded background
        doc.setFontSize(8);
        doc.setFont(settings.fontFamily, 'bold');
        
        const autoLabel = `${sectionNumber}${subLetter}`;
        const labelText = `${autoLabel})`;
        const labelTextWidth = doc.getTextWidth(labelText);
        
        // Get colors from layout settings
        const infoColor = layoutSettings?.labelColors?.info || (settings.primaryColor || '#3B82F6');
        const taskColor = layoutSettings?.labelColors?.task || '#F97316';
        
        if (item.itemType === 'infoItem') {
          // Blue background for Info
          const rgb = hexToRgb(infoColor);
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.roundedRect(labelX, yPosition - 3, labelWidth, 5.5, 1, 1, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text(labelText, labelX + (labelWidth - labelTextWidth) / 2, yPosition);
        } else {
          // Orange background for Aufgabe
          const rgb = hexToRgb(taskColor);
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.roundedRect(labelX, yPosition - 3, labelWidth, 5.5, 1, 1, 'F');
          doc.setTextColor(255, 255, 255);
          doc.text(labelText, labelX + (labelWidth - labelTextWidth) / 2, yPosition);
        }
        
        // Subject - bold and prominent (without type label)
        doc.setFontSize(baseFontSize);
        doc.setFont(settings.fontFamily, 'bold');
        doc.setTextColor(0, 0, 0);
        
        const cleanedSubject = (item.subject || '').trim();
        const subjectText = cleanedSubject === autoLabel ? '' : cleanedSubject;
        if (subjectText) {
          const subjectLines = doc.splitTextToSize(subjectText, contentWidth);
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
          doc.setTextColor(220, 38, 38); // Red color for due date
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
          
          const detailLines = doc.splitTextToSize(item.details, contentWidth);
          detailLines.forEach((line: string) => {
            doc.text(line, contentX, yPosition);
            yPosition += 4;
          });
          yPosition += 1;
        }

        // Task-specific information in gray (status, priority)
        if (item.itemType === 'actionItem') {
          doc.setFontSize(8);
          doc.setFont(settings.fontFamily, 'normal');
          doc.setTextColor(120, 120, 120);
          
          const taskInfo: string[] = [];
          
          if (settings.includeStatusBadges && item.status) {
            taskInfo.push(`Status: ${labels.statusLabels[item.status]}`);
          }

          if (settings.includePriorityBadges && item.priority) {
            const prioLabel = locale.startsWith('en') ? 'Priority' : 'Priorität';
            taskInfo.push(`${prioLabel}: ${labels.priorityLabels[item.priority]}`);
          }
          
          if (taskInfo.length > 0) {
            yPosition += 1;
            doc.text(taskInfo.join(' | '), contentX, yPosition);
            yPosition += 4;
          }
        }

        // Notes in italic gray
        if (settings.includeNotes && item.notes) {
          doc.setFontSize(8);
          doc.setFont(settings.fontFamily, 'italic');
          doc.setTextColor(120, 120, 120);
          
          const noteLines = doc.splitTextToSize(`${labels.note} ${item.notes}`, contentWidth);
          noteLines.forEach((line: string) => {
            doc.text(line, contentX, yPosition);
            yPosition += 4;
          });
        }

        // Separator line between items (with more spacing)
        yPosition += 4;
        
        // Get separator settings from layout
        const separatorElement = layoutSettings?.elements?.find((e) => e.id === 'separator');
        const separatorColor = separatorElement?.style?.borderColor || (settings.secondaryColor || '#E6E6E6');
        const separatorWidth = separatorElement?.style?.borderWidth || 0.3;
        const separatorRgb = hexToRgb(separatorColor);
        
        doc.setDrawColor(separatorRgb[0], separatorRgb[1], separatorRgb[2]);
        doc.setLineWidth(separatorWidth);
        doc.line(contentX, yPosition, pageWidth - marginRight - 4, yPosition);
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
    
    yPosition += Math.max(3, layoutSettings?.sectionSpacing || 4);
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

  if (cleanGlobalNote) {
    ensurePageSpace(16);

    // Draw border for global notes
    doc.setDrawColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
    doc.setLineWidth(0.5);
    
    const titleBarHeight = 10;
    doc.setFillColor(softHeaderFillRgb[0], softHeaderFillRgb[1], softHeaderFillRgb[2]);
    doc.roundedRect(marginLeft, yPosition, contentWidth, titleBarHeight, 1, 1, 'FD');
    
    doc.setFontSize(11);
    doc.setFont(settings.fontFamily, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(labels.generalNotes, marginLeft + 2, yPosition + 7);
    
    yPosition += titleBarHeight;
    const notesStartY = yPosition;

    yPosition += 3;
    doc.setFontSize(baseFontSize - 1);
    doc.setFont(settings.fontFamily, 'normal');
    const splitNote = doc.splitTextToSize(cleanGlobalNote, contentWidth - 8);
    splitNote.forEach((line: string) => {
      if (yPosition + 6 > pageBottomLimit) {
        doc.rect(marginLeft, notesStartY, contentWidth, yPosition - notesStartY);
        beginNewPage();
      }
      doc.text(line, marginLeft + 4, yPosition);
      yPosition += 4;
    });
    
    yPosition += 3;
    doc.rect(marginLeft, notesStartY, contentWidth, yPosition - notesStartY);
  }

  // Reopening History
  if (minute.reopeningHistory && minute.reopeningHistory.length > 0) {
    ensurePageSpace(20);

    yPosition += 10;

    // Colors
    const amber500: [number, number, number] = [245, 158, 11];
    const amber50: [number, number, number] = [255, 251, 235];
    const amber900: [number, number, number] = [120, 53, 15];

    // Header Bar
    const titleBarHeight = 7;
    doc.setFillColor(amber50[0], amber50[1], amber50[2]);
    doc.setDrawColor(amber500[0], amber500[1], amber500[2]);
    doc.setLineWidth(0.5);
    
    // Draw header background and border
    doc.rect(marginLeft, yPosition, contentWidth, titleBarHeight, 'FD');
    
    // Title
    doc.setFontSize(9);
    doc.setFont(settings.fontFamily, 'bold');
    doc.setTextColor(amber900[0], amber900[1], amber900[2]);
    doc.text(labels.reopeningHistory, marginLeft + 3, yPosition + 5);
    
    yPosition += titleBarHeight;
    const contentStartY = yPosition;
    
    // Content padding (top)
    yPosition += 8;

    minute.reopeningHistory.forEach((entry, _index) => {
      // Check for page break
      if (yPosition + 10 > pageBottomLimit) {
        // Close current box
        doc.setDrawColor(amber500[0], amber500[1], amber500[2]);
        doc.rect(marginLeft, contentStartY, contentWidth, yPosition - contentStartY);
        beginNewPage();
        
        // Restart content box on new page
        // For simplicity, just continue the box
      }

      const date = new Date(entry.reopenedAt).toLocaleString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Metadata line (Date - User)
      doc.setFont(settings.fontFamily, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128); // Gray-500
      
      // Bullet point
      doc.setFillColor(amber500[0], amber500[1], amber500[2]);
      doc.circle(marginLeft + 8, yPosition - 1, 0.8, 'F');
      
      doc.text(`${date} • ${entry.reopenedBy}`, marginLeft + 12, yPosition);
      yPosition += 5;

      // Reason text
      doc.setFont(settings.fontFamily, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(31, 41, 55); // Gray-800
      
      const reasonLines = doc.splitTextToSize(entry.reason, contentWidth - 24);
      reasonLines.forEach((line: string) => {
        doc.text(line, marginLeft + 12, yPosition);
        yPosition += 4.5;
      });

      // Spacing between entries
      yPosition += 3;
    });
    
    // Close the content box
    doc.setDrawColor(amber500[0], amber500[1], amber500[2]);
    doc.rect(marginLeft, contentStartY, contentWidth, yPosition - contentStartY);
  }

  // Footer with page numbers (simple style)
  const pageCount = doc.getNumberOfPages();
  if (settings.showFooter && (settings.showPageNumbers || settings.footerText || settings.footerLeftText)) {
    doc.setFontSize(8);
    doc.setFont(settings.fontFamily, 'normal');
    doc.setTextColor(80, 80, 80);
    const footerTextY = pageHeight - Math.max(8, marginBottom - 2);
    const footerLineY = footerTextY - 5;

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Draw a thin line above footer
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(marginLeft, footerLineY, pageWidth - marginRight, footerLineY);
      
      // "Confidential" on the left
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text((settings.footerLeftText || labels.confidential).trim(), marginLeft, footerTextY);
      
      // Custom footer text in center if provided
      if (settings.footerText) {
        const footerWidth = doc.getTextWidth(settings.footerText);
        doc.setTextColor(80, 80, 80);
        doc.text(settings.footerText, (pageWidth - footerWidth) / 2, footerTextY);
      }
      
      // Page numbers on the right
      if (settings.showPageNumbers) {
        const pageText = labels.pageOf(i, pageCount);
        const textWidth = doc.getTextWidth(pageText);
        doc.setTextColor(80, 80, 80);
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
