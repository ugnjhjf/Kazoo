'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useAppStore } from '@/store/appStore';
import { SONGS, SPEED_PX_PER_SEC, BADGE_DEFS, ACCURACY_AWARDS, generatePattern, NotePattern } from '@/lib/gameData';
import { dbLoad, dbSave, getTrainedDays, todayKey } from '@/lib/db';
import { formatTime } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface GameNote extends NotePattern {
  state: 'pending' | 'active' | 'hit' | 'miss' | 'done';
  yPos: number;
  hitFrames: number;
  totalWindowFrames: number;
}

export default function GamePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { requestMic, detectPitch, calcStability, isActive, getTimeDomainData } = useAudioEngine();
  const { settings, setLastResult } = useAppStore();

  const [micGranted, setMicGranted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [accuracyVal, setAccuracyVal] = useState('--');
  const [hitsVal, setHitsVal] = useState(0);
  const [missesVal, setMissesVal] = useState(0);
  const [notesLeft, setNotesLeft] = useState(0);
  const [hzDisplay, setHzDisplay] = useState('--');
  const [comboCount, setComboCount] = useState(0);
  const [stabilityPct, setStabilityPct] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [songName, setSongName] = useState('Warm-Up Session');
  const [dotTop, setDotTop] = useState('50%');
  const [gridTotal, setGridTotal] = useState(1);

  const laneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeDataRef = useRef(new Uint8Array(1024));
  const animRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameRef = useRef({
    active: false,
    paused: false,
    songElapsed: 0,
    sessionPlaySeconds: 0,
    lastTimestamp: 0,
    hits: 0, misses: 0,
    hitFrames: 0, totalTargetFrames: 0,
    combo: 0, maxCombo: 0,
    pitchHistory: [] as number[],
    notes: [] as GameNote[],
    noteDomElements: new Map<GameNote, HTMLDivElement>(),
    speedPx: 150,
    song: SONGS[0],
  });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 900);
  }, []);

  const isOnPitch = useCallback((hz: number, pitch: 'low' | 'mid' | 'high') => {
    const targets = { 
      low: settings.calibrationData?.low ?? 200, 
      mid: settings.calibrationData?.mid ?? 320, 
      high: settings.calibrationData?.high ?? 450 
    };
    return Math.abs(hz - targets[pitch]) <= settings.tolerance;
  }, [settings.tolerance, settings.calibrationData]);

  const endGame = useCallback((finalStability: number) => {
    const G = gameRef.current;
    G.active = false;
    if (timerRef.current) clearInterval(timerRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const accuracy = G.totalTargetFrames > 0
      ? Math.round((G.hitFrames / G.totalTargetFrames) * 100) : 0;
    const stab = Math.round(finalStability);
    const durationS = G.sessionPlaySeconds;

    const data = dbLoad();
    const today = todayKey();
    data.sessions.push({ date: today, durationS, accuracy, stability: stab, hits: G.hits, misses: G.misses, song: G.song.id });

    ACCURACY_AWARDS.forEach(award => {
      if (award.id === 'stable') {
        if (stab >= award.target && !data.accuracyAwards[award.id]) data.accuracyAwards[award.id] = true;
      } else {
        if (accuracy >= award.target && !data.accuracyAwards[award.id]) data.accuracyAwards[award.id] = true;
      }
    });

    const trainedDays = getTrainedDays(data);
    let newBadge: { icon: string; nameKey: any; descKey: any } | null = null;
    BADGE_DEFS.forEach(b => {
      if (trainedDays.length >= b.day && !data.badges[b.id]) {
        data.badges[b.id] = today;
        if (!newBadge) newBadge = { icon: b.icon, nameKey: b.nameKey, descKey: b.descKey };
      }
    });

    dbSave(data);
    setLastResult({ accuracy, stability: stab, durationS, hits: G.hits, total: G.hits + G.misses, newBadge, dateKey: today });
    router.push('/results');
  }, [router, setLastResult]);

  const gameFrame = useCallback((timestamp: number) => {
    const G = gameRef.current;
    if (!G.active) return;
    if (G.paused) { animRef.current = requestAnimationFrame(gameFrame); return; }

    const lane = laneRef.current;
    if (!lane) { animRef.current = requestAnimationFrame(gameFrame); return; }

    const dt = G.lastTimestamp ? (timestamp - G.lastTimestamp) / 1000 : 0.016;
    G.lastTimestamp = timestamp;
    G.songElapsed += dt;

    const laneH = lane.clientHeight;
    const targetLineY = laneH - laneH * 0.20;

    const hz = detectPitch();
    if (hz > 60 && hz < 1200) {
      G.pitchHistory.push(hz);
      if (G.pitchHistory.length > 120) G.pitchHistory.shift();
      setHzDisplay(String(Math.round(hz)));
      const normHz = Math.max(0, Math.min(1, (hz - 100) / 600));
      setDotTop(`${laneH * (1 - normHz)}px`);
    }

    const canvas = canvasRef.current;
    if (canvas && G.active) {
      const ctx = canvas.getContext('2d');
      const c = settings.calibrationData || { low: 200, mid: 320, high: 450 };
      if (ctx) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        
        const hzToY = (val: number) => h - (Math.max(0, Math.min(1, (val - 100) / 600)) * h);
        const tol = settings.tolerance;
        const yLimitHigh = hzToY(c.high + tol);
        const yHigh = hzToY(c.high);
        const yMid = hzToY(c.mid);
        const yLow = hzToY(c.low);
        const yLimitLow = hzToY(c.low - tol);

        // Draw boundaries (Red Dashed)
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#e53e3e';
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(0, yLimitHigh); ctx.lineTo(w, yLimitHigh); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, yLimitLow); ctx.lineTo(w, yLimitLow); ctx.stroke();

        // Draw targets (Grey)
        ctx.strokeStyle = '#cbd5e0';
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(0, yHigh); ctx.lineTo(w, yHigh); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, yMid); ctx.lineTo(w, yMid); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, yLow); ctx.lineTo(w, yLow); ctx.stroke();

        // Labels
        ctx.fillStyle = '#a0aec0';
        ctx.font = '10px Arial';
        ctx.fillText(String(c.high), 2, yHigh + 10);
        ctx.fillText(String(c.mid), 2, yMid - 2);
        ctx.fillText(String(c.low), 2, yLow - 2);

        // Draw pitch history
        if (G.pitchHistory.length > 0) {
          ctx.beginPath();
          ctx.strokeStyle = '#9f7aea'; // purple
          ctx.lineWidth = 2;
          const sliceW = w / 120;
          
          let lastX = 0;
          for (let i = 0; i < G.pitchHistory.length; i++) {
            const x = i * sliceW;
            const y = hzToY(G.pitchHistory[i]);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            lastX = x;
          }
          ctx.stroke();

          // Fill underneath
          ctx.lineTo(lastX, h);
          ctx.lineTo(0, h);
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = '#00b09b'; // cyan
          ctx.fill();
          ctx.globalAlpha = 1.0;
          
          // Draw dot
          ctx.beginPath();
          ctx.fillStyle = '#00e676';
          ctx.arc(lastX, hzToY(G.pitchHistory[G.pitchHistory.length - 1]), 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }

    const stability = calcStability(G.pitchHistory);
    setStabilityPct(stability);

    G.notes.forEach(note => {
      if (note.state === 'done') return;
      const timeSinceStart = G.songElapsed - note.start;

      if (note.state === 'pending' && timeSinceStart > -3) {
        if (!G.noteDomElements.has(note)) {
          const el = document.createElement('div');
          el.className = `game-note ${note.pitch}`;
          el.style.top = '-60px';
          el.style.height = `${Math.round(note.duration * 40)}px`;
          el.textContent = note.pitch.toUpperCase();
          lane.appendChild(el);
          G.noteDomElements.set(note, el);
          note.state = 'active';
          note.yPos = -50;
        }
      }

      if (note.state === 'active') {
        note.yPos = (G.songElapsed - note.start + 3) * G.speedPx;
        const el = G.noteDomElements.get(note);
        if (el) el.style.top = `${note.yPos}px`;

        const noteBottom = note.yPos + 40;
        const noteTop = note.yPos;
        const inZone = noteBottom >= targetLineY - 30 && noteTop <= targetLineY + 30;

        if (inZone) {
          note.totalWindowFrames++;
          G.totalTargetFrames++;
          if (hz > 60 && isOnPitch(hz, note.pitch)) {
            note.hitFrames++;
            G.hitFrames++;
            G.combo++;
            if (G.combo > G.maxCombo) G.maxCombo = G.combo;
            if (el) el.style.boxShadow = '0 0 20px var(--clr-accent)';
          } else {
            G.combo = 0;
            if (el) el.style.boxShadow = '';
          }
          setComboCount(G.combo);
        }

        if (note.yPos > laneH + 60) {
          const acc = note.totalWindowFrames > 0 ? note.hitFrames / note.totalWindowFrames : 0;
          if (acc >= 0.4) {
            G.hits++;
            showToast(acc >= 0.9 ? t('toast-perfect') : acc >= 0.7 ? t('toast-good') : t('toast-ok'));
            const el2 = G.noteDomElements.get(note);
            if (el2) { el2.classList.add('hit'); setTimeout(() => el2.remove(), 400); }
          } else {
            G.misses++;
            const el2 = G.noteDomElements.get(note);
            if (el2) { el2.classList.add('miss'); setTimeout(() => el2.remove(), 400); }
            if (note.totalWindowFrames > 0) showToast(t('toast-miss'));
            else showToast(t('toast-skip'));
          }
          note.state = 'done';
          const totalAcc = G.totalTargetFrames > 0 ? Math.round((G.hitFrames / G.totalTargetFrames) * 100) : 0;
          setAccuracyVal(`${totalAcc}%`);
          setHitsVal(G.hits);
          setMissesVal(G.misses);
        }
      }
    });

    const lastNote = G.song.pattern[G.song.pattern.length - 1];
    const totalDuration = lastNote ? lastNote.start + lastNote.duration + 2 : 30;
    const pct = Math.min(100, (G.songElapsed / totalDuration) * 100);
    setProgressPct(pct);
    setNotesLeft(G.notes.filter(n => n.state !== 'done').length);

    if (G.songElapsed > totalDuration && G.notes.every(n => n.state === 'done')) {
      endGame(stability);
      return;
    }

    animRef.current = requestAnimationFrame(gameFrame);
  }, [detectPitch, calcStability, isOnPitch, showToast, endGame]);

  const startGameLoop = useCallback(() => {
    const G = gameRef.current;
    const songDef = SONGS.find(s => s.id === settings.selectedSong) || SONGS[0];
    // Regenerate pattern for fresh randomness
    songDef.pattern = generatePattern(songDef.id as 'warmup' | 'daily' | 'challenge');

    G.active = true;
    G.paused = false;
    G.songElapsed = 0;
    G.lastTimestamp = 0;
    G.sessionPlaySeconds = 0;
    G.hits = 0; G.misses = 0;
    G.hitFrames = 0; G.totalTargetFrames = 0;
    G.combo = 0; G.maxCombo = 0;
    G.pitchHistory = [];
    G.noteDomElements = new Map();
    G.song = songDef;
    G.speedPx = SPEED_PX_PER_SEC[settings.speed] || 150;
    G.notes = songDef.pattern.map(n => ({ ...n, state: 'pending', yPos: -50, hitFrames: 0, totalWindowFrames: 0 }));

    setSongName(t(songDef.nameKey as any));
    setSessionTime(0);
    setAccuracyVal('--%');
    setHitsVal(0); setMissesVal(0);
    setNotesLeft(G.notes.length);
    setComboCount(0); setHzDisplay('--');
    setGridTotal(Math.max(1, Math.floor(songDef.pattern.length / 2)));

    if (laneRef.current) {
      laneRef.current.querySelectorAll('.game-note').forEach(n => n.remove());
    }

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!gameRef.current.paused && gameRef.current.active) {
        gameRef.current.sessionPlaySeconds++;
        setSessionTime(s => s + 1);
      }
    }, 1000);

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(gameFrame);
  }, [settings, gameFrame]);

  const handleGrantMic = async () => {
    const ok = await requestMic();
    if (ok) { setMicGranted(true); startGameLoop(); }
    else alert('Mic access denied. Please allow microphone use.');
  };

  const handlePause = () => {
    gameRef.current.paused = true;
    setPaused(true);
  };
  const handleResume = () => {
    gameRef.current.paused = false;
    setPaused(false);
  };
  const handleQuit = () => {
    gameRef.current.active = false;
    if (timerRef.current) clearInterval(timerRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    router.push('/');
  };

  useEffect(() => {
    if (isActive()) { setMicGranted(true); startGameLoop(); }
    return () => {
      gameRef.current.active = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="game-screen-wrapper">
      {/* Top bar */}
      <div className="game-top-bar">
        <button className="btn-back-sm" onClick={handleQuit}>✕</button>
        <div className="game-top-center">
          <div className="session-timer">{formatTime(sessionTime)}</div>
          <div className="session-label">{t('session-lbl')}</div>
        </div>
        <div className="game-accuracy-chip">
          <span className="game-accuracy-val">{accuracyVal}</span>
          <span className="chip-label">{t('chip-acc-lbl')}</span>
        </div>
      </div>

      {!micGranted ? (
        <div className="mic-notice">
          <div className="mic-notice-card">
            <div className="mic-icon-big">🎤</div>
            <h3>{t('mic-h3')}</h3>
            <p>{t('mic-desc')}</p>
            <button className="btn btn-primary" onClick={handleGrantMic}>{t('btn-grant-mic')}</button>
          </div>
        </div>
      ) : (
        <div className="game-main">
          <div className="game-split-top">
            <div className="game-lane-area">
              {/* Stability Thermometer */}
              <div className="thermometer-container">
                <div className="thermo-label top">{t('thermo-lbl-stable')}</div>
                <div className="thermometer">
                  <div className="thermo-fill" style={{ height: `${stabilityPct}%` }} />
                  <div className="thermo-indicator" style={{ bottom: `${stabilityPct}%` }}>🎵</div>
                </div>
                <div className="thermo-label bottom">{t('thermo-lbl-erratic')}</div>
              </div>

              {/* Note Lane */}
              <div className="note-lane-wrapper">
                <div className="pitch-sidebar">
                  <div className="pitch-label" style={{ top: '8%' }}>{t('calib-lbl-high')}</div>
                  <div className="pitch-label" style={{ top: '50%' }}>{t('calib-lbl-mid')}</div>
                  <div className="pitch-label" style={{ bottom: '8%' }}>{t('calib-lbl-low')}</div>
                </div>
                <div className="note-lane" ref={laneRef}>
                  <div className="target-zone">
                    <div className="target-zone-line" />
                    <div className="target-zone-glow" />
                  </div>
                  <div className="pitch-indicator">
                    <div className="pitch-dot" style={{ top: dotTop }} />
                    <div className="pitch-ring" style={{ top: dotTop }} />
                  </div>
                </div>

                {/* Feedback toast */}
                <div className={`feedback-toast${toastVisible ? ' visible' : ''}`}>{toast}</div>
              </div>

              {/* Right panel */}
              <div className="game-right-panel">
                <div className="game-combo-badge">
                  <span className="combo-count">{comboCount}</span>
                  <span className="combo-label">{t('combo-lbl')}</span>
                </div>
                <div className="game-hz-display">
                  <span className="hz-display">{hzDisplay}</span>
                  <span className="hz-label">{t('hz')}</span>
                </div>
                {/* Waveform */}
                <canvas ref={canvasRef} className="hz-wave-canvas" width={80} height={200} style={{ width: '100%', flexGrow: 1 }} />
                <div className="hz-wave-label" style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--clr-text-dim)', marginBottom: '8px' }}>{t('wave-lbl')}</div>
              </div>
            </div>
          </div>

          {/* Grid Walking Sub-game */}
          <div className="game-split-bottom">
            <div className="grid-game-header">
              <span className="grid-game-title">{t('grid-journey')}</span>
              <span className="grid-game-progress">{t('grid-step', { current: Math.min(hitsVal, gridTotal), total: gridTotal })}</span>
            </div>
            <div className="grid-board">
              {Array.from({ length: gridTotal + 1 }).map((_, i) => {
                const isCurrent = i === Math.min(hitsVal, gridTotal);
                const isPassed = i < hitsVal;
                return (
                  <div key={i} className={`grid-cell${isCurrent ? ' active' : ''}${isPassed ? ' passed' : ''}`}>
                    {isCurrent ? (
                      <div className="grid-avatar">🚶‍♂️</div>
                    ) : i === gridTotal ? (
                      <div>🏁</div>
                    ) : isPassed ? (
                      <div>✅</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            
            {/* Combine bottom info seamlessly */}
            <div className="game-bottom">
              <div className="game-song-info">
                <span className="game-song-name">{songName}</span>
                <div className="song-progress-bar">
                  <div className="song-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
              <div className="game-mini-stats">
                <div className="mini-stat"><span className="mini-stat-val">{hitsVal}</span><span className="mini-stat-label">{t('mini-hits')}</span></div>
                <div className="mini-stat"><span className="mini-stat-val">{missesVal}</span><span className="mini-stat-label">{t('mini-misses')}</span></div>
                <div className="mini-stat"><span className="mini-stat-val">{notesLeft}</span><span className="mini-stat-label">{t('mini-left')}</span></div>
              </div>
            </div>
          </div>

          {/* Pause overlay */}
          {paused && (
            <div className="pause-overlay">
              <div className="pause-card">
                <h2>{t('pause-title')}</h2>
                <p>{t('pause-time-lbl')} <strong>{formatTime(sessionTime)}</strong></p>
                <button className="btn btn-primary" onClick={handleResume}>{t('btn-resume')}</button>
                <button className="btn btn-glass" onClick={handleQuit}>{t('btn-quit')}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
