'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import clsx from 'clsx';

export type ShgStudent = {
  id: string;
  name: string;
  track: string;
  attendance: string;
  guardian: string;
  phone: string;
};

export type PanelStats = {
  students: number;
  sessions: number;
  avgScore: string | null;
  subjects: number;
};

interface StudentPanelProps {
  shgName: string | null;
  stats: PanelStats;
  students: ShgStudent[];
  hasRealData: boolean;
  className?: string;
}

export function StudentPanel({ shgName, stats, students, hasRealData, className }: StudentPanelProps) {
  if (!shgName) {
    return (
      <Card className={clsx('surface-muted h-full flex items-center justify-center text-center', className)}>
        <CardContent>
          <p className="text-base font-semibold text-slate-700">Select an SHG to preview the roster</p>
          <p className="text-sm text-slate-500 mt-2">
            Student level data will appear here with attendance, guardianship and contact details.
          </p>
        </CardContent>
      </Card>
    );
  }

  const detailRows = students.length ? (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[35%]">Student</TableHead>
          <TableHead>Focus Track</TableHead>
          <TableHead>Attendance</TableHead>
          <TableHead className="text-right">Guardian</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((student) => (
          <TableRow key={student.id}>
            <TableCell>
              <div className="font-medium text-slate-900">{student.name}</div>
            </TableCell>
            <TableCell className="text-sm text-slate-600">{student.track}</TableCell>
            <TableCell className="text-sm text-slate-600">{student.attendance}</TableCell>
            <TableCell className="text-right text-sm">
              <div className="font-medium text-slate-900">{student.guardian}</div>
              <p className="text-xs text-slate-500">{student.phone}</p>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ) : (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-slate-500 py-12">
      <div className="text-4xl">🗂️</div>
      <p className="font-medium text-slate-600">Roster coming soon</p>
      <p className="text-sm">
        Connect the student sheet for <span className="font-semibold">{shgName}</span> and the list will populate automatically.
      </p>
    </div>
  );

  return (
    <Card className={clsx('surface-card h-full flex flex-col', className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Self Help Group</p>
            <CardTitle className="text-2xl leading-snug">{shgName}</CardTitle>
          </div>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            {hasRealData ? 'Live sync' : 'Design preview'}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">
          Rich roster with attendance, focus areas and guardian touch points. Hook this panel to the student sheet once
          it is shared.
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PanelStat label="Students" value={stats.students || '—'} />
          <PanelStat label="Sessions Audited" value={stats.sessions || '—'} />
          <PanelStat label="Avg. Score" value={stats.avgScore ? `${stats.avgScore}/100` : '—'} />
          <PanelStat label="Subjects" value={stats.subjects || '—'} />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Student roster</p>
          <p className="text-xs text-slate-500">Auto-refreshes with Google Sheet</p>
        </div>

        <div className="flex-1 rounded-xl border border-slate-200 bg-white/70 dark:bg-slate-900/40">
          <ScrollArea className="h-full">
            <div className="p-4 min-h-[320px]">{detailRows}</div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

interface PanelStatProps {
  label: string;
  value: string | number;
}

function PanelStat({ label, value }: PanelStatProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.08)] dark:bg-slate-900/40">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
