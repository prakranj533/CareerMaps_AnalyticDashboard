"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSheetDashboard } from '@/hooks/useSheetDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Search, Filter } from 'lucide-react';
import { encodeShgSlug } from '@/lib/shg-slug';
import { normalizeGvizDate } from '@/lib/sheets';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RANGE_PRESET_OPTIONS, createRangeState, describeRangeState, getRangeBounds, isDateWithinBounds } from '@/lib/date-filters';

export default function ShgPage() {
  const [refreshMs] = useState(30000);
  const [query, setQuery] = useState('');
  const [range, setRange] = useState(createRangeState());
  const router = useRouter();

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
    const map = new Map<string, number>();
    rows.forEach((r: any) => {
      const k = String(r['SHG Name'] ?? '').trim();
      if (!k) return;
      const dateValue = normalizeGvizDate(r['Date Created']);
      const date = dateValue ? new Date(dateValue) : null;
      if (hasExplicitBounds) {
        if (!date || !isDateWithinBounds(date, bounds)) return;
      }
      map.set(k, (map.get(k) || 0) + 1);
    });
    const arr = Array.from(map.entries()).map(([name, count]) => ({ name, count }));
    return arr
      .filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.count - a.count);
  }, [rows, query, hasExplicitBounds, bounds]);

  const totalClasses = shgCounts.reduce((sum, item) => sum + item.count, 0);

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
              <p className="text-sm text-slate-500">Class sessions completed across Self Help Groups</p>
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
            {shgCounts.map((s) => (
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
                  Consistent engagement recorded by Careermaps.
                </CardContent>
              </Card>
            ))}
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
