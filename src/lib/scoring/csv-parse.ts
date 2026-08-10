/** Minimal CSV parser (handles quoted fields with commas). */

export type CsvTable = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseCsv(text: string): CsvTable {
  const lines = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = splitCsvLine(lines[0]!).map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]!] = (cells[c] ?? "").trim();
    }
    rows.push(row);
  }

  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function csvPreview(content: string, maxRows = 10): {
  preview: string;
  rowCount: number;
} {
  const table = parseCsv(content);
  const head = table.headers.join(",");
  const body = table.rows
    .slice(0, maxRows)
    .map((r) => table.headers.map((h) => r[h] ?? "").join(","))
    .join("\n");
  return {
    preview: body ? `${head}\n${body}` : head,
    rowCount: table.rows.length,
  };
}

export function toCsv(headers: string[], rows: Record<string, string>[]): string {
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? "")).join(","));
  }
  return lines.join("\n") + "\n";
}
