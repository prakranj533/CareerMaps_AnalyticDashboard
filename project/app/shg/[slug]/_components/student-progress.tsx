'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { firebase, getFirebaseStudentRecords } from '@/lib/firebase/client';

type StudentProgressProps = {
  student: {
    id: string;
    name: string;
  };
  section: 'attendance' | 'marksheets';
};

type AttendanceRecord = {
  date: string;
  status: 'present' | 'absent' | 'late';
  markedByEmail?: string;
};

type MarksheetRecord = {
  id: string;
  date: string;
  subject: string;
  score: number;
  maxScore: number;
  answers?: string;
  attachmentUrl?: string;
  attachmentName?: string;
};

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function StudentProgress({ student, section }: StudentProgressProps) {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [marksheets, setMarksheets] = useState<MarksheetRecord[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(localDate);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceRecord['status']>('present');
  const [assessmentDate, setAssessmentDate] = useState(localDate);
  const [subject, setSubject] = useState('');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [answers, setAnswers] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingMarksheet, setSavingMarksheet] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    let stopAttendance: (() => void) | undefined;
    let stopMarksheets: (() => void) | undefined;

    void getFirebaseStudentRecords().then((app) => {
      if (!active) return;
      const records = app.firestore().collection('studentRecords').doc(student.id);
      stopAttendance = records.collection('attendance').orderBy('date', 'desc').onSnapshot((snapshot) => {
        setAttendance(snapshot.docs.map((doc) => doc.data() as AttendanceRecord));
        setLoading(false);
      }, (reason) => {
        if (active) {
          setError(reason.message || 'Could not load attendance records.');
          setLoading(false);
        }
      });
      stopMarksheets = records.collection('marksheets').orderBy('date', 'desc').onSnapshot((snapshot) => {
        setMarksheets(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as MarksheetRecord)));
        setLoading(false);
      }, (reason) => {
        if (active) {
          setError(reason.message || 'Could not load answer and marksheet records.');
          setLoading(false);
        }
      });
    }).catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error ? reason.message : 'Firebase could not be initialized.');
        setLoading(false);
      }
    });

    return () => {
      active = false;
      stopAttendance?.();
      stopMarksheets?.();
    };
  }, [student.id]);

  const saveAttendance = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingAttendance(true);
    setError('');
    setMessage('');
    try {
      const app = await getFirebaseStudentRecords();
      const user = app.auth().currentUser;
      await app.firestore().collection('studentRecords').doc(student.id)
        .collection('attendance').doc(attendanceDate).set({
          date: attendanceDate,
          status: attendanceStatus,
          markedBy: user?.uid ?? '',
          markedByEmail: user?.email ?? '',
          markedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      setMessage(`Attendance saved for ${attendanceDate}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save attendance.');
    } finally {
      setSavingAttendance(false);
    }
  };

  const saveMarksheet = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingMarksheet(true);
    setError('');
    setMessage('');
    let uploadedFile: firebase.storage.Reference | undefined;
    try {
      const app = await getFirebaseStudentRecords();
      const file = fileInput.current?.files?.[0];
      let attachmentUrl = '';
      if (file) {
        if (file.size > 20 * 1024 * 1024) throw new Error('Choose a file smaller than 20 MB.');
        if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          throw new Error('Attach a PDF, JPEG, PNG, or WebP file.');
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        uploadedFile = app.storage().ref(`studentRecords/${student.id}/answers/${Date.now()}-${safeName}`);
        await uploadedFile.put(file, { contentType: file.type });
        attachmentUrl = await uploadedFile.getDownloadURL();
      }

      await app.firestore().collection('studentRecords').doc(student.id)
        .collection('marksheets').add({
          date: assessmentDate,
          subject: subject.trim(),
          score: Number(score),
          maxScore: Number(maxScore),
          answers: answers.trim(),
          attachmentUrl,
          attachmentName: fileInput.current?.files?.[0]?.name ?? '',
          markedBy: app.auth().currentUser?.uid ?? '',
          markedByEmail: app.auth().currentUser?.email ?? '',
          markedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      setSubject('');
      setScore('');
      setAnswers('');
      if (fileInput.current) fileInput.current.value = '';
      setMessage('Answer and marksheet record saved.');
    } catch (reason) {
      if (uploadedFile) await uploadedFile.delete().catch(() => undefined);
      setError(reason instanceof Error ? reason.message : 'Could not save the marksheet.');
    } finally {
      setSavingMarksheet(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {loading && <p className="text-sm text-slate-500">Loading student records…</p>}

      {section === 'attendance' ? (
        <section className="space-y-3">
          <div>
            <h3 className="font-semibold text-slate-900">Mark attendance</h3>
            <p className="text-sm text-slate-500">One attendance status is saved per student per date.</p>
          </div>
          <form onSubmit={saveAttendance} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} required />
            <select
              value={attendanceStatus}
              onChange={(event) => setAttendanceStatus(event.target.value as AttendanceRecord['status'])}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Attendance status"
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
            </select>
            <Button type="submit" disabled={savingAttendance}>{savingAttendance ? 'Saving…' : 'Save attendance'}</Button>
          </form>
          {attendance.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {attendance.map((record) => (
                <li key={record.date} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                  <span>{record.date}</span>
                  <span className="capitalize font-medium">{record.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div>
            <h3 className="font-semibold text-slate-900">Answers and marksheets</h3>
            <p className="text-sm text-slate-500">Add marks, answer notes, and an optional scanned answer sheet.</p>
          </div>
          <form onSubmit={saveMarksheet} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="date" value={assessmentDate} onChange={(event) => setAssessmentDate(event.target.value)} required aria-label="Assessment date" />
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject or assessment" required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="number" min="0" step="any" value={score} onChange={(event) => setScore(event.target.value)} placeholder="Marks earned" required />
              <Input type="number" min="0.01" step="any" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} placeholder="Maximum marks" required />
            </div>
            <Textarea value={answers} onChange={(event) => setAnswers(event.target.value)} placeholder="Answers, feedback, or marking notes" rows={4} />
            <Input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label="Attach scanned answers or marksheet" />
            <Button type="submit" disabled={savingMarksheet}>{savingMarksheet ? 'Saving…' : 'Save answer / marksheet'}</Button>
          </form>
          {marksheets.length > 0 && (
            <ul className="space-y-2">
              {marksheets.map((record) => (
                <li key={record.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{record.subject}</span>
                    <span>{record.score} / {record.maxScore}</span>
                  </div>
                  <p className="mt-1 text-slate-500">{record.date}</p>
                  {record.answers && <p className="mt-2 whitespace-pre-wrap text-slate-700">{record.answers}</p>}
                  {record.attachmentUrl && (
                    <a href={record.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-[hsl(var(--primary))] hover:underline">
                      View {record.attachmentName || 'answer sheet'}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
