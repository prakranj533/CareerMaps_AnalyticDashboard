// Punch-in (attendance) sheet parsing, SHG matching, aggregation and ranking.
//
// The punch-in sheet is a Google Form responses tab. Its "Primary Class Name"
// column appears in two formats:
//   - "02:19:01 / CEC-Purzagir/ Purzagir/ MIRZAPUR/ UP" (code / center / village / district / state)
//   - "Purzagir Mirzapur" (village + district, no code)
// The audit dashboard sheet uses "SHG TC MIRZAPUR PURZAGIR(02:19:01)" — the
// parenthesised code is the primary join key, with token matching as fallback.

import { GvizRowObject } from '@/lib/sheets';

export interface PunchInRecord {
  timestamp: Date | null;
  timestampLabel: string;
  classNameRaw: string;
  centerCode: string | null;
  centerLabel: string;
  subject: string;
  merged: boolean;
  mergedWith: string;
  studentsPrimary: number;
  studentsSecondary: number;
  totalStudents: number;
  topic: string;
  subTopic: string;
  month: number | null;
  week: string;
}

export interface AuditShgEntry {
  name: string;
  code: string | null;
  tokens: string[];
  scoreSum: number;
  scoreCount: number;
}

export interface ShgRanking {
  key: string;
  displayName: string;
  matchedAuditName: string | null;
  classes: number;
  mergedClasses: number;
  totalStudents: number;
  avgStudentsPerClass: number;
  subjectsTaught: number;
  lastClassAt: Date | null;
  qualityAvg: number | null;
  qualityClasses: number;
  rankScore: number;
}

const CODE_RE = /(\d{2}:\d{2}:\d{2})/;

// Non-SHG entries to exclude from the dashboard entirely
const EXCLUDED_CENTERS = new Set(['sgps']);

const asNumber = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const cleanToken = (t: string) => t.toLowerCase().replace(/[^a-z]/g, '');

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const tokensMatch = (a: string, b: string) => {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  const dist = levenshtein(a, b);
  if (Math.min(a.length, b.length) >= 7) return dist <= 2;
  return a.length >= 5 && dist <= 1;
};

// Parse "Primary Class Name" into a code (when present) and a friendly label.
export function parseCenterName(raw: string): { code: string | null; label: string; tokens: string[] } {
  const value = String(raw ?? '').trim();
  const codeMatch = value.match(CODE_RE);
  if (codeMatch) {
    const segments = value.split('/').map((s) => s.trim()).filter(Boolean);
    // segments: [code, center, village, district, state]
    const village = segments[2] ?? '';
    const district = segments[3] ?? '';
    const label = [village, district].filter(Boolean).join(' ') || value;
    return { code: codeMatch[1], label, tokens: tokenizeLabel(label) };
  }
  return { code: null, label: value, tokens: tokenizeLabel(value) };
}

const STOP_TOKENS = new Set(['shg', 'tc', 'cec', 'sr', 'jr', 'up', 'mp', 'cg', 'bihar', 'jharkhand', 'center', 'centre', 'sr.']);

function tokenizeLabel(label: string): string[] {
  return label
    .split(/[\s\-()&.,/]+/)
    .map(cleanToken)
    .filter((t) => t && !STOP_TOKENS.has(t));
}

// Build an index of audit-sheet SHG names (from "SHG Name" column) for matching.
export function buildAuditIndex(shgNames: string[]): AuditShgEntry[] {
  const seen = new Map<string, AuditShgEntry>();
  for (const raw of shgNames) {
    const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const code = name.match(CODE_RE)?.[1] ?? null;
    const key = code ?? name.toLowerCase();
    const existing = seen.get(key);
    if (existing) {
      // Prefer the spelling without stray spaces inside the parentheses
      if (name.length < existing.name.length) existing.name = name;
      continue;
    }
    seen.set(key, {
      name,
      code,
      tokens: tokenizeLabel(name.replace(CODE_RE, '')),
      scoreSum: 0,
      scoreCount: 0,
    });
  }
  return Array.from(seen.values());
}

// Match a punch-in center (code preferred, then token overlap) to an audit SHG.
export function matchCenterToAudit(
  center: { code: string | null; tokens: string[] },
  auditIndex: AuditShgEntry[],
): AuditShgEntry | null {
  if (center.code) {
    const byCode = auditIndex.find((e) => e.code === center.code);
    if (byCode) return byCode;
  }
  if (!center.tokens.length) return null;
  let best: AuditShgEntry | null = null;
  let bestScore = 0;
  for (const entry of auditIndex) {
    if (!entry.tokens.length) continue;
    const hits = center.tokens.filter((t) => entry.tokens.some((e) => tokensMatch(t, e))).length;
    const score = hits / Math.max(center.tokens.length, entry.tokens.length);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  if (bestScore >= 0.6) return best;

  // Fallback: a token that maps to exactly one audit entry is distinctive
  // enough to identify the center (e.g. "Naigadhi SIWAN" → SATNA NAIGADHI).
  const candidates = new Set<AuditShgEntry>();
  for (const t of center.tokens) {
    const hits = auditIndex.filter((e) => e.tokens.some((x) => tokensMatch(t, x)));
    if (hits.length === 1) candidates.add(hits[0]);
  }
  return candidates.size === 1 ? Array.from(candidates)[0] : null;
}

const parseTimestamp = (v: any): Date | null => {
  if (v == null) return null;
  if (typeof v === 'string') {
    const m = v.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/);
    if (m) {
      return new Date(
        Number(m[1]),
        Number(m[2]),
        Number(m[3]),
        Number(m[4] ?? 0),
        Number(m[5] ?? 0),
        Number(m[6] ?? 0),
      );
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  return null;
};

export function parsePunchInRows(rows: GvizRowObject[]): PunchInRecord[] {
  return rows
    .map((r) => {
      const classNameRaw = String(r['Primary Class Name'] ?? '').trim();
      const primary = asNumber(r['Number of Students Primary center']);
      const secondary = asNumber(r['Number of Students in secondary center']);
      const totalRaw = r['Total Students'];
      const total = totalRaw === null || totalRaw === undefined || totalRaw === ''
        ? primary + secondary
        : asNumber(totalRaw);
      const ts = parseTimestamp(r['Timestamp']);
      const { code, label } = parseCenterName(classNameRaw);
      const monthRaw = r['Month'];
      return {
        timestamp: ts,
        timestampLabel: ts ? ts.toLocaleString() : String(r['Timestamp'] ?? ''),
        classNameRaw,
        centerCode: code,
        centerLabel: label,
        subject: String(r['Subject'] ?? '').trim(),
        merged: String(r['Merged'] ?? '').trim().toLowerCase().startsWith('y'),
        mergedWith: String(r['Merged with center'] ?? '').trim(),
        studentsPrimary: primary,
        studentsSecondary: secondary,
        totalStudents: total,
        topic: String(r['Topic Taught: Mention standard as well. Example: Algebra-class 8th '] ?? '').trim(),
        subTopic: String(r['Sub topic covered'] ?? '').trim(),
        month: monthRaw === null || monthRaw === undefined || monthRaw === '' ? null : asNumber(monthRaw),
        week: String(r['Week'] ?? '').trim(),
        // "Name of Teacher" and "Reporting teacher" are intentionally not mapped.
      } satisfies PunchInRecord;
    })
    .filter(
      (rec) =>
        (rec.classNameRaw || rec.timestamp) &&
        !EXCLUDED_CENTERS.has(rec.classNameRaw.trim().toLowerCase()),
    );
}

// Aggregate punch-in records per SHG center and join with audit quality scores.
export function buildShgRankings(
  records: PunchInRecord[],
  auditRecords: Array<{ shgName: string; finalScore: number }>,
): { rankings: ShgRanking[]; byKey: Map<string, PunchInRecord[]> } {
  const auditIndex = buildAuditIndex(auditRecords.map((r) => r.shgName));
  for (const rec of auditRecords) {
    const code = String(rec.shgName ?? '').match(CODE_RE)?.[1] ?? null;
    const key = code ?? String(rec.shgName ?? '').toLowerCase();
    const entry = auditIndex.find((e) => (e.code ?? e.name.toLowerCase()) === key);
    if (entry && Number.isFinite(rec.finalScore)) {
      entry.scoreSum += rec.finalScore;
      entry.scoreCount += 1;
    }
  }

  const byKey = new Map<string, PunchInRecord[]>();
  const meta = new Map<string, { label: string; audit: AuditShgEntry | null }>();

  for (const rec of records) {
    const center = { code: rec.centerCode, tokens: tokenizeLabel(rec.centerLabel) };
    const audit = matchCenterToAudit(center, auditIndex);
    const key = audit?.code ?? rec.centerCode ?? rec.centerLabel.toLowerCase() ?? rec.classNameRaw.toLowerCase();
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(rec);
    byKey.set(key, list);
    const m = meta.get(key);
    if (!m) {
      meta.set(key, { label: audit?.name ?? rec.centerLabel, audit });
    } else if (!m.audit && audit) {
      m.audit = audit;
      m.label = audit.name;
    }
  }

  const rankings: ShgRanking[] = [];
  const maxAvgStudents = Math.max(
    1,
    ...Array.from(byKey.values()).map(
      (list) => list.reduce((s, r) => s + r.totalStudents, 0) / Math.max(1, list.length),
    ),
  );

  byKey.forEach((list, key) => {
    const m = meta.get(key)!;
    const classes = list.length;
    const totalStudents = list.reduce((s, r) => s + r.totalStudents, 0);
    const avgStudentsPerClass = classes ? totalStudents / classes : 0;
    const subjects = new Set(list.map((r) => r.subject.toLowerCase()).filter(Boolean));
    const mergedClasses = list.filter((r) => r.merged).length;
    const lastClassAt = list.reduce<Date | null>(
      (acc, r) => (r.timestamp && (!acc || r.timestamp > acc) ? r.timestamp : acc),
      null,
    );
    const qualityAvg = m.audit && m.audit.scoreCount ? m.audit.scoreSum / m.audit.scoreCount : null;
    rankings.push({
      key,
      displayName: m.label,
      matchedAuditName: m.audit?.name ?? null,
      classes,
      mergedClasses,
      totalStudents,
      avgStudentsPerClass: Math.round(avgStudentsPerClass * 10) / 10,
      subjectsTaught: subjects.size,
      lastClassAt,
      qualityAvg: qualityAvg === null ? null : Math.round(qualityAvg * 10) / 10,
      qualityClasses: m.audit?.scoreCount ?? 0,
      rankScore: 0, // filled below
    });
  });

  // Audit SHGs with no punch-in rows still appear, with zero attendance.
  for (const entry of auditIndex) {
    const key = entry.code ?? entry.name.toLowerCase();
    if (byKey.has(key)) continue;
    rankings.push({
      key,
      displayName: entry.name,
      matchedAuditName: entry.name,
      classes: 0,
      mergedClasses: 0,
      totalStudents: 0,
      avgStudentsPerClass: 0,
      subjectsTaught: 0,
      lastClassAt: null,
      qualityAvg: entry.scoreCount ? Math.round((entry.scoreSum / entry.scoreCount) * 10) / 10 : null,
      qualityClasses: entry.scoreCount,
      rankScore: 0,
    });
  }

  // Composite rank: 60% audit quality (0-100) + 40% students-per-class normalised
  // to the best center. Centers without audit data keep a students-only score.
  for (const r of rankings) {
    const studentsNorm = r.avgStudentsPerClass / maxAvgStudents;
    const qualityNorm = r.qualityAvg === null ? 0 : r.qualityAvg / 100;
    r.rankScore = Math.round((60 * qualityNorm + 40 * studentsNorm) * 10) / 10;
  }

  rankings.sort((a, b) => b.rankScore - a.rankScore || b.avgStudentsPerClass - a.avgStudentsPerClass);
  return { rankings, byKey };
}
