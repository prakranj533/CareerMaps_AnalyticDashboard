import { useEffect, useMemo, useRef, useState } from 'react';

import { fetchSheetTabAsObjects, GvizRowObject } from '@/lib/sheets';

interface UseSheetDataParams {
  sheetId?: string;
  gid?: string | number;
  refreshMs?: number;
  enabled?: boolean;
}

export function useSheetData({
  sheetId,
  gid,
  refreshMs = 30000,
  enabled = true,
}: UseSheetDataParams) {
  const [rows, setRows] = useState<GvizRowObject[]>([]);
  const [loading, setLoading] = useState(Boolean(enabled && sheetId));
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);

  const effectiveSheetId = sheetId?.trim();
  const isActive = Boolean(enabled && effectiveSheetId);

  const load = async (signal?: AbortSignal) => {
    if (!isActive || !effectiveSheetId) return;
    try {
      setError(null);
      const data = await fetchSheetTabAsObjects({ sheetId: effectiveSheetId, gid, signal });
      const cleaned = data.filter((o) => Object.values(o).some((v) => v !== null && v !== ''));
      setRows(cleaned);
      setLastUpdatedAt(new Date());
    } catch (e: any) {
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
    if (!isActive || !effectiveSheetId) {
      setLoading(false);
      setRows([]);
      setLastUpdatedAt(null);
      setError(null);
      return;
    }

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
  }, [effectiveSheetId, gid, refreshMs, isActive]);

  const reload = () => {
    if (!isActive) return Promise.resolve();
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    return load(controller.signal);
  };

  return useMemo(
    () => ({ rows, loading, error, lastUpdatedAt, reload, enabled: isActive }),
    [rows, loading, error, lastUpdatedAt, isActive]
  );
}
