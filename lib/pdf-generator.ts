import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { IMinutes } from '@/models/Minutes';
import { IMeetingSeries } from '@/models/MeetingSeries';

export interface PDFOptions {
  locale?: 'de' | 'en';
  includeTopics?: boolean;
  includeInfoItems?: boolean;
  includeParticipants?: boolean;
}

const translations = {
  de: {
    title: 'Protokoll',
    session: 'Sitzung',
    date: 'Datum',
    participants: 'Teilnehmer',
    topics: 'Themen',
    infoItems: 'Informationspunkte',
    actionItems: 'Aktionspunkte',
    responsible: 'Verantwortlich',
    dueDate: 'Fällig',
    priority: 'Priorität',
    status: 'Status',
    open: 'Offen',
    inProgress: 'In Bearbeitung',
    done: 'Erledigt',
    high: 'Hoch',
    medium: 'Mittel',
    low: 'Niedrig',
    noTopics: 'Keine Themen vorhanden',
    noInfoItems: 'Keine Informationspunkte',
    generatedAt: 'Erstellt am',
    page: 'Seite',
    of: 'von',
  },
  en: {
    title: 'Minutes',
    session: 'Session',
    date: 'Date',
    participants: 'Participants',
    topics: 'Topics',
    infoItems: 'Information Items',
    actionItems: 'Action Items',
    responsible: 'Responsible',
    dueDate: 'Due Date',
    priority: 'Priority',
    status: 'Status',
    open: 'Open',
    inProgress: 'In Progress',
    done: 'Done',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    noTopics: 'No topics available',
    noInfoItems: 'No information items',
    generatedAt: 'Generated on',
    page: 'Page',
    of: 'of',
  },
};

export function generateMinutesPDF(
  minute: IMinutes & { meetingSeries?: IMeetingSeries },
  options: PDFOptions = {}
): jsPDF {
  const {
    locale = 'de',
    includeTopics = true,
    includeInfoItems = true,
    includeParticipants = true,
  } = options;

  const t = translations[locale];
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(t.title, 14, 20);

  // Session info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  let yPosition = 30;

  if (minute.meetingSeries?.name) {
    doc.text(`${t.session}: ${minute.meetingSeries.name}`, 14, yPosition);
    yPosition += 7;
  }

  doc.text(`${t.date}: ${new Date(minute.date).toLocaleDateString(locale)}`, 14, yPosition);
  yPosition += 10;

  // Participants
  if (includeParticipants && minute.participants && minute.participants.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${t.participants}:`, 14, yPosition);
    yPosition += 7;
    doc.setFont('helvetica', 'normal');
    minute.participants.forEach((participant: string) => {
      doc.text(`• ${participant}`, 20, yPosition);
      yPosition += 6;
    });
    yPosition += 5;
  }

  // Topics
  if (includeTopics && minute.topics && minute.topics.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(t.topics, 14, yPosition);
    yPosition += 10;

    minute.topics.forEach((topic: any, index: number) => {
      // Check if we need a new page
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${topic.subject}`, 14, yPosition);
      yPosition += 7;

      // Info items
      if (includeInfoItems && topic.infoItems && topic.infoItems.length > 0) {
        const infoItemsData: any[] = [];
        const actionItemsData: any[] = [];

        topic.infoItems.forEach((item: any) => {
          if (item.isActionItem) {
            actionItemsData.push([
              item.subject,
              item.responsibles?.join(', ') || '-',
              item.dueDate ? new Date(item.dueDate).toLocaleDateString(locale) : '-',
              item.priority ? t[item.priority as keyof typeof t] : '-',
              item.isSticky ? '📌' : '',
            ]);
          } else {
            infoItemsData.push([item.subject, item.details || '']);
          }
        });

        // Regular info items table
        if (infoItemsData.length > 0) {
          autoTable(doc, {
            startY: yPosition,
            head: [[t.infoItems, '']],
            body: infoItemsData,
            theme: 'grid',
            headStyles: { fillColor: [100, 100, 100], fontSize: 10 },
            styles: { fontSize: 9 },
            margin: { left: 20 },
          });
          yPosition = (doc as any).lastAutoTable.finalY + 7;
        }

        // Action items table
        if (actionItemsData.length > 0) {
          // Check if we need a new page
          if (yPosition > 240) {
            doc.addPage();
            yPosition = 20;
          }

          autoTable(doc, {
            startY: yPosition,
            head: [[t.actionItems, t.responsible, t.dueDate, t.priority, '']],
            body: actionItemsData,
            theme: 'grid',
            headStyles: { fillColor: [220, 53, 69], fontSize: 10 },
            styles: { fontSize: 9 },
            margin: { left: 20 },
          });
          yPosition = (doc as any).lastAutoTable.finalY + 10;
        }
      }
    });
  } else if (includeTopics) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.text(t.noTopics, 14, yPosition);
    yPosition += 10;
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128);
    doc.text(
      `${t.generatedAt}: ${new Date().toLocaleString(locale)}`,
      14,
      doc.internal.pageSize.height - 10
    );
    doc.text(
      `${t.page} ${i} ${t.of} ${pageCount}`,
      doc.internal.pageSize.width - 30,
      doc.internal.pageSize.height - 10
    );
  }

  return doc;
}

export function downloadMinutesPDF(
  minute: IMinutes & { meetingSeries?: IMeetingSeries },
  options: PDFOptions = {}
): void {
  const doc = generateMinutesPDF(minute, options);
  const fileName = `minutes-${minute.meetingSeries?.name || 'unknown'}-${
    new Date(minute.date).toISOString().split('T')[0]
  }.pdf`;
  doc.save(fileName);
}
