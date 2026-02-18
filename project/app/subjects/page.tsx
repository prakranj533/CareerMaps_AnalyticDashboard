"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSheetDashboard } from '@/hooks/useSheetDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Search, Filter } from 'lucide-react';
import { SHEET_ID, SHEET_GID, DEFAULT_REFRESH_MS } from '@/lib/config';
import { CORE_SUBJECTS, coreSubjectFor, type CoreSubject } from '@/lib/subject-categories';
import { normalizeGvizDate } from '@/lib/sheets';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RANGE_PRESET_OPTIONS, createRangeState, describeRangeState, getRangeBounds, isDateWithinBounds } from '@/lib/date-filters';

const normalizeHeader = (value: string) => value?.toLowerCase().replace(/[^a-z0-9]/gi, '') ?? '';

const readSheetValue = (row: Record<string, any>, ...labels: string[]): string => {
  const keys = Object.keys(row ?? {});
  for (const label of labels) {
    const normalizedLabel = normalizeHeader(label);
    const match = keys.find((key) => normalizeHeader(key) === normalizedLabel);
    if (match) {
      const cell = row[match];
      if (cell !== undefined && cell !== null && cell !== '') {
        return String(cell);
      }
    }
  }
  return '';
};

const cleanSheetText = (value: string): string => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  let result = trimmed.split(/\r?\n/)[0]?.trim() ?? '';
  const markers = ['Scores', 'Engagement', 'Class Issues', 'Instructor Issues', 'Content Structure', 'Platform Tool Usage', 'Comments', 'Final Score'];
  for (const marker of markers) {
    const idx = result.toLowerCase().indexOf(marker.toLowerCase());
    if (idx > 0) {
      result = result.slice(0, idx).trim();
    }
  }
  return result
    .replace(/[★☆•✅⚠️🔹🔥✨]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[,:;\-\–]+$/g, '')
    .trim();
};

const CATEGORY_ORDER = CORE_SUBJECTS;
type CategoryName = CoreSubject;

const categorizePair = (subject: string, topic: string): CategoryName => {
  const subjectLabel = subject?.trim();
  if (subjectLabel) {
    return coreSubjectFor(subjectLabel);
  }
  return coreSubjectFor(topic);
};

export default function SubjectsPage() {
  const [refreshMs] = useState(DEFAULT_REFRESH_MS);
  const [query, setQuery] = useState('');
  const [range, setRange] = useState(createRangeState());
  const [open, setOpen] = useState<Record<CategoryName, boolean>>({
    Mathematics: false,
    Science: false,
    Computer: false,
    English: false,
  });

  const { rows } = useSheetDashboard({
    sheetId: SHEET_ID,
    gid: SHEET_GID,
    refreshMs,
    columns: {
      shg: 'SHG Name',
      subject: 'Subject from AI',
      score: 'Final Score (100)',
      videoName: 'Video Name',
      dateCreated: 'Date Created',
    },
  });

  const bounds = useMemo(() => getRangeBounds(range), [range]);
  const hasExplicitBounds = bounds.from !== null || bounds.to !== null;

  type SubjectTopic = { subject: string; topic: string; count: number };
  const { subjectTopics, uncategorizedCount } = useMemo<{ subjectTopics: SubjectTopic[]; uncategorizedCount: number }>(() => {
    const grouped = new Map<string, SubjectTopic>();
    let uncategorized = 0;
    for (const row of rows as any[]) {
      if (hasExplicitBounds) {
        const dateValue = normalizeGvizDate(row['Date Created']);
        const date = dateValue ? new Date(dateValue) : null;
        if (!date || !isDateWithinBounds(date, bounds)) continue;
      }
      const rawTopic = cleanSheetText(String(row['Topic Name'] ?? ''));
      const topicName = rawTopic.startsWith('#') ? '' : rawTopic;
      const aiSubject = cleanSheetText(String(row['Subject from AI'] ?? ''));
      if (!aiSubject && !topicName) {
        uncategorized += 1;
        continue;
      }
      const displayName = aiSubject || topicName;
      const topicLabel = topicName || aiSubject;
      if (
        query &&
        !displayName.toLowerCase().includes(query.toLowerCase()) &&
        !topicLabel.toLowerCase().includes(query.toLowerCase())
      ) {
        continue;
      }
      const subj = categorizePair(displayName, topicLabel);
      const key = `${subj}|${displayName}|${topicLabel}`;
      const existing = grouped.get(key) ?? { subject: displayName, topic: topicLabel, count: 0 };
      existing.count += 1;
      grouped.set(key, existing);
    }
    let items = Array.from(grouped.values());
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter((item) =>
        item.subject.toLowerCase().includes(q) || item.topic.toLowerCase().includes(q)
      );
    }
    return {
      subjectTopics: items.sort((a, b) =>
        a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic)
      ),
      uncategorizedCount: uncategorized,
    };
  }, [rows, query, hasExplicitBounds, bounds]);

  const totalClassesFiltered = subjectTopics.reduce((sum, item) => sum + item.count, 0) + uncategorizedCount;

  const sections = useMemo(() => {
    const byCategory = new Map<CategoryName, { items: SubjectTopic[]; total: number }>();
    for (const cat of CATEGORY_ORDER) {
      byCategory.set(cat, { items: [], total: 0 });
    }
    for (const pair of subjectTopics) {
      const category = categorizePair(pair.subject, pair.topic);
      const bucket = byCategory.get(category)!;
      bucket.items.push(pair);
      bucket.total += pair.count;
    }
    return CATEGORY_ORDER.map((cat) => ({
      name: cat,
      total: byCategory.get(cat)!.total,
      items: byCategory.get(cat)!.items.sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject)),
    })).filter((section) => section.items.length > 0);
  }, [subjectTopics]);

  const totalClasses = subjectTopics.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="min-h-screen bg-[hsla(var(--background)/1)]">
      <header className="border-b bg-white/95 dark:bg-slate-900/90 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Subjects Overview</h1>
              <p className="text-sm text-slate-500">Live view of "Subject from AI" × "Topic Name" pairs from the sheet</p>
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
                Showing {sections.length} categories • {totalClassesFiltered} classes
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search subject or topic..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {sections.length > 0 ? (
          <div className="space-y-4">
            {sections.map((section) => (
              <Card key={section.name} className="surface-card">
                <CardHeader className="py-4">
                  <button
                    className="w-full flex items-center justify-between text-left"
                    onClick={() => setOpen((prev) => ({ ...prev, [section.name]: !prev[section.name] }))}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`transition-transform duration-200 ${open[section.name as CategoryName] ? 'rotate-90' : ''}`}>
                        {open[section.name as CategoryName] ? '▾' : '▸'}
                      </div>
                      <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-[hsl(var(--primary))]" />
                        {section.name}
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="bg-[hsla(var(--primary)/0.12)] text-[hsl(var(--primary))] border-transparent">
                      {section.total} {section.total === 1 ? 'class' : 'classes'}
                    </Badge>
                  </button>
                </CardHeader>
                {open[section.name as CategoryName] && (
                  <CardContent className="pt-0 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {section.items.map((item) => (
                        <div key={`${section.name}|${item.subject}|${item.topic}`} className="rounded-lg border border-[hsla(var(--border)/1)] bg-white dark:bg-slate-900/60 p-3 space-y-1">
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.subject}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-300">Topic: {item.topic}</div>
                          <div className="text-xs text-slate-500">{item.count} {item.count === 1 ? 'class' : 'classes'} recorded</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card className="surface-muted">
            <CardContent className="py-12 text-center space-y-3">
              <div className="text-4xl">🔍</div>
              <p className="text-slate-600">No subjects found</p>
              <p className="text-sm text-slate-500">Try a different search term or refresh the data.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
