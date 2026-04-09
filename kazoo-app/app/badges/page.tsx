'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dbLoad } from '@/lib/db';
import { BADGE_DEFS, ACCURACY_AWARDS } from '@/lib/gameData';
import { getReadableDate } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

export default function BadgesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [badges, setBadges] = useState<Record<string, string>>({});
  const [awards, setAwards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const data = dbLoad();
    setBadges(data.badges);
    setAwards(data.accuracyAwards);
  }, []);

  const earned = Object.keys(badges).length;

  return (
    <div className="screen-wrapper">
      <div className="screen-header">
        <button className="btn-back" onClick={() => router.push('/')}>{t('btn-back')}</button>
        <h2>{t('badges-header')}</h2>
        <div />
      </div>

      <div className="badges-content">
        <div className="badges-summary">{t('badges-summary', { earned })}</div>

        <div className="badge-grid">
          {BADGE_DEFS.map(b => {
            const unlocked = !!badges[b.id];
            const date = badges[b.id] ? getReadableDate(badges[b.id]) : '';
            return (
              <div key={b.id} className={`badge-item${unlocked ? ' unlocked' : ''}`}>
                <div className="badge-item-icon">{b.icon}</div>
                <div className="badge-item-title">{unlocked ? t(b.nameKey) : t('badges-locked')}</div>
                <div className="badge-item-sub">{t('mile-badge-day', { day: b.day })}</div>
                {unlocked ? (
                  <div className="badge-item-date">{date}</div>
                ) : (
                  <div className="badge-item-sub">{t('badges-locked')}</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="extra-achievements">
          <h3>{t('awards-header')}</h3>
          <div className="award-grid">
            {ACCURACY_AWARDS.map(a => {
              const unlocked = !!awards[a.id];
              return (
                <div key={a.id} className={`award-item${unlocked ? ' unlocked' : ''}`}>
                  <div className="award-icon">{a.icon}</div>
                  <div className="award-info">
                    <div className="award-name">{t(a.nameKey)}</div>
                    <div className="award-crit">{t(a.criterionKey)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
