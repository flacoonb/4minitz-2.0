import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UserOptions } from 'jspdf-autotable';
import { IPdfLayoutSettings, ILayoutElement } from '@/models/PdfLayoutSettings';

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

interface IParticipant {
  userId: string;
  attendance: 'present' | 'excused' | 'absent';
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
    notSpecified: isEn ? 'Not specified' : 'Nicht angegeben',
    guests: isEn ? 'Guests:' : 'Gäste:',
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
  layoutSettings?: IPdfLayoutSettings
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Set font
  doc.setFont(settings.fontFamily);

  // Base font size from settings (used for body text)
  const baseFontSize = settings.fontSize || 10;

  // i18n labels
  const locale = settings.locale || 'de-DE';
  const labels = getLabels(locale);

  // Add draft watermark if not finalized
  if (!minute.isFinalized) {
    addDraftWatermark(doc, labels.draft);
  }

  // ===== HEADER SECTION WITH BORDER =====
  const headerHeight = 70;
  
  // Draw outer border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPosition, pageWidth - 2 * margin, headerHeight);
  
  // Right section - Attendance table
  const attendanceWidth = 90;
  doc.line(pageWidth - margin - attendanceWidth, yPosition, pageWidth - margin - attendanceWidth, yPosition + headerHeight);
  
  // Left section - Logo and Protocol info
  const leftSectionWidth = pageWidth - 2 * margin - attendanceWidth;
  
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
      let logoX = margin + 5;
      if (settings.logoPosition === 'center') {
        logoX = margin + (leftSectionWidth - logoWidth) / 2;
      } else if (settings.logoPosition === 'right') {
        logoX = margin + leftSectionWidth - logoWidth - 5;
      }

      // Center vertically within the logo area
      const logoY = yPosition + 5 + (logoMaxHeight - logoHeight) / 2;

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
  
  // Title "Protokoll" or custom header text
  doc.setFontSize(24);
  doc.setFont(settings.fontFamily, 'bold');
  doc.setTextColor(0, 0, 0);
  
  const titleText = (settings.showHeader && settings.headerText) ? settings.headerText : labels.protocol;
  doc.text(titleText, margin + 5, yPosition + 55);
  
  // Company Name (if set)
  if (settings.companyName) {
    doc.setFontSize(10);
    doc.setFont(settings.fontFamily, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(settings.companyName, margin + 5, yPosition + 45);
  }
  
  // Meeting series and protocol name below "Protokoll" (left-aligned)
  const sessionName = minute.meetingSeries_id?.project || '';
  const yearName = minute.meetingSeries_id?.name || '';
  const protocolName = yearName ? `${sessionName} – ${yearName}` : sessionName;
  
  if (protocolName) {
    doc.setFontSize(11);
    doc.setFont(settings.fontFamily, 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(protocolName, margin + 5, yPosition + 65);
  }
  
  // Attendance header in right section
  doc.setFontSize(9);
  doc.setFont(settings.fontFamily, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(labels.attendance, pageWidth - margin - attendanceWidth + 5, yPosition + 8);
  
  // Attendance columns with better formatting
  const colAX = pageWidth - margin - 32;
  const colEX = pageWidth - margin - 20;
  const colNeX = pageWidth - margin - 8;
  
  // Draw column headers with borders
  doc.setFontSize(7);
  doc.setFont(settings.fontFamily, 'bold');
  const headerY = yPosition + 14;
  
  // Column headers
  doc.text(labels.present, colAX - 0.5, headerY);
  doc.text(labels.excused, colEX - 0.5, headerY);
  doc.text(labels.absent, colNeX - 1.5, headerY);
  
  // List participants with checkboxes
  doc.setFont(settings.fontFamily, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  let attendanceY = yPosition + 20;
  
  // Use participantsWithStatus if available, otherwise fall back to participants
  const participantsList = minute.participantsWithStatus || 
    minute.participants.map(p => ({ userId: p, attendance: 'present' as const }));
  
  // Adjust max participants if guests are present to make space
  const hasGuests = !!minute.participantsAdditional;
  const maxParticipantsLimit = hasGuests ? 5 : 8;
  const maxParticipants = Math.min(participantsList.length, maxParticipantsLimit);
  
  for (let i = 0; i < maxParticipants; i++) {
    const participant = participantsList[i];
    const participantUser = allUsers.find(u => u._id === participant.userId);
    const participantName = participantUser 
      ? `${participantUser.firstName} ${participantUser.lastName}`
      : getUserInitials(participant.userId, allUsers);
    
    doc.text(participantName, pageWidth - margin - attendanceWidth + 5, attendanceY);
    
    // Draw checkboxes based on attendance status
    doc.setLineWidth(0.3);
    
    // Anwesend (present) checkbox
    doc.rect(colAX - 2, attendanceY - 3, 3, 3);
    if (participant.attendance === 'present') {
      doc.setFontSize(8);
      doc.setFont(settings.fontFamily, 'bold');
      doc.text('x', colAX - 0.5, attendanceY - 0.3, { align: 'center' });
      doc.setFont(settings.fontFamily, 'normal');
      doc.setFontSize(8);
    }
    
    // Entschuldigt (excused) checkbox
    doc.rect(colEX - 2, attendanceY - 3, 3, 3);
    if (participant.attendance === 'excused') {
      doc.setFontSize(8);
      doc.setFont(settings.fontFamily, 'bold');
      doc.text('x', colEX - 0.5, attendanceY - 0.3, { align: 'center' });
      doc.setFont(settings.fontFamily, 'normal');
      doc.setFontSize(8);
    }
    
    // Nicht entschuldigt (absent/not excused) checkbox
    doc.rect(colNeX - 2, attendanceY - 3, 3, 3);
    if (participant.attendance === 'absent') {
      doc.setFontSize(8);
      doc.setFont(settings.fontFamily, 'bold');
      doc.text('x', colNeX - 0.5, attendanceY - 0.3, { align: 'center' });
      doc.setFont(settings.fontFamily, 'normal');
      doc.setFontSize(8);
    }
    
    attendanceY += 5;
  }
  
  if (participantsList.length > maxParticipants) {
    doc.setFontSize(7);
    doc.text(`+${participantsList.length - maxParticipants} ${labels.more}`, pageWidth - margin - attendanceWidth + 5, attendanceY);
    attendanceY += 5;
  }

  // Guests
  if (hasGuests && minute.participantsAdditional) {
    attendanceY += 1;
    doc.setFontSize(8);
    doc.setFont(settings.fontFamily, 'bold');
    doc.text(labels.guests, pageWidth - margin - attendanceWidth + 5, attendanceY);
    attendanceY += 4;
    
    doc.setFont(settings.fontFamily, 'normal');
    const guestLines = doc.splitTextToSize(minute.participantsAdditional, attendanceWidth - 10);
    
    const maxGuestY = yPosition + headerHeight - 8;
    
    for (const line of guestLines) {
      if (attendanceY > maxGuestY) break;
      doc.text(line, pageWidth - margin - attendanceWidth + 5, attendanceY);
      attendanceY += 4;
    }
  }
  
  // Legend at bottom of attendance
  doc.setFontSize(6);
  doc.setTextColor(100, 100, 100);
  const legendText = `${labels.legendPresent}; ${labels.legendExcused}; ${labels.legendAbsent}`;
  const legendLines = doc.splitTextToSize(legendText, attendanceWidth - 10);
  doc.text(legendLines, pageWidth - margin - attendanceWidth + 5, yPosition + headerHeight - 5);
  
  yPosition += headerHeight + 5;
  
  // ===== INFO BOX (Ort, Datum, Zeit) =====
  doc.setTextColor(0, 0, 0);
  const infoBoxHeight = 15;
  doc.rect(margin, yPosition, pageWidth - 2 * margin, infoBoxHeight);
  
  // Divide into 3 columns
  const col1X = margin;
  const col2X = margin + (pageWidth - 2 * margin) / 3;
  const col3X = margin + 2 * (pageWidth - 2 * margin) / 3;
  
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
  
  const timeText = minute.time || labels.notSpecified;
  doc.text(timeText, col3X + 2, yPosition + 11);
  
  yPosition += infoBoxHeight + (layoutSettings?.sectionSpacing || 5);

  // ===== TOPICS AS NUMBERED SECTIONS =====
  minute.topics.forEach((topic, topicIndex) => {
    // Calculate total height needed for this topic
    const calculateTopicHeight = () => {
      let estimatedHeight = 0;
      
      // Title bar height
      const topicTitleElement = layoutSettings?.elements?.find((e) => e.id === 'topic-title');
      const titleBarHeight = topicTitleElement?.size?.height || 10;
      estimatedHeight += titleBarHeight;
      
      // Estimate height for all items
      const allItems = (topic.infoItems || []);
      
      allItems.forEach(() => {
        // Rough estimate: ~25-30 per item (subject + details + spacing)
        estimatedHeight += 30;
      });
      
      estimatedHeight += 10; // Bottom padding
      
      return estimatedHeight;
    };
    
    const topicHeight = calculateTopicHeight();
    
    // Check if entire topic fits on current page, otherwise start new page
    if (yPosition + topicHeight > pageHeight - 40) {
      doc.addPage();
      yPosition = margin;
      
      // Add draft watermark on new page
      if (!minute.isFinalized) {
        addDraftWatermark(doc, labels.draft);
      }
    }

    // Section number and title with border
    const sectionNumber = topicIndex + 1;
    
    // Get topic title settings from layout
    const topicTitleElement = layoutSettings?.elements?.find((e) => e.id === 'topic-title');
    const topicBgColor = topicTitleElement?.style?.backgroundColor || '#F3F4F6';
    const topicFontSize = topicTitleElement?.style?.fontSize || 11;
    const topicBorderWidth = topicTitleElement?.style?.borderWidth || 0.5;
    
    // Draw section border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(topicBorderWidth);
    
    // Title bar with background color
    const titleBarHeight = topicTitleElement?.size?.height || 10;
    
    // Fill background
    if (topicBgColor && topicBgColor !== '#FFFFFF') {
      const bgRgb = hexToRgb(topicBgColor);
      doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, titleBarHeight, 'FD');
    } else {
      doc.rect(margin, yPosition, pageWidth - 2 * margin, titleBarHeight);
    }
    
    // Section title
    doc.setFontSize(topicFontSize);
    doc.setFont(settings.fontFamily, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${sectionNumber}. ${topic.subject}`, margin + 2, yPosition + 7);
    
    yPosition += titleBarHeight;
    
    // Content area start position
    let contentStartY = yPosition;
    let contentHeight = 5; // Minimum padding

    // Info Items as subsections with improved layout
    if (topic.infoItems && topic.infoItems.length > 0) {
      topic.infoItems.forEach((item, itemIndex) => {
        const subLetter = String.fromCharCode(97 + itemIndex); // a, b, c, etc.
        
        // Calculate estimated height for this item
        const calculateItemHeight = () => {
          let estimatedHeight = 0;
          
          // Label and subject (minimum 2 lines)
          estimatedHeight += 10;
          
          // Details if present
          if (item.details) {
            const detailLines = Math.ceil(item.details.length / 80); // Rough estimate
            estimatedHeight += detailLines * 4;
          }
          
          // Due date if present
          if (item.itemType === 'actionItem' && item.dueDate) {
            estimatedHeight += 5;
          }
          
          // Notes if present
          if (item.notes && item.notes.length > 0) {
            estimatedHeight += item.notes.length * 4;
          }
          
          // Spacing and separator
          estimatedHeight += 10;
          
          return estimatedHeight;
        };
        
        const itemHeight = calculateItemHeight();
        
        // Check if item fits on current page, otherwise start new page
        if (yPosition + itemHeight > pageHeight - 40) {
          // Close current border before page break
          doc.rect(margin, contentStartY, pageWidth - 2 * margin, yPosition - contentStartY);
          doc.addPage();
          yPosition = margin;
          
          // Add draft watermark on new page
          if (!minute.isFinalized) {
            addDraftWatermark(doc, labels.draft);
          }
          
          // Continue border on new page without repeating the title
          contentStartY = yPosition;
        }

        const itemStartY = yPosition + (layoutSettings?.itemSpacing || 5);
        yPosition = itemStartY;
        
        // Label on the LEFT side (outside the main content) with color coding
        const labelWidth = layoutSettings?.elements?.find((e) => e.id === 'item-label')?.size?.width || 12;
        const labelX = margin + 2;
        
        // Responsible column on the right
        const responsibleColumnWidth = 35;
        const responsibleX = pageWidth - margin - responsibleColumnWidth;
        
        // Main content area (between label and responsibles)
        const contentX = margin + labelWidth + 6;
        const contentWidth = pageWidth - 2 * margin - labelWidth - responsibleColumnWidth - 12;
        
        // Color-coded label on the left with rounded background
        doc.setFontSize(8);
        doc.setFont(settings.fontFamily, 'bold');
        
        const labelText = `${sectionNumber}${subLetter})`;
        const labelTextWidth = doc.getTextWidth(labelText);
        
        // Get colors from layout settings
        const infoColor = layoutSettings?.labelColors?.info || '#3B82F6';
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
        
        const subjectLines = doc.splitTextToSize(item.subject, contentWidth);
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
        } else if (settings.includeNotes && !item.notes) {
          // Show "Notiz: keine" if no notes
          doc.setFontSize(8);
          doc.setFont(settings.fontFamily, 'italic');
          doc.setTextColor(120, 120, 120);
          doc.text(labels.noNote, contentX, yPosition);
          yPosition += 4;
        }

        // Separator line between items (with more spacing)
        yPosition += 4;
        
        // Get separator settings from layout
        const separatorElement = layoutSettings?.elements?.find((e) => e.id === 'separator');
        const separatorColor = separatorElement?.style?.borderColor || '#E6E6E6';
        const separatorWidth = separatorElement?.style?.borderWidth || 0.3;
        const separatorRgb = hexToRgb(separatorColor);
        
        doc.setDrawColor(separatorRgb[0], separatorRgb[1], separatorRgb[2]);
        doc.setLineWidth(separatorWidth);
        doc.line(contentX, yPosition, pageWidth - margin - 4, yPosition);
        yPosition += 5;
      });
    } else {
      // Empty section
      yPosition += 8;
      doc.setFontSize(9);
      doc.setFont(settings.fontFamily, 'italic');
      doc.setTextColor(150, 150, 150);
      doc.text(labels.noEntries, margin + 4, yPosition);
      yPosition += 5;
    }

    // Close section border
    contentHeight = yPosition - contentStartY + 3;
    doc.rect(margin, contentStartY, pageWidth - 2 * margin, contentHeight);
    
    yPosition += 5;
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
    if (yPosition > pageHeight - 50) {
      doc.addPage();
      yPosition = margin;
      
      // Add draft watermark on new page
      if (!minute.isFinalized) {
        addDraftWatermark(doc, labels.draft);
      }
    }

    // Draw border for global notes
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    
    const titleBarHeight = 10;
    doc.rect(margin, yPosition, pageWidth - 2 * margin, titleBarHeight);
    
    doc.setFontSize(11);
    doc.setFont(settings.fontFamily, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(labels.generalNotes, margin + 2, yPosition + 7);
    
    yPosition += titleBarHeight;
    const notesStartY = yPosition;

    yPosition += 3;
    doc.setFontSize(baseFontSize - 1);
    doc.setFont(settings.fontFamily, 'normal');
    const splitNote = doc.splitTextToSize(cleanGlobalNote, pageWidth - 2 * margin - 8);
    splitNote.forEach((line: string) => {
      if (yPosition > pageHeight - 30) {
        doc.rect(margin, notesStartY, pageWidth - 2 * margin, yPosition - notesStartY);
        doc.addPage();
        yPosition = margin;
        
        // Add draft watermark on new page
        if (!minute.isFinalized) {
          addDraftWatermark(doc, labels.draft);
        }
      }
      doc.text(line, margin + 4, yPosition);
      yPosition += 4;
    });
    
    yPosition += 3;
    doc.rect(margin, notesStartY, pageWidth - 2 * margin, yPosition - notesStartY);
  }

  // Reopening History
  if (minute.reopeningHistory && minute.reopeningHistory.length > 0) {
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = margin;
      
      // Add draft watermark on new page
      if (!minute.isFinalized) {
        addDraftWatermark(doc, labels.draft);
      }
    }

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
    doc.rect(margin, yPosition, pageWidth - 2 * margin, titleBarHeight, 'FD');
    
    // Title
    doc.setFontSize(9);
    doc.setFont(settings.fontFamily, 'bold');
    doc.setTextColor(amber900[0], amber900[1], amber900[2]);
    doc.text(labels.reopeningHistory, margin + 3, yPosition + 5);
    
    yPosition += titleBarHeight;
    const contentStartY = yPosition;
    
    // Content padding (top)
    yPosition += 8;

    minute.reopeningHistory.forEach((entry, _index) => {
      // Check for page break
      if (yPosition > pageHeight - 30) {
        // Close current box
        doc.setDrawColor(amber500[0], amber500[1], amber500[2]);
        doc.rect(margin, contentStartY, pageWidth - 2 * margin, yPosition - contentStartY);
        
        doc.addPage();
        yPosition = margin;
        
        // Add draft watermark on new page
        if (!minute.isFinalized) {
          addDraftWatermark(doc, labels.draft);
        }
        
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
      doc.circle(margin + 8, yPosition - 1, 0.8, 'F');
      
      doc.text(`${date} • ${entry.reopenedBy}`, margin + 12, yPosition);
      yPosition += 5;

      // Reason text
      doc.setFont(settings.fontFamily, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(31, 41, 55); // Gray-800
      
      const reasonLines = doc.splitTextToSize(entry.reason, pageWidth - 2 * margin - 24);
      reasonLines.forEach((line: string) => {
        doc.text(line, margin + 12, yPosition);
        yPosition += 4.5;
      });

      // Spacing between entries
      yPosition += 3;
    });
    
    // Close the content box
    doc.setDrawColor(amber500[0], amber500[1], amber500[2]);
    doc.rect(margin, contentStartY, pageWidth - 2 * margin, yPosition - contentStartY);
  }

  // Footer with page numbers (simple style)
  const pageCount = doc.getNumberOfPages();
  if (settings.showPageNumbers || settings.footerText) {
    doc.setFontSize(8);
    doc.setFont(settings.fontFamily, 'normal');
    doc.setTextColor(80, 80, 80);

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Draw a thin line above footer
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      // "Confidential" on the left
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(labels.confidential, margin, pageHeight - 10);
      
      // Custom footer text in center if provided
      if (settings.footerText) {
        const footerWidth = doc.getTextWidth(settings.footerText);
        doc.setTextColor(80, 80, 80);
        doc.text(settings.footerText, (pageWidth - footerWidth) / 2, pageHeight - 10);
      }
      
      // Page numbers on the right
      if (settings.showPageNumbers) {
        const pageText = labels.pageOf(i, pageCount);
        const textWidth = doc.getTextWidth(pageText);
        doc.setTextColor(80, 80, 80);
        doc.text(pageText, pageWidth - margin - textWidth, pageHeight - 10);
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
