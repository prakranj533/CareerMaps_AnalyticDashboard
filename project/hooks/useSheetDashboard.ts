import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchSheetTabAsObjects, GvizRowObject } from '@/lib/sheets';

export interface UseSheetDashboardParams {
  sheetId: string;
  gid?: string | number;
  refreshMs?: number;
  columns: {
    shg: string;
    subject: string; // if no subject column, use 'Video Name'
    score: string;   // e.g. 'Final Score (100)'
    dateCreated?: string; // optional for sessions list
    videoName?: string;   // optional for sessions list
    videoUrl?: string;    // optional for sessions list
    output?: string;      // optional for sessions list
    engagement?: string;  // optional
    classIssues?: string; // optional
    instructorIssues?: string; // optional
    contentStructure?: string; // optional
    platformUsage?: string; // optional
    issuesToImprove?: string; // optional
  };
}

export function useSheetDashboard({
  sheetId,
  gid,
  refreshMs = 30000,
  columns,
}: UseSheetDashboardParams) {
  const [rows, setRows] = useState<GvizRowObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);

  const load = async (signal?: AbortSignal) => {
    try {
      setError(null);
      const data = await fetchSheetTabAsObjects({ sheetId, gid, signal });
      // Filter out entirely empty rows
      const cleaned = data.filter((o) => Object.values(o).some((v) => v !== null && v !== ''));
      setRows(cleaned);
      setLastUpdatedAt(new Date());
    } catch (e: any) {
      // If the request was aborted due to navigation/unmount, don't surface an error
      if (e?.name === 'AbortError' || e?.message === 'The user aborted a request.') {
        return;
      }
      console.error(e);
      setError(e?.message || 'Failed to load sheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    load(controller.signal);
    const id = window.setInterval(() => load(), refreshMs);
    timer.current = id;
    return () => {
      controller.abort();
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [sheetId, gid, refreshMs]);

  // Metrics
  const metrics = useMemo(() => {
    const classesDone = rows.length;
    const shgInitiated = new Set(
      rows.map((r) => (r[columns.shg] ?? '').toString().trim()).filter(Boolean)
    ).size;
    const subjectsInitiated = new Set(
      rows.map((r) => (r[columns.subject] ?? '').toString().trim()).filter(Boolean)
    ).size;
    const scores = rows
      .map((r) => Number(r[columns.score]))
      .filter((n) => !Number.isNaN(n));
    const finalScore = scores.length
      ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
      : 0;

    return { classesDone, shgInitiated, subjectsInitiated, finalScore };
  }, [rows, columns]);

  const reload = () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    return load(controller.signal);
  };

  return { loading, error, rows, metrics, reload, lastUpdatedAt };
}
