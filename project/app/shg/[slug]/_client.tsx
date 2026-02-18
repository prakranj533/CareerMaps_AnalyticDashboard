"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, GraduationCap, Phone, Users } from 'lucide-react';
import { STUDENT_SHEET_MAP } from '../student-sheet-map';
import { decodeShgSlug } from '@/lib/shg-slug';

type StudentRecord = {
  slNo: number;
  name: string;
  mother: string;
  father: string;
  grade: string;
  phone: string;
};

type RosterMetadata = {
  region?: string;
  branch?: string;
  shgtcId?: string;
  shgtcName?: string;
  timing?: string;
};

const ENV_STUDENT_SHEET_GID = process.env.NEXT_PUBLIC_STUDENT_SHEET_GID || '0';
const ENV_STUDENT_SHEET_SHG_COLUMN = process.env.NEXT_PUBLIC_STUDENT_SHEET_SHG_COLUMN || 'SHG Name';

const normalizeKey = (value?: string) => (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

const STUDENT_NAME_FIELDS = [
  'Student Name',
  'Children Name',
  'Chilren Name',
  'Child Name',
  'Name OF Student',
  'Name Of Student',
  'Name of student',
  'Student Name ',
  'Name',
  'Learner Name',
];

const readField = (row: Record<string, any>, candidates: string[], fallback: any = '') => {
  const entries = Object.entries(row ?? {});
  for (const candidate of candidates) {
    const target = normalizeKey(candidate);
    const match = entries.find(([key]) => normalizeKey(key) === target);
    if (match) return match[1];
  }
  return fallback;
};

const cellText = (value: any) => String(value ?? '').trim();
const normalizeCell = (value: any) => cellText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const detectHeaderIndex = (matrix: any[][]) => {
  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < matrix.length; i += 1) {
    const normalized = matrix[i].map(normalizeCell);
    const score = [
      normalized.some((v) => /^s\s*no$/.test(v) || (v.startsWith('s') && v.includes('no'))),
      normalized.some((v) => v.includes('student') || v.includes('children') || v.includes('child') || v.includes('learner')),
      normalized.some((v) => v.includes('mother')),
      normalized.some((v) => v.includes('father')),
      normalized.some((v) => v.includes('class') || v.includes('grade')),
    ].filter(Boolean).length;

    if (score > bestScore && score >= 2) {
      bestIdx = i;
      bestScore = score;
      if (score === 5) break;
    }
  }
  return bestIdx;
};

const META_KEY_MAP: Record<string, keyof RosterMetadata> = {
  'region name': 'region',
  'branch name': 'branch',
  'shgtc id': 'shgtcId',
  'shgtc name': 'shgtcName',
  'shgtc timing': 'timing',
};

const extractStudentTableRows = (rows: Record<string, any>[]) => {
  const metadata: RosterMetadata = {};
  if (!rows.length) return { rows: [], metadata };
  const keyOrder = Object.keys(rows[0] ?? {});
  if (!keyOrder.length) return { rows, metadata };

  const matrix = rows.map((row) => keyOrder.map((key) => row[key]));
  const headerIdx = detectHeaderIndex(matrix);
  if (headerIdx < 0) {
    return { rows, metadata };
  }

  if (headerIdx > 0) {
    for (let i = 0; i < headerIdx; i += 1) {
      const rowValues = matrix[i];
      const key = cellText(rowValues[1] ?? rowValues[0]);
      const value = cellText(rowValues[2] ?? rowValues[1]);
      const normalized = normalizeCell(key);
      const metaKey = META_KEY_MAP[normalized];
      if (metaKey && value) {
        metadata[metaKey] = value;
      }
    }
  }

  const headerRow = matrix[headerIdx];
  const headerValues = headerRow.map((value, idx) => {
    const text = cellText(value);
    if (text) return text;

    if (idx === 0) return 'S.No.';
    const prevText = cellText(headerRow[idx - 1]).toLowerCase();
    if (prevText.includes('father')) return 'Class';

    return `Col${idx + 1}`;
  });

  const bodyMatrices = matrix.slice(headerIdx + 1);

  const remappedRows: Record<string, any>[] = [];
  for (const rowValues of bodyMatrices) {
    const normalized = rowValues.map(normalizeCell);
    if (normalized.every((v) => !v)) continue;
    if (normalized.some((v) => v.includes('guardian contact'))) break;

    const row: Record<string, any> = {};
    for (let i = 0; i < headerValues.length; i += 1) {
      row[headerValues[i]] = rowValues[i] ?? '';
    }
    remappedRows.push(row);
  }

  return { rows: remappedRows, metadata };
};

export default function ShgStudentsClient({ params }: { params: { slug: string } }) {
  const shgName = decodeShgSlug(params.slug);
  const [searchTerm, setSearchTerm] = useState('');

  const mappedConfig = useMemo(() => {
    if (STUDENT_SHEET_MAP[shgName]) return STUDENT_SHEET_MAP[shgName];
    const normalized = normalizeKey(shgName);
    const foundEntry = Object.entries(STUDENT_SHEET_MAP).find(([key]) => normalizeKey(key) === normalized);
    return foundEntry ? foundEntry[1] : undefined;
  }, [shgName]);

  const sheetId = mappedConfig?.sheetId;
  const gid = mappedConfig?.gid ?? ENV_STUDENT_SHEET_GID;
  const mode: 'dedicated' | 'shared' = mappedConfig ? 'dedicated' : 'shared';

  const { rows, loading, enabled, error } = useSheetData({
    sheetId,
    gid,
    refreshMs: 60000,
    enabled: Boolean(sheetId),
  });

  const isLoading = Boolean(sheetId && loading);
  const hasLiveSheet = Boolean(sheetId);

  const relevantRows = useMemo(() => {
    if (!enabled || !sheetId) return [];
    return mode === 'dedicated'
      ? rows
      : rows.filter((row) => {
          const sheetShg = String(row[ENV_STUDENT_SHEET_SHG_COLUMN] ?? '').trim();
          return sheetShg && sheetShg.toLowerCase() === shgName.toLowerCase();
        });
  }, [rows, enabled, mode, shgName, sheetId]);

  const rosterData = useMemo(() => {
    if (!enabled || !sheetId) return { rows: [], metadata: {} as RosterMetadata };
    return extractStudentTableRows(relevantRows as any);
  }, [relevantRows, enabled, sheetId]);

  const sheetStudents = useMemo(() => {
    if (!enabled || !sheetId) return [];
    const tableRows = rosterData.rows;

    const parsed = tableRows.map((row, idx) => {
      const slNoRaw = readField(row, ['S.No.', 'S.No', 'Sl.No', 'Sl No', 'SL No', 'Sr No', 'Sr.No'], idx + 1);
      const nameRaw = readField(row, STUDENT_NAME_FIELDS, '');

      const motherRaw = readField(row, [
        "Mother's Name",
        'Mother Name',
        'Mother',
        "Sitamarhi Darbhanga Bisfi (31:07) 31:07:03 Bisfi 03:00 PM to 05:00 PM Mother's Name",
        "Azamgarh Bhadsar (07:20) 07:20:03 Bhadsar 03:00 PM to 05:00 PM Mother's Name",
        "Gorakhpur  Bramhpur (13:05) 13:05:04 bramhpur  06:00 AM to 08:00 AM Mother's Name",
      ], '—');

      const fatherRaw = readField(row, ["Father's Name", 'Father Name', 'Father'], '—');
      const classRaw = readField(row, ['Class', 'Grade', 'Std'], '—');
      const phoneRaw = readField(row, ['Mobile Number', 'Phone', 'Guardian Contact', 'Contact Number'], '—');

      const name = String(nameRaw).trim();
      return {
        slNo: Number(slNoRaw) || idx + 1,
        name,
        mother: String(motherRaw || '—'),
        father: String(fatherRaw || '—'),
        grade: String(classRaw || '—'),
        phone: String(phoneRaw || '—'),
      };
    });

    return parsed.filter((s) => s.name);
  }, [rosterData.rows, enabled, sheetId]);

  const students: StudentRecord[] = hasLiveSheet ? sheetStudents : [];
  const rosterMetadata = hasLiveSheet ? rosterData.metadata : undefined;

  const metadataItems = useMemo(() => {
    if (!rosterMetadata) return [];
    return [
      { label: 'Region Name', value: rosterMetadata.region },
      { label: 'Branch Name', value: rosterMetadata.branch },
      { label: 'SHGTC ID', value: rosterMetadata.shgtcId },
      { label: 'SHGTC Name', value: rosterMetadata.shgtcName },
      { label: 'SHGTC Timing', value: rosterMetadata.timing },
    ].filter((item) => item.value);
  }, [rosterMetadata]);

  const stats = useMemo(() => {
    const total = students.length;
    const withPhone = students.filter((student) => student.phone && student.phone !== '—').length;
    const classes = students.reduce<Record<string, number>>((acc, student) => {
      const key = student.grade || 'Unassigned';
      return { ...acc, [key]: (acc[key] || 0) + 1 };
    }, {});
    const highlightedClass = Object.entries(classes).sort((a, b) => b[1] - a[1])[0];
    return { total, withPhone, uniqueClasses: Object.keys(classes).length, highlightedClass };
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => {
      const haystack = [student.slNo, student.name, student.mother, student.father, student.grade, student.phone]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [students, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white/90 border-b">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Link href="/shg" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[hsl(var(--primary))]">
              <ChevronLeft className="h-4 w-4" /> Back to SHGs
            </Link>
            <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
              {enabled ? 'Live sheet sync' : 'Design preview'}
            </Badge>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Student roster</p>
            <h1 className="text-3xl font-semibold text-slate-900 mt-1">{shgName}</h1>
            <p className="text-sm text-slate-500 mt-2 max-w-3xl">
              Learner directory listing guardian touch points, grade levels, and verified contact numbers.
            </p>
            {!!metadataItems.length && (
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {metadataItems.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">{item.label}</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-1">{item.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={<Users className="h-5 w-5" />} label="Total students" value={stats.total} subtle="Across this SHG" />
          <StatTile icon={<Phone className="h-5 w-5" />} label="Reachable guardians" value={`${stats.withPhone}/${stats.total}`} subtle="Numbers on file" />
          <StatTile icon={<GraduationCap className="h-5 w-5" />} label="Classes represented" value={stats.uniqueClasses} subtle={stats.highlightedClass ? `${stats.highlightedClass[0]} most common` : '—'} />
          <StatTile icon={<Users className="h-5 w-5" />} label="Sheet status" value={sheetId ? (isLoading ? 'Refreshing…' : 'Synced') : 'Awaiting sheet'} subtle={sheetId ? 'Auto-refreshing every min' : 'Add this SHG to the sheet'} />
        </div>

        {sheetId && error && (
          <Card className="shadow-sm border border-rose-200 bg-rose-50">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-rose-700">Could not load student sheet</p>
              <p className="text-xs text-rose-700/90 mt-1 break-words">{error}</p>
              <p className="text-xs text-rose-700/90 mt-2">
                Make sure the Google Sheet is shared as: Anyone with the link → Viewer.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">Student directory</CardTitle>
              <p className="text-sm text-slate-500">Includes Sl.No, parent information, class and contact number.</p>
            </div>
            {!sheetId && (
              <Badge variant="secondary" className="text-xs uppercase tracking-wide">Roster sheet not connected</Badge>
            )}
          </CardHeader>

          <Separator />
          {sheetId ? (
            <CardContent className="border-b">
              <div className="relative">
                <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search students, guardians, class..." className="pl-3" />
              </div>
              {searchTerm && (
                <p className="text-xs text-slate-500 mt-2">Showing {filteredStudents.length} of {students.length} learners</p>
              )}
            </CardContent>
          ) : (
            <CardContent className="py-16 text-center space-y-3">
              <div className="text-4xl">🗂️</div>
              <p className="text-slate-700 font-medium">Roster coming soon</p>
              <p className="text-sm text-slate-500">Connect this SHG's Google Sheet to view learner details once it is available.</p>
            </CardContent>
          )}
          {sheetId && (
            <ScrollArea className="h-[60vh] pr-3">
              <Table>
                <TableHeader className="sticky top-0 bg-white/90 backdrop-blur border-b">
                  <TableRow>
                    <TableHead className="w-20">Sl. No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Mother</TableHead>
                    <TableHead>Father</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-right">Mobile</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24">
                        <div className="animate-pulse space-y-2">
                          <div className="h-4 bg-slate-200 rounded" />
                          <div className="h-4 bg-slate-200 rounded w-3/4" />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && filteredStudents.map((student) => (
                    <TableRow key={`${student.name}-${student.slNo}`} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-600">{student.slNo}</TableCell>
                      <TableCell><div className="font-semibold text-slate-900">{student.name}</div></TableCell>
                      <TableCell className="text-sm text-slate-700">{student.mother}</TableCell>
                      <TableCell className="text-sm text-slate-700">{student.father}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700">{student.grade || 'NA'}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-slate-900">
                        {student.phone !== '—' ? student.phone : <span className="text-slate-400">Not shared</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && filteredStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                        {students.length === 0 ? 'No students recorded yet.' : 'No students match your search.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </Card>
      </main>
    </div>
  );
}

function StatTile({ icon, label, value, subtle }: { icon: React.ReactNode; label: string; value: string | number; subtle?: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-4 py-5">
        <div className="h-12 w-12 rounded-2xl bg-[hsla(var(--primary)/0.12)] text-[hsl(var(--primary))] flex items-center justify-center">{icon}</div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="text-2xl font-semibold text-slate-900">{value}</p>
          {subtle && <p className="text-xs text-slate-500 mt-1">{subtle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}