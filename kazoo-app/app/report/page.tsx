'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dbLoad, getWeeklySessions, getTrainedDays, todayKey } from '@/lib/db';
import { useTranslation } from '@/hooks/useTranslation';

export default function ReportPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [data] = useState(() => dbLoad());
  const [week, setWeek] = useState(() => getWeeklySessions(data));
  const [start] = useState(() => week[0].date);
  const [end] = useState(() => week[6].date);
  const startMon = t(`mon-s-${start.getMonth()}` as any);
  const endMon = t(`mon-s-${end.getMonth()}` as any);
  const [period] = useState(() => `${startMon} ${start.getDate()} – ${endMon} ${end.getDate()}, ${end.getFullYear()}`);

  const [daysTrained] = useState(() => week.filter(d => d.mins > 0).length);
  const [totalMins] = useState(() => week.reduce((a, d) => a + d.mins, 0));
  const [avgAcc] = useState(() => {
    const accs = week.filter(d => d.avgAcc !== null).map(d => d.avgAcc as number);
    return accs.length ? Math.round(accs.reduce((a, v) => a + v, 0) / accs.length) : null;
  });
  const [avgStab] = useState(() => {
    const recent = data.sessions.slice(-7);
    return recent.length ? Math.round(recent.reduce((a, s) => a + s.stability, 0) / recent.length) : null;
  });
  const [weekData] = useState(() => week.map(d => ({ label: d.label, mins: d.mins, avgAcc: d.avgAcc, key: d.key })));

  const [freqLvl] = useState(() => {
    const totalTrainedDaysCount = getTrainedDays(data).length;
    return totalTrainedDaysCount >= 21 ? 5 : totalTrainedDaysCount >= 14 ? 4 : totalTrainedDaysCount >= 7 ? 3 : totalTrainedDaysCount >= 3 ? 2 : 1;
  });
  const freqDesc = t(`freq-desc-${freqLvl}` as any);

  const today = todayKey();
  const maxMins = Math.max(...weekData.map(d => d.mins), 20);
  const formatT = (m: number) => m < 60 ? `${m}m` : `${Math.floor(m/60)}h${m%60}m`;

  return (
    <div className="screen-wrapper">
      <div className="screen-header">
        <button className="btn-back" onClick={() => router.push('/')}>{t('btn-back')}</button>
        <h2>{t('report-header')}</h2>
        <div />
      </div>

      <div className="report-content">
        <div className="report-period">{period}</div>

        <div className="report-summary-cards">
          {[
            { icon: '📆', val: daysTrained, lbl: t('rpt-days-lbl') },
            { icon: '⏱', val: formatT(totalMins), lbl: t('rpt-time-lbl') },
            { icon: '🎯', val: avgAcc !== null ? `${avgAcc}%` : '--', lbl: t('rpt-acc-lbl') },
            { icon: '🌡️', val: avgStab !== null ? `${avgStab}%` : '--', lbl: t('rpt-stab-lbl') },
          ].map(c => (
            <div key={c.lbl} className="report-card">
              <div className="report-card-icon">{c.icon}</div>
              <div className="report-card-val">{c.val}</div>
              <div className="report-card-lbl">{c.lbl}</div>
            </div>
          ))}
        </div>

        <h3 className="chart-title">{t('chart-title-time')}</h3>
        <div className="bar-chart">
          {weekData.map(d => {
            const pct = maxMins > 0 ? (d.mins / maxMins) * 100 : 0;
            return (
              <div key={d.key} className="bar-chart-col">
                <div className="bar-val">{d.mins > 0 ? `${d.mins}m` : ''}</div>
                <div className="bar-seg-wrap">
                  <div className={`bar-seg${d.key === today ? ' today' : ''}${d.mins >= 20 ? ' goal-met' : ''}`} style={{ height: `${pct}%` }} />
                </div>
                <div className="bar-label">{t(`day-${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(d.label)}` as any)}</div>
              </div>
            );
          })}
        </div>

        <h3 className="chart-title">{t('chart-title-freq')}</h3>
        <div className="frequency-level-display">
          <div className="freq-level-badge">F{freqLvl}</div>
          <div className="freq-level-desc">{freqDesc}</div>
        </div>
        <div className="freq-level-bar">
          <div className="freq-level-steps">
            {[1,2,3,4,5].map(i => (
              <div key={i} className={`freq-step${i <= freqLvl ? ' active' : ''}`} />
            ))}
          </div>
        </div>

        <h3 className="chart-title">{t('chart-title-trend')}</h3>
        <div className="accuracy-trend">
          {weekData.map(d => (
            <div key={d.key} className="trend-dot-col">
              <div className="trend-seg-wrap">
                <div className="trend-dot" style={{ height: `${d.avgAcc ?? 0}%` }} />
              </div>
              <div className="trend-label">{t(`day-${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(d.label)}` as any)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
