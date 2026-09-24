'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Area,
  LabelList,
  Legend
} from 'recharts';
import Link from 'next/link';
import { Users, BookOpen, CirclePlay as PlayCircle, TrendingUp, Search, Filter, Eye, Calendar as CalendarIcon, ChevronDown, X as XIcon, Star, TriangleAlert as AlertTriangle, Loader2, Donut, Radar as RadarIcon, LogOut } from 'lucide-react';
import type { DashboardRecord } from '@/lib/dashboard-data';
import { useSheetDashboard } from '@/hooks/useSheetDashboard';
import { normalizeGvizDate } from '@/lib/sheets';
import { SHEET_ID, SHEET_GID, DEFAULT_REFRESH_MS } from '@/lib/config';
import { CORE_SUBJECTS } from '@/lib/subject-categories';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { getFirebaseAuth, shouldBypassFirebaseAuth } from '@/lib/firebase/client';

// Helpers (local)
function subjectFor(videoName: string): string {
  const v = (videoName || '').toLowerCase();
  if (/\bmath|integer|fraction|pattern\b/.test(v)) return 'Mathematics';
  if (/\bcomputer|email|internet|hardware|word|files?_?folders?|languages?\b/.test(v)) return 'Computer';
  return 'Other';
}
function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export default function Dashboard() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSHG, setSelectedSHG] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshMs] = useState(DEFAULT_REFRESH_MS);
  const [retryIn, setRetryIn] = useState<number | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const itemsPerPage = 10;
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Live data from Google Sheet (gid=0)
  const { rows, metrics, loading, error, reload, lastUpdatedAt } = useSheetDashboard({
    sheetId: SHEET_ID,
    gid: SHEET_GID,
    refreshMs,
    columns: {
      shg: 'SHG Name',
      subject: 'Subject from AI',
      score: 'Final Score (100)',
      dateCreated: 'Date Created',
      videoName: 'Video Name',
      videoUrl: 'Video URL',
      output: 'OUTPUT',
      engagement: 'Engagement (20)',
      classIssues: 'Class Issues (20)',
      instructorIssues: 'Instructor Issues (20)',
      contentStructure: 'Content Structure (20)',
      platformUsage: 'Platform Tool Usage (20)',
      issuesToImprove: 'Issues to Improve',
    },
  });

  // Map sheet rows to DashboardRecord shape for rendering the Sessions list
  const liveData: DashboardRecord[] = useMemo(() => {
    const all = rows.map((r, idx) => ({
      srNo: idx + 1,
      shgName: String(r['SHG Name'] ?? ''),
      videoName: String(r['Video Name'] ?? ''),
      subjectFromAI: String(r['Subject from AI'] ?? ''),
      videoUrl: String(r['Video URL'] ?? 'NA'),
      dateCreated: normalizeGvizDate(r['Date Created']),
      output: String(r['OUTPUT'] ?? ''),
      engagement: Number(r['Engagement (20)'] ?? 0),
      engagementComments: String(r['Engagement Comments'] ?? ''),
      classIssues: Number(r['Class Issues (20)'] ?? 0),
      classIssuesComments: String(r['Class Issues Comments'] ?? ''),
      instructorIssues: Number(r['Instructor Issues (20)'] ?? 0),
      instructorIssuesComments: String(r['Instructor Issues Comments'] ?? ''),
      contentStructure: Number(r['Content Structure (20)'] ?? 0),
      contentStructureComments: String(r['Content Structure Comments'] ?? ''),
      platformUsage: Number(r['Platform Tool Usage (20)'] ?? 0),
      platformUsageComments: String(r['Platform Tool Usage comments'] ?? ''),
      finalScore: Number(r['Final Score (100)'] ?? 0),
      issuesToImprove: String(r['Issues to Improve'] ?? ''),
    }));
    if (!startDate && !endDate) return all;
    return all.filter((rec) => {
      const d = parseIsoDate(rec.dateCreated);
      if (!d) return false;
      if (startDate && d < startDate) return false;
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        if (d > e) return false;
      }
      return true;
    });
  }, [rows, startDate, endDate]);

  // Error auto-retry countdown (visual only; polling is handled by the hook)
  useEffect(() => {
    if (!error) {
      setRetryIn(null);
      return;
    }
    let remaining = Math.max(1, Math.floor(refreshMs / 1000));
    setRetryIn(remaining);
    const id = window.setInterval(() => {
      remaining -= 1;
      setRetryIn(Math.max(0, remaining));
      if (remaining <= 0) {
        window.clearInterval(id);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [error, refreshMs, lastUpdatedAt]);

  // Filter data
  const filteredData = useMemo(() => {
    return liveData.filter(record => {
      const matchesSearch = record.shgName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          record.videoName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSHG = selectedSHG === 'all' || record.shgName.includes(selectedSHG);
      const matchesScore = scoreFilter === 'all' || 
        (scoreFilter === 'excellent' && record.finalScore >= 90) ||
        (scoreFilter === 'good' && record.finalScore >= 75 && record.finalScore < 90) ||
        (scoreFilter === 'needs-improvement' && record.finalScore < 75);
      
      return matchesSearch && matchesSHG && matchesScore;
    });
  }, [liveData, searchTerm, selectedSHG, scoreFilter]);

  // Sort by most recent date first
  const sortedData = useMemo(() => {
    const toTime = (d: string) => {
      const t = new Date(d).getTime();
      return isNaN(t) ? 0 : t;
    };
    return [...filteredData].sort((a, b) => toTime(b.dateCreated) - toTime(a.dateCreated));
  }, [filteredData]);

  const scoreDistribution = useMemo(() => {
    const ranges = [
      { name: '90-100', count: 0, color: '#10B981' },
      { name: '75-89', count: 0, color: '#3B82F6' },
      { name: '60-74', count: 0, color: '#F59E0B' },
      { name: '0-59', count: 0, color: '#EF4444' }
    ];

    filteredData.forEach(record => {
      if (record.finalScore >= 90) ranges[0].count++;
      else if (record.finalScore >= 75) ranges[1].count++;
      else if (record.finalScore >= 60) ranges[2].count++;
      else ranges[3].count++;
    });

    return ranges;
  }, [filteredData]);

  const topScoreBand = useMemo(() => {
    if (scoreDistribution.length === 0) return null;
    const best = [...scoreDistribution].sort((a, b) => b.count - a.count)[0];
    if (!best || best.count === 0) return null;
    return best;
  }, [scoreDistribution]);

  const totalSessions = useMemo(() => {
    return scoreDistribution.reduce((sum, band) => sum + band.count, 0);
  }, [scoreDistribution]);

  const weeklyMomentum = useMemo(() => {
    if (filteredData.length === 0) return [];

    const bucket = new Map<string, {
      start: Date;
      sessions: number;
      totalScore: number;
      high: number;
      low: number;
    }>();

    const normalizeStart = (date: Date) => {
      const normalized = new Date(date);
      const day = (normalized.getDay() + 6) % 7; // convert Sunday=0 to Monday=0
      normalized.setDate(normalized.getDate() - day);
      normalized.setHours(0, 0, 0, 0);
      return normalized;
    };

    filteredData.forEach((record) => {
      const date = parseIsoDate(record.dateCreated);
      if (!date) return;

      const start = normalizeStart(date);
      const key = start.toISOString();
      const current = bucket.get(key) ?? {
        start,
        sessions: 0,
        totalScore: 0,
        high: Number.NEGATIVE_INFINITY,
        low: Number.POSITIVE_INFINITY,
      };

      current.sessions += 1;
      current.totalScore += record.finalScore;
      current.high = Math.max(current.high, record.finalScore);
      current.low = Math.min(current.low, record.finalScore);

      bucket.set(key, current);
    });

    const formatSpan = (start: Date) => {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `${fmt(start)} – ${fmt(end)}`;
    };

    const populatedWeeks = Array.from(bucket.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
    if (!populatedWeeks.length) return [];

    const continuousWeeks = [];
    const lastWeekStart = populatedWeeks[populatedWeeks.length - 1].start;
    for (const cursor = new Date(populatedWeeks[0].start); cursor <= lastWeekStart; cursor.setDate(cursor.getDate() + 7)) {
      const entry = bucket.get(cursor.toISOString());
      continuousWeeks.push({
        week: formatSpan(cursor),
        weekLabel: cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        sessions: entry?.sessions ?? 0,
        avgScore: entry ? Number((entry.totalScore / entry.sessions).toFixed(1)) : 0,
        highScore: entry?.high ?? 0,
        lowScore: entry?.low ?? 0,
      });
    }
    return continuousWeeks;
  }, [filteredData]);

  const latestWeek = weeklyMomentum.length ? weeklyMomentum[weeklyMomentum.length - 1] : null;

  const classesTrend = useMemo(() => {
    return weeklyMomentum.slice(-8).map((entry, index) => ({
      ...entry,
      order: index + 1,
    }));
  }, [weeklyMomentum]);

  const previousWeek = classesTrend.length > 1 ? classesTrend[classesTrend.length - 2] : null;
  const latestWeekChange = latestWeek && previousWeek ? latestWeek.sessions - previousWeek.sessions : null;

  const averageWeeklySessions = useMemo(() => {
    if (!classesTrend.length) return 0;
    const totalSessions = classesTrend.reduce((sum, entry) => sum + entry.sessions, 0);
    return Math.round((totalSessions / classesTrend.length) * 10) / 10;
  }, [classesTrend]);

  const peakSessionsWeek = useMemo(() => {
    if (!classesTrend.length) return null;
    return classesTrend.reduce((peak, current) => (current.sessions > peak.sessions ? current : peak), classesTrend[0]);
  }, [classesTrend]);

  // Metrics with fidelity tweaks
  const computedMetrics = useMemo(() => {
    const classesDone = filteredData.length;
    const shgSet = new Set<string>();
    let scoreSum = 0; let scoreCount = 0;
    for (const r of filteredData) {
      const key = r.shgName.trim().toLowerCase();
      if (key) shgSet.add(key);
      if (!Number.isNaN(r.finalScore)) { scoreSum += r.finalScore; scoreCount++; }
    }
    return {
      classesDone,
      shgInitiated: shgSet.size,
      subjectsInitiated: CORE_SUBJECTS.length,
      finalScore: scoreCount ? Number((scoreSum / scoreCount).toFixed(2)) : 0,
    };
  }, [filteredData]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const categoryAverages = useMemo(() => {
    if (filteredData.length === 0) return [];
    
    return [
      {
        category: 'Engagement',
        score: Math.round(filteredData.reduce((sum, record) => sum + record.engagement, 0) / filteredData.length * 100) / 100
      },
      {
        category: 'Class Issues',
        score: Math.round(filteredData.reduce((sum, record) => sum + record.classIssues, 0) / filteredData.length * 100) / 100
      },
      {
        category: 'Instructor',
        score: Math.round(filteredData.reduce((sum, record) => sum + record.instructorIssues, 0) / filteredData.length * 100) / 100
      },
      {
        category: 'Content',
        score: Math.round(filteredData.reduce((sum, record) => sum + record.contentStructure, 0) / filteredData.length * 100) / 100
      },
      {
        category: 'Platform',
        score: Math.round(filteredData.reduce((sum, record) => sum + record.platformUsage, 0) / filteredData.length * 100) / 100
      }
    ];
  }, [filteredData]);

  const strongestCategory = useMemo(() => {
    if (categoryAverages.length === 0) return null;
    return categoryAverages.reduce((best, current) => current.score > best.score ? current : best, categoryAverages[0]);
  }, [categoryAverages]);

  const priorityCategory = useMemo(() => {
    if (categoryAverages.length === 0) return null;
    return categoryAverages.reduce((lowest, current) => current.score < lowest.score ? current : lowest, categoryAverages[0]);
  }, [categoryAverages]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    if (score >= 75) return <Badge className="bg-blue-100 text-blue-800">Good</Badge>;
    if (score >= 60) return <Badge className="bg-amber-100 text-amber-800">Fair</Badge>;
    return <Badge className="bg-red-100 text-red-800">Needs Improvement</Badge>;
  };

  const getCategoryScoreBand = (score: number) => {
    if (score >= 16) {
      return {
        label: 'Excelling',
        color: '#10B981',
        detail: 'Consistently surpassing rubric expectations',
      };
    }
    if (score >= 12) {
      return {
        label: 'Solid',
        color: '#3B82F6',
        detail: 'Meeting most rubric expectations',
      };
    }
    if (score >= 8) {
      return {
        label: 'Developing',
        color: '#F59E0B',
        detail: 'Needs targeted improvement',
      };
    }
    return {
      label: 'Priority',
      color: '#EF4444',
      detail: 'Immediate focus required',
    };
  };

  // Helpers for date range label in header
  const formatDate = (d: Date | null) => {
    if (!d) return '';
    try {
      return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return new Date(d).toISOString().slice(0, 10);
    }
  };

  const rangeLabel = () => {
    const from = startDate; const to = endDate;
    if (!from && !to) return 'Select date range';
    if (from && !to) return `${formatDate(from)} —`;
    if (!from && to) return `— ${formatDate(to)}`;
    return `${formatDate(from!)} — ${formatDate(to!)}`;
  };

  // Quick preset helper
  const applyPreset = (preset: 'last7' | 'last30' | 'thisMonth' | 'allTime') => {
    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;
    if (preset === 'last7') {
      to = new Date(now);
      from = new Date(now);
      from.setDate(from.getDate() - 6);
    } else if (preset === 'last30') {
      to = new Date(now);
      from = new Date(now);
      from.setDate(from.getDate() - 29);
    } else if (preset === 'thisMonth') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === 'allTime') {
      from = null;
      to = null;
    }
    setStartDate(from);
    setEndDate(to);
    setTempRange({ from, to });
    setDatePickerOpen(false);
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      const auth = await getFirebaseAuth();
      await auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Failed to sign out', err);
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsla(var(--background)/1)]">
      <header className="border-b bg-white/95 dark:bg-slate-900/90 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12 overflow-visible">
                <Image
                  src="/careermaps-logo.png"
                  alt="Careermaps logo"
                  fill
                  sizes="48px"
                  className="object-contain"
                  style={{ transform: 'scale(1.35)' }}
                  priority
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold headline-gradient">
                  Career Maps Analytics Dashboard
                </h1>
                <p className="flex items-center gap-2 text-sm header-subtitle">
                  <span className="inline-flex w-2 h-2 rounded-full bg-[hsl(var(--primary))]"></span>
                  Careermaps classes with SHGs Cashpor
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
                <div className="edu-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                AI Processing: Active
              </div> */}
              <div className="text-xs text-[#6B7280] hidden md:block">
                Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : '—'}
              </div>
              <div className="hidden md:flex items-center gap-2">
                <Popover open={datePickerOpen} onOpenChange={(open) => {
                  if (open) {
                    setTempRange({ from: startDate, to: endDate });
                  }
                  setDatePickerOpen(open);
                }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start min-w-[240px] gap-2 pr-2 text-[#374151] border-[#E5E7EB] hover:bg-[#E6F4EC] hover:border-[#0B6B41]">
                      <CalendarIcon className="h-4 w-4 text-[#0B6B41]" />
                      <span className="truncate">{rangeLabel()}</span>
                      <span className="ml-auto flex items-center gap-1">
                        {(startDate || endDate) && (
                          <span
                            role="button"
                            aria-label="Clear date range"
                            title="Clear"
                            className="rounded-md p-1 text-[#6B7280] hover:bg-[#E6F4EC]"
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onClick={(e) => {
                              e.preventDefault(); e.stopPropagation();
                              setStartDate(null);
                              setEndDate(null);
                              setTempRange({ from: null, to: null });
                            }}
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <ChevronDown className="h-4 w-4 opacity-70" />
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="end">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2 px-1">
                        <span className="text-xs text-slate-500 mr-1">Quick ranges:</span>
                        <Button size="sm" variant="secondary" onClick={() => applyPreset('last7')}>Last 7 days</Button>
                        <Button size="sm" variant="secondary" onClick={() => applyPreset('last30')}>Last 30 days</Button>
                        <Button size="sm" variant="secondary" onClick={() => applyPreset('thisMonth')}>This month</Button>
                        <Button size="sm" variant="secondary" onClick={() => applyPreset('allTime')}>All time</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-6 px-1">
                        <div className="text-sm font-medium text-slate-700">Start Date</div>
                        <div className="text-sm font-medium text-slate-700">End Date</div>
                      </div>
                      <CalendarUI
                        mode="range"
                        numberOfMonths={2}
                        selected={{ from: tempRange.from ?? undefined, to: tempRange.to ?? undefined }}
                        onSelect={(range: any) => setTempRange({ from: range?.from ?? null, to: range?.to ?? null })}
                        initialFocus
                      />
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          variant="ghost"
                          className="text-slate-600"
                          onClick={() => {
                            setTempRange({ from: null, to: null });
                            setStartDate(null);
                            setEndDate(null);
                            setDatePickerOpen(false);
                          }}
                        >
                          Clear
                        </Button>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setTempRange({ from: startDate, to: endDate });
                              setDatePickerOpen(false);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => {
                              setStartDate(tempRange.from ? new Date(tempRange.from) : null);
                              setEndDate(tempRange.to ? new Date(tempRange.to) : null);
                              setDatePickerOpen(false);
                            }}
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    setIsReloading(true);
                    await Promise.resolve(reload());
                  } finally {
                    setIsReloading(false);
                  }
                }}
                className="gap-2 border-[#0B6B41] text-[#0B6B41] hover:bg-[#E6F4EC] disabled:border-[#D1D5DB] disabled:text-[#9CA3AF]"
                disabled={isReloading}
              >
                {isReloading && <Loader2 className="h-4 w-4 animate-spin" />}
                Refresh now
              </Button>
              {!shouldBypassFirebaseAuth() && (
                <Button
                  variant="default"
                  className="gap-2 bg-[#0B6B41] hover:bg-[#095836]"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  <LogOut className="h-4 w-4" />
                  {isSigningOut ? 'Signing out…' : 'Sign out'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm surface-card">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Failed to load Google Sheet. Retrying automatically every {Math.round(refreshMs/1000)}s{typeof retryIn === 'number' ? ` (next attempt in ${retryIn}s)` : ''}. You can also click "Refresh now".
            </div>
          </div>
        )}

        {/* Key metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading && (
            <>
              <Card className="surface-card"><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
              <Card className="surface-card"><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
              <Card className="surface-card"><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
              <Card className="surface-card"><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
            </>
          )}
          {!loading && (
            <Link href="/shg" className="block group">
              <Card className="surface-card transition-colors duration-300 hover:border-[hsl(var(--primary))]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium pillar-accent">SHG Initiated</p>
                      <p className="text-3xl font-bold text-[hsl(var(--primary))]">{computedMetrics.shgInitiated}</p>
                    </div>
                    <div className="surface-muted p-3 rounded-full">
                      <Users className="h-8 w-8 text-[hsl(var(--primary))] icon-users-breathe" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {!loading && (
            <Link href="/subjects" className="block group">
              <Card className="surface-card transition-colors duration-300 hover:border-[hsl(var(--primary))]" style={{ animationDelay: '0.1s' }}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium pillar-accent">Subjects Initiated</p>
                      <p className="text-3xl font-bold text-[hsl(var(--primary))]">{computedMetrics.subjectsInitiated}</p>
                    </div>
                    <div className="surface-muted p-3 rounded-full">
                      <BookOpen className="h-8 w-8 text-[hsl(var(--primary))] icon-book-flip" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {!loading && (
            <Link href="/classes" className="block group">
              <Card className="surface-card transition-colors duration-300 hover:border-[hsl(var(--primary))]" style={{ animationDelay: '0.2s' }}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium pillar-accent">Classes Done</p>
                      <p className="text-3xl font-bold"><span className="metric-dual-tone">{computedMetrics.classesDone}</span></p>
                    </div>
                    <div className="surface-muted p-3 rounded-full">
                      <PlayCircle className="h-8 w-8 text-[hsl(var(--primary))] icon-play-rotate" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {!loading && (
            <Link href="/scores" className="block group">
              <Card className="surface-card transition-colors duration-300 hover:border-[hsl(var(--primary))]" style={{ animationDelay: '0.3s' }}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium pillar-accent">Final Score (100)</p>
                      <p className={`text-3xl font-bold ${getScoreColor(computedMetrics.finalScore)}`}>{computedMetrics.finalScore}</p>
                    </div>
                    <div className="surface-muted p-3 rounded-full">
                      <TrendingUp className="h-8 w-8 text-[hsl(var(--primary))] icon-trend-float" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>

        {/* Educational Charts Section */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full lg:w-[800px] grid-cols-4 glass-morphism edu-glow">
            <TabsTrigger value="overview" className="data-[state=active]:edu-glow-accent flex items-center justify-center gap-2 font-semibold text-slate-600">
              <Donut className="h-4 w-4 text-[hsl(var(--primary))]" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="momentum" className="data-[state=active]:edu-glow-accent">🚀 Momentum</TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:edu-glow-accent flex items-center justify-center gap-2 font-semibold text-slate-600">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--primary))]" />
              <span>Performance</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:edu-glow-accent flex items-center justify-center gap-2 font-semibold text-slate-600">
              <Search className="h-4 w-4 text-[hsl(var(--primary))]" />
              <span>Sessions</span>
            </TabsTrigger>
          </TabsList>

          {/* Animation Test Indicator */}
          {/* <div className="fixed top-4 right-4 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-3 py-2 rounded-lg text-sm font-medium z-50 border border-green-300 dark:border-green-700">
            🎓 Icon Animations: Active
          </div> */}

          <TabsContent value="overview" className="space-y-6 tabs-entrance-animation">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Enhanced Score Distribution Chart */}
              <Card className="glass-morphism edu-glow chart-container relative card-entrance-animation card-breathing pie-chart-container overview-card">
                <CardHeader className="pb-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="overview-icon">
                        <Donut className="h-5 w-5" />
                      </span>
                      <CardTitle className="overview-gradient-title">Score Distribution</CardTitle>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-1 text-xs text-slate-600">
                      <span className="chart-status-badge overview-status-badge bg-green-100 text-green-800 border-green-200 font-black shimmer-pulse" style={{animationDelay: '0s'}}>
                        <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse"></span>
                        LIVE
                      </span>
                      <span className="font-semibold text-slate-700">{filteredData.length} classes</span>
                      <span className="overview-meta-label">{totalSessions} total sessions</span>
                    </div>
                  </div>
                  <p className="overview-subtext">
                    Distribution of final scores by performance band. Green highlights 90-100 excellence, blue marks 75-89 strong delivery, amber flags 60-74 developing sessions, and red signals classes under 60 needing attention.
                  </p>
                </CardHeader>
                <CardContent className="relative space-y-4">
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={scoreDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                          className="chart-build-progress pie-spin-in-place"
                          style={{ filter: 'drop-shadow(0 8px 18px rgba(0, 0, 0, 0.12))' }}
                        >
                          {scoreDistribution.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color}
                              className="chart-element pie-segment-hover"
                              style={{
                                animationDelay: `${index * 0.18}s`,
                                transformOrigin: 'center',
                                filter: `drop-shadow(0 4px 8px ${entry.color}3a)`
                              }}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.92)',
                            color: '#1f2937',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '12px',
                            backdropFilter: 'blur(15px)',
                            boxShadow: '0 16px 32px rgba(15, 23, 42, 0.12)',
                            fontSize: '0.875rem',
                            padding: '12px 16px',
                            minWidth: '120px'
                          }}
                          labelStyle={{ color: '#1f2937', fontWeight: '600' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute bottom-2 left-2 text-xs text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded backdrop-blur-sm overview-tip">
                      🥧 Hover a band to spot concentration
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    {scoreDistribution.map((band) => (
                      <div
                        key={`score-band-${band.name}`}
                        className="flex items-center justify-between rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: band.color }}
                          ></span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{band.name}</span>
                        </div>
                        <span className="font-medium text-slate-500 dark:text-slate-400">{band.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {topScoreBand
                      ? `Most classes currently land in the ${topScoreBand.name} range.`
                      : 'No classes logged yet for these filters.'}
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Category Averages Chart */}
              <Card className="glass-morphism edu-glow chart-container relative card-entrance-animation overview-card" style={{animationDelay: '0.15s'}}>
                <CardHeader className="pb-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="overview-icon">
                        <RadarIcon className="h-5 w-5" />
                      </span>
                      <CardTitle className="overview-gradient-title">Category Performance</CardTitle>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-1 text-xs text-slate-600">
                      <span className="chart-status-badge overview-status-badge bg-sky-100 text-sky-700 border-sky-200 font-black shimmer-pulse" style={{animationDelay: '0.6s'}}>
                        ANALYTICS
                      </span>
                      <span className="font-semibold text-slate-700">Avg {computedMetrics.finalScore}</span>
                      <span className="overview-meta-label">{categoryAverages.length} rubric dimensions</span>
                    </div>
                  </div>
                  <p className="overview-subtext">
                    Average rubric scores (0-20) plotted per dimension. Green ≥16 signals excelling delivery, blue 12-15.9 shows solid consistency, amber 8-11.9 highlights developing areas, and red &lt;8 marks priority focus.
                  </p>
                </CardHeader>
                <CardContent className="radar-chart-container space-y-4">
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={categoryAverages}>
                        <PolarGrid
                          gridType="polygon"
                          stroke="#374151"
                          strokeDasharray="2 2"
                          className="polar-grid-pulse"
                        />
                        <PolarAngleAxis
                          dataKey="category"
                          tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }}
                          className="text-slate-600 dark:text-slate-400 radar-label-float"
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 20]}
                          tick={{ fill: '#6B7280', fontSize: 10 }}
                          tickCount={5}
                          stroke="#6B7280"
                          className="radar-axis-glow"
                        />
                        <Radar
                          name="Performance Score"
                          dataKey="score"
                          stroke="#3B82F6"
                          fill="url(#radarGradient)"
                          fillOpacity={0.4}
                          strokeWidth={3}
                          className="chart-build-progress radar-fill-animate"
                          style={{ filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.92)',
                            color: '#1f2937',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            borderRadius: '12px',
                            backdropFilter: 'blur(15px)',
                            boxShadow: '0 16px 32px rgba(15, 23, 42, 0.12)',
                            fontSize: '0.875rem',
                            padding: '12px 16px',
                            minWidth: '120px'
                          }}
                          labelStyle={{ color: '#1f2937', fontWeight: '600' }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>

                    <svg width="0" height="0" className="absolute">
                      <defs>
                        <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.6} />
                          <stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.6} />
                          <animateTransform
                            attributeName="gradientTransform"
                            attributeType="XML"
                            type="rotate"
                            values="0 0.5 0.5;360 0.5 0.5"
                            dur="8s"
                            repeatCount="indefinite"
                          />
                        </linearGradient>
                      </defs>
                    </svg>

                    <div className="absolute top-2 right-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse radar-indicator"></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                    {categoryAverages.length ? (
                      categoryAverages.map((dimension) => {
                        const band = getCategoryScoreBand(dimension.score);
                        return (
                          <div
                            key={`category-band-${dimension.category}`}
                            className="flex items-center justify-between rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: band.color }}
                              ></span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{dimension.category}</span>
                            </div>
                            <div className="flex flex-col items-end text-right">
                              <span className="font-semibold text-slate-700 dark:text-slate-100">{dimension.score.toFixed(1)}/20</span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">{band.label}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-full rounded-lg border border-dashed border-slate-200/70 dark:border-slate-700/60 bg-white/50 dark:bg-slate-900/20 px-3 py-3 text-center">
                        No rubric category data yet for these filters.
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {categoryAverages.length && strongestCategory && priorityCategory
                      ? `Top strength: ${strongestCategory.category} (${strongestCategory.score.toFixed(1)}/20). Priority support: ${priorityCategory.category} (${priorityCategory.score.toFixed(1)}/20).`
                      : 'Add rubric scores to highlight category strengths and focus areas.'}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-morphism edu-glow chart-container relative card-entrance-animation overview-card lg:col-span-2" style={{ animationDelay: '0.25s' }}>
                <CardHeader className="pb-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="overview-icon">
                        <PlayCircle className="h-5 w-5" />
                      </span>
                      <CardTitle className="overview-gradient-title">Classes Momentum</CardTitle>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-1 text-xs text-slate-600">
                      <span className="chart-status-badge overview-status-badge bg-sky-100 text-sky-700 border-sky-200 font-semibold shimmer-pulse">
                        Trend pulse
                      </span>
                      <span className="font-semibold text-slate-700 whitespace-nowrap">
                        Avg {averageWeeklySessions} classes / week
                      </span>
                      <span className="overview-meta-label whitespace-nowrap">
                        Peak week {peakSessionsWeek ? `${peakSessionsWeek.week}` : '—'}
                      </span>
                    </div>
                  </div>
                  <p className="overview-subtext">
                    Classes delivered week by week for the last 8 weeks. Empty weeks are shown as zero.
                  </p>
                </CardHeader>
                <CardContent className="space-y-5">
                  {classesTrend.length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-500">
                      Not enough weekly data to draw the momentum chart yet.
                    </div>
                  ) : (
                    <div className="h-[300px] rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/60 to-white px-2 pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={classesTrend} margin={{ top: 24, right: 12, left: 0, bottom: 12 }}>
                          <defs>
                            <linearGradient id="classesBarGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10B981" />
                              <stop offset="100%" stopColor="#059669" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.35)" />
                          <XAxis
                            dataKey="weekLabel"
                            tick={{ fontSize: 11, fontWeight: 600, fill: '#475569' }}
                            axisLine={{ stroke: '#CBD5E1' }}
                            tickLine={false}
                            interval={0}
                            minTickGap={4}
                            height={38}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                            domain={[0, 'dataMax + 2']}
                            width={32}
                            label={{ value: 'Classes', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }}
                            contentStyle={{
                              background: 'rgba(255, 255, 255, 0.96)',
                              borderRadius: 12,
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
                              fontSize: '0.8rem',
                              padding: '10px 14px',
                            }}
                            formatter={(value) => [`${value} classes`, 'Classes delivered']}
                          />
                          <Bar
                            dataKey="sessions"
                            name="Classes delivered"
                            fill="url(#classesBarGradient)"
                            radius={[7, 7, 0, 0]}
                            maxBarSize={52}
                          >
                            <LabelList dataKey="sessions" position="top" fill="#047857" fontSize={12} fontWeight={700} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2 text-xs text-slate-600">
                    <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/70">
                      <p className="font-semibold text-emerald-700">Latest week</p>
                      <p>
                        {latestWeek ? `${latestWeek.week} • ${latestWeek.sessions} classes` : 'No weekly data yet'}
                      </p>
                      {latestWeekChange !== null && (
                        <p className={`mt-1 font-semibold ${latestWeekChange > 0 ? 'text-emerald-700' : latestWeekChange < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                          {latestWeekChange > 0 ? '+' : ''}{latestWeekChange} vs previous week
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/70">
                      <p className="font-semibold text-blue-700">Peak volume</p>
                      <p>
                        {peakSessionsWeek ? `${peakSessionsWeek.sessions} classes • ${peakSessionsWeek.week}` : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="momentum" className="space-y-6 tabs-entrance-animation">
            <Card className="glass-morphism edu-glow chart-container relative card-entrance-animation weekly-momentum-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="edu-gradient-text flex items-center gap-2">
                    🚀 Weekly Momentum Pulse
                    <span className="chart-status-badge bg-amber-100 text-amber-700 border-amber-200 font-semibold shimmer-pulse">
                      Dynamic
                    </span>
                  </CardTitle>
                  <Badge variant="outline" className="bg-white/60 text-slate-600 border-transparent hidden sm:flex">
                    {weeklyMomentum.length} tracked weeks
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Captures weekly average score trajectory, extremes, and session load. Hover bars or dots to explore momentum shifts.
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                {weeklyMomentum.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-500">
                    Not enough data to render weekly trends yet.
                  </div>
                ) : (
                  <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={weeklyMomentum} margin={{ top: 30, right: 24, left: 8, bottom: 12 }}>
                        <defs>
                          <linearGradient id="weeklyGradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="rgba(16, 185, 129, 0.4)" />
                            <stop offset="100%" stopColor="rgba(245, 158, 11, 0.35)" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" stroke="#E5E7EB" className="grid-lines-pulse" />
                        <XAxis
                          dataKey="week"
                          tick={{ fill: '#6B7280', fontSize: 11 }}
                          angle={-10}
                          textAnchor="end"
                        />
                        <YAxis
                          yAxisId="score"
                          domain={[0, 100]}
                          tick={{ fill: '#6B7280', fontSize: 11 }}
                          tickFormatter={(v) => `${v}`}
                        />
                        <YAxis
                          yAxisId="sessions"
                          orientation="right"
                          tick={{ fill: '#94A3B8', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${v} sess`}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                          contentStyle={{
                            background: 'rgba(255,255,255,0.9)',
                            borderRadius: 12,
                            border: '1px solid hsla(var(--border)/1)',
                            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.12)',
                          }}
                          formatter={(value, name) => {
                            if (name === 'avgScore') return [`${value}`, 'Avg Score'];
                            if (name === 'sessions') return [`${value}`, 'Sessions'];
                            if (name === 'highScore') return [`${value}`, 'High'];
                            if (name === 'lowScore') return [`${value}`, 'Low'];
                            return [value, name];
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          height={32}
                          iconType="circle"
                          wrapperStyle={{ fontSize: 12, gap: 8 }}
                        />
                        <Area
                          yAxisId="score"
                          type="monotone"
                          dataKey="avgScore"
                          stroke="hsl(var(--primary))"
                          strokeWidth={3}
                          fill="url(#weeklyGradient)"
                          dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: 'hsl(var(--primary))' }}
                          activeDot={{ r: 7, stroke: 'rgba(245, 158, 11, 0.6)', strokeWidth: 3 }}
                        />
                        <Line
                          yAxisId="score"
                          type="monotone"
                          dataKey="highScore"
                          stroke="#F59E0B"
                          strokeWidth={2}
                          strokeDasharray="5 4"
                          dot={false}
                        />
                        <Line
                          yAxisId="score"
                          type="monotone"
                          dataKey="lowScore"
                          stroke="#3B82F6"
                          strokeWidth={2}
                          strokeDasharray="3 4"
                          dot={false}
                        />
                        <Bar
                          yAxisId="sessions"
                          dataKey="sessions"
                          barSize={14}
                          radius={[6, 6, 6, 6]}
                          fill="rgba(15, 118, 110, 0.25)"
                          className="weekly-volume-bars"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-morphism edu-glow chart-container relative card-entrance-animation" style={{ animationDelay: '0.15s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 edu-gradient-text">
                  📌 Weekly Highlights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/10 border border-emerald-200/60">
                    <p className="text-xs uppercase tracking-wide text-emerald-600">Strongest week</p>
                    <p className="text-lg font-semibold text-emerald-700">
                      {weeklyMomentum.at(-1)?.week ?? '—'}
                    </p>
                    <p className="text-sm text-emerald-700">Avg score {weeklyMomentum.at(-1)?.avgScore ?? '—'}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-900/10 border border-amber-200/60">
                    <p className="text-xs uppercase tracking-wide text-amber-600">Peak sessions</p>
                    <p className="text-lg font-semibold text-amber-700">
                      {weeklyMomentum.reduce((max, cur) => cur.sessions > max.sessions ? cur : max, weeklyMomentum[0] ?? { week: '—', sessions: 0 }).week}
                    </p>
                    <p className="text-sm text-amber-700">{weeklyMomentum.reduce((max, cur) => Math.max(max, cur.sessions), 0)} total sessions</p>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-900/10 border border-blue-200/60">
                    <p className="text-xs uppercase tracking-wide text-blue-600">Volatility</p>
                    <p className="text-lg font-semibold text-blue-700">
                      {weeklyMomentum.length ? `${Math.max(...weeklyMomentum.map(w => w.highScore - w.lowScore)).toFixed(1)} pts` : '—'}
                    </p>
                    <p className="text-sm text-blue-700">Range between weekly high & low</p>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  Weekly metrics begin Monday and end Sunday. Adjust the sheet data to see immediate impact.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6 tabs-entrance-animation animate-immediate-performance">
            <Card
              className="glass-morphism edu-glow chart-container relative card-entrance-animation card-breathing overview-card performance-chart-container animate-immediately"
              style={{ animationDelay: '0.4s' }}
            >
              <CardHeader className="pb-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="overview-icon">
                      <TrendingUp className="h-5 w-5" />
                    </span>
                    <CardTitle className="overview-gradient-title">
                      AI Performance Trends
                    </CardTitle>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-1 text-xs text-slate-600">
                    <span
                      className="chart-status-badge overview-status-badge bg-green-100 text-green-800 border-green-200 font-black shimmer-pulse"
                      style={{ animationDelay: '1.4s' }}
                    >
                      <span className="inline-block w-2 h-2 bg-purple-400 rounded-full mr-1 animate-pulse"></span>
                      TRENDING
                    </span>
                    <span className="font-semibold text-slate-700">
                      {Math.min(filteredData.length, 20)} recent classes
                    </span>
                    <span className="overview-meta-label">
                      Tracks final score vs engagement & instructor
                    </span>
                  </div>
                </div>
                <p className="overview-subtext">
                  Explore how overall scores align with engagement and instructor metrics across recent sessions.
                </p>
              </CardHeader>
              <CardContent className="relative performance-chart-content">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={filteredData.slice(0, 20)}>
                    <CartesianGrid strokeDasharray="3 3" className="grid-lines-pulse" />
                    <XAxis
                      dataKey="srNo"
                      className="axis-labels-float"
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      className="axis-labels-float"
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        color: '#1f2937',
                        border: '1px solid #8b5cf6',
                        borderRadius: '12px',
                        backdropFilter: 'blur(15px)',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                        fontSize: '0.875rem',
                        padding: '12px 16px',
                        minWidth: '120px'
                      }}
                      labelStyle={{ color: '#1f2937', fontWeight: '600' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="finalScore"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      className="line-animate-final-score"
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 5, className: 'dot-pulse-final' }}
                      activeDot={{ r: 8, className: 'active-dot-glow' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="engagement"
                      stroke="#10B981"
                      strokeWidth={3}
                      className="line-animate-engagement"
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 5, className: 'dot-pulse-engagement' }}
                      activeDot={{ r: 8, className: 'active-dot-glow' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="instructorIssues"
                      stroke="#F59E0B"
                      strokeWidth={3}
                      className="line-animate-instructor"
                      dot={{ fill: '#F59E0B', strokeWidth: 2, r: 5, className: 'dot-pulse-instructor' }}
                      activeDot={{ r: 8, className: 'active-dot-glow' }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                {/* Trend Indicator */}
                <div className="absolute bottom-2 right-2 text-xs text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded backdrop-blur-sm">
                  📊 Hover lines for trends
                </div>

                {/* Creative floating indicators */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Floating trend indicators */}
                  <div className="absolute top-4 left-4 w-3 h-3 bg-blue-400 rounded-full trend-float-1"></div>
                  <div className="absolute top-1/3 right-6 w-2 h-2 bg-green-400 rounded-full trend-float-2"></div>
                  <div className="absolute bottom-1/3 left-8 w-2 h-2 bg-amber-400 rounded-full trend-float-3"></div>

                  {/* Animated background elements */}
                  <div className="absolute top-8 right-8 text-2xl opacity-10">📈</div>
                  <div className="absolute bottom-8 left-8 text-2xl opacity-10">📊</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            {/* Educational Filters */}
            <Card className="glass-morphism edu-glow session-card-interactive">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="relative flex-1 session-filter-field">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 edu-pulse" />
                    <Input
                      placeholder="AI Search: Find SHG or video insights..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 glass-morphism edu-glow"
                    />
                  </div>
                  <Select value={selectedSHG} onValueChange={setSelectedSHG}>
                    <SelectTrigger className="w-full lg:w-64 glass-morphism edu-glow session-filter-field">
                      <SelectValue placeholder="Select SHG" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All SHGs</SelectItem>
                      <SelectItem value="PURZAGIR">SHG TC PURZAGIR</SelectItem>
                      <SelectItem value="BIRDHA">SHG TC BIRDHA</SelectItem>
                      <SelectItem value="BHUSRA">SHG TC BHUSRA</SelectItem>
                      <SelectItem value="BHADSAR">SHG TC BHADSAR</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={scoreFilter} onValueChange={setScoreFilter}>
                    <SelectTrigger className="w-full lg:w-48 glass-morphism edu-glow session-filter-field">
                      <SelectValue placeholder="Filter by score" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Scores</SelectItem>
                      <SelectItem value="excellent">Excellent (90+)</SelectItem>
                      <SelectItem value="good">Good (75-89)</SelectItem>
                      <SelectItem value="needs-improvement">Needs Improvement (&lt;75)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Educational Sessions Table */}
            <Card className="glass-morphism edu-glow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between edu-gradient-text">
                  <span>AI-Analyzed Session Records ({filteredData.length} total)</span>
                  <Badge variant="outline" className="edu-glow-accent">Page {currentPage} of {totalPages}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loading && (
                    <>
                      <Card className="p-4 glass-morphism"><Skeleton className="h-24 w-full" /></Card>
                      <Card className="p-4 glass-morphism"><Skeleton className="h-24 w-full" /></Card>
                      <Card className="p-4 glass-morphism"><Skeleton className="h-24 w-full" /></Card>
                    </>
                  )}
                  {!loading && paginatedData.map((record) => (
                    <Card
                      key={record.srNo}
                      className="p-4 transition-all duration-300 glass-morphism edu-glow session-card-interactive"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-3">
                            <div className="edu-glow-accent rounded-full p-2 session-icon">
                              <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-blue-600 rounded-full"></div>
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                                {record.shgName}
                              </h3>
                              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                {record.videoName}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <CalendarIcon className="h-3 w-3" />
                                {record.dateCreated}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className={`text-2xl font-bold ${getScoreColor(record.finalScore)}`}>
                                {record.finalScore}
                              </div>
                              {getScoreBadge(record.finalScore)}
                            </div>
                          </div>
                          
                          <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
                            <div className="text-center p-2 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 edu-glow-accent">
                              <div className="text-sm font-medium text-blue-600 dark:text-blue-400">Engagement</div>
                              <div className={`text-lg font-semibold ${getScoreColor(record.engagement * 5)}`}>
                                {record.engagement}/20
                              </div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-green-50/50 dark:bg-green-900/20 edu-glow-accent">
                              <div className="text-sm font-medium text-green-600 dark:text-green-400">Class Issues</div>
                              <div className={`text-lg font-semibold ${getScoreColor(record.classIssues * 5)}`}>
                                {record.classIssues}/20
                              </div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-purple-50/50 dark:bg-purple-900/20 edu-glow-accent">
                              <div className="text-sm font-medium text-purple-600 dark:text-purple-400">Instructor</div>
                              <div className={`text-lg font-semibold ${getScoreColor(record.instructorIssues * 5)}`}>
                                {record.instructorIssues}/20
                              </div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-amber-50/50 dark:bg-amber-900/20 edu-glow-accent">
                              <div className="text-sm font-medium text-amber-600 dark:text-amber-400">Content</div>
                              <div className={`text-lg font-semibold ${getScoreColor(record.contentStructure * 5)}`}>
                                {record.contentStructure}/20
                              </div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-cyan-50/50 dark:bg-cyan-900/20 edu-glow-accent">
                              <div className="text-sm font-medium text-cyan-600 dark:text-cyan-400">Platform</div>
                              <div className={`text-lg font-semibold ${getScoreColor(record.platformUsage * 5)}`}>
                                {record.platformUsage}/20
                              </div>
                            </div>
                          </div>

                          {record.issuesToImprove && (
                            <div className="mt-3 p-3 bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200/50 dark:border-amber-800/50 edu-glow-accent">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0 edu-pulse" />
                                <div>
                                  <div className="text-sm font-medium text-amber-800 dark:text-amber-200">AI Analysis: Issues to Improve</div>
                                  <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                    {record.issuesToImprove}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        {/* <div className="flex items-center gap-2">
                          {record.videoUrl !== 'NA' && (
                            <Button variant="outline" size="sm" className="gap-2 glass-morphism edu-glow hover:edu-glow-strong">
                              <Eye className="h-4 w-4" />
                              AI View
                            </Button>
                          )}
                        </div> */}
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Educational Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6 p-4 glass-morphism edu-glow rounded-xl">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="glass-morphism edu-glow"
                    >
                      Previous
                    </Button>
                    <div className="text-sm text-slate-600 dark:text-slate-400 edu-glow-accent px-3 py-1 rounded-lg">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="glass-morphism edu-glow"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}