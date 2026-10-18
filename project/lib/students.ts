// Student roster parsing for the shared "Student list" tab in the audit sheet.
// One row per student, grouped to an SHG center by the "SHGTC ID" column, which
// matches the (NN:NN:NN) code embedded in audit "SHG Name" values.

import { GvizRowObject } from '@/lib/sheets';

export interface StudentRosterEntry {
  id: string;
  slNo: number;
  name: string;
  mother: string;
  father: string;
  grade: string;
  registrationId: string;
  gender: string;
  type: string;
  attendance: string;
  marksheet: string;
  district: string;
  region: string;
  branch: string;
  shgCode: string | null;
  shgName: string;
  timing: string;
}

const text = (v: any) => String(v ?? '').trim();

// Normalise the SHGTC ID cell to "NN:NN:NN".
// Arrives as "31:07:03"/"1:04:02" (formatted), "Date(1899,11,31,7,7,3)" (raw
// duration serialised by gviz, day 30 = 0h so day 31 adds 24h), or a number.
export function parseShgtcId(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();

  const m = raw.match(/^Date\(1899,11,(\d+),(\d+),(\d+),(\d+)\)$/);
  if (m) {
    const hours = (Number(m[1]) - 30) * 24 + Number(m[2]);
    return `${String(hours).padStart(2, '0')}:${m[3].padStart(2, '0')}:${m[4].padStart(2, '0')}`;
  }

  const direct = raw.match(/^(\d{1,3}):(\d{1,2}):(\d{1,2})$/);
  if (direct) {
    return `${direct[1].padStart(2, '0')}:${direct[2].padStart(2, '0')}:${direct[3].padStart(2, '0')}`;
  }

  // Excel serial day fraction → duration
  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 0 && serial < 60) {
    const totalSeconds = Math.round(serial * 86400);
    const h = Math.floor(totalSeconds / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    const ss = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  return null;
}

export function parseStudentRows(rows: GvizRowObject[]): StudentRosterEntry[] {
  return rows
    .map((r, idx) => {
      const name = text(r['Student Name']);
      const registration = text(r['Registration']).replace(/\.0+$/, '');
      return {
        id: registration || `${parseShgtcId(r['SHGTC ID']) ?? 'x'}-${idx + 1}`,
        slNo: Number(r['S.No.']) || idx + 1,
        name,
        mother: text(r["Mother's Name"]) || '—',
        father: text(r["Father's Name"]) || '—',
        grade: text(r['Class']) || '—',
        registrationId: registration,
        gender: text(r['Gender']),
        type: text(r['Type']),
        attendance: text(r['Attendace'] ?? r['Attendance']),
        marksheet: text(r['Marksheet']),
        district: text(r['District']),
        region: text(r['Region Name']),
        branch: text(r['Branch Name']),
        shgCode: parseShgtcId(r['SHGTC ID']),
        shgName: text(r['SHGTC Name']),
        timing: text(r['SHGTC Timing']),
      } satisfies StudentRosterEntry;
    })
    .filter((s) => s.name);
}

export function groupStudentsByCode(students: StudentRosterEntry[]): Map<string, StudentRosterEntry[]> {
  const groups = new Map<string, StudentRosterEntry[]>();
  for (const s of students) {
    if (!s.shgCode) continue;
    const list = groups.get(s.shgCode) ?? [];
    list.push(s);
    groups.set(s.shgCode, list);
  }
  return groups;
}

// Extract the NN:NN:NN code embedded in an audit "SHG Name" like
// "SHG TC SITAMARHI&DARBHANGA BISFI(31:07:03)".
export function shgCodeFromName(shgName: string): string | null {
  const raw = shgName.match(/\(\s*(\d{1,3}:\d{1,2}:\d{1,2})\s*\)/)?.[1] ?? null;
  return raw ? parseShgtcId(raw) : null;
}
