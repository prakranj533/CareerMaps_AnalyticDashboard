'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Loader2, ShieldCheck, ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ShgRanking } from '@/components/shg-ranking';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useSheetData } from '@/hooks/useSheetData';
import { DEFAULT_REFRESH_MS, PUNCH_IN_SHEET_ID, PUNCH_IN_SHEET_NAME, SHEET_GID, SHEET_ID } from '@/lib/config';

export default function AdminClient() {
  const { isAdmin, loading, user } = useIsAdmin();

  // Only fetch data once admin access is confirmed
  const { rows: auditRows } = useSheetData({
    sheetId: SHEET_ID,
    gid: SHEET_GID,
    refreshMs: DEFAULT_REFRESH_MS,
    enabled: isAdmin,
  });
  const { rows: punchRows, loading: punchLoading, error: punchError } = useSheetData({
    sheetId: PUNCH_IN_SHEET_ID,
    sheet: PUNCH_IN_SHEET_NAME,
    refreshMs: DEFAULT_REFRESH_MS,
    enabled: isAdmin,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="animate-spin h-6 w-6" />
        <p>Checking admin access…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldCheck className="h-10 w-10 mx-auto text-slate-400" />
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-slate-900">Admin access required</h1>
              <p className="text-sm text-slate-500">
                {user?.email
                  ? `${user.email} is not on the admin list.`
                  : 'Sign in with an admin account to view this panel.'}
              </p>
            </div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--primary))] hover:underline">
              <ChevronLeft className="h-4 w-4" /> Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsla(var(--background)/1)]">
      <header className="border-b bg-white/95 dark:bg-slate-900/90 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
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
                <h1 className="text-2xl font-bold headline-gradient">Admin Panel</h1>
                <p className="flex items-center gap-2 text-sm header-subtitle">
                  <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                  Signed in as {user?.email ?? 'admin'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 font-semibold">
                Admin only
              </Badge>
              <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--primary))] hover:underline">
                <ChevronLeft className="h-4 w-4" /> Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <ShgRanking
          auditRows={auditRows}
          punchRows={punchRows}
          punchLoading={punchLoading}
          punchError={punchError}
        />
      </main>
    </div>
  );
}
