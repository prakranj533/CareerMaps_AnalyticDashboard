export const CORE_SUBJECTS = ['Mathematics', 'Science', 'Computer', 'English'] as const;
export type CoreSubject = (typeof CORE_SUBJECTS)[number];

const mathPattern = /(math|mathematics|algebra|geometry|arithmetic|ganit|mensuration|fraction|integer)/i;
const computerPattern = /(computer|digital|internet|hardware|software|coding|programming|ict|robotics|artificial intelligence|\bai\b|data science|technology|cyber|\bit\b)/i;
const sciencePattern = /(science|biology|physics|chemistry|environment|evs|stem|laboratory|experiment)/i;
const englishPattern = /(english|grammar|communication|spoken|language|literature|reading|writing|comprehension|vocabulary)/i;

export function coreSubjectFor(label: string): CoreSubject {
  const value = (label || '').toLowerCase();
  if (!value) return 'Science';
  if (mathPattern.test(value)) return 'Mathematics';
  if (computerPattern.test(value)) return 'Computer';
  if (sciencePattern.test(value)) return 'Science';
  if (englishPattern.test(value)) return 'English';
  return 'Science';
}
