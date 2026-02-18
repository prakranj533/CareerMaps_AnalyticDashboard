// Google Sheets gviz fetch utility
// Reads a specific tab (gid) from a public, view-only Google Sheet and returns an array of row objects

export interface GvizRowObject {
  [key: string]: any;
}

export async function fetchSheetTabAsObjects(params: {
  sheetId: string;
  gid?: string | number;
  signal?: AbortSignal;
}): Promise<GvizRowObject[]> {
  const { sheetId, gid, signal } = params;
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
  const url = gid !== undefined && gid !== null ? `${base}&gid=${gid}` : base;

  const res = await fetch(url, { cache: 'no-store', signal });
  const text = await res.text();

  // Extract the JSON portion from the gviz wrapper safely
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not locate JSON payload in gviz response');
  const json = JSON.parse(match[0]);

  const table = json.table as {
    cols: Array<{ label?: string; id?: string }>;
    rows: Array<{ c: Array<{ v: any } | null> }>;
  };

  const rawRows: any[][] = (table.rows || []).map((r) => (r.c || []).map((c) => (c ? c.v : null)));
  const colLabels: string[] = (table.cols || []).map((c) => c.label || c.id || '');

  // Determine headers: prefer labeled columns; else use the first data row as headers
  const hasLabels = colLabels.some((h) => (h || '').trim() !== '');
  let headers: string[];
  let bodyRows: any[][];

  if (hasLabels) {
    headers = colLabels.map((h, i) => h || `Col${i + 1}`);
    bodyRows = rawRows;
  } else {
    headers = (rawRows[0] || []).map((v, i) => (v ?? '').toString().trim() || `Col${i + 1}`);
    bodyRows = rawRows.slice(1);
  }

  const objects: GvizRowObject[] = bodyRows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? '']))
  );

  return objects;
}

// Convert gviz date string like "Date(2025,6,25)" to ISO-like "2025-07-25".
// If value is already a readable date string, return as-is.
export function normalizeGvizDate(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    const m = value.match(/^Date\((\d+),(\d+),(\d+)\)$/);
    if (m) {
      const y = Number(m[1]);
      const mIdx = Number(m[2]); // 0-indexed month in gviz
      const d = Number(m[3]);
      const dt = new Date(y, mIdx, d);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return value; // already a human string
  }
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return String(value);
}
