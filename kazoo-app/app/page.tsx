'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dbLoad, getStreak, getTotalMinutes } from '@/lib/db';
import { useAppStore } from '@/store/appStore';
import { useTranslation } from '@/hooks/useTranslation';

export default function HomePage() {
  const router = useRouter();
  const { settings, setSettings } = useAppStore();
  const { t } = useTranslation();
  const [stats, setStats] = useState({ streak: 0, totalMin: 0, badgesEarned: 0 });

  useEffect(() => {
    const data = dbLoad();
    setStats({
      streak: getStreak(data),
      totalMin: getTotalMinutes(data),
      badgesEarned: Object.keys(data.badges).length,
    });
  }, []);

  const formatTime = (min: number) =>
    min < 60 ? `${min}m` : `${Math.floor(min / 60)}h${min % 60}m`;

  const toggleLayout = () => {
    setSettings({ layoutMode: settings.layoutMode === 'desktop' ? 'mobile' : 'desktop' });
  };

  const toggleLang = () => {
    setSettings({ language: settings.language === 'en' ? 'zh' : 'en' });
  };

  return (
    <div className="screen-wrapper">
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 100, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button 
          className="btn-icon-sm" 
          style={{ border: 'none', background: 'transparent' }} 
          title="Toggle Language"
          onClick={toggleLang}
        >
          {settings.language === 'en' ? '繁' : 'EN'}
        </button>
        <button 
          className="btn-icon-sm" 
          style={{ border: 'none', background: 'transparent' }} 
          title="Toggle Layout Mode"
          onClick={toggleLayout}
        >
          {settings.layoutMode === 'desktop' ? '💻' : '📱'}
        </button>
      </div>
      <div className="home-wrapper">
        <div className="home-bg">
          <div className="orb orb1" />
          <div className="orb orb2" />
          <div className="orb orb3" />
        </div>
        <div className="home-content">
          <div className="home-logo">
            <div className="logo-icon">🎵</div>
            <h1 className="logo-title">KazooTherapy</h1>
            <p className="logo-sub">{t('logo-sub')}</p>
          </div>

          <div className="home-actions">
            <div className="home-stats-bar">
              <div className="stat-chip">
                <span className="stat-icon">🔥</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--clr-primary)' }}>{stats.streak}</span>
                <span className="stat-label">{t('home-streak-lbl')}</span>
              </div>
              <div className="stat-chip">
                <span className="stat-icon">⏱</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--clr-primary)' }}>{formatTime(stats.totalMin)}</span>
                <span className="stat-label">{t('home-totaltime-lbl')}</span>
              </div>
              <div className="stat-chip">
                <span className="stat-icon">🏅</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--clr-primary)' }}>{stats.badgesEarned}/6</span>
                <span className="stat-label">{t('home-badges-lbl')}</span>
              </div>
            </div>

            <div className="home-buttons">
              <button className="btn btn-primary btn-xl pulse-glow" onClick={() => router.push('/tutorial')}>
                <span className="btn-icon">🎤</span> {t('btn-start')}
              </button>
              <div className="home-secondary-buttons">
                <button className="btn btn-glass" onClick={() => router.push('/calendar')}>
                  <span>📅</span> {t('btn-calendar')}
                </button>
                <button className="btn btn-glass" onClick={() => router.push('/report')}>
                  <span>📊</span> {t('btn-report')}
                </button>
                <button className="btn btn-glass" onClick={() => router.push('/badges')}>
                  <span>🏆</span> {t('btn-badges')}
                </button>
                <button className="btn btn-glass" onClick={() => router.push('/settings')}>
                  <span>⚙️</span> {t('btn-settings')}
                </button>
              </div>
            </div>

            <p className="home-footer">{t('home-footer')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
