'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dbLoad, getWeeklySessions, getTrainedDays, todayKey } from '@/lib/db';
import { useTranslation } from '@/hooks/useTranslation';

export default function ReportPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [period, setPeriod] = useState('');
  const [daysTrained, setDaysTrained] = useState(0);
  const [totalMins, setTotalMins] = useState(0);
  const [avgAcc, setAvgAcc] = useState<number | null>(null);
  const [avgStab, setAvgStab] = useState<number | null>(null);
  const [weekData, setWeekData] = useState<{ label: string; mins: number; avgAcc: number | null; key: string }[]>([]);
  const [freqLvl, setFreqLvl] = useState(1);
  const [freqDesc, setFreqDesc] = useState('');

  useEffect(() => {
    const data = dbLoad();
    const week = getWeeklySessions(data);
    const start = week[0].date;
    const end = week[6].date;
    const startMon = t(`mon-s-${start.getMonth()}` as any);
    const endMon = t(`mon-s-${end.getMonth()}` as any);
    setPeriod(`${startMon} ${start.getDate()} – ${endMon} ${end.getDate()}, ${end.getFullYear()}`);

    const dt = week.filter(d => d.mins > 0).length;
    const total = week.reduce((a, d) => a + d.mins, 0);
    const accs = week.filter(d => d.avgAcc !== null).map(d => d.avgAcc as number);
    const acc = accs.length ? Math.round(accs.reduce((a, v) => a + v, 0) / accs.length) : null;
    const recent = data.sessions.slice(-7);
    const stab = recent.length ? Math.round(recent.reduce((a, s) => a + s.stability, 0) / recent.length) : null;

    setDaysTrained(dt);
    setTotalMins(total);
    setAvgAcc(acc);
    setAvgStab(stab);
    setWeekData(week.map(d => ({ label: d.label, mins: d.mins, avgAcc: d.avgAcc, key: d.key })));

    const tdays = getTrainedDays(data);
    const totalTrainedDaysCount = tdays.length;
    const lvl = totalTrainedDaysCount >= 21 ? 5 : totalTrainedDaysCount >= 14 ? 4 : totalTrainedDaysCount >= 7 ? 3 : totalTrainedDaysCount >= 3 ? 2 : 1;
    setFreqLvl(lvl);
    setFreqDesc(t(`freq-desc-${lvl}` as any));
  }, [t]);

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
            { icon: '📆', val: daysTrained, lbl: 'Days Trained' },
            { icon: '⏱', val: formatT(totalMins), lbl: 'Total Time' },
            { icon: '🎯', val: avgAcc !== null ? `${avgAcc}%` : '--', lbl: 'Avg Accuracy' },
            { icon: '🌡️', val: avgStab !== null ? `${avgStab}%` : '--', lbl: 'Avg Stability' },
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
