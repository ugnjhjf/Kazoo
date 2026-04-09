import { todayKey } from './utils';

export interface Session {
  date: string;
  durationS: number;
  accuracy: number;
  stability: number;
  hits: number;
  misses: number;
  song: string;
}

export interface DBData {
  sessions: Session[];
  badges: Record<string, string>;       // { day1: '2026-03-19', ... }
  accuracyAwards: Record<string, boolean>; // { acc80: true, ... }
  settings: Record<string, unknown>;
}

const DB_KEY = 'kazoo_therapy_v1';

function defaults(): DBData {
  return {
    sessions: [],
    badges: {},
    accuracyAwards: {},
    settings: {},
  };
}

export function dbLoad(): DBData {
  const def = defaults();
  if (typeof window === 'undefined') return def;
  try {
    const stored = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
    if (stored) {
      return { ...def, ...stored, badges: stored.badges || {}, accuracyAwards: stored.accuracyAwards || {}, settings: stored.settings || {} };
    }
    return def;
  } catch {
    return def;
  }
}

export function dbSave(data: DBData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

export function getTrainedDays(data: DBData): string[] {
  const days = new Set(data.sessions.map((s) => s.date));
  return [...days].sort();
}

export function getTotalMinutes(data: DBData): number {
  return Math.floor(data.sessions.reduce((s, x) => s + x.durationS, 0) / 60);
}

export function getStreak(data: DBData): number {
  const days = getTrainedDays(data).reverse();
  if (!days.length) return 0;
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const d of days) {
    const dc = new Date(d + 'T00:00:00');
    const diff = Math.round((cursor.getTime() - dc.getTime()) / 86400000);
    if (diff === 0 || diff === 1) {
      streak++;
      cursor = dc;
    } else break;
  }
  return streak;
}

export interface WeekDay {
  date: Date;
  key: string;
  mins: number;
  avgAcc: number | null;
  label: string;
}

export function getWeeklySessions(data: DBData): WeekDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const daySessions = data.sessions.filter((s) => s.date === key);
    const mins = Math.floor(daySessions.reduce((a, s) => a + s.durationS, 0) / 60);
    const avgAcc = daySessions.length
      ? Math.round(daySessions.reduce((a, s) => a + s.accuracy, 0) / daySessions.length)
      : null;
    week.push({ date: d, key, mins, avgAcc, label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] });
  }
  return week;
}

export { todayKey };
