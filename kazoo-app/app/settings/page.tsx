'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { SONGS } from '@/lib/gameData';
import { dbLoad, dbSave } from '@/lib/db';
import { useTranslation } from '@/hooks/useTranslation';

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { settings, setSettings } = useAppStore();
  const { requestMic, detectPitch, getFrequencyData, isActive } = useAudioEngine();
  const [micTestActive, setMicTestActive] = useState(false);
  const [micHz, setMicHz] = useState('-- Hz');
  const [barHeights, setBarHeights] = useState<number[]>(Array(7).fill(20));
  const [showConfirm, setShowConfirm] = useState(false);
  const testAnimRef = useRef<number | null>(null);
  const barsData = useRef(new Uint8Array(1024));

  const micTestLoop = () => {
    const hz = detectPitch();
    if (hz > 60 && hz < 1200) setMicHz(`${Math.round(hz)} ${t('hz')}`);
    else setMicHz(t('mic-test-hum'));

    const arr = new Uint8Array(barsData.current.length);
    getFrequencyData(arr);
    const newHeights = Array.from({ length: 7 }, (_, i) => {
      const idx = Math.floor((i / 7) * arr.length * 0.3);
      return Math.max(10, (arr[idx] / 255) * 100);
    });
    setBarHeights(newHeights);
    testAnimRef.current = requestAnimationFrame(micTestLoop);
  };

  const toggleMicTest = async () => {
    if (micTestActive) {
      if (testAnimRef.current) cancelAnimationFrame(testAnimRef.current);
      setMicTestActive(false);
      setMicHz(`-- ${t('hz')}`);
      setBarHeights(Array(7).fill(20));
    } else {
      if (!isActive()) await requestMic();
      setMicTestActive(true);
      testAnimRef.current = requestAnimationFrame(micTestLoop);
    }
  };

  useEffect(() => {
    return () => { if (testAnimRef.current) cancelAnimationFrame(testAnimRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearData = () => {
    dbSave(dbLoad()); // just reset to defaults
    const fresh = { sessions: [], badges: {}, accuracyAwards: {}, settings: {} };
    localStorage.setItem('kazoo_therapy_v1', JSON.stringify(fresh));
    setShowConfirm(false);
  };

  return (
    <div className="screen-wrapper">
      <div className="screen-header">
        <button className="btn-back" onClick={() => router.push('/')}>{t('btn-back')}</button>
        <h2>{t('settings-header')}</h2>
        <div />
      </div>

      <div className="settings-content">
        {/* Mic test */}
        <div className="settings-section">
          <h3>{t('set-mic-title')}</h3>
          <div className="mic-test-area">
            <div className="mic-test-visual">
              <div className="mic-test-bar-group">
                {barHeights.map((h, i) => (
                  <div key={i} className="mic-bar" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <button className="btn btn-glass" onClick={toggleMicTest}>
              {micTestActive ? t('btn-mic-stop') : t('btn-mic-test')}
            </button>
            <div className="mic-test-hz">{micHz}</div>
          </div>
        </div>

        {/* Calibration */}
        <div className="settings-section">
          <h3>{t('set-calib-title')}</h3>
          <p className="settings-desc">{t('set-calib-desc')}</p>
          <button className="btn btn-primary" onClick={() => router.push('/settings/calibration')} style={{ marginTop: '8px' }}>
            {t('btn-calib-pitches')}
          </button>
        </div>

        {/* Tolerance */}
        <div className="settings-section">
          <h3>{t('set-tol-title')}</h3>
          <p className="settings-desc">{t('set-tol-desc')}</p>
          <div className="slider-row">
            <span>{t('tol-strict')}</span>
            <input
              type="range" min={20} max={100} step={10}
              value={settings.tolerance}
              onChange={e => setSettings({ tolerance: parseInt(e.target.value) })}
            />
            <span>{t('tol-relaxed')}</span>
          </div>
          <div className="slider-val">{t('tol-val-label')} <strong>±{settings.tolerance} {t('hz')}</strong></div>
        </div>

        {/* Speed */}
        <div className="settings-section">
          <h3>{t('set-speed-title')}</h3>
          <div className="speed-options">
            {([['slow',t('speed-slow')],['normal',t('speed-normal')],['fast',t('speed-fast')]] as const).map(([spd, label]) => (
              <button
                key={spd}
                className={`speed-btn${settings.speed === spd ? ' active' : ''}`}
                onClick={() => setSettings({ speed: spd })}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Song */}
        <div className="settings-section">
          <h3>{t('set-song-title')}</h3>
          <div className="song-select">
            {SONGS.map(s => (
              <div
                key={s.id}
                className={`song-option${settings.selectedSong === s.id ? ' selected' : ''}`}
                onClick={() => setSettings({ selectedSong: s.id })}
              >
                <div className="song-option-icon">{s.icon}</div>
                <div className="song-option-info">
                  <div className="song-opt-name">{t(s.nameKey)}</div>
                  <div className="song-opt-desc">{t(s.descKey)} · {t(s.diffKey)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clear data */}
        <div className="settings-section">
          <h3>{t('set-data-title' as any)}</h3>
          <button className="btn btn-danger" onClick={() => setShowConfirm(true)}>{t('btn-clear-data')}</button>
          <p className="settings-desc">{t('set-data-desc')}</p>
        </div>
      </div>

      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-card">
            <h3>{t('clear-confirm-title')}</h3>
            <p>{t('clear-confirm-desc')}</p>
            <div className="confirm-buttons">
              <button className="btn btn-glass" onClick={() => setShowConfirm(false)}>{t('btn-cancel')}</button>
              <button className="btn btn-danger" onClick={clearData}>{t('btn-delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
