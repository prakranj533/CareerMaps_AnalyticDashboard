export type RangePreset = 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'custom';

export interface RangeState {
  preset: RangePreset;
  customFrom: string;
  customTo: string;
}

export const RANGE_PRESET_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'thisWeek', label: 'This week' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
];

export const createRangeState = (): RangeState => ({
  preset: 'all',
  customFrom: '',
  customTo: '',
});

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const startOfWeek = (date: Date) => {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7; // convert Sunday=0 to Monday=0
  d.setDate(d.getDate() - day);
  return d;
};

const endOfWeek = (date: Date) => {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return endOfDay(end);
};

const startOfMonth = (date: Date) => startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
const endOfMonth = (date: Date) => endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));

export interface RangeBounds {
  from: Date | null;
  to: Date | null;
}

export const getRangeBounds = (state: RangeState, now = new Date()): RangeBounds => {
  switch (state.preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'thisWeek':
      return { from: startOfWeek(now), to: endOfWeek(now) };
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'custom':
      return {
        from: state.customFrom ? startOfDay(new Date(state.customFrom)) : null,
        to: state.customTo ? endOfDay(new Date(state.customTo)) : null,
      };
    default:
      return { from: null, to: null };
  }
};

export const describeRangeState = (state: RangeState): string => {
  switch (state.preset) {
    case 'today':
      return 'Showing today';
    case 'thisWeek':
      return 'Showing this week (Mon–Sun)';
    case 'thisMonth':
      return 'Showing this month';
    case 'custom':
      if (state.customFrom && state.customTo) {
        const from = new Date(state.customFrom).toLocaleDateString();
        const to = new Date(state.customTo).toLocaleDateString();
        return `Showing ${from} – ${to}`;
      }
      return 'Select custom range';
    default:
      return 'Showing all time';
  }
};

export const isDateWithinBounds = (date: Date | null, bounds: RangeBounds) => {
  if (!date) return false;
  if (bounds.from && date < bounds.from) return false;
  if (bounds.to && date > bounds.to) return false;
  return true;
};
