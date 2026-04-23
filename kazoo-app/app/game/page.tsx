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

type PitchLabel = 'LOW' | 'MID' | 'HIGH' | '--';

export default function GamePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { requestMic, detectPitch, calcStability, isActive } = useAudioEngine();
  const { settings, setLastResult } = useAppStore();

  const [micGranted, setMicGranted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [accuracyVal, setAccuracyVal] = useState('--');
  const [hitsVal, setHitsVal] = useState(0);
    const [hzDisplay, setHzDisplay] = useState('--');
    const [stepProgressPct, setStepProgressPct] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
    const [songName, setSongName] = useState('Warm-Up Session');
  const [gridTotal, setGridTotal] = useState(1);
  // New: pitch labels for two display rectangles
  const [currentPitchLabel, setCurrentPitchLabel] = useState<PitchLabel>('--');
  const [targetPitchLabel, setTargetPitchLabel] = useState<PitchLabel>('--');
  // New: pre-specified note pattern for grid
  const [notePattern, setNotePattern] = useState<Array<'low' | 'mid' | 'high'>>([]);

  // Hidden lane ref for game timing logic (notes still exist but not shown)
  const laneRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const HIDDEN_LANE_H = 500; // fixed height for timing calculations
  const gameRef = useRef({
    active: false,
    paused: false,
    songElapsed: 0,
    sessionPlaySeconds: 0,
    lastTimestamp: 0,
    hits: 0,
    hitFrames: 0, totalTargetFrames: 0,
    pitchHistory: [] as number[],
    notes: [] as GameNote[],
    noteDomElements: new Map<GameNote, HTMLDivElement>(),
    speedPx: 150,
    song: SONGS[0],
  });
  
  
  const isOnPitch = useCallback((hz: number, pitch: 'low' | 'mid' | 'high') => {
    const targets = {
      low: settings.calibrationData?.low ?? 200,
      mid: settings.calibrationData?.mid ?? 320,
      high: settings.calibrationData?.high ?? 450,
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
    data.sessions.push({ date: today, durationS, accuracy, stability: stab, hits: G.hits, misses: 0, song: G.song.id });

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
    setLastResult({ accuracy, stability: stab, durationS, hits: G.hits, total: G.song.pattern.length, newBadge, dateKey: today });
    router.push('/results');
  }, [router, setLastResult]);

  const gameFrame = useCallback((timestamp: number) => {
    const G = gameRef.current;
    if (!G.active) return;
    if (G.paused) { animRef.current = requestAnimationFrame(gameFrame); return; }

    const dt = G.lastTimestamp ? (timestamp - G.lastTimestamp) / 1000 : 0.016;
    G.lastTimestamp = timestamp;
    G.songElapsed += dt;

    // Use fixed lane height for timing calculations (lane is hidden)
    const laneH = HIDDEN_LANE_H;
    const targetLineY = laneH - laneH * 0.20;

    // Detect current pitch and update label
    const hz = detectPitch();
    let newCurrentPitch: PitchLabel = '--';
    if (hz > 60 && hz < 1200) {
      G.pitchHistory.push(hz);
      if (G.pitchHistory.length > 120) G.pitchHistory.shift();
      setHzDisplay(String(Math.round(hz)));
      // Determine closest pitch zone
      const c = settings.calibrationData || { low: 200, mid: 320, high: 450 };
      const dists = [Math.abs(hz - c.low), Math.abs(hz - c.mid), Math.abs(hz - c.high)];
      const minIdx = dists.indexOf(Math.min(...dists));
      newCurrentPitch = (['LOW', 'MID', 'HIGH'] as const)[minIdx];
    } else {
      setHzDisplay('--');
    }
    setCurrentPitchLabel(newCurrentPitch);

    const stability = calcStability(G.pitchHistory);


    // Process step without failure
    const currentStep = G.hits;
    const patternLen = G.song.pattern.length;
    if (currentStep < patternLen) {
      const currentTargetPitch = G.song.pattern[currentStep].pitch.toUpperCase() as PitchLabel;
      setTargetPitchLabel(currentTargetPitch);

      if (hz > 60 && isOnPitch(hz, currentTargetPitch.toLowerCase() as any)) {
        G.hitFrames += dt; // Accrue time in seconds
        G.totalTargetFrames++;
        if (G.hitFrames >= 1.5) { // 1.5 seconds to complete step
          G.hits++;
          G.hitFrames = 0;
          setHitsVal(G.hits);
          
        }
      } else {
        // No decay, just don't accrue
        if (hz > 60) G.totalTargetFrames++;
      }
      setStepProgressPct(Math.min(100, (G.hitFrames / 1.5) * 100));
    } else {
      setTargetPitchLabel('--');
    }

    const lastNote = G.song.pattern[G.song.pattern.length - 1];
    const totalDuration = lastNote ? lastNote.start + lastNote.duration + 2 : 30;
    const pct = Math.min(100, (G.songElapsed / totalDuration) * 100);
    setProgressPct(pct);

    if (G.songElapsed > totalDuration || G.hits >= patternLen) {
      endGame(stability);
      return;
    }


    animRef.current = requestAnimationFrame(gameFrame);
  }, [detectPitch, calcStability, isOnPitch, endGame, settings]);

  const startGameLoop = useCallback(() => {
    const G = gameRef.current;
    const songDef = SONGS.find(s => s.id === settings.selectedSong) || SONGS[0];
    songDef.pattern = generatePattern(songDef.id as 'warmup' | 'daily' | 'challenge');

    G.active = true;
    G.paused = false;
    G.songElapsed = 0;
    G.lastTimestamp = 0;
    G.sessionPlaySeconds = 0;
    G.hits = 0;
    G.hitFrames = 0; G.totalTargetFrames = 0;
    G.pitchHistory = [];
    G.noteDomElements = new Map();
    G.song = songDef;
    G.speedPx = SPEED_PX_PER_SEC[settings.speed] || 150;
    G.notes = songDef.pattern.map(n => ({ ...n, state: 'pending', yPos: -50, hitFrames: 0, totalWindowFrames: 0 }));

    // Store pitch pattern for grid display
    const pitches = songDef.pattern.map(n => n.pitch as 'low' | 'mid' | 'high');
    setNotePattern(pitches);
    setGridTotal(pitches.length);

    setSongName(t(songDef.nameKey as any));
    setSessionTime(0);
    setAccuracyVal('--%');
    setHitsVal(0);
    setHzDisplay('--');
    setStepProgressPct(0);
    setCurrentPitchLabel('--');
    setTargetPitchLabel('--');

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

  const handlePause = () => { gameRef.current.paused = true; setPaused(true); };
  const handleResume = () => { gameRef.current.paused = false; setPaused(false); };
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

  // Helper: translate pitch key to display label
  const pitchDisplayLabel = (p: PitchLabel) => {
    if (p === 'LOW') return t('calib-lbl-low');
    if (p === 'MID') return t('calib-lbl-mid');
    if (p === 'HIGH') return t('calib-lbl-high');
    return '---';
  };

  const pitchColorClass = (p: PitchLabel) => {
    if (p === 'LOW') return 'pitch-color-low';
    if (p === 'MID') return 'pitch-color-mid';
    if (p === 'HIGH') return 'pitch-color-high';
    return 'pitch-color-none';
  };

  return (
    <div className="game-screen-wrapper">
      {/* Hidden lane for game timing logic */}
      <div ref={laneRef} style={{ position: 'absolute', width: 1, height: HIDDEN_LANE_H, overflow: 'hidden', opacity: 0, pointerEvents: 'none', top: -9999 }} />

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
          {/* ── Pitch display area ── */}
          <div className="pitch-display-area">

            {/* Target pitch rectangle */}
            <div className="pitch-rect-row">
              <div className={`pitch-rect pitch-rect-target ${pitchColorClass(targetPitchLabel)}`}>
                <div className="pitch-rect-label">{t('target-pitch-lbl') || '目標音符'}</div>
                <div className="pitch-rect-value">{pitchDisplayLabel(targetPitchLabel)}</div>
              </div>

              {/* Current (user) pitch rectangle */}
              <div className={`pitch-rect pitch-rect-current ${pitchColorClass(currentPitchLabel)}`}>
                <div className="pitch-rect-label">{t('current-pitch-lbl') || '您的聲音'}</div>
                <div className="pitch-rect-value">{pitchDisplayLabel(currentPitchLabel)}</div>
              </div>
            </div>

          </div>
          
          {/* Stats row: stability + combo + hz — Now acting as a separator */}
          <div className="game-stats-row">
            <div className="step-progress-container">
              <div className="step-progress-bar">
                <div className="step-progress-fill" style={{ width: `${stepProgressPct}%` }} />
              </div>
              <span className="step-progress-label">音符进度</span>
            </div>
            <div className="game-hz-display">
              <span className="hz-display">{hzDisplay}</span>
              <span className="hz-label">{t('hz')}</span>
            </div>
          </div>

          {/* ── Grid Walking – now shows pre-specified pitches ── */}
          <div className="game-split-bottom">
            <div className="grid-game-header">
              <span className="grid-game-title">{t('grid-journey')}</span>
              <span className="grid-game-progress">
                {t('grid-step', { current: Math.min(hitsVal, gridTotal), total: gridTotal })}
              </span>
            </div>
            <div className="grid-board">
              {notePattern.map((pitch, i) => {
                const stepIdx = hitsVal;
                const isCurrent = i === Math.min(stepIdx, gridTotal - 1) && stepIdx < gridTotal;
                const isPassed = i < stepIdx;
                const pitchCls = pitch === 'low' ? 'pitch-color-low' : pitch === 'mid' ? 'pitch-color-mid' : 'pitch-color-high';
                const pitchTxt = pitch === 'low' ? t('calib-lbl-low') : pitch === 'mid' ? t('calib-lbl-mid') : t('calib-lbl-high');
                return (
                  <div key={i} className={`grid-cell${isCurrent ? ' active' : ''}${isPassed ? ' passed' : ''}`}>
                    {isCurrent && <div className="grid-avatar">🚶‍♂️</div>}
                    {isPassed && <div className="grid-check" style={{ fontSize: '1rem', position: 'absolute', top: 2, right: 2 }}>✅</div>}
                    <div className={`grid-pitch-badge ${pitchCls}`}>{pitchTxt}</div>
                  </div>
                );
              })}
              {/* Finish cell */}
              <div className={`grid-cell${hitsVal >= gridTotal ? ' active' : ''}`}>
                🏁
              </div>
            </div>

            <div className="game-bottom">
              <div className="game-song-info">
                <span className="game-song-name">{songName}</span>
                <div className="song-progress-bar">
                  <div className="song-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
              <div className="game-mini-stats">
                <div className="mini-stat"><span className="mini-stat-val">{hitsVal}</span><span className="mini-stat-label">{t('mini-hits')}</span></div>
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
