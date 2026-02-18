"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSheetDashboard } from '@/hooks/useSheetDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Search, BarChart3, Award } from 'lucide-react';

export default function ScoresPage() {
  const [refreshMs] = useState(30000);
  const [query, setQuery] = useState('');

  const scoreBadgeClass = (score: number) => {
    if (score >= 90) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 75) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 60) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

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

  const data = useMemo(() => {
    const records = rows.map((r: any) => ({
      shgName: String(r['SHG Name'] ?? ''),
      videoName: String(r['Video Name'] ?? ''),
      score: Number(r['Final Score (100)'] ?? 0),
    }));

    const filtered = records.filter(
      (r) => r.shgName.toLowerCase().includes(query.toLowerCase()) || r.videoName.toLowerCase().includes(query.toLowerCase())
    );

    const distribution = [
      { name: '90-100', count: 0, color: '#10B981' },
      { name: '75-89', count: 0, color: '#3B82F6' },
      { name: '60-74', count: 0, color: '#F59E0B' },
      { name: '0-59', count: 0, color: '#EF4444' },
    ];

    filtered.forEach((r) => {
      if (r.score >= 90) distribution[0].count++;
      else if (r.score >= 75) distribution[1].count++;
      else if (r.score >= 60) distribution[2].count++;
      else distribution[3].count++;
    });

    const avg = filtered.length
      ? Number((filtered.reduce((a, b) => a + b.score, 0) / filtered.length).toFixed(2))
      : 0;

    return { filtered, distribution, avg };
  }, [rows, query]);

  return (
    <div className="min-h-screen bg-[hsla(var(--background)/1)]">
      <header className="border-b bg-white/95 dark:bg-slate-900/90 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Score Insights</h1>
              <p className="text-sm text-slate-500">Distribution and averages across Careermaps sessions</p>
            </div>
          </div>
          <Link href="/" className="text-sm font-medium text-[hsl(var(--primary))] hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Card className="surface-card lg:col-span-8 score-card-interactive score-chart-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-800 dark:text-slate-100 text-base font-semibold">Score distribution</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      borderRadius: 12,
                      border: '1px solid hsla(var(--border)/1)',
                      boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)'
                    }}
                    labelStyle={{ fontWeight: 600, color: '#1F2937' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} className="chart-build-progress">
                    {data.distribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="surface-card lg:col-span-4 score-card-interactive">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100 text-base font-semibold">
                <Award className="h-5 w-5 text-[hsl(var(--primary))]" />
                Average score
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex justify-end">
                <span className="score-beacon" aria-hidden="true" />
              </div>
              <div className="text-4xl font-bold text-[hsl(var(--primary))]">{data.avg}</div>
              <p className="text-sm text-slate-500">Across {data.filtered.length} classes evaluated.</p>
              <Badge variant="outline" className="bg-[hsla(var(--primary)/0.12)] text-[hsl(var(--primary))] border-transparent">Out of 100</Badge>
            </CardContent>
          </Card>
        </div>

        <Card className="surface-card score-card-interactive">
          <CardContent className="p-4">
            <div className="relative overflow-hidden">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search SHG or video name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {data.filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.filtered.map((r, i) => (
              <Card key={`${r.shgName}-${r.videoName}-${i}`} className="surface-card score-card-interactive">
                <CardContent className="p-5 space-y-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] items-start">
                    <div className="space-y-1 min-w-0">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{r.shgName}</h3>
                      <p className="text-sm text-slate-500 truncate">{r.videoName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="score-pill">{r.score}</span>
                      <Badge variant="outline" className={scoreBadgeClass(r.score)}>
                        {r.score >= 90
                          ? 'Excellent'
                          : r.score >= 75
                          ? 'Good'
                          : r.score >= 60
                          ? 'Fair'
                          : 'Needs work'}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Score classification based on overall AI evaluation.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="surface-muted">
            <CardContent className="py-12 text-center space-y-3">
              <div className="text-4xl">📊</div>
              <p className="text-slate-600">No records found</p>
              <p className="text-sm text-slate-500">Try a different search term or refresh the data.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
