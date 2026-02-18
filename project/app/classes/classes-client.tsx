"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Calendar, Filter, GitMerge, PlayCircle, Search, Tag } from "lucide-react";

import AuthGuard from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSheetDashboard } from "@/hooks/useSheetDashboard";
import { normalizeGvizDate } from "@/lib/sheets";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RANGE_PRESET_OPTIONS, createRangeState, describeRangeState, getRangeBounds, isDateWithinBounds } from "@/lib/date-filters";

const normalizeHeader = (value: string) => value?.toLowerCase().replace(/[^a-z0-9]/gi, "") ?? "";
const readSheetValue = (row: Record<string, any>, ...labels: string[]): string => {
  const keys = Object.keys(row ?? {});
  for (const label of labels) {
    const normalizedLabel = normalizeHeader(label);
    const matchedKey = keys.find((key) => normalizeHeader(key) === normalizedLabel);
    if (matchedKey) {
      const cell = row[matchedKey];
      if (cell !== undefined && cell !== null && cell !== "") {
        return String(cell);
      }
    }
  }
  return "";
};

const cleanSheetText = (value: string): string => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  let result = trimmed.split(/\r?\n/)[0]?.trim() ?? "";
  const markers = ["Scores:", "Subject name:", "Subject Name:", "Teacher:"];
  for (const marker of markers) {
    const idx = result.toLowerCase().indexOf(marker.toLowerCase());
    if (idx > 0) {
      result = result.slice(0, idx).trim();
    }
  }
  return result.replace(/[•\-\u2022\u2013]+$/g, "").trim();
};

export default function ClassesClient() {
  const [refreshMs] = useState(30000);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState(createRangeState());

  const { rows } = useSheetDashboard({
    sheetId: "1Oyz0XkemLeHjUQOBW1KrSKYTlhyvRfjXc3jNp9eZoSM",
    gid: "0",
    refreshMs,
    columns: {
      shg: "SHG Name",
      subject: "Video Name",
      score: "Final Score (100)",
    },
  });

  const bounds = useMemo(() => getRangeBounds(range), [range]);
  const hasExplicitBounds = bounds.from !== null || bounds.to !== null;

  const sessions = useMemo(() => {
    const toTime = (d: string) => {
      const t = new Date(d).getTime();
      return isNaN(t) ? 0 : t;
    };
    return rows
      .map((r: any, idx: number) => ({
        id: idx + 1,
        shgName: String(r["SHG Name"] ?? ""),
        videoName: String(r["Video Name"] ?? ""),
        videoUrl: String(r["Video URL"] ?? "NA"),
        dateCreated: normalizeGvizDate(r["Date Created"]),
        finalScore: Number(r["Final Score (100)"] ?? 0),
        engagement: Number(r["Engagement (20)"] ?? 0),
        classIssues: Number(r["Class Issues (20)"] ?? 0),
        instructorIssues: Number(r["Instructor Issues (20)"] ?? 0),
        contentStructure: Number(r["Content Structure (20)"] ?? 0),
        platformUsage: Number(r["Platform Tool Usage (20)"] ?? 0),
        issuesToImprove: String(r["Issues to Improve"] ?? ""),
        subjectFromAi: cleanSheetText(readSheetValue(r, "Subject from AI")),
        topicName: cleanSheetText(readSheetValue(r, "Topic Name")),
        teacher: readSheetValue(r, "Teacher"),
        mergeStatus: readSheetValue(r, "Merge Y/N").trim().toUpperCase(),
      }))
      .filter((s) => {
        const matchesSearch =
          s.shgName.toLowerCase().includes(query.toLowerCase()) ||
          s.videoName.toLowerCase().includes(query.toLowerCase());
        const date = s.dateCreated ? new Date(s.dateCreated) : null;
        const matchesRange = !hasExplicitBounds || (date && isDateWithinBounds(date, bounds));
        return matchesSearch && matchesRange;
      })
      .sort((a, b) => toTime(b.dateCreated) - toTime(a.dateCreated));
  }, [rows, query, hasExplicitBounds, bounds]);

  const totalClasses = sessions.length;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[hsla(var(--background)/1)]">
        <header className="border-b bg-white/95 dark:bg-slate-900/90 shadow-sm">
          <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white">
                <PlayCircle className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Classes Overview</h1>
                <p className="text-sm text-slate-500">Latest Careermaps sessions and performance metrics</p>
              </div>
            </div>
            <Link href="/" className="text-sm font-medium text-[hsl(var(--primary))] hover:underline">
              ← Back to dashboard
            </Link>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
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
                  onValueChange={(value) =>
                    setRange((prev) => ({ ...prev, preset: value as typeof range.preset, customFrom: '', customTo: '' }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    {RANGE_PRESET_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
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
                  Showing {totalClasses} classes
                </p>
                <div className="relative">
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
          </div>

          {sessions.length > 0 ? (
            <div className="space-y-4">
              {sessions.map((record) => {
                const mergeStatus = record.mergeStatus;
                const isMerged = mergeStatus === "Y";
                const isNotMerged = mergeStatus === "N";
                const mergeLabel = mergeStatus
                  ? isMerged
                    ? "Merged"
                    : isNotMerged
                    ? "Not merged"
                    : mergeStatus
                  : "—";
                const mergeBadgeClasses = isMerged
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : isNotMerged
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

                return (
                  <Card key={record.id} className="surface-card">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1 space-y-4">
                          <div className="flex flex-wrap items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsla(var(--primary)/0.12)] text-[hsl(var(--primary))]">
                              <PlayCircle className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-[200px]">
                              <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{record.shgName}</h3>
                              <p className="text-sm text-slate-500 flex items-center gap-2">
                                <span className="hidden sm:inline text-[hsl(var(--primary))]">•</span>
                                <span className="truncate">{record.videoName}</span>
                              </p>
                            </div>
                          </div>

                          <dl className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                <BookOpen className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                                Subject from AI
                              </dt>
                              <dd className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2">
                                {record.subjectFromAi || "—"}
                              </dd>
                            </div>
                            <div className="space-y-1">
                              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                <Tag className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                                Topic Name
                              </dt>
                              <dd className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2">
                                {record.topicName || "—"}
                              </dd>
                            </div>
                            {/**
                             * Teacher block hidden temporarily as per request
                             *
                             * <div className="space-y-1">
                             *   <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                             *     <User className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                             *     Teacher
                             *   </dt>
                             *   <dd className="text-sm text-slate-700 dark:text-slate-200">
                             *     {record.teacher || "—"}
                             *   </dd>
                             * </div>
                             */}
                            <div className="space-y-1">
                              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                <GitMerge className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                                Merge
                              </dt>
                              <dd>
                                {mergeStatus ? (
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${mergeBadgeClasses}`}>
                                    {mergeLabel}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-500">—</span>
                                )}
                              </dd>
                            </div>
                          </dl>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                              <Calendar className="h-3 w-3 text-[hsl(var(--primary))]" />
                              {record.dateCreated}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                              Engagement {record.engagement}/20
                            </span>
                            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                              Instructor {record.instructorIssues}/20
                            </span>
                          </div>
                          {record.issuesToImprove && (
                            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-700 dark:text-amber-300">
                              <span className="font-medium text-amber-800 dark:text-amber-200">Areas to improve:</span> {record.issuesToImprove}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-3 min-w-[120px]">
                          <div className="text-3xl font-bold text-[hsl(var(--primary))]">{record.finalScore}</div>
                          <Badge variant="outline" className="bg-[hsla(var(--primary)/0.12)] text-[hsl(var(--primary))] border-transparent">
                            Score / 100
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="surface-muted">
              <CardContent className="py-12 text-center space-y-3">
                <div className="text-4xl">🎬</div>
                <p className="text-slate-600">No classes found</p>
                <p className="text-sm text-slate-500">Try a different search term or refresh the data.</p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
