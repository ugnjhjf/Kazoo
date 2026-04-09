'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { formatTime, getReadableDate } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

export default function ResultsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { lastResult } = useAppStore();
  const [barWidth, setBarWidth] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastResult) { router.push('/'); return; }
    setTimeout(() => setBarWidth(lastResult.accuracy), 300);
    if (lastResult.newBadge) {
      flashTimer.current = setTimeout(() => setShowFlash(true), 1000);
    }
    return () => { if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, [lastResult, router]);

  if (!lastResult) return null;

  const { accuracy, stability, durationS, hits, total, newBadge, dateKey } = lastResult;
  const icon = accuracy >= 90 ? '🏆' : accuracy >= 75 ? '🎉' : accuracy >= 50 ? '👍' : '💪';
  const title = accuracy >= 90 ? t('res-title-excellent') : accuracy >= 75 ? t('res-title-great') : accuracy >= 50 ? t('res-title-good') : t('res-title-effort');
  const stabilityLabel = stability >= 80 ? t('res-stab-super') : stability >= 60 ? t('res-stab-good') : stability >= 40 ? t('res-stab-fair') : t('res-stab-erratic');

  return (
    <div className="screen-wrapper">
      <div className="results-wrapper">
        <div className="results-bg">
          <div className="orb orb1" /><div className="orb orb2" />
        </div>
        <div className="results-content">
          <div className="results-header">
            <div className="results-icon">{icon}</div>
            <h2 className="results-title">{title}</h2>
            <p className="results-sub">{t('res-sub')}</p>
          </div>

          <div className="results-cards">
            <div className="result-card">
              <div className="result-card-icon">🎯</div>
              <div className="result-card-value">{accuracy}%</div>
              <div className="result-card-label">{t('res-acc-lbl')}</div>
              <div className="result-card-bar">
                <div className="result-bar-fill" style={{ width: `${barWidth}%` }} />
              </div>
            </div>
            <div className="result-card">
              <div className="result-card-icon">🌡️</div>
              <div className="result-card-value">{stability}%</div>
              <div className="result-card-label">{t('res-stab-lbl')}</div>
              <div className="result-bar-label">{stabilityLabel}</div>
            </div>
            <div className="result-card">
              <div className="result-card-icon">⏱</div>
              <div className="result-card-value">{formatTime(durationS)}</div>
              <div className="result-card-label">{t('res-time-lbl')}</div>
            </div>
            <div className="result-card">
              <div className="result-card-icon">🎵</div>
              <div className="result-card-value">{hits}/{total}</div>
              <div className="result-card-label">{t('res-notes-lbl')}</div>
            </div>
          </div>

          {newBadge && (
            <div className="badge-unlock-area">
              <h3>🏆 Badge Unlocked!</h3>
              <div className="unlocked-badge-display">{newBadge.icon}</div>
            </div>
          )}

          <div className="results-calendar-note">
            <span className="cal-note-icon">📅</span>
            <span>{t('res-cal-note', { date: getReadableDate(dateKey) })}</span>
          </div>

          <div className="results-actions">
            <button className="btn btn-primary" onClick={() => router.push('/game')}>{t('btn-play-again')}</button>
            <button className="btn btn-glass" onClick={() => router.push('/calendar')}>{t('btn-res-calendar')}</button>
            <button className="btn btn-glass" onClick={() => router.push('/')}>{t('btn-res-home')}</button>
          </div>
        </div>
      </div>

      {showFlash && newBadge && (
        <div className="badge-flash" onClick={() => setShowFlash(false)}>
          <div className="badge-flash-content">
            <div className="badge-flash-icon">{newBadge.icon}</div>
            <h2>{t('res-flash-title')}</h2>
            <div className="badge-flash-name">{newBadge.name}</div>
            <p>{newBadge.desc}</p>
            <button className="btn btn-primary" onClick={() => setShowFlash(false)}>{t('res-flash-btn')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
