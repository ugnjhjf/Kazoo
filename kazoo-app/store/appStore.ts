'use client';
import { create } from 'zustand';

export interface AppSettings {
  tolerance: number;
  speed: 'slow' | 'normal' | 'fast';
  selectedSong: string;
  layoutMode: 'mobile' | 'desktop';
  language: 'en' | 'zh';
  calibrationData?: { low: number; mid: number; high: number };
}

export interface LastGameResult {
  accuracy: number;
  stability: number;
  durationS: number;
  hits: number;
  total: number;
  newBadge: { icon: string; name: string; desc: string } | null;
  dateKey: string;
}

interface AppStore {
  settings: AppSettings;
  lastResult: LastGameResult | null;
  setSettings: (s: Partial<AppSettings>) => void;
  setLastResult: (r: LastGameResult) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  settings: {
    tolerance: 50,
    speed: 'slow',
    selectedSong: 'warmup',
    layoutMode: 'mobile',
    language: 'en',
  },
  lastResult: null,
  setSettings: (s) => set((state) => ({ settings: { ...state.settings, ...s } })),
  setLastResult: (r) => set({ lastResult: r }),
}));
