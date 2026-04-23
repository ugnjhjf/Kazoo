'use client';
import { useAppStore } from '@/store/appStore';
import { useEffect, useState } from 'react';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { settings } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      if (settings.layoutMode === 'desktop') {
        document.documentElement.classList.add('desktop-mode');
      } else {
        document.documentElement.classList.remove('desktop-mode');
      }
    }
  }, [settings.layoutMode, mounted]);

  if (!mounted) {
    return <div className="screen-wrapper" style={{ opacity: 0 }} />;
  }

  return <>{children}</>;
}
