/* ═══════════════════════════════════════════════════════════════════
   KazooTherapy — app.js
   Main application logic: screen router, audio/pitch engine,
   game loop, session manager, calendar, badges, weekly report
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════
   1. CONSTANTS & CONFIG
   ══════════════════════════════════ */
const VERSION = '1.0.0';

const SESSION_THRESHOLDS = [5 * 60, 10 * 60, 20 * 60]; // seconds
const BADGE_DAYS = [1, 2, 3, 7, 14, 21];

const BADGE_DEFS = [
  { id: 'day1',  day: 1,  icon: '🌱', name: 'First Step',       desc: 'Completed your first training day!' },
  { id: 'day2',  day: 2,  icon: '🌿', name: 'Comeback',         desc: 'Two days of training in the books!' },
  { id: 'day3',  day: 3,  icon: '🎋', name: 'Three Strong',     desc: 'Building a streak — 3 days!' },
  { id: 'day7',  day: 7,  icon: '🔥', name: 'Week Warrior',     desc: 'A full week of oral training!' },
  { id: 'day14', day: 14, icon: '⚡', name: 'Fortnight Force',   desc: 'Two weeks of consistency!' },
  { id: 'day21', day: 21, icon: '🏆', name: 'Iron Jaw',         desc: 'Ultimate 21-day challenge complete!' },
];

const ACCURACY_AWARDS = [
  { id: 'acc80', icon: '🎯', name: 'Sharp Shooter',  criterion: '80%+ accuracy in a session', target: 80 },
  { id: 'acc90', icon: '💎', name: 'Diamond Hum',    criterion: '90%+ accuracy in a session', target: 90 },
  { id: 'acc95', icon: '⭐', name: 'Perfect Resonance', criterion: '95%+ accuracy in a session', target: 95 },
  { id: 'stable', icon: '🌊', name: 'Steady Stream', criterion: 'Stability ≥ 80% in a session', target: 80 },
];

const SONGS = [
  {
    id: 'warmup', name: 'Warm-Up Session', icon: '🌅',
    desc: 'Slow, gentle notes — perfect for beginners',
    bpm: 60, difficulty: 'Easy',
    pattern: generatePattern('warmup'),
  },
  {
    id: 'daily', name: 'Daily Trainer', icon: '🎵',
    desc: 'Moderate rhythm with pitch variety',
    bpm: 72, difficulty: 'Normal',
    pattern: generatePattern('daily'),
  },
  {
    id: 'challenge', name: 'Power Hum', icon: '⚡',
    desc: 'Faster notes, more accuracy required',
    bpm: 90, difficulty: 'Hard',
    pattern: generatePattern('challenge'),
  },
];

const PITCH_ZONES = {
  low:  { label: 'LOW',  hz: 200, color: 'low',  y: 0.75 },
  mid:  { label: 'MID',  hz: 320, color: 'mid',  y: 0.50 },
  high: { label: 'HIGH', hz: 450, color: 'high', y: 0.25 },
};

const SPEED_PX_PER_SEC = { slow: 100, normal: 150, fast: 210 };

function generatePattern(type) {
  const pitches = ['low', 'mid', 'high'];
  const notes = [];
  let t = 2;

  const configs = {
    warmup:    { count: 12, dur: [1.5, 2.5], gap: [1.5, 2.5] },
    daily:     { count: 16, dur: [1.0, 2.0], gap: [1.0, 1.8] },
    challenge: { count: 20, dur: [0.8, 1.5], gap: [0.7, 1.2] },
  };

  const cfg = configs[type];
  for (let i = 0; i < cfg.count; i++) {
    const dur = rnd(cfg.dur[0], cfg.dur[1]);
    const pitch = pitches[Math.floor(Math.random() * 3)];
    notes.push({ start: t, duration: dur, pitch });
    t += dur + rnd(cfg.gap[0], cfg.gap[1]);
  }
  return notes;
}

function rnd(a, b) { return a + Math.random() * (b - a); }

/* ══════════════════════════════════
   2. STATE
   ══════════════════════════════════ */
const App = {
  currentScreen: 'home',
  settings: {
    tolerance: 15,
    speed: 'normal',
    selectedSong: 'warmup',
    calibration: { low: 200, mid: 320, high: 450 },
  },
  game: {
    active: false,
    paused: false,
    startTime: null,
    elapsedSeconds: 0,
    sessionPlaySeconds: 0,   // only counts active play (not paused)
    timerInterval: null,
    song: null,
    notes: [],                // cloned/decorated note objects
    hits: 0,
    misses: 0,
    totalTargetFrames: 0,
    hitFrames: 0,
    combo: 0,
    maxCombo: 0,
    pitchHistory: [],         // frequency values during this session for stability
    currentNote: null,        // note being targeted
    noteHoldFrames: 0,
    animFrame: null,
    lastTimestamp: null,
    songElapsed: 0,
    speedPx: 150,
    noteDomElements: new Map(),
    accuracyHistory: [],
    stabilityScores: [],
    hzWaveHistory: [],        // ring buffer of hz values for waveform display
  },
  mic: {
    stream: null,
    audioCtx: null,
    analyser: null,
    dataArray: null,
    bufferLength: null,
    active: false,
    testActive: false,
    testAnimFrame: null,
    pitchBuffer: [],      // rolling buffer of recent valid hz readings for smoothing
  },
  calendarState: {
    year: 0,
    month: 0,
  },
};

/* ══════════════════════════════════
   3. LOCAL STORAGE HELPERS
   ══════════════════════════════════ */
const DB = {
  key: 'kazoo_therapy_v1',

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || this.defaults();
    } catch { return this.defaults(); }
  },

  save(data) {
    localStorage.setItem(this.key, JSON.stringify(data));
  },

  defaults() {
    return {
      sessions: [],       // { date:'YYYY-MM-DD', durationS, accuracy, stability, hits, misses, song }
      badges: {},         // { day1: '2026-03-19', ... }
      accuracyAwards: {}, // { acc80: true, ... }
      settings: {},
    };
  },

  todayKey() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  },

  getTrainedDays(data) {
    const days = new Set(data.sessions.map(s => s.date));
    return [...days].sort();
  },

  getTotalMinutes(data) {
    return Math.floor(data.sessions.reduce((s, x) => s + x.durationS, 0) / 60);
  },

  getStreak(data) {
    const days = this.getTrainedDays(data).reverse();
    if (!days.length) return 0;
    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0,0,0,0);
    for (const d of days) {
      const dc = new Date(d + 'T00:00:00');
      const diff = Math.round((cursor - dc) / 86400000);
      if (diff === 0 || diff === 1) { streak++; cursor = dc; }
      else break;
    }
    return streak;
  },

  getWeeklySessions(data) {
    const today = new Date(); today.setHours(0,0,0,0);
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const daySessions = data.sessions.filter(s => s.date === key);
      const mins = Math.floor(daySessions.reduce((a, s) => a + s.durationS, 0) / 60);
      const avgAcc = daySessions.length
        ? Math.round(daySessions.reduce((a, s) => a + s.accuracy, 0) / daySessions.length)
        : null;
      week.push({ date: d, key, mins, avgAcc, label: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] });
    }
    return week;
  },
};

/* ══════════════════════════════════
   4. SCREEN ROUTER
   ══════════════════════════════════ */
function nav(screenId) {
  // Stop mic test if navigating away from settings
  if (App.currentScreen === 'settings' && App.mic.testActive) stopMicTest();
  if (App.currentScreen === 'calibration') stopCalibration();

  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  const el = document.getElementById(`screen-${screenId}`);
  if (!el) return;
  el.classList.add('active');
  App.currentScreen = screenId;

  // Init screens on first visit
  switch (screenId) {
    case 'home':     initHome();     break;
    case 'game':     initGame();     break;
    case 'calendar': initCalendar(); break;
    case 'badges':   initBadges();   break;
    case 'report':   initReport();   break;
    case 'settings': initSettings(); break;
    case 'calibration': startCalibration(); break;
  }
  // Scroll to top
  el.scrollTop = 0;
}

/* ══════════════════════════════════
   5. HOME SCREEN
   ══════════════════════════════════ */
function initHome() {
  const data = DB.load();
  const streak = DB.getStreak(data);
  const totalMin = DB.getTotalMinutes(data);
  const badgesEarned = Object.keys(data.badges).length;

  setText('home-streak', streak);
  setText('home-totaltime', totalMin < 60 ? `${totalMin}m` : `${Math.floor(totalMin/60)}h${totalMin%60}m`);
  setText('home-badges', `${badgesEarned}/6`);
}

/* ══════════════════════════════════
   6. TUTORIAL
   ══════════════════════════════════ */
let tutSlide = 0;
const TUT_TOTAL = 5;

function goSlide(idx) {
  document.querySelectorAll('.tutorial-slide').forEach((s, i) => {
    s.classList.toggle('active', i === idx);
  });
  document.querySelectorAll('#tutorial-dots .dot').forEach((d, i) => {
    d.classList.toggle('active', i === idx);
  });
  tutSlide = idx;
  document.getElementById('btn-tut-prev').style.visibility = idx === 0 ? 'hidden' : 'visible';
  document.getElementById('btn-tut-next').textContent = idx === TUT_TOTAL - 1 ? '🎤 Start!' : 'Next →';
}

function tutNext() {
  if (tutSlide < TUT_TOTAL - 1) goSlide(tutSlide + 1);
  else nav('game');
}

function tutPrev() {
  if (tutSlide > 0) goSlide(tutSlide - 1);
}

/* ══════════════════════════════════
   7. AUDIO ENGINE
   ══════════════════════════════════ */
async function requestMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    App.mic.stream = stream;
    App.mic.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    const source = App.mic.audioCtx.createMediaStreamSource(stream);
    App.mic.analyser = App.mic.audioCtx.createAnalyser();
    App.mic.analyser.fftSize = 2048;
    App.mic.bufferLength = App.mic.analyser.fftSize;
    App.mic.dataArray = new Float32Array(App.mic.bufferLength);
    source.connect(App.mic.analyser);
    App.mic.active = true;

    document.getElementById('mic-permission-notice').classList.add('hidden');
    document.getElementById('game-main').classList.remove('hidden');

    startGameLoop();
  } catch (err) {
    showToast('Mic access denied. Please allow microphone use.', 3000);
  }
}

// detectPitch: returns a smoothed pitch using a rolling median of recent valid readings.
// This prevents single-frame dropouts from causing missed notes.
function detectPitch() {
  if (!App.mic.analyser) return -1;
  App.mic.analyser.getFloatTimeDomainData(App.mic.dataArray);
  const raw = autoCorrelate(App.mic.dataArray, App.mic.audioCtx.sampleRate);

  const buf = App.mic.pitchBuffer;
  if (raw > 60 && raw < 1200) {
    buf.push(raw);
    if (buf.length > 5) buf.shift(); // keep last 5 valid readings
  }

  if (buf.length === 0) return -1;

  // Return median of buffer to smooth out noise spikes
  const sorted = [...buf].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function autoCorrelate(buffer, sampleRate) {
  const SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.006) return -1; // lower threshold: detect softer hums

  let r1 = 0, r2 = SIZE - 1;
  const threshold = 0.12; // lower clipping threshold for softer signals
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < threshold) { r2 = SIZE - i; break; }
  }

  const buf2 = buffer.slice(r1, r2);
  const c = new Array(buf2.length).fill(0);
  for (let i = 0; i < buf2.length; i++) {
    for (let j = 0; j < buf2.length - i; j++) {
      c[i] += buf2[j] * buf2[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxVal = -1, maxPos = -1;
  for (let i = d; i < buf2.length; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }

  // Noise filter: require the autocorrelation peak to be at least 35% of the
  // zero-lag energy. Random/environmental noise has a flat autocorrelation and
  // will fail this check; a periodic hum will have a clear peak.
  if (!c[0] || maxVal / c[0] < 0.35) return -1;

  let T0 = maxPos;
  const x1 = c[T0-1], x2 = c[T0], x3 = c[T0+1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 -= b / (2 * a);

  return sampleRate / T0;
}

/* ══════════════════════════════════
   8. GAME ENGINE
   ══════════════════════════════════ */
function initGame() {
  // If mic already active, go straight to game
  if (!App.mic.active) {
    document.getElementById('mic-permission-notice').classList.remove('hidden');
    document.getElementById('game-main').classList.add('hidden');
  } else {
    document.getElementById('mic-permission-notice').classList.add('hidden');
    document.getElementById('game-main').classList.remove('hidden');
    startGameLoop();
  }
}

function startGameLoop() {
  const G = App.game;
  G.active = true;
  G.paused = false;
  G.startTime = Date.now();
  G.elapsedSeconds = 0;
  G.sessionPlaySeconds = 0;
  G.hits = 0;
  G.misses = 0;
  G.combo = 0;
  G.maxCombo = 0;
  G.hitFrames = 0;
  G.totalTargetFrames = 0;
  G.pitchHistory = [];
  G.songElapsed = 0;
  G.lastTimestamp = null;
  G.noteDomElements = new Map();
  G.accuracyHistory = [];
  G.stabilityScores = [];
  G.hzWaveHistory = [];
  App.mic.pitchBuffer = []; // clear smoothing buffer for new session

  // Load song
  const songDef = SONGS.find(s => s.id === App.settings.selectedSong) || SONGS[0];
  G.song = songDef;
  G.speedPx = SPEED_PX_PER_SEC[App.settings.speed] || 150;

  // Deep-copy notes and add state
  G.notes = songDef.pattern.map(n => ({
    ...n,
    state: 'pending',   // pending | active | hit | miss | done
    yPos: null,         // current pixel position from top
    hitFrames: 0,
    totalWindowFrames: 0,
  }));

  setText('game-song-name', songDef.name);
  setText('game-hits', '0');
  setText('game-misses', '0');
  setText('game-notes-left', G.notes.length);
  setText('game-accuracy-val', '--%');
  setText('combo-count', '0');
  setText('hz-display', '--');

  updateThermometer(0);

  // Session timer
  if (G.timerInterval) clearInterval(G.timerInterval);
  G.timerInterval = setInterval(() => {
    if (!G.paused && G.active) {
      G.sessionPlaySeconds++;
      updateTimerDisplay(G.sessionPlaySeconds);
    }
  }, 1000);

  // Clear lane
  const lane = document.getElementById('note-lane');
  lane.querySelectorAll('.game-note').forEach(n => n.remove());

  // Start animation loop
  if (G.animFrame) cancelAnimationFrame(G.animFrame);
  G.animFrame = requestAnimationFrame(gameFrame);
}

function gameFrame(timestamp) {
  const G = App.game;
  if (!G.active) return;
  if (G.paused) { G.animFrame = requestAnimationFrame(gameFrame); return; }

  const dt = G.lastTimestamp ? (timestamp - G.lastTimestamp) / 1000 : 0.016;
  G.lastTimestamp = timestamp;
  G.songElapsed += dt;

  const lane = document.getElementById('note-lane');
  const laneH = lane.clientHeight;
  const targetBottom = laneH * 0.20; // target zone bottom at 20% from bottom
  const targetTop = targetBottom + 60; // target zone top (60px tall)

  // --- Detect pitch ---
  const hz = detectPitch();           // smoothed — used for hit detection
  const rawHz = autoCorrelate(App.mic.dataArray, App.mic.audioCtx.sampleRate); // raw — used for stability

  // Update pitchHistory with raw readings (including silence=0) so stability
  // reflects actual humming consistency, not the smoothed output.
  const histVal = (rawHz > 60 && rawHz < 1200) ? rawHz : 0;
  G.pitchHistory.push(histVal);
  if (G.pitchHistory.length > 120) G.pitchHistory.shift();

  if (hz > 60 && hz < 1200) {
    setText('hz-display', Math.round(hz));

    // Move pitch dot based on calibration range
    const pitchDot = document.getElementById('pitch-dot');
    const pitchRing = document.getElementById('pitch-ring');
    const cLow = App.settings.calibration.low || 200;
    const cHigh = App.settings.calibration.high || 450;
    
    let yPct = 0.75;
    if (cHigh > cLow) {
      yPct = 0.75 - 0.5 * ((hz - cLow) / (cHigh - cLow));
    }
    // Clamp to [0.1, 0.9] to keep the dot visible in the lane
    yPct = Math.max(0.1, Math.min(0.9, yPct));
    
    const dotY = laneH * yPct;
    pitchDot.style.top = `${dotY}px`;
    pitchRing.style.top = `${dotY - 9}px`;
  } else {
    setText('hz-display', '--');
  }

  // --- Update stability thermometer + waveform ---
  const stability = calcStability(G.pitchHistory);
  updateThermometer(stability);
  drawHzWave(hz);

  // --- Update notes ---
  G.notes.forEach(note => {
    if (note.state === 'done') return;

    const timeSinceStart = G.songElapsed - note.start;
    const targetLineY = laneH - targetBottom; // pixels from top

    if (note.state === 'pending' && timeSinceStart > -3) {
      // Create DOM element
      if (!G.noteDomElements.has(note)) {
        const el = createNoteEl(note);
        lane.appendChild(el);
        G.noteDomElements.set(note, el);
        note.state = 'active';
        note.yPos = -50;
      }
    }

    if (note.state === 'active') {
      // Move note downward
      note.yPos = (G.songElapsed - note.start + 3) * G.speedPx;
      const el = G.noteDomElements.get(note);
      if (el) el.style.top = `${note.yPos}px`;

      // Check if note is in target zone
      const noteBottom = note.yPos + 40;
      const noteTop = note.yPos;
      const inZone = noteBottom >= targetLineY - 60 && noteTop <= targetLineY + 60;

      if (inZone) {
        note.totalWindowFrames++;
        G.totalTargetFrames++;
        G.stabilityScores.push(stability);

        if (isOnPitch(hz, note.pitch)) {
          note.hitFrames++;
          G.hitFrames++;
          G.combo++;
          if (G.combo > G.maxCombo) G.maxCombo = G.combo;
          if (el) el.style.boxShadow = `0 0 20px var(--clr-accent)`;
        } else {
          G.combo = 0;
          if (el) el.style.boxShadow = '';
        }

        setText('combo-count', G.combo);
      }

      // Note has passed or expired
      if (note.yPos > laneH + 60) {
        const accuracy = note.totalWindowFrames > 0
          ? note.hitFrames / note.totalWindowFrames
          : 0;

        if (accuracy >= 0.25) {
          G.hits++;
          noteEffect(G.noteDomElements.get(note), 'hit');
          showFeedbackToast(accuracy >= 0.9 ? '🎵 Perfect!' : accuracy >= 0.7 ? '✅ Good!' : '👍 OK');
        } else {
          G.misses++;
          noteEffect(G.noteDomElements.get(note), 'miss');
          if (note.totalWindowFrames > 0) showFeedbackToast('❌ Missed');
          else showFeedbackToast('⚠️ Skipped');
        }
        note.state = 'done';
        updateGameUI(G, stability);
      }
    }
  });

  // --- Song progress ---
  const totalDuration = G.song.pattern.length
    ? G.song.pattern[G.song.pattern.length - 1].start + G.song.pattern[G.song.pattern.length - 1].duration + 2
    : 30;
  const progressPct = Math.min(100, (G.songElapsed / totalDuration) * 100);
  document.getElementById('song-progress-fill').style.width = `${progressPct}%`;
  setText('game-notes-left', G.notes.filter(n => n.state !== 'done').length);

  // Song finished?
  if (G.songElapsed > totalDuration && G.notes.every(n => n.state === 'done')) {
    endGame(stability);
    return;
  }

  G.animFrame = requestAnimationFrame(gameFrame);
}

// Judgment range utilizes the explicit calibration settings + the global tolerance.
function isOnPitch(hz, notePitch) {
  if (hz < 0) return false;
  const targetHz = App.settings.calibration[notePitch] || PITCH_ZONES[notePitch].hz;
  return Math.abs(hz - targetHz) <= App.settings.tolerance;
}

function calcStability(history) {
  if (history.length < 4) return 0;

  const validCount = history.filter(v => v > 0).length;
  if (validCount === 0) return 0;

  const mean = history.reduce((a, v) => a + v, 0) / history.length;
  const variance = history.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / history.length;
  const stdDev = Math.sqrt(variance);
  // Map stdDev to 0–100% stability (lower stdDev = higher stability)
  // stdDev of 0 = 100%, stdDev of 80+ = 0%
  return Math.max(0, Math.min(100, 100 - (stdDev / 80) * 100));
}

function updateThermometer(stabilityPct) {
  const fill = document.getElementById('thermo-fill');
  const indicator = document.getElementById('thermo-indicator');
  fill.style.height = `${stabilityPct}%`;
  indicator.style.bottom = `${stabilityPct}%`;
}

/* Draw a scrolling Hz line chart onto the right-panel canvas.
   Valid hum → coloured line; silence → gap at bottom. */
function drawHzWave(hz) {
  const canvas = document.getElementById('hz-wave-canvas');
  if (!canvas) return;

  // Sync canvas resolution to its CSS display size
  const W = canvas.offsetWidth  || 64;
  const H = canvas.offsetHeight || 160;
  if (canvas.width !== W)  canvas.width  = W;
  if (canvas.height !== H) canvas.height = H;

  const G = App.game;
  // Push current reading (0 = silence)
  const val = (hz > 60 && hz < 1200) ? hz : 0;
  G.hzWaveHistory.push(val);
  if (G.hzWaveHistory.length > W) G.hzWaveHistory.shift(); // one sample per pixel

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Map Hz → Y using calibration values.
  // Set range so LOW / MID / HIGH each occupy exactly 1/3 of the canvas.
  const cLow  = App.settings.calibration.low  || 200;
  const cHigh = App.settings.calibration.high || 450;
  const span  = cHigh - cLow;                 // distance between Low and High
  const HZ_MIN = cLow  - span;                // below LOW (bottom third)
  const HZ_MAX = cHigh + span;                // above HIGH (top third)
  const hzToY = h => H - ((h - HZ_MIN) / (HZ_MAX - HZ_MIN)) * H;

  // Background grid lines at LOW, MID, HIGH (equal thirds)
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.font = '8px sans-serif';
  ctx.lineWidth = 1;
  [Math.round(cLow), Math.round((cLow + cHigh) / 2), Math.round(cHigh)].forEach(mark => {
    const y = hzToY(mark);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    // Fill text slightly above the line
    ctx.fillText(mark, 2, y - 2);
  });

  // ── Red limit lines at (cHigh + tolerance) and (cLow − tolerance) ──
  const tol = App.settings.tolerance || 15;
  const yUpperLimit = hzToY(cHigh + tol);
  const yLowerLimit = hzToY(cLow  - tol);

  ctx.save();
  ctx.strokeStyle = 'rgba(220,30,30,0.85)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);

  // Upper limit line (cHigh + tolerance)
  ctx.beginPath();
  ctx.moveTo(0, yUpperLimit);
  ctx.lineTo(W, yUpperLimit);
  ctx.stroke();

  // Lower limit line (cLow - tolerance)
  ctx.beginPath();
  ctx.moveTo(0, yLowerLimit);
  ctx.lineTo(W, yLowerLimit);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();

  // Build gradient along the line
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,   '#00e5c8');   // top  = high Hz = cyan
  grad.addColorStop(0.5, '#b76cff');   // mid  = purple
  grad.addColorStop(1,   '#ff6b9d');   // low  = pink

  // Draw filled area under the curve
  ctx.beginPath();
  let started = false;
  const hist = G.hzWaveHistory;
  const startX = W - hist.length;

  for (let i = 0; i < hist.length; i++) {
    const x = startX + i;
    if (hist[i] === 0) { started = false; continue; }
    const y = hzToY(hist[i]);
    if (!started) {
      ctx.moveTo(x, H);        // anchor to bottom
      ctx.lineTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  if (started) ctx.lineTo(startX + hist.length - 1, H); // close to bottom

  ctx.closePath();
  ctx.fillStyle = 'rgba(0,229,200,0.12)';
  ctx.fill();

  // Draw the line itself on top
  ctx.beginPath();
  started = false;
  for (let i = 0; i < hist.length; i++) {
    const x = startX + i;
    if (hist[i] === 0) { started = false; continue; }
    const y = hzToY(hist[i]);
    if (!started) { ctx.moveTo(x, y); started = true; }
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Dot at the tip of the current reading
  if (val > 0) {
    const tipX = W - 1;
    const tipY = hzToY(val);
    ctx.beginPath();
    ctx.arc(tipX, tipY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00e5c8';
    ctx.shadowColor = '#00e5c8';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}


function updateGameUI(G, stability) {
  const accuracy = G.totalTargetFrames > 0
    ? Math.round((G.hitFrames / G.totalTargetFrames) * 100)
    : 0;
  setText('game-accuracy-val', `${accuracy}%`);
  setText('game-hits', G.hits);
  setText('game-misses', G.misses);
}

function createNoteEl(note) {
  const el = document.createElement('div');
  el.className = `game-note ${note.pitch}`;
  el.style.top = '-60px';
  el.style.height = `${Math.round(note.duration * 40)}px`;
  el.textContent = note.pitch.toUpperCase();
  return el;
}

function noteEffect(el, type) {
  if (!el) return;
  el.classList.add(type);
  setTimeout(() => el.remove(), 400);
}

function showFeedbackToast(msg) {
  const toast = document.getElementById('feedback-toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), 900);
}

function pauseGame() {
  App.game.paused = true;
  setText('pause-time', formatTime(App.game.sessionPlaySeconds));
  document.getElementById('pause-overlay').classList.remove('hidden');
}

function resumeGame() {
  App.game.paused = false;
  document.getElementById('pause-overlay').classList.add('hidden');
}

function stopGame() {
  const G = App.game;
  G.active = false;
  if (G.timerInterval) clearInterval(G.timerInterval);
  if (G.animFrame) cancelAnimationFrame(G.animFrame);
  nav('home');
}

function endGame(finalStability) {
  const G = App.game;
  G.active = false;
  if (G.timerInterval) clearInterval(G.timerInterval);
  if (G.animFrame) cancelAnimationFrame(G.animFrame);

  const accuracy = G.totalTargetFrames > 0
    ? Math.round((G.hitFrames / G.totalTargetFrames) * 100)
    : 0;

  const avgStability = G.stabilityScores.length
    ? G.stabilityScores.reduce((a, b) => a + b, 0) / G.stabilityScores.length
    : 0;
  const stabilityPct = Math.round(avgStability);
  const durationS = G.sessionPlaySeconds;

  // Save session
  const data = DB.load();
  const today = DB.todayKey();
  const session = {
    date: today,
    durationS,
    accuracy,
    stability: stabilityPct,
    hits: G.hits,
    misses: G.misses,
    song: G.song.id,
  };
  data.sessions.push(session);

  // Check accuracy awards
  ACCURACY_AWARDS.forEach(award => {
    if (award.id === 'stable') {
      if (stabilityPct >= award.target && !data.accuracyAwards[award.id]) {
        data.accuracyAwards[award.id] = true;
      }
    } else {
      if (accuracy >= award.target && !data.accuracyAwards[award.id]) {
        data.accuracyAwards[award.id] = true;
      }
    }
  });

  // Check day badges
  const trainedDays = DB.getTrainedDays(data);
  const totalDays = trainedDays.length;
  let newBadge = null;
  BADGE_DEFS.forEach(b => {
    if (totalDays >= b.day && !data.badges[b.id]) {
      data.badges[b.id] = today;
      if (!newBadge) newBadge = b;
    }
  });

  DB.save(data);

  // Show results
  nav('results');
  showResults(accuracy, stabilityPct, durationS, G.hits, G.hits + G.misses, newBadge, today);
}

/* ══════════════════════════════════
   9. RESULTS SCREEN
   ══════════════════════════════════ */
function showResults(accuracy, stability, durationS, hits, total, newBadge, dateKey) {
  // Determine emoji icon based on accuracy
  const icon = accuracy >= 90 ? '🏆' : accuracy >= 75 ? '🎉' : accuracy >= 50 ? '👍' : '💪';
  const title = accuracy >= 90 ? 'Excellent!' : accuracy >= 75 ? 'Great Job!' : accuracy >= 50 ? 'Keep Going!' : 'Good Effort!';

  setText('results-icon', icon);
  setText('results-title', title);

  const stabilityLabel = stability >= 80 ? 'Super Stable 🟢' : stability >= 60 ? 'Good 🟡' : stability >= 40 ? 'Fair 🟠' : 'Erratic 🔴';
  setText('res-accuracy', `${accuracy}%`);
  setText('res-stability', `${stability}%`);
  setText('res-stability-label', stabilityLabel);
  setText('res-time', formatTime(durationS));
  setText('res-notes', `${hits}/${total}`);

  // Animate accuracy bar
  setTimeout(() => {
    const bar = document.getElementById('res-acc-bar');
    if (bar) bar.style.width = `${accuracy}%`;
  }, 300);

  // Badge unlock display
  const badgeArea = document.getElementById('badge-unlock-area');
  if (newBadge) {
    badgeArea.style.display = 'block';
    setText('unlocked-badge-display', newBadge.icon);
  } else {
    badgeArea.style.display = 'none';
  }

  // Calendar note
  const calText = `📅 ${getReadableDate(dateKey)} logged on your calendar!`;
  setText('results-cal-text', calText);

  // Flash badge
  if (newBadge) setTimeout(() => showBadgeFlash(newBadge), 1000);
}

/* ══════════════════════════════════
   10. CALENDAR SCREEN
   ══════════════════════════════════ */
function initCalendar() {
  const now = new Date();
  App.calendarState.year = now.getFullYear();
  App.calendarState.month = now.getMonth();
  renderCalendar();
}

function renderCalendar() {
  const { year, month } = App.calendarState;
  const data = DB.load();
  const trainedDays = new Set(DB.getTrainedDays(data));
  const streak = DB.getStreak(data);
  const totalDays = trainedDays.size;

  setText('cal-streak-num', streak);
  setText('cal-total-days', totalDays);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  setText('cal-month-label', `${MONTHS[month]} ${year}`);

  // Build grid
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = DB.todayKey();

  // Empty cells
  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day empty';
    grid.appendChild(cell);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (key === today) cell.classList.add('today');
    if (trainedDays.has(key)) {
      cell.classList.add('trained');
      cell.innerHTML = `<span>${d}</span><span class="cal-day-note">🎵</span>`;
    } else {
      cell.textContent = d;
    }
    grid.appendChild(cell);
  }

  // Milestone badges
  renderMilestoneBadges(data, totalDays);
}

function calPrevMonth() {
  App.calendarState.month--;
  if (App.calendarState.month < 0) { App.calendarState.month = 11; App.calendarState.year--; }
  renderCalendar();
}
function calNextMonth() {
  App.calendarState.month++;
  if (App.calendarState.month > 11) { App.calendarState.month = 0; App.calendarState.year++; }
  renderCalendar();
}

function renderMilestoneBadges(data, totalDays) {
  const fill = document.getElementById('milestone-fill');
  const pct = Math.min(100, (totalDays / 21) * 100);
  fill.style.width = `${pct}%`;

  // Color milestone markers
  BADGE_DEFS.forEach(b => {
    const el = document.getElementById(`mile-${b.day}`);
    if (el && totalDays >= b.day) el.classList.add('reached');
    else if (el) el.classList.remove('reached');
  });

  // Badge icons row
  const row = document.getElementById('milestone-badges-row');
  row.innerHTML = '';
  BADGE_DEFS.forEach(b => {
    const unlocked = !!data.badges[b.id];
    row.innerHTML += `
      <div class="mile-badge-item">
        <div class="mile-badge-icon ${unlocked ? 'unlocked' : ''}">${b.icon}</div>
        <div class="mile-badge-label">Day ${b.day}</div>
      </div>`;
  });
}

/* ══════════════════════════════════
   11. BADGES SCREEN
   ══════════════════════════════════ */
function initBadges() {
  const data = DB.load();
  const earned = Object.keys(data.badges).length;

  setText('badges-count', earned);

  const grid = document.getElementById('badge-grid');
  grid.innerHTML = '';
  BADGE_DEFS.forEach(b => {
    const unlocked = !!data.badges[b.id];
    const date = data.badges[b.id] ? getReadableDate(data.badges[b.id]) : '';
    grid.innerHTML += `
      <div class="badge-item ${unlocked ? 'unlocked' : ''}">
        <div class="badge-item-icon">${b.icon}</div>
        <div class="badge-item-title">${b.name}</div>
        <div class="badge-item-sub">Day ${b.day}</div>
        ${unlocked ? `<div class="badge-item-date">${date}</div>` : '<div class="badge-item-sub">🔒 Locked</div>'}
      </div>`;
  });

  // Accuracy awards
  const aGrid = document.getElementById('award-grid');
  aGrid.innerHTML = '';
  ACCURACY_AWARDS.forEach(a => {
    const unlocked = !!data.accuracyAwards[a.id];
    aGrid.innerHTML += `
      <div class="award-item ${unlocked ? 'unlocked' : ''}">
        <div class="award-icon">${a.icon}</div>
        <div class="award-info">
          <div class="award-name">${a.name}</div>
          <div class="award-crit">${a.criterion}</div>
        </div>
      </div>`;
  });
}

/* ══════════════════════════════════
   12. WEEKLY REPORT
   ══════════════════════════════════ */
function initReport() {
  const data = DB.load();
  const week = DB.getWeeklySessions(data);

  const start = week[0].date;
  const end = week[6].date;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  setText('report-period', `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`);

  const daysTrained = week.filter(d => d.mins > 0).length;
  const totalMins = week.reduce((a, d) => a + d.mins, 0);
  const accs = week.filter(d => d.avgAcc !== null).map(d => d.avgAcc);
  const avgAcc = accs.length ? Math.round(accs.reduce((a, v) => a + v, 0) / accs.length) : null;

  // Get avg stability from last 7 sessions
  const recentSessions = data.sessions.slice(-7);
  const avgStab = recentSessions.length
    ? Math.round(recentSessions.reduce((a, s) => a + s.stability, 0) / recentSessions.length)
    : null;

  setText('rpt-days', daysTrained);
  setText('rpt-time', totalMins < 60 ? `${totalMins}m` : `${Math.floor(totalMins/60)}h${totalMins%60}m`);
  setText('rpt-acc', avgAcc !== null ? `${avgAcc}%` : '--');
  setText('rpt-stab', avgStab !== null ? `${avgStab}%` : '--');

  // Bar chart
  const chart = document.getElementById('bar-chart');
  chart.innerHTML = '';
  const maxMins = Math.max(...week.map(d => d.mins), 20);
  const todayKey = DB.todayKey();

  week.forEach(d => {
    const pct = maxMins > 0 ? (d.mins / maxMins) * 100 : 0;
    const isToday = d.key === todayKey;
    const goalMet = d.mins >= 20;
    chart.innerHTML += `
      <div class="bar-chart-col">
        <div class="bar-val">${d.mins > 0 ? d.mins+'m' : ''}</div>
        <div class="bar-seg-wrap">
          <div class="bar-seg ${isToday ? 'today' : ''} ${goalMet ? 'goal-met' : ''}" style="height:${pct}%"></div>
        </div>
        <div class="bar-label">${d.label}</div>
      </div>`;
  });

  // Frequency level (F1–F5)
  const totalTrainedDays = DB.getTrainedDays(data).length;
  const freqLvl = totalTrainedDays >= 21 ? 5
    : totalTrainedDays >= 14 ? 4
    : totalTrainedDays >= 7  ? 3
    : totalTrainedDays >= 3  ? 2
    : 1;

  const freqDescs = {
    1: 'Getting started! Train more days to level up.',
    2: 'F2 — Building a habit! 7 days to reach F3.',
    3: 'F3 — Halfway to mastery! Keep it up.',
    4: 'F4 — Advanced trainer! Just 7 more days for F5.',
    5: 'F5 — Master-level consistency! 🏆',
  };
  setText('freq-level-badge', `F${freqLvl}`);
  setText('freq-level-desc', freqDescs[freqLvl]);

  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`freq-f${i}`);
    if (el) el.classList.toggle('active', i <= freqLvl);
  }

  // Accuracy trend
  const trend = document.getElementById('accuracy-trend');
  trend.innerHTML = '';
  week.forEach(d => {
    const pct = d.avgAcc !== null ? d.avgAcc : 0;
    trend.innerHTML += `
      <div class="trend-dot-col">
        <div class="trend-seg-wrap">
          <div class="trend-dot" style="height:${pct}%"></div>
        </div>
        <div class="trend-label">${d.label}</div>
      </div>`;
  });
}

/* ══════════════════════════════════
   13. SETTINGS
   ══════════════════════════════════ */
function initSettings() {
  const el = document.getElementById('pitch-tolerance-slider');
  el.value = App.settings.tolerance || 15;
  setText('tolerance-val', `±${App.settings.tolerance || 15} Hz`);

  // Speed buttons
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.speed === App.settings.speed);
  });

  // Song list
  const songSel = document.getElementById('song-select');
  songSel.innerHTML = '';
  SONGS.forEach(s => {
    songSel.innerHTML += `
      <div class="song-option ${App.settings.selectedSong === s.id ? 'selected' : ''}" onclick="selectSong('${s.id}')">
        <div class="song-option-icon">${s.icon}</div>
        <div class="song-option-info">
          <div class="song-opt-name">${s.name}</div>
          <div class="song-opt-desc">${s.desc} · ${s.difficulty}</div>
        </div>
      </div>`;
  });
}

function updateTolerance(val) {
  App.settings.tolerance = parseInt(val);
  setText('tolerance-val', `±${val} Hz`);
}

function setSpeed(btn) {
  App.settings.speed = btn.dataset.speed;
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', b === btn));
}

function selectSong(id) {
  App.settings.selectedSong = id;
  document.querySelectorAll('.song-option').forEach(el => {
    el.classList.toggle('selected', el.onclick.toString().includes(`'${id}'`));
  });
  initSettings(); // Re-render to reflect selection
}

/* Mic test */
function toggleMicTest() {
  if (App.mic.testActive) stopMicTest();
  else startMicTest();
}

async function startMicTest() {
  if (!App.mic.active) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      App.mic.stream = stream;
      App.mic.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
      const source = App.mic.audioCtx.createMediaStreamSource(stream);
      App.mic.analyser = App.mic.audioCtx.createAnalyser();
      App.mic.analyser.fftSize = 2048;
      App.mic.bufferLength = App.mic.analyser.fftSize;
      App.mic.dataArray = new Float32Array(App.mic.bufferLength);
      source.connect(App.mic.analyser);
      App.mic.active = true;
    } catch { return; }
  }

  App.mic.testActive = true;
  setText('btn-mic-test', '⏹ Stop Test');
  micTestLoop();
}

function stopMicTest() {
  App.mic.testActive = false;
  if (App.mic.testAnimFrame) cancelAnimationFrame(App.mic.testAnimFrame);
  setText('btn-mic-test', '🎤 Test Mic');
  setText('mic-test-hz', '-- Hz');
  document.querySelectorAll('.mic-bar').forEach(b => b.style.height = '20%');
}

function micTestLoop() {
  if (!App.mic.testActive) return;
  const hz = detectPitch();
  if (hz > 60 && hz < 1200) setText('mic-test-hz', `${Math.round(hz)} Hz`);
  else setText('mic-test-hz', 'Hum to test…');

  // Animate bars with amplitude
  if (App.mic.analyser) {
    const arr = new Uint8Array(App.mic.analyser.frequencyBinCount);
    App.mic.analyser.getByteFrequencyData(arr);
    const bars = document.querySelectorAll('.mic-bar');
    bars.forEach((b, i) => {
      const idx = Math.floor((i / bars.length) * arr.length * 0.3);
      const h = Math.max(10, (arr[idx] / 255) * 100);
      b.style.height = `${h}%`;
    });
  }
  App.mic.testAnimFrame = requestAnimationFrame(micTestLoop);
}

/* ══════════════════════════════════
   14. CALIBRATION
   ══════════════════════════════════ */
let calibStep = 0; // 0 = low, 1 = mid, 2 = high
const CALIB_STEPS = [
  { id: 'low', title: 'Low Note', desc: 'Hum a low, deep pitch.' },
  { id: 'mid', title: 'Mid Note', desc: 'Hum a comfortable, medium pitch.' },
  { id: 'high', title: 'High Note', desc: 'Hum a high, steady pitch.' }
];

async function startCalibration() {
  if (!App.mic.active) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      App.mic.stream = stream;
      App.mic.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
      const source = App.mic.audioCtx.createMediaStreamSource(stream);
      App.mic.analyser = App.mic.audioCtx.createAnalyser();
      App.mic.analyser.fftSize = 2048;
      App.mic.bufferLength = App.mic.analyser.fftSize;
      App.mic.dataArray = new Float32Array(App.mic.bufferLength);
      source.connect(App.mic.analyser);
      App.mic.active = true;
    } catch { 
      showToast('Mic access denied.', 3000);
      return; 
    }
  }

  calibStep = 0;
  updateCalibrationUI();
  App.mic.testActive = true;
  calibrationLoop();
}

function stopCalibration() {
  App.mic.testActive = false;
  if (App.mic.testAnimFrame) cancelAnimationFrame(App.mic.testAnimFrame);
}

function updateCalibrationUI() {
  if (calibStep < 3) {
    const step = CALIB_STEPS[calibStep];
    setText('calib-step-title', step.title);
    setText('calib-step-desc', step.desc);
    setText('btn-calib-record', `Record ${step.title.split(' ')[0]}`);
    document.getElementById('btn-calib-record').classList.remove('btn-success');
    document.getElementById('btn-calib-record').classList.add('btn-primary');
  } else {
    setText('calib-step-title', 'Calibration Complete!');
    setText('calib-step-desc', 'Your kazoo pitches have been saved.');
    setText('btn-calib-record', 'Back to Settings');
    document.getElementById('btn-calib-record').classList.remove('btn-primary');
    document.getElementById('btn-calib-record').classList.add('btn-success'); // Assuming a success class exists or uses primary
  }

  setText('calib-val-low', App.settings.calibration.low);
  setText('calib-val-mid', App.settings.calibration.mid);
  setText('calib-val-high', App.settings.calibration.high);
}

function recordCalibrationStep() {
  if (calibStep >= 3) {
    const data = DB.load();
    data.settings = App.settings;
    DB.save(data);
    nav('settings');
    return;
  }

  const hzDisplay = document.getElementById('calib-live-hz').textContent;
  const hz = parseInt(hzDisplay);
  if (isNaN(hz) || hz < 60) {
    showToast("Couldn't hear a steady pitch, please try again.");
    return;
  }

  const stepKey = CALIB_STEPS[calibStep].id;
  App.settings.calibration[stepKey] = hz;
  
  calibStep++;
  updateCalibrationUI();
  
  if (calibStep >= 3) {
    showToast("All pitches configured successfully!");
  }
}

function calibrationLoop() {
  if (!App.mic.testActive || App.currentScreen !== 'calibration') return;
  const hz = detectPitch();
  if (hz > 60 && hz < 1200) setText('calib-live-hz', Math.round(hz));
  else setText('calib-live-hz', '--');

  App.mic.testAnimFrame = requestAnimationFrame(calibrationLoop);
}

/* ══════════════════════════════════
   15. BADGE FLASH
   ══════════════════════════════════ */
function showBadgeFlash(badge) {
  setText('flash-badge-icon', badge.icon);
  setText('flash-badge-name', badge.name);
  setText('flash-badge-desc', badge.desc);
  document.getElementById('global-badge-flash').classList.remove('hidden');
}

function closeBadgeFlash() {
  document.getElementById('global-badge-flash').classList.add('hidden');
}

/* ══════════════════════════════════
   16. CONFIRM DIALOG
   ══════════════════════════════════ */
function confirmClearData() {
  const dlg = document.getElementById('confirm-dialog');
  dlg.classList.remove('hidden');
  setText('confirm-title', 'Clear All Data?');
  setText('confirm-msg', 'This will erase ALL sessions, badges, and calendar data. This cannot be undone.');
  document.getElementById('confirm-ok').onclick = () => {
    DB.save(DB.defaults());
    closeConfirm();
    showToast('All data cleared! 🗑️');
    initHome();
  };
}

function closeConfirm() {
  document.getElementById('confirm-dialog').classList.add('hidden');
}

/* ══════════════════════════════════
   17. UTILITY FUNCTIONS
   ══════════════════════════════════ */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function updateTimerDisplay(seconds) {
  setText('session-timer', formatTime(seconds));
}

function getReadableDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${MONTHS[m-1]} ${d}, ${y}`;
}

function showToast(msg, duration = 2000) {
  // Reuse feedback toast for global notifications
  const toast = document.getElementById('feedback-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toast._toastTimer);
  toast._toastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
}

/* ══════════════════════════════════
   18. BOOT
   ══════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Init home on load
  nav('home');

  // Set tutorial to first slide
  goSlide(0);

  // Load saved settings
  const data = DB.load();
  if (data.settings) {
    Object.assign(App.settings, data.settings);
    if (!App.settings.tolerance || App.settings.tolerance > 50) App.settings.tolerance = 15;
  }

  // Re-generate song patterns (they're random, which is fine for a training game)
  SONGS.forEach(s => { s.pattern = generatePattern(s.id); });

  console.log(`KazooTherapy v${VERSION} loaded`);
});

// Handle back button / browser navigation within the app
window.addEventListener('popstate', () => nav('home'));
