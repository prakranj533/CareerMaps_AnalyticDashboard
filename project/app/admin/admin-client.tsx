'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ChevronLeft, UserCheck, UserX, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShgRanking } from '@/components/shg-ranking';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useSheetData } from '@/hooks/useSheetData';
import { isAdminEmail } from '@/lib/admin';
import {
  subscribeLoginEvents,
  subscribeUserAccessList,
  setUserApproval,
  type LoginEventDoc,
  type UserAccessDoc,
} from '@/lib/access';
import { DEFAULT_REFRESH_MS, PUNCH_IN_SHEET_ID, PUNCH_IN_SHEET_NAME, SHEET_GID, SHEET_ID } from '@/lib/config';

const fmtTime = (ts?: { toDate: () => Date }) =>
  ts ? ts.toDate().toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function AdminClient() {
  const { isAdmin, loading, user } = useIsAdmin();

  const [accessUsers, setAccessUsers] = useState<UserAccessDoc[]>([]);
  const [loginEvents, setLoginEvents] = useState<LoginEventDoc[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isAdmin) return;
    const unsubUsers = subscribeUserAccessList(setAccessUsers, (err) => setAccessError(err.message));
    const unsubEvents = subscribeLoginEvents(50, setLoginEvents, () => undefined);
    return () => {
      unsubUsers();
      unsubEvents();
    };
  }, [isAdmin]);

  const handleApproval = async (email: string, approved: boolean) => {
    if (!user?.email) return;
    setPendingAction(`${email}:${approved}`);
    try {
      await setUserApproval(email, approved, user.email);
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : 'Failed to update access');
    } finally {
      setPendingAction(null);
    }
  };

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

  const pendingCount = accessUsers.filter((u) => !u.approved && !isAdminEmail(u.email)).length;

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
              {pendingCount > 0 && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-semibold">
                  {pendingCount} pending approval{pendingCount === 1 ? '' : 's'}
                </Badge>
              )}
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

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {accessError && (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
            {accessError}
          </div>
        )}

        {/* Login access management */}
        <Card className="glass-morphism edu-glow">
          <CardHeader className="pb-3 space-y-2">
            <div className="flex items-center gap-3">
              <span className="overview-icon">
                <KeyRound className="h-5 w-5" />
              </span>
              <CardTitle className="overview-gradient-title">Login Access</CardTitle>
            </div>
            <p className="overview-subtext">
              Every Google sign-in is logged here. New users see a pending screen until you approve them. Updates are live.
            </p>
          </CardHeader>
          <CardContent>
            {accessUsers.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No logins recorded yet.</p>
            ) : (
              <div className="max-h-[380px] overflow-auto rounded-xl border border-slate-200/70">
                <Table>
                  <TableHeader className="sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Logins</TableHead>
                      <TableHead>First seen</TableHead>
                      <TableHead>Last seen</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessUsers.map((u) => {
                      const adminUser = isAdminEmail(u.email);
                      const busy = pendingAction?.startsWith(`${u.email}:`);
                      return (
                        <TableRow key={u.email}>
                          <TableCell className="font-medium text-slate-800">{u.email}</TableCell>
                          <TableCell className="text-slate-600">{u.displayName || '—'}</TableCell>
                          <TableCell className="text-right">{u.loginCount ?? 0}</TableCell>
                          <TableCell className="whitespace-nowrap text-slate-600">{fmtTime(u.firstSeenAt)}</TableCell>
                          <TableCell className="whitespace-nowrap text-slate-600">{fmtTime(u.lastSeenAt)}</TableCell>
                          <TableCell>
                            {adminUser ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Admin</Badge>
                            ) : u.approved ? (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200">Approved</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {adminUser ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : u.approved ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                                disabled={busy}
                                onClick={() => handleApproval(u.email, false)}
                              >
                                <UserX className="h-3.5 w-3.5" /> Revoke
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="gap-1 bg-[#0B6B41] hover:bg-[#095836]"
                                disabled={busy}
                                onClick={() => handleApproval(u.email, true)}
                              >
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                                Approve
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent logins */}
        <Card className="glass-morphism edu-glow">
          <CardHeader className="pb-3 space-y-2">
            <div className="flex items-center gap-3">
              <span className="overview-icon">
                <UserCheck className="h-5 w-5" />
              </span>
              <CardTitle className="overview-gradient-title">Recent Logins</CardTitle>
            </div>
            <p className="overview-subtext">Last 50 sign-in events, newest first.</p>
          </CardHeader>
          <CardContent>
            {loginEvents.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No login events yet.</p>
            ) : (
              <div className="max-h-[300px] overflow-auto rounded-xl border border-slate-200/70">
                <Table>
                  <TableHeader className="sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Device</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginEvents.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium text-slate-800">{e.email}</TableCell>
                        <TableCell className="whitespace-nowrap text-slate-600">{fmtTime(e.at)}</TableCell>
                        <TableCell className="max-w-[360px] truncate text-xs text-slate-500" title={e.userAgent}>
                          {e.userAgent || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

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
