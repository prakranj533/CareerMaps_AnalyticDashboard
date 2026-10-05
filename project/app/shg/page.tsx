"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSheetDashboard } from '@/hooks/useSheetDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Search, Filter } from 'lucide-react';
import { encodeShgSlug } from '@/lib/shg-slug';
import { fetchSheetTabAsObjects, normalizeGvizDate } from '@/lib/sheets';
import { STUDENT_SHEET_MAP, type StudentSheetConfig } from './student-sheet-map';
import { STUDENT_ROSTER_IMPORT } from './student-roster-import';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RANGE_PRESET_OPTIONS, createRangeState, describeRangeState, getRangeBounds, isDateWithinBounds } from '@/lib/date-filters';

const normalizeKey = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const canonicalizeShgName = (value: unknown) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\s*\(\s*(\d{2}:\d{2}:\d{2})\s*\)$/, ' ($1)');
const normalizeShgName = (value: unknown) => canonicalizeShgName(value).toLowerCase();
const normalizeHeader = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const STUDENT_NAME_HEADERS = new Set([
  'studentname',
  'childrenname',
  'chilrenname',
  'childname',
  'nameofstudent',
  'name',
  'learnername',
]);

const STUDENT_ROSTER_SHEETS = Array.from(
  Object.entries(STUDENT_SHEET_MAP).reduce((sheets, [shgName, config]) => {
    const key = `${config.sheetId}:${config.gid ?? '0'}`;
    const sheet = sheets.get(key) ?? { config, shgNames: [] as string[] };
    sheet.shgNames.push(shgName);
    sheets.set(key, sheet);
    return sheets;
  }, new Map<string, { config: StudentSheetConfig; shgNames: string[] }>()).values()
);

const countStudentRows = (rows: Record<string, any>[]) => {
  if (!rows.length) return 0;

  const directNameHeader = Object.keys(rows[0]).find((key) => STUDENT_NAME_HEADERS.has(normalizeHeader(key)));
  if (directNameHeader) {
    return rows.filter((row) => String(row[directNameHeader] ?? '').trim()).length;
  }

  const keys = Object.keys(rows[0]);
  const matrix = rows.map((row) => keys.map((key) => row[key]));
  let headerIndex = -1;
  let bestScore = 0;

  matrix.forEach((row, index) => {
    const values = row.map(normalizeHeader);
    const score = [
      values.some((value) => value.includes('sno') || value.includes('srno')),
      values.some((value) => STUDENT_NAME_HEADERS.has(value) || value.includes('student') || value.includes('child') || value.includes('learner')),
      values.some((value) => value.includes('mother')),
      values.some((value) => value.includes('father')),
      values.some((value) => value.includes('class') || value.includes('grade')),
    ].filter(Boolean).length;

    if (score > bestScore && score >= 2) {
      headerIndex = index;
      bestScore = score;
    }
  });

  if (headerIndex < 0) return 0;
  const nameIndex = matrix[headerIndex].findIndex((value) => STUDENT_NAME_HEADERS.has(normalizeHeader(value)));
  if (nameIndex < 0) return 0;

  let count = 0;
  for (const row of matrix.slice(headerIndex + 1)) {
    if (row.some((value) => normalizeHeader(value).includes('guardiancontact'))) break;
    if (String(row[nameIndex] ?? '').trim()) count += 1;
  }
  return count;
};

const getStudentSheetConfig = (shgName: string) => {
  const normalizedName = normalizeKey(shgName);
  return STUDENT_SHEET_MAP[shgName] ?? Object.entries(STUDENT_SHEET_MAP)
    .find(([name]) => normalizeKey(name) === normalizedName)?.[1];
};

const getImportedStudentCount = (shgName: string) => {
  const code = shgName.match(/\(\s*(\d{2}:\d{2}:\d{2})\s*\)/)?.[1];
  return code ? STUDENT_ROSTER_IMPORT[code]?.length : undefined;
};

export default function ShgPage() {
  const [refreshMs] = useState(30000);
  const [query, setQuery] = useState('');
  const [range, setRange] = useState(createRangeState());
  const [studentCounts, setStudentCounts] = useState<Record<string, number | null>>({});
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadStudentCounts = async () => {
      const counts = await Promise.all(STUDENT_ROSTER_SHEETS.map(async ({ config, shgNames }) => {
        try {
          const rows = await fetchSheetTabAsObjects({ ...config, signal: controller.signal });
          return { shgNames, count: countStudentRows(rows) };
        } catch {
          return { shgNames, count: null };
        }
      }));

      if (isMounted) {
        setStudentCounts(Object.fromEntries(
          counts.flatMap(({ shgNames, count }) => shgNames.map((name) => [normalizeKey(name), count]))
        ));
      }
    };

    void loadStudentCounts();
    const timer = window.setInterval(() => void loadStudentCounts(), 60000);

    return () => {
      isMounted = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const { rows } = useSheetDashboard({
    sheetId: '1Oyz0XkemLeHjUQOBW1KrSKYTlhyvRfjXc3jNp9eZoSM',
    gid: '0',
    refreshMs,
    columns: {
      shg: 'SHG Name',
      subject: 'Video Name',
      score: 'Final Score (100)'
    },
  });

  const bounds = useMemo(() => getRangeBounds(range), [range]);
  const hasExplicitBounds = bounds.from !== null || bounds.to !== null;

  const shgCounts = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    rows.forEach((r: any) => {
      const rawName = String(r['SHG Name'] ?? '');
      const key = normalizeShgName(rawName);
      if (!key) return;
      const dateValue = normalizeGvizDate(r['Date Created']);
      const date = dateValue ? new Date(dateValue) : null;
      if (hasExplicitBounds) {
        if (!date || !isDateWithinBounds(date, bounds)) return;
      }
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { name: canonicalizeShgName(rawName), count: 1 });
      }
    });
    return Array.from(map.values())
      .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.count - a.count);
  }, [rows, query, hasExplicitBounds, bounds]);

  const totalClasses = shgCounts.reduce((sum, item) => sum + item.count, 0);
  const connectedRosters = new Map<string, number>();
  shgCounts.forEach((item) => {
    const importedCount = getImportedStudentCount(item.name);
    if (typeof importedCount === 'number') {
      const code = item.name.match(/\(\s*(\d{2}:\d{2}:\d{2})\s*\)/)?.[1];
      if (code) connectedRosters.set(`import:${code}`, importedCount);
      return;
    }

    const config = getStudentSheetConfig(item.name);
    const count = studentCounts[normalizeKey(item.name)];
    if (config && typeof count === 'number') {
      connectedRosters.set(`${config.sheetId}:${config.gid ?? '0'}`, count);
    }
  });
  const totalLiveStudents = Array.from(connectedRosters.values()).reduce((sum, count) => sum + count, 0);
  const connectedStudentRosters = connectedRosters.size;

  return (
    <div className="min-h-screen bg-[hsla(var(--background)/1)]">
      <header className="border-b bg-white/95 dark:bg-slate-900/90 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">SHG Overview</h1>
              <p className="text-sm text-slate-500">Class sessions and live student rosters across Self Help Groups</p>
            </div>
          </div>
          <Link href="/" className="text-sm font-medium text-[hsl(var(--primary))] hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="surface-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Filter className="h-4 w-4" />
                <span>Filter period</span>
                <span className="text-xs text-slate-400">{describeRangeState(range)}</span>
              </div>
              <Select
                value={range.preset}
                onValueChange={(value) => setRange((prev) => ({ ...prev, preset: value as typeof range.preset, customFrom: '', customTo: '' }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_PRESET_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {range.preset === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={range.customFrom}
                    onChange={(e) => setRange((prev) => ({ ...prev, customFrom: e.target.value }))}
                  />
                  <Input
                    type="date"
                    value={range.customTo}
                    onChange={(e) => setRange((prev) => ({ ...prev, customTo: e.target.value }))}
                  />
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="surface-card">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-slate-500">
                Showing {shgCounts.length} SHGs • {totalClasses} classes
                {connectedStudentRosters > 0 && ` • ${totalLiveStudents} live students on ${connectedStudentRosters} connected rosters`}
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search SHG..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {shgCounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shgCounts.map((s) => {
              const importedCount = getImportedStudentCount(s.name);
              const hasRoster = typeof importedCount === 'number' || Boolean(getStudentSheetConfig(s.name));
              const studentCount = importedCount ?? studentCounts[normalizeKey(s.name)];
              const studentLabel = !hasRoster
                ? 'Roster not connected'
                : studentCount === undefined
                  ? 'Loading live students…'
                  : studentCount === null
                    ? 'Roster unavailable'
                    : `${studentCount} live ${studentCount === 1 ? 'student' : 'students'}`;

              return (
              <Card
                key={s.name}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/shg/${encodeShgSlug(s.name)}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/shg/${encodeShgSlug(s.name)}`);
                  }
                }}
                className="surface-card transition-colors duration-200 hover:border-[hsl(var(--primary))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--primary))] cursor-pointer"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between gap-3">
                    <span className="truncate">{s.name}</span>
                    <Badge variant="outline" className="bg-[hsla(var(--primary)/0.12)] text-[hsl(var(--primary))] border-transparent">
                      {s.count} {s.count === 1 ? 'class' : 'classes'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-slate-500">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Consistent engagement recorded by Careermaps.</span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700" aria-live="polite">
                      <Users className="h-4 w-4" />
                      {studentLabel}
                    </span>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        ) : (
          <Card className="surface-muted">
            <CardContent className="py-12 text-center space-y-3">
              <div className="text-4xl">🔍</div>
              <p className="text-slate-600">No SHGs found</p>
              <p className="text-sm text-slate-500">Try a different search term or refresh the data.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
