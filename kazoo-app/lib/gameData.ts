import { rnd } from './utils';

export const SESSION_THRESHOLDS = [5 * 60, 10 * 60, 20 * 60];
export const BADGE_DAYS = [1, 2, 3, 7, 14, 21];

export interface BadgeDef {
  id: string;
  day: number;
  icon: string;
  nameKey: any;
  descKey: any;
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: 'day1',  day: 1,  icon: '🌱', nameKey: 'badge-day1-name',  descKey: 'badge-day1-desc' },
  { id: 'day2',  day: 2,  icon: '🌿', nameKey: 'badge-day2-name',  descKey: 'badge-day2-desc' },
  { id: 'day3',  day: 3,  icon: '🎋', nameKey: 'badge-day3-name',  descKey: 'badge-day3-desc' },
  { id: 'day7',  day: 7,  icon: '🔥', nameKey: 'badge-day7-name',  descKey: 'badge-day7-desc' },
  { id: 'day14', day: 14, icon: '⚡', nameKey: 'badge-day14-name', descKey: 'badge-day14-desc' },
  { id: 'day21', day: 21, icon: '🏆', nameKey: 'badge-day21-name', descKey: 'badge-day21-desc' },
];

export interface AccuracyAward {
  id: string;
  icon: string;
  nameKey: any;
  criterionKey: any;
  target: number;
}

export const ACCURACY_AWARDS: AccuracyAward[] = [
  { id: 'acc80',  icon: '🎯', nameKey: 'award-acc80-name',  criterionKey: 'award-acc80-crit', target: 80 },
  { id: 'acc90',  icon: '💎', nameKey: 'award-acc90-name',  criterionKey: 'award-acc90-crit', target: 90 },
  { id: 'acc95',  icon: '⭐', nameKey: 'award-acc95-name',  criterionKey: 'award-acc95-crit', target: 95 },
  { id: 'stable', icon: '🌊', nameKey: 'award-stable-name', criterionKey: 'award-stable-crit', target: 80 },
];

export interface NotePattern {
  start: number;
  duration: number;
  pitch: 'low' | 'mid' | 'high';
}

export interface SongDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  bpm: number;
  difficulty: string;
  pattern: NotePattern[];
}

export function generatePattern(type: 'warmup' | 'daily' | 'challenge'): NotePattern[] {
  const pitches: Array<'low' | 'mid' | 'high'> = ['low', 'mid', 'high'];
  const notes: NotePattern[] = [];
  let t = 2;

  const configs = {
    warmup:    { count: 12, dur: [1.5, 2.5] as [number, number], gap: [1.5, 2.5] as [number, number] },
    daily:     { count: 16, dur: [1.0, 2.0] as [number, number], gap: [1.0, 1.8] as [number, number] },
    challenge: { count: 20, dur: [0.8, 1.5] as [number, number], gap: [0.7, 1.2] as [number, number] },
  };

  const cfg = configs[type];
  for (let i = 0; i < cfg.count; i++) {
    const dur = rnd(cfg.dur[0], cfg.dur[1]);
    const pitch = pitches[Math.floor(Math.random() * 3)];
    notes.push({ start: t, duration: dur, pitch });
    t += dur + rnd(cfg.gap[0], cfg.gap[1]);
  }
  return notes;
}

export const SONGS: SongDef[] = [
  {
    id: 'warmup', name: 'Warm-Up Session', icon: '🌅',
    desc: 'Slow, gentle notes — perfect for beginners',
    bpm: 60, difficulty: 'Easy',
    pattern: generatePattern('warmup'),
  },
  {
    id: 'daily', name: 'Daily Trainer', icon: '🎵',
    desc: 'Moderate rhythm with pitch variety',
    bpm: 72, difficulty: 'Normal',
    pattern: generatePattern('daily'),
  },
  {
    id: 'challenge', name: 'Power Hum', icon: '⚡',
    desc: 'Faster notes, more accuracy required',
    bpm: 90, difficulty: 'Hard',
    pattern: generatePattern('challenge'),
  },
];

export const PITCH_ZONES = {
  low:  { label: 'LOW',  hz: 200, y: 0.75 },
  mid:  { label: 'MID',  hz: 320, y: 0.50 },
  high: { label: 'HIGH', hz: 450, y: 0.25 },
};

export const SPEED_PX_PER_SEC: Record<string, number> = {
  slow: 100,
  normal: 150,
  fast: 210,
};
