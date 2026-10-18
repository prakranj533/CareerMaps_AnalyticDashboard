"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, GraduationCap, Users } from 'lucide-react';
import { decodeShgSlug } from '@/lib/shg-slug';
import { SHEET_ID, STUDENT_LIST_GID } from '@/lib/config';
import { groupStudentsByCode, parseStudentRows, shgCodeFromName, type StudentRosterEntry } from '@/lib/students';

const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isUrl = (value: string) => /^https?:\/\//i.test(value);

export default function ShgStudentsClient({ params }: { params: { slug: string } }) {
  const shgName = decodeShgSlug(params.slug);
  const groupCode = shgCodeFromName(shgName);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentRosterEntry | null>(null);

  const { rows, loading, error, lastUpdatedAt } = useSheetData({
    sheetId: SHEET_ID,
    gid: STUDENT_LIST_GID,
    preferFormatted: true,
    refreshMs: 60000,
  });

  const students = useMemo(() => {
    const parsed = parseStudentRows(rows);
    if (groupCode) {
      const byCode = groupStudentsByCode(parsed);
      const group = byCode.get(groupCode);
      if (group?.length) return group;
    }
    // Fallback for SHGs without a code: match on the center name token
    return parsed.filter((s) => {
      const token = normalizeName(s.shgName);
      return token && normalizeName(shgName).includes(token);
    });
  }, [rows, groupCode, shgName]);

  const rosterMetadata = useMemo(() => {
    const first = students[0];
    if (!first) return [];
    return [
      { label: 'District', value: first.district },
      { label: 'Region Name', value: first.region },
      { label: 'Branch Name', value: first.branch },
      { label: 'SHGTC ID', value: first.shgCode },
      { label: 'SHGTC Name', value: first.shgName },
      { label: 'SHGTC Timing', value: first.timing },
    ].filter((item) => item.value);
  }, [students]);

  const stats = useMemo(() => {
    const total = students.length;
    const registered = students.filter((s) => s.registrationId).length;
    const classes = students.reduce<Record<string, number>>((acc, student) => {
      const key = student.grade || 'Unassigned';
      return { ...acc, [key]: (acc[key] || 0) + 1 };
    }, {});
    const highlightedClass = Object.entries(classes).sort((a, b) => b[1] - a[1])[0];
    return { total, registered, uniqueClasses: Object.keys(classes).length, highlightedClass };
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => {
      const haystack = [student.slNo, student.registrationId, student.name, student.mother, student.father, student.grade]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [students, searchTerm]);

  const isLoading = loading && students.length === 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white/90 border-b">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Link href="/shg" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[hsl(var(--primary))]">
              <ChevronLeft className="h-4 w-4" /> Back to SHGs
            </Link>
            <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
              Live sheet sync
            </Badge>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Student roster</p>
            <h1 className="text-3xl font-semibold text-slate-900 mt-1">{shgName}</h1>
            <p className="text-sm text-slate-500 mt-2 max-w-3xl">
              Learner directory synced from the Student list sheet — names, classes, registration numbers, attendance and marks update automatically.
            </p>
            {!!rosterMetadata.length && (
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rosterMetadata.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">{item.label}</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-1">{item.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={<Users className="h-5 w-5" />} label="Total students" value={stats.total} subtle="Across this SHG" />
          <StatTile icon={<Users className="h-5 w-5" />} label="Registration numbers" value={`${stats.registered}/${stats.total}`} subtle="IDs on file" />
          <StatTile icon={<GraduationCap className="h-5 w-5" />} label="Classes represented" value={stats.uniqueClasses} subtle={stats.highlightedClass ? `${stats.highlightedClass[0]} most common` : '—'} />
          <StatTile icon={<Users className="h-5 w-5" />} label="Roster status" value={isLoading ? 'Refreshing…' : 'Synced'} subtle={lastUpdatedAt ? `Updated ${new Date(lastUpdatedAt).toLocaleTimeString()}` : 'Auto-refreshing every min'} />
        </div>

        {error && (
          <Card className="shadow-sm border border-rose-200 bg-rose-50">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-rose-700">Could not load student sheet</p>
              <p className="text-xs text-rose-700/90 mt-1 break-words">{error}</p>
              <p className="text-xs text-rose-700/90 mt-2">
                Make sure the Google Sheet is shared as: Anyone with the link → Viewer.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">Student directory</CardTitle>
              <p className="text-sm text-slate-500">Includes Sl.No, class, registration number, guardians, attendance and marksheet.</p>
            </div>
          </CardHeader>

          <Separator />
          <CardContent className="border-b">
            <div className="relative">
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search students, registration ID, class..." className="pl-3" />
            </div>
            {searchTerm && (
              <p className="text-xs text-slate-500 mt-2">Showing {filteredStudents.length} of {students.length} learners</p>
            )}
          </CardContent>
          <ScrollArea className="h-[60vh] pr-3">
            <Table>
              <TableHeader className="sticky top-0 bg-white/90 backdrop-blur border-b">
                <TableRow>
                  <TableHead className="w-20">Sl. No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Registration</TableHead>
                  <TableHead>Mother</TableHead>
                  <TableHead>Father</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead className="text-right">Marksheet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24">
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-slate-200 rounded" />
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filteredStudents.map((student) => (
                  <TableRow key={student.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-slate-600">{student.slNo}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        aria-label={`View ${student.name}'s details`}
                        className="text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
                      >
                        <span className="block font-semibold text-[hsl(var(--primary))] hover:underline">{student.name}</span>
                        <span className="text-xs text-slate-500">View student progress</span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700">{student.grade || 'NA'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{student.registrationId || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-sm text-slate-700">{student.mother}</TableCell>
                    <TableCell className="text-sm text-slate-700">{student.father}</TableCell>
                    <TableCell className="text-sm text-slate-700">{student.attendance || <span className="text-slate-400">—</span>}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {student.marksheet ? (
                        isUrl(student.marksheet) ? (
                          <a href={student.marksheet} target="_blank" rel="noreferrer" className="text-[hsl(var(--primary))] hover:underline">
                            View
                          </a>
                        ) : (
                          <span className="text-slate-900">{student.marksheet}</span>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && filteredStudents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                      {students.length === 0 ? 'No students recorded yet for this SHG.' : 'No students match your search.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>

        <Dialog open={Boolean(selectedStudent)} onOpenChange={(open) => !open && setSelectedStudent(null)}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Student progress · {shgName}</p>
              <DialogTitle className="text-2xl">{selectedStudent?.name ?? 'Student progress'}</DialogTitle>
              <DialogDescription>
                Review the student profile, attendance, and marksheets.
              </DialogDescription>
            </DialogHeader>

            {selectedStudent && (
              <Tabs defaultValue="overview" className="mt-2">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                  <TabsTrigger value="marksheets">Marksheet</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <StudentDetail label="Class" value={selectedStudent.grade} icon={<GraduationCap className="h-4 w-4" />} />
                    <StudentDetail label={selectedStudent.registrationId ? 'Registration ID' : 'Sl. No'} value={selectedStudent.registrationId || String(selectedStudent.slNo)} icon={<Users className="h-4 w-4" />} />
                    {selectedStudent.mother !== '—' && <StudentDetail label="Mother" value={selectedStudent.mother} />}
                    {selectedStudent.father !== '—' && <StudentDetail label="Father" value={selectedStudent.father} />}
                    {selectedStudent.gender && <StudentDetail label="Gender" value={selectedStudent.gender} />}
                    {selectedStudent.attendance && <StudentDetail label="Attendance" value={selectedStudent.attendance} />}
                  </div>
                </TabsContent>
                <TabsContent value="attendance" className="mt-4">
                  {selectedStudent.attendance ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Attendance</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{selectedStudent.attendance}</p>
                      <p className="mt-2 text-xs text-slate-500">Synced from the Student list sheet — updates appear automatically.</p>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                      No attendance recorded yet. It will appear here once added to the Student list sheet.
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="marksheets" className="mt-4">
                  {selectedStudent.marksheet ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Marksheet</p>
                      {isUrl(selectedStudent.marksheet) ? (
                        <a href={selectedStudent.marksheet} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-[hsl(var(--primary))] hover:underline">
                          View marksheet
                        </a>
                      ) : (
                        <p className="mt-1 text-lg font-semibold text-slate-900">{selectedStudent.marksheet}</p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">Synced from the Student list sheet — updates appear automatically.</p>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                      No marksheet recorded yet. It will appear here once added to the Student list sheet.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function StudentDetail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value || '—'}</p>
    </div>
  );
}

function StatTile({ icon, label, value, subtle }: { icon: React.ReactNode; label: string; value: string | number; subtle?: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-4 py-5">
        <div className="h-12 w-12 rounded-2xl bg-[hsla(var(--primary)/0.12)] text-[hsl(var(--primary))] flex items-center justify-center">{icon}</div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="text-2xl font-semibold text-slate-900">{value}</p>
          {subtle && <p className="text-xs text-slate-500 mt-1">{subtle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
