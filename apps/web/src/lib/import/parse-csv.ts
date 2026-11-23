/**
 * Dependency-free CSV parser for the import engine.
 *
 * Handles quoted fields ("" escapes, delimiters and newlines inside quotes),
 * auto-detects the delimiter (comma / semicolon / tab) and normalizes CRLF.
 * Used by both the import page (client) and /api/import/google (server).
 */

export interface ParsedCsv {
  columns: string[];
  rows: Array<Record<string, string>>;
}

/** First logical line (quote-aware), used for delimiter detection. */
function firstLogicalLine(text: string): string {
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && (ch === '\n' || ch === '\r')) {
      return text.slice(0, i);
    }
  }
  return text;
}

/** Pick the delimiter (comma / semicolon / tab) that occurs most often outside quotes. */
function detectDelimiter(line: string): string {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = 0;
  for (const delimiter of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && ch === delimiter) {
        count++;
      }
    }
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }
  return best;
}

/** Split CSV text into a raw table of cells (RFC 4180-style quoting, CRLF-safe). */
function parseCells(text: string, delimiter: string): string[][] {
  const table: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    table.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i++;
      continue;
    }
    if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      i++;
      pushRow();
      continue;
    }
    if (ch === '\n') {
      i++;
      pushRow();
      continue;
    }
    field += ch;
    i++;
  }
  pushRow();
  return table;
}

/**
 * Parse CSV text into column headers (first row) and data rows.
 * Empty lines are skipped, duplicate/empty headers get stable unique names.
 */
export function parseCsvToRows(text: string): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, '');
  if (!clean.trim()) {
    return { columns: [], rows: [] };
  }

  const delimiter = detectDelimiter(firstLogicalLine(clean));
  const table = parseCells(clean, delimiter).filter((cells) =>
    cells.some((cell) => cell.trim() !== ''),
  );
  if (table.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns: string[] = [];
  const seen = new Map<string, number>();
  table[0].forEach((header, index) => {
    let name = header.trim() || `Column ${index + 1}`;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count > 0) {
      name = `${name} (${count + 1})`;
    }
    columns.push(name);
  });

  const rows = table.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    columns.forEach((column, index) => {
      row[column] = (cells[index] ?? '').trim();
    });
    return row;
  });

  return { columns, rows };
}
