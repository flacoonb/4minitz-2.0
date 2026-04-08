export type MinutesMarkdownStatus = 'open' | 'in-progress' | 'completed' | 'cancelled';
export type MinutesMarkdownPriority = 'high' | 'medium' | 'low';

export interface MinutesMarkdownInfoItem {
  subject: string;
  details?: string;
  itemType: 'actionItem' | 'infoItem';
  status?: MinutesMarkdownStatus;
  priority?: MinutesMarkdownPriority;
  dueDate?: string;
  durationMinutes?: number;
  responsibles?: string[];
  notes?: string;
}

export interface MinutesMarkdownTopic {
  subject: string;
  responsibles: string[];
  infoItems: MinutesMarkdownInfoItem[];
}

export interface ParsedMinutesMarkdown {
  topics: MinutesMarkdownTopic[];
  warnings: string[];
}

const TOPIC_PREFIX = '## ';
const STATUS_TOKEN_MAP: Record<string, MinutesMarkdownStatus> = {
  ' ': 'open',
  x: 'completed',
  '~': 'in-progress',
  '!': 'cancelled',
};

function normalizeDate(input: string): string | undefined {
  const value = input.trim();
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return undefined;
}

function parseInlineTags(
  rawText: string
): {
  text: string;
  dueDate?: string;
  durationMinutes?: number;
  priority?: MinutesMarkdownPriority;
  responsibles?: string[];
} {
  let text = rawText;
  const responsibles = new Set<string>();
  let dueDate: string | undefined;
  let durationMinutes: number | undefined;
  let priority: MinutesMarkdownPriority | undefined;

  // @user1,@user2 (supports unicode letters/numbers plus . _ : -)
  text = text.replace(/(^|\s)@([\p{L}\p{N}._:-]+(?:,[\p{L}\p{N}._:-]+)*)/gu, (_match, prefix, users) => {
    users
      .split(',')
      .map((u: string) => u.trim())
      .filter(Boolean)
      .forEach((u: string) => responsibles.add(u));
    return prefix;
  });

  // due:YYYY-MM-DD
  text = text.replace(/(^|\s)due:(\S+)/gi, (_match, prefix, rawDate) => {
    const parsed = normalizeDate(rawDate);
    if (parsed) {
      dueDate = parsed;
    }
    return prefix;
  });

  // dur:15 | duration:15 (minutes)
  text = text.replace(/(^|\s)(?:dur|duration):(\d{1,4})\b/gi, (_match, prefix, rawMinutes) => {
    const parsed = Number.parseInt(rawMinutes, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      durationMinutes = Math.min(parsed, 1440);
    }
    return prefix;
  });

  // !high | !medium | !low
  text = text.replace(/(^|\s)!(high|medium|low)\b/gi, (_match, prefix, p) => {
    priority = p.toLowerCase() as MinutesMarkdownPriority;
    return prefix;
  });

  return {
    text: text.replace(/\s{2,}/g, ' ').trim(),
    dueDate,
    durationMinutes,
    priority,
    responsibles: responsibles.size > 0 ? Array.from(responsibles) : undefined,
  };
}

export function parseMinutesMarkdown(markdown: string): ParsedMinutesMarkdown {
  const warnings: string[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  const topics: MinutesMarkdownTopic[] = [];
  let currentTopic: MinutesMarkdownTopic | null = null;
  let lastItem: MinutesMarkdownInfoItem | null = null;
  let inNotesBlock = false;

  const ensureTopic = () => {
    if (!currentTopic) {
      currentTopic = { subject: 'Schnellerfassung', responsibles: [], infoItems: [] };
      topics.push(currentTopic);
    }
    return currentTopic;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      if (inNotesBlock && lastItem?.notes) {
        lastItem.notes += '\n';
      }
      continue;
    }

    if (trimmed.startsWith(TOPIC_PREFIX)) {
      const subject = trimmed.slice(TOPIC_PREFIX.length).trim();
      if (!subject) {
        warnings.push(`Zeile ${i + 1}: Leeres Traktandum wurde übersprungen.`);
        continue;
      }
      currentTopic = { subject, responsibles: [], infoItems: [] };
      topics.push(currentTopic);
      lastItem = null;
      inNotesBlock = false;
      continue;
    }

    const taskMatch = trimmed.match(/^- \[([ x~!])\]\s+(.+)$/i);
    if (taskMatch) {
      const topic = ensureTopic();
      const statusToken = taskMatch[1].toLowerCase();
      const status = STATUS_TOKEN_MAP[statusToken] ?? 'open';
      const parsed = parseInlineTags(taskMatch[2].trim());
      if (!parsed.text) {
        warnings.push(`Zeile ${i + 1}: Aufgabe ohne Titel wurde übersprungen.`);
        continue;
      }
      const item: MinutesMarkdownInfoItem = {
        itemType: 'actionItem',
        subject: parsed.text,
        status,
        priority: parsed.priority || 'medium',
        dueDate: parsed.dueDate,
        durationMinutes: parsed.durationMinutes,
        responsibles: parsed.responsibles || [],
      };
      topic.infoItems.push(item);
      lastItem = item;
      inNotesBlock = false;
      continue;
    }

    const infoMatch = trimmed.match(/^- \[i\]\s+(.+)$/i) || trimmed.match(/^- i:\s+(.+)$/i);
    if (infoMatch) {
      const topic = ensureTopic();
      const parsed = parseInlineTags(infoMatch[1].trim());
      if (!parsed.text) {
        warnings.push(`Zeile ${i + 1}: Info-Eintrag ohne Betreff wurde übersprungen.`);
        continue;
      }
      const item: MinutesMarkdownInfoItem = {
        itemType: 'infoItem',
        subject: parsed.text,
        status: 'open',
        priority: 'medium',
        durationMinutes: parsed.durationMinutes,
        responsibles: parsed.responsibles || [],
      };
      topic.infoItems.push(item);
      lastItem = item;
      inNotesBlock = false;
      continue;
    }

    const noteStartMatch = trimmed.match(/^(?:note|beschluss|information|decision|info):\s*(.*)$/i);
    if (noteStartMatch && lastItem) {
      const initial = noteStartMatch[1].trim();
      lastItem.notes = initial;
      inNotesBlock = true;
      continue;
    }

    // Support multiline details / notes with indentation.
    if (line.startsWith('  ') || line.startsWith('\t')) {
      if (!lastItem) {
        warnings.push(`Zeile ${i + 1}: Eingerückte Zeile ohne vorherigen Eintrag ignoriert.`);
        continue;
      }

      const content = trimmed;
      if (inNotesBlock) {
        lastItem.notes = lastItem.notes ? `${lastItem.notes}\n${content}` : content;
      } else {
        lastItem.details = lastItem.details ? `${lastItem.details}\n${content}` : content;
      }
      continue;
    }

    warnings.push(`Zeile ${i + 1}: Unbekanntes Muster ignoriert.`);
  }

  const nonEmptyTopics = topics
    .map((topic) => ({
      ...topic,
      infoItems: topic.infoItems.filter((item) => item.subject.trim().length > 0),
    }))
    .filter((topic) => topic.subject.trim().length > 0);

  return { topics: nonEmptyTopics, warnings };
}

export function serializeTopicsToMarkdown(topics: MinutesMarkdownTopic[]): string {
  const lines: string[] = [];

  topics.forEach((topic) => {
    lines.push(`## ${topic.subject || 'Traktandum'}`);
    if (!topic.infoItems || topic.infoItems.length === 0) {
      lines.push('');
      return;
    }

    topic.infoItems.forEach((item) => {
      if (item.itemType === 'actionItem') {
        const statusToken =
          item.status === 'completed'
            ? 'x'
            : item.status === 'in-progress'
              ? '~'
              : item.status === 'cancelled'
                ? '!'
                : ' ';
        const tags: string[] = [];
        if (item.priority && item.priority !== 'medium') {
          tags.push(`!${item.priority}`);
        }
        if (item.dueDate) {
          tags.push(`due:${item.dueDate.split('T')[0]}`);
        }
        if (item.durationMinutes && item.durationMinutes > 0) {
          tags.push(`dur:${Math.round(item.durationMinutes)}`);
        }
        if (item.responsibles && item.responsibles.length > 0) {
          tags.push(`@${item.responsibles.join(',')}`);
        }
        const suffix = tags.length > 0 ? ` ${tags.join(' ')}` : '';
        lines.push(`- [${statusToken}] ${item.subject}${suffix}`);
      } else {
        const tagsRaw: string[] = [];
        if (item.durationMinutes && item.durationMinutes > 0) {
          tagsRaw.push(`dur:${Math.round(item.durationMinutes)}`);
        }
        if (item.responsibles && item.responsibles.length > 0) {
          tagsRaw.push(`@${item.responsibles.join(',')}`);
        }
        const tags = tagsRaw.length > 0 ? ` ${tagsRaw.join(' ')}` : '';
        lines.push(`- [i] ${item.subject}${tags}`);
      }

      if (item.details) {
        item.details.split('\n').forEach((line) => lines.push(`  ${line}`));
      }
      if (item.notes) {
        const noteKey = item.itemType === 'actionItem' ? 'beschluss' : 'information';
        lines.push(`  ${noteKey}: ${item.notes.split('\n')[0]}`);
        item.notes
          .split('\n')
          .slice(1)
          .forEach((line) => lines.push(`  ${line}`));
      }
    });

    lines.push('');
  });

  return lines.join('\n').trim();
}

export function getMinutesMarkdownTemplate(): string {
  return [
    '## Traktandum 1',
    '- [i] Information zum Thema @userId',
    '  Weitere Details zur Information',
    '- [ ] Aufgabe erfassen !high due:2026-03-20 dur:15 @userId',
    '  Details zur Aufgabe',
    '  beschluss: Optionaler Kommentar',
    '',
    '## Traktandum 2',
    '- [~] Laufende Aufgabe !medium @userA,userB',
    '- [x] Erledigte Aufgabe',
  ].join('\n');
}
