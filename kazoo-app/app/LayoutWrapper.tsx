'use client';
import { useAppStore } from '@/store/appStore';
import { useEffect } from 'react';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { settings } = useAppStore();

  useEffect(() => {
    // Only manage manual layout override
    if (settings.layoutMode === 'desktop') {
      document.documentElement.classList.add('desktop-mode');
    } else {
      document.documentElement.classList.remove('desktop-mode');
    }
  }, [settings.layoutMode]);

  return <>{children}</>;
}
