'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Trophy, ClipboardList, TriangleAlert as AlertTriangle } from 'lucide-react';
import { normalizeGvizDate, type GvizRowObject } from '@/lib/sheets';
import { buildShgRankings, parsePunchInRows } from '@/lib/punch-in';

type RankingSort = 'composite' | 'quality' | 'students' | 'total' | 'classes';

const OVERALL_PERIOD = 'overall';

const getMonthKey = (date: Date | null) => {
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getAuditMonthKey = (value: unknown) => {
  const normalized = normalizeGvizDate(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  return getMonthKey(date);
};

const formatMonth = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

interface ShgRankingProps {
  auditRows: GvizRowObject[];
  punchRows: GvizRowObject[];
  punchLoading: boolean;
  punchError: string | null;
}

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-blue-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
};

export function ShgRanking({ auditRows, punchRows, punchLoading, punchError }: ShgRankingProps) {
  const [rankingSort, setRankingSort] = useState<RankingSort>('composite');
  const [rankingSearch, setRankingSearch] = useState('');
  const [rankingPeriod, setRankingPeriod] = useState(OVERALL_PERIOD);
  const [selectedCenterKey, setSelectedCenterKey] = useState<string | null>(null);

  const punchInRecords = useMemo(() => parsePunchInRows(punchRows), [punchRows]);

  // Build the period menu from both punch-in and audit dates so months with
  // only one type of activity remain available for review.
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    punchInRecords.forEach((record) => {
      const key = getMonthKey(record.timestamp);
      if (key) months.add(key);
    });
    auditRows.forEach((row) => {
      const key = getAuditMonthKey(row['Date Created']);
      if (key) months.add(key);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [punchInRecords, auditRows]);

  // A monthly ranking uses only classes and audit scores from that calendar
  // month. Overall uses the complete history. All known audit SHG names are
  // retained so centers with no activity in the selected month still show 0.
  const { rankings, byKey: punchByCenter } = useMemo(() => {
    const filteredPunchRecords = rankingPeriod === OVERALL_PERIOD
      ? punchInRecords
      : punchInRecords.filter((record) => getMonthKey(record.timestamp) === rankingPeriod);
    const audit = auditRows.map((r) => ({
      shgName: String(r['SHG Name'] ?? ''),
      finalScore: rankingPeriod === OVERALL_PERIOD || getAuditMonthKey(r['Date Created']) === rankingPeriod
        ? Number(r['Final Score (100)'] ?? NaN)
        : NaN,
    }));
    return buildShgRankings(filteredPunchRecords, audit);
  }, [punchInRecords, auditRows, rankingPeriod]);

  const periodLabel = rankingPeriod === OVERALL_PERIOD ? 'Overall' : formatMonth(rankingPeriod);
  const periodRecordCount = rankingPeriod === OVERALL_PERIOD
    ? punchInRecords.length
    : punchInRecords.filter((record) => getMonthKey(record.timestamp) === rankingPeriod).length;

  const sortedRankings = useMemo(() => {
    const term = rankingSearch.trim().toLowerCase();
    const filtered = term
      ? rankings.filter((r) => r.displayName.toLowerCase().includes(term))
      : rankings;
    const arr = [...filtered];
    switch (rankingSort) {
      case 'quality':
        arr.sort((a, b) => (b.qualityAvg ?? -1) - (a.qualityAvg ?? -1));
        break;
      case 'students':
        arr.sort((a, b) => b.avgStudentsPerClass - a.avgStudentsPerClass);
        break;
      case 'total':
        arr.sort((a, b) => b.totalStudents - a.totalStudents);
        break;
      case 'classes':
        arr.sort((a, b) => b.classes - a.classes);
        break;
      default:
        arr.sort((a, b) => b.rankScore - a.rankScore);
    }
    return arr;
  }, [rankings, rankingSort, rankingSearch]);

  const activeCenterKey = selectedCenterKey && punchByCenter.has(selectedCenterKey)
    ? selectedCenterKey
    : sortedRankings.find((r) => r.classes > 0)?.key ?? null;

  const activeCenterRecords = useMemo(() => {
    if (!activeCenterKey) return [];
    const list = punchByCenter.get(activeCenterKey) ?? [];
    return [...list].sort((a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0));
  }, [punchByCenter, activeCenterKey]);

  const activeCenterRanking = rankings.find((r) => r.key === activeCenterKey) ?? null;

  return (
    <div className="space-y-6">
      {punchError && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm surface-card">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Failed to load punch-in sheet. It refreshes automatically with the dashboard.
          </div>
        </div>
      )}

      {/* SHG Leaderboard */}
      <Card className="glass-morphism edu-glow chart-container relative card-entrance-animation overview-card">
        <CardHeader className="pb-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="overview-icon">
                <Trophy className="h-5 w-5" />
              </span>
              <CardTitle className="overview-gradient-title">SHG Ranking</CardTitle>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1 text-xs text-slate-600">
              <span className="chart-status-badge overview-status-badge bg-amber-100 text-amber-700 border-amber-200 font-black shimmer-pulse">
                LEADERBOARD
              </span>
              <span className="font-semibold text-slate-700">{rankings.length} SHG centers · {periodLabel}</span>
              <span className="overview-meta-label">{periodRecordCount} punch-in records</span>
            </div>
          </div>
          <p className="overview-subtext">
            Centers ranked on audit quality (60%) and average students per class (40%) from punch-in attendance. Select a row to inspect its class records below.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search SHG center..."
                value={rankingSearch}
                onChange={(e) => setRankingSearch(e.target.value)}
                className="pl-10 glass-morphism edu-glow"
              />
            </div>
            <Select value={rankingPeriod} onValueChange={setRankingPeriod}>
              <SelectTrigger className="w-full sm:w-52 glass-morphism edu-glow">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={OVERALL_PERIOD}>Overall</SelectItem>
                {availableMonths.map((month) => (
                  <SelectItem key={month} value={month}>{formatMonth(month)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={rankingSort} onValueChange={(v) => setRankingSort(v as RankingSort)}>
              <SelectTrigger className="w-full sm:w-56 glass-morphism edu-glow">
                <SelectValue placeholder="Rank by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="composite">Overall (quality + students)</SelectItem>
                <SelectItem value="quality">Quality score</SelectItem>
                <SelectItem value="students">Students per class</SelectItem>
                <SelectItem value="total">Total students</SelectItem>
                <SelectItem value="classes">Classes held</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {punchLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : sortedRankings.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No punch-in records found{rankingSearch ? ` for "${rankingSearch}"` : ''}.
            </div>
          ) : (
            <div className="max-h-[480px] overflow-auto rounded-xl border border-slate-200/70">
              <Table>
                <TableHeader className="sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                  <TableRow>
                    <TableHead className="w-14">Rank</TableHead>
                    <TableHead>SHG Center</TableHead>
                    <TableHead className="text-right">Classes</TableHead>
                    <TableHead className="text-right">Students / Class</TableHead>
                    <TableHead className="text-right">Total Students</TableHead>
                    <TableHead className="text-right">Subjects</TableHead>
                    <TableHead className="text-right">Quality Avg</TableHead>
                    <TableHead className="text-right">Rank Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRankings.map((r, idx) => (
                    <TableRow
                      key={r.key}
                      onClick={() => setSelectedCenterKey(r.key)}
                      className={`cursor-pointer transition-colors ${r.key === activeCenterKey ? 'bg-emerald-50/80 hover:bg-emerald-50' : 'hover:bg-slate-50'}`}
                    >
                      <TableCell className="font-semibold text-slate-500">
                        {rankingSort === 'composite' && idx < 3 ? (
                          <span className="inline-flex items-center gap-1">
                            <Trophy className={`h-4 w-4 ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : 'text-amber-700'}`} />
                            {idx + 1}
                          </span>
                        ) : (
                          idx + 1
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">{r.displayName}</TableCell>
                      <TableCell className="text-right">{r.classes}</TableCell>
                      <TableCell className="text-right">{r.avgStudentsPerClass}</TableCell>
                      <TableCell className="text-right">{r.totalStudents}</TableCell>
                      <TableCell className="text-right">{r.subjectsTaught}</TableCell>
                      <TableCell className="text-right">
                        {r.qualityAvg === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className={getScoreColor(r.qualityAvg)}>{r.qualityAvg}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-[hsl(var(--primary))]">
                        {r.rankScore}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!punchLoading && sortedRankings.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Quality Avg is the mean AI audit score for matched centers; centers without audit data show — and rank on attendance strength only.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Per-SHG punch-in detail */}
      <Card className="glass-morphism edu-glow chart-container relative card-entrance-animation overview-card">
        <CardHeader className="pb-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="overview-icon">
                <ClipboardList className="h-5 w-5" />
              </span>
              <CardTitle className="overview-gradient-title">Punch-in Records per SHG</CardTitle>
            </div>
            <div className="w-full sm:w-80">
              <Select value={activeCenterKey ?? ''} onValueChange={(v) => setSelectedCenterKey(v)}>
                <SelectTrigger className="glass-morphism edu-glow">
                  <SelectValue placeholder="Select SHG center" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {sortedRankings
                    .filter((r) => r.classes > 0)
                    .map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.displayName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="overview-subtext">
            Attendance records submitted through the punch-in form for the selected center, newest first. Teacher names are hidden.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!activeCenterRanking ? (
            <div className="py-12 text-center text-sm text-slate-500">
              {punchLoading ? 'Loading punch-in records…' : 'Select an SHG center to view its punch-in data.'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="text-center p-3 rounded-lg bg-emerald-50/70 border border-emerald-100">
                  <div className="text-xs font-medium text-emerald-700">Classes</div>
                  <div className="text-xl font-bold text-emerald-800">{activeCenterRanking.classes}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50/70 border border-blue-100">
                  <div className="text-xs font-medium text-blue-700">Students / Class</div>
                  <div className="text-xl font-bold text-blue-800">{activeCenterRanking.avgStudentsPerClass}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-indigo-50/70 border border-indigo-100">
                  <div className="text-xs font-medium text-indigo-700">Total Students</div>
                  <div className="text-xl font-bold text-indigo-800">{activeCenterRanking.totalStudents}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-purple-50/70 border border-purple-100">
                  <div className="text-xs font-medium text-purple-700">Subjects</div>
                  <div className="text-xl font-bold text-purple-800">{activeCenterRanking.subjectsTaught}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-50/70 border border-amber-100">
                  <div className="text-xs font-medium text-amber-700">Quality Avg</div>
                  <div className={`text-xl font-bold ${activeCenterRanking.qualityAvg === null ? 'text-slate-400' : getScoreColor(activeCenterRanking.qualityAvg)}`}>
                    {activeCenterRanking.qualityAvg ?? '—'}
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-slate-50/70 border border-slate-200">
                  <div className="text-xs font-medium text-slate-600">Last Class</div>
                  <div className="text-sm font-bold text-slate-800 pt-1">
                    {activeCenterRanking.lastClassAt
                      ? activeCenterRanking.lastClassAt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200/70">
                <Table>
                  <TableHeader className="sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>Sub-topic</TableHead>
                      <TableHead className="text-right">Students</TableHead>
                      <TableHead>Merged</TableHead>
                      <TableHead>Week</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeCenterRecords.map((rec, i) => (
                      <TableRow key={`${rec.classNameRaw}-${i}`}>
                        <TableCell className="whitespace-nowrap text-slate-700">
                          {rec.timestamp
                            ? rec.timestamp.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : rec.timestampLabel || '—'}
                        </TableCell>
                        <TableCell>
                          {rec.subject ? <Badge variant="secondary">{rec.subject}</Badge> : '—'}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate" title={rec.topic}>{rec.topic || '—'}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-slate-600" title={rec.subTopic}>{rec.subTopic || '—'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {rec.totalStudents}
                          {rec.studentsSecondary > 0 && (
                            <span className="block text-[11px] text-slate-400">
                              {rec.studentsPrimary}+{rec.studentsSecondary}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {rec.merged ? (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                              Yes{rec.mergedWith ? `: ${rec.mergedWith}` : ''}
                            </Badge>
                          ) : (
                            'No'
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600 whitespace-nowrap">{rec.week || (rec.month != null ? `Month ${rec.month}` : '—')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
