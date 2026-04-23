'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dbLoad, getTrainedDays, getStreak } from '@/lib/db';
import { BADGE_DEFS } from '@/lib/gameData';
import { useTranslation } from '@/hooks/useTranslation';

export default function CalendarPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [data] = useState(() => dbLoad());
  const [now] = useState(() => new Date());
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [trainedDays, setTrainedDays] = useState<Set<string>>(() => new Set(getTrainedDays(data)));
  const [streak, setStreak] = useState(() => getStreak(data));
  const [totalDays, setTotalDays] = useState(() => trainedDays.size);

  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const milestonePct = Math.min(100, (totalDays / 21) * 100);

  return (
    <div className="screen-wrapper tablet-screen">
      <div className="screen-header">
        <button className="btn-back" onClick={() => router.push('/')}>{t('btn-back')}</button>
        <h2>{t('cal-header')}</h2>
        <button className="btn-icon-sm" onClick={() => router.push('/report')}>📊</button>
      </div>

      <div className="calendar-content tablet-content">
        <div className="calendar-left">
          <div className="streak-banner">
            <span className="streak-fire">🔥</span>
            <div>
              <div className="streak-num">{streak}</div>
              <div className="streak-text">{t('cal-streak-lbl')}</div>
            </div>
            <div className="streak-total">
              <div className="streak-num">{totalDays}</div>
              <div className="streak-text">{t('cal-total-lbl')}</div>
            </div>
          </div>

          <div className="calendar-nav">
            <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
            <h3>{t(`mon-${month}` as any)} {year}</h3>
            <button className="cal-nav-btn" onClick={nextMonth}>›</button>
          </div>

          <div className="calendar-grid-header">
            {[0,1,2,3,4,5,6].map(d => <span key={d}>{t(`day-${d}` as any)}</span>)}
          </div>

          <div className="calendar-grid">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} className="cal-day empty" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
              const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const isTrained = trainedDays.has(key);
              const isToday = key === today;
              return (
                <div key={d} className={`cal-day${isToday ? ' today' : ''}${isTrained ? ' trained' : ''}`}>
                  <span>{d}</span>
                  {isTrained && <span className="cal-day-note">🎵</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="calendar-right">
          <div className="milestone-section tablet-milestone">
            <h3>{t('mile-header')}</h3>
            <div className="milestone-bar">
              <div className="milestone-fill" style={{ width: `${milestonePct}%` }} />
              <div className="milestone-markers">
                {[{pct:'4.76%',day:1},{pct:'9.52%',day:2},{pct:'14.28%',day:3},{pct:'33.33%',day:7},{pct:'66.66%',day:14},{pct:'100%',day:21}].map(m => (
                  <div key={m.day} className={`mile-marker${totalDays >= m.day ? ' reached' : ''}`} style={{ left: m.pct }}>
                    {t('mile-day-prefix')}{m.day}
                  </div>
                ))}
              </div>
            </div>
            <div className="milestone-badges-row tablet-badges-row">
              {BADGE_DEFS.map(b => (
                <div key={b.id} className="mile-badge-item">
                  <div className={`mile-badge-icon${totalDays >= b.day ? ' unlocked' : ''}`}>{b.icon}</div>
                  <div className="mile-badge-label">{t('mile-badge-day', { day: b.day })}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
