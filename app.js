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

/* ══════════════════════════════════
   i18n TRANSLATIONS
   ══════════════════════════════════ */
const LANG = {
  en: {
    /* Home */
    'logo-sub': 'Oral Muscle Training · Rhythm Game',
    'home-streak-lbl': 'Day Streak',
    'home-totaltime-lbl': 'Total Time',
    'home-badges-lbl': 'Badges',
    'btn-start': 'Start Training',
    'btn-calendar': 'Calendar',
    'btn-report': 'Report',
    'btn-badges': 'Badges',
    'btn-settings': 'Settings',
    'home-footer': 'Hold phone upright · Hum into microphone',
    /* Tutorial */
    'tut-header': 'How to Play',
    'tut0-title': 'Hold Your Phone Upright',
    'tut0-desc': 'Keep your phone vertical, microphone facing up toward your mouth at about 15–20cm distance.',
    'tut1-title': 'Hum Like a Kazoo',
    'tut1-desc': 'Close your lips and hum steadily through your nose — like humming "mmmmm". This activates your oral and jaw muscles.',
    'tut2-title': 'Match the Falling Notes',
    'tut2-desc': 'Notes fall from the top. When a note reaches the Target Zone, hum steadily to score. Keep your pitch stable for bonus accuracy!',
    'tut-target': 'TARGET',
    'tut3-title': 'Watch Your Stability',
    'tut3-desc': 'The Stability Thermometer shows how steady your hum is. Aim for the green zone — consistent muscle control = better rehabilitation!',
    'tut-stable': 'Stable!',
    'tut-erratic': 'Erratic',
    'tut4-title': 'Build Your Streak',
    'tut4-desc': 'Train for ≥20 minutes to complete a session. Earn badges on Day 1, 2, 3, 7, 14, and 21. Check your weekly report to see your progress!',
    'btn-tut-prev': '← Back',
    'btn-tut-next': 'Next →',
    /* Calibration */
    'calib-header': 'Kazoo Calibration',
    'calib-desc': 'Hum the target note steadily into the microphone, then press the Record button.',
    'calib-lbl-low': 'LOW',
    'calib-lbl-mid': 'MID',
    'calib-lbl-high': 'HIGH',
    'btn-calib-record': 'Record Pitch',
    /* Calibration dynamic */
    'calib-step-low-title': 'Low Note',
    'calib-step-low-desc': 'Hum a low, deep pitch.',
    'calib-step-mid-title': 'Mid Note',
    'calib-step-mid-desc': 'Hum a comfortable, medium pitch.',
    'calib-step-high-title': 'High Note',
    'calib-step-high-desc': 'Hum a high, steady pitch.',
    'calib-done-title': 'Calibration Complete!',
    'calib-done-desc': 'Your kazoo pitches have been saved.',
    'calib-btn-low': 'Record Low',
    'calib-btn-mid': 'Record Mid',
    'calib-btn-high': 'Record High',
    'calib-btn-done': 'Back to Settings',
    'calib-err-pitch': "Couldn't hear a steady pitch, please try again.",
    'calib-success': 'All pitches configured successfully!',
    'calib-mic-denied': 'Mic access denied.',
    /* Game */
    'session-lbl': 'SESSION TIME',
    'chip-acc-lbl': 'Accuracy',
    'mic-h3': 'Microphone Access Required',
    'mic-desc': 'KazooTherapy needs your microphone to detect your humming. Tap below to grant access.',
    'btn-grant-mic': 'Allow Microphone',
    'thermo-lbl-stable': 'STABLE',
    'thermo-lbl-erratic': 'ERRATIC',
    'combo-lbl': 'COMBO',
    'mini-lbl-hits': 'Hits',
    'mini-lbl-misses': 'Misses',
    'mini-lbl-left': 'Left',
    'pause-title': 'Paused',
    'pause-time-lbl': 'Session time:',
    'btn-resume': '▶ Resume',
    'btn-quit': '✕ Quit Session',
    /* Feedback toasts */
    'toast-perfect': '🎵 Perfect!',
    'toast-good': '✅ Good!',
    'toast-ok': '👍 OK',
    'toast-missed': '❌ Missed',
    'toast-skipped': '⚠️ Skipped',
    'toast-mic-denied': 'Mic access denied. Please allow microphone use.',
    'toast-data-cleared': 'All data cleared! 🗑️',
    'toast-hum-test': 'Hum to test…',
    /* Results */
    'res-acc-lbl': 'Accuracy',
    'res-stab-lbl': 'Stability',
    'res-time-lbl': 'Time Trained',
    'res-notes-lbl': 'Notes Hit',
    'badge-unlock-h3': '🏆 Badge Unlocked!',
    'btn-play-again': '🔄 Play Again',
    'btn-res-calendar': '📅 Calendar',
    'btn-res-home': '🏠 Home',
    /* Results dynamic */
    'results-sub': 'Great work on your oral training!',
    'results-cal-prefix': '📅',
    'results-cal-suffix': 'logged on your calendar!',
    'results-stab-super': 'Super Stable 🟢',
    'results-stab-good': 'Good 🟡',
    'results-stab-fair': 'Fair 🟠',
    'results-stab-erratic': 'Erratic 🔴',
    'results-title-excellent': 'Excellent!',
    'results-title-great': 'Great Job!',
    'results-title-keep': 'Keep Going!',
    'results-title-effort': 'Good Effort!',
    /* Calendar */
    'cal-header': 'Training Calendar',
    'cal-streak-lbl': 'Day Streak',
    'cal-total-lbl': 'Total Days',
    'cal-sun': 'Sun', 'cal-mon': 'Mon', 'cal-tue': 'Tue', 'cal-wed': 'Wed',
    'cal-thu': 'Thu', 'cal-fri': 'Fri', 'cal-sat': 'Sat',
    'cal-day-labels': ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    'mile-header': 'Milestone Progress',
    /* Badges */
    'badges-header': 'Achievements',
    'badges-unlocked-lbl': 'Badges Unlocked',
    'awards-header': 'Accuracy Awards',
    /* Months */
    'months-long': ['January','February','March','April','May','June','July','August','September','October','November','December'],
    'months-short': ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    /* Report */
    'report-header': 'Weekly Report',
    'rpt-days-lbl': 'Days Trained',
    'rpt-time-lbl': 'Total Time',
    'rpt-acc-lbl': 'Avg Accuracy',
    'rpt-stab-lbl': 'Avg Stability',
    'chart-title-time': 'Daily Training Time (min)',
    'chart-title-freq': 'Frequency Level',
    'chart-title-trend': 'Accuracy Trend',
    'freq-descs': {
      1: 'Getting started! Train more days to level up.',
      2: 'F2 — Building a habit! 7 days to reach F3.',
      3: 'F3 — Halfway to mastery! Keep it up.',
      4: 'F4 — Advanced trainer! Just 7 more days for F5.',
      5: 'F5 — Master-level consistency! 🏆',
    },
    /* Settings */
    'settings-header': 'Settings',
    'set-mic-title': 'Microphone Test',
    'btn-mic-test': '🎤 Test Mic',
    'btn-mic-stop': '⏹ Stop Test',
    'set-calib-title': 'Kazoo Calibration',
    'set-calib-desc': 'Calibrate your Low, Mid, and High kazoo pitches for accurate game scoring.',
    'btn-calib-pitches': '⚙️ Calibrate Pitches',
    'set-tol-title': 'Pitch Tolerance',
    'set-tol-desc': 'How forgiving the pitch detection is. Higher = easier.',
    'tol-strict': 'Strict',
    'tol-relaxed': 'Relaxed',
    'tol-prefix': 'Tolerance:',
    'set-speed-title': 'Game Speed',
    'speed-slow': '🐢 Slow',
    'speed-normal': '🎵 Normal',
    'speed-fast': '⚡ Fast',
    'set-song-title': 'Song / Pattern',
    'set-data-title': 'Data Management',
    'btn-clear-data': '🗑 Clear All Data',
    'set-data-desc': 'This will erase all your sessions, badges, and calendar progress.',
    /* Confirm */
    'confirm-clear-title': 'Clear All Data?',
    'confirm-clear-msg': 'This will erase ALL sessions, badges, and calendar data. This cannot be undone.',
    'btn-cancel': 'Cancel',
    'btn-confirm-yes': 'Yes, Delete',
    /* Badge flash */
    'flash-badge-h2': 'Badge Unlocked!',
    'btn-close-flash': 'Awesome! 🎉',
    /* Songs */
    'song-warmup-name': 'Warm-Up Session',
    'song-warmup-desc': 'Slow, gentle notes — perfect for beginners',
    'song-daily-name': 'Daily Trainer',
    'song-daily-desc': 'Moderate rhythm with pitch variety',
    'song-challenge-name': 'Power Hum',
    'song-challenge-desc': 'Faster notes, more accuracy required',
    /* Badges */
    'badge-day1-name': 'First Step',      'badge-day1-desc': 'Completed your first training day!',
    'badge-day2-name': 'Comeback',        'badge-day2-desc': 'Two days of training in the books!',
    'badge-day3-name': 'Three Strong',    'badge-day3-desc': 'Building a streak — 3 days!',
    'badge-day7-name': 'Week Warrior',    'badge-day7-desc': 'A full week of oral training!',
    'badge-day14-name': 'Fortnight Force','badge-day14-desc': 'Two weeks of consistency!',
    'badge-day21-name': 'Iron Jaw',       'badge-day21-desc': 'Ultimate 21-day challenge complete!',
  },
  zh: {
    /* Home */
    'logo-sub': '口腔肌肉訓練 · 節奏遊戲',
    'home-streak-lbl': '連續天數',
    'home-totaltime-lbl': '總時長',
    'home-badges-lbl': '徽章',
    'btn-start': '開始訓練',
    'btn-calendar': '行事曆',
    'btn-report': '報告',
    'btn-badges': '徽章',
    'btn-settings': '設定',
    'home-footer': '手機直立 · 對麥克風哼鳴',
    /* Tutorial */
    'tut-header': '玩法說明',
    'tut0-title': '直立持機',
    'tut0-desc': '將手機垂直拿好，麥克風朝上，距離嘴巴約 15–20 公分。',
    'tut1-title': '像卡祖笛一樣哼鳴',
    'tut1-desc': '閉上嘴唇，用鼻腔穩定哼鳴——就像哼「嗯嗯嗯」。這能鍛鍊您的口腔與下頷肌肉。',
    'tut2-title': '跟上下落的音符',
    'tut2-desc': '音符從頂部落下。當音符到達目標區時，穩定哼鳴即可得分。保持音調穩定可獲得額外準確率！',
    'tut-target': '目標',
    'tut3-title': '關注穩定性',
    'tut3-desc': '穩定性溫度計顯示您哼鳴的穩定程度。目標是綠色區域——肌肉控制越一致，復健效果越好！',
    'tut-stable': '穩定！',
    'tut-erratic': '不穩定',
    'tut4-title': '建立連續記錄',
    'tut4-desc': '訓練 ≥20 分鐘可完成一次訓練。在第 1、2、3、7、14 和 21 天獲得徽章。查看每週報告了解您的進度！',
    'btn-tut-prev': '← 返回',
    'btn-tut-next': '下一步 →',
    /* Calibration */
    'calib-header': '卡祖笛校準',
    'calib-desc': '對著麥克風穩定哼出目標音，然後按下錄製按鈕。',
    'calib-lbl-low': '低音',
    'calib-lbl-mid': '中音',
    'calib-lbl-high': '高音',
    'btn-calib-record': '錄製音調',
    /* Calibration dynamic */
    'calib-step-low-title': '低音',
    'calib-step-low-desc': '哼出一個低沉的音調。',
    'calib-step-mid-title': '中音',
    'calib-step-mid-desc': '哼出一個舒適的中間音調。',
    'calib-step-high-title': '高音',
    'calib-step-high-desc': '哼出一個高而穩定的音調。',
    'calib-done-title': '校準完成！',
    'calib-done-desc': '您的哼鳴音調已儲存。',
    'calib-btn-low': '錄製低音',
    'calib-btn-mid': '錄製中音',
    'calib-btn-high': '錄製高音',
    'calib-btn-done': '返回設定',
    'calib-err-pitch': '未能偵測到穩定音調，請再試一次。',
    'calib-success': '所有音調配置成功！',
    'calib-mic-denied': '麥克風存取被拒。',
    /* Game */
    'session-lbl': '訓練時間',
    'chip-acc-lbl': '準確率',
    'mic-h3': '需要麥克風權限',
    'mic-desc': 'KazooTherapy 需要使用您的麥克風來偵測哼鳴。請點擊下方授予權限。',
    'btn-grant-mic': '允許麥克風',
    'thermo-lbl-stable': '穩定',
    'thermo-lbl-erratic': '不穩',
    'combo-lbl': '連擊',
    'mini-lbl-hits': '步数',
    'mini-lbl-misses': '失誤',
    
    'pause-title': '已暫停',
    'pause-time-lbl': '訓練時間：',
    'btn-resume': '▶ 繼續',
    'btn-quit': '✕ 退出訓練',
    /* Feedback toasts */
    'toast-perfect': '🎵 完美！',
    'toast-good': '✅ 很好！',
    'toast-ok': '👍 還行',
    'toast-missed': '❌ 失誤',
    'toast-skipped': '⚠️ 跳過',
    'toast-mic-denied': '麥克風存取被拒，請允許使用麥克風。',
    'toast-data-cleared': '所有資料已清除！🗑️',
    'toast-hum-test': '請哼鳴以測試…',
    /* Results */
    'res-acc-lbl': '準確率',
    'res-stab-lbl': '穩定性',
    'res-time-lbl': '訓練時長',
    'res-notes-lbl': '步数',
    'badge-unlock-h3': '🏆 解鎖徽章！',
    'btn-play-again': '🔄 再玩一次',
    'btn-res-calendar': '📅 行事曆',
    'btn-res-home': '🏠 主頁',
    /* Results dynamic */
    'results-sub': '繼續保持您的口腔訓練！',
    'results-cal-prefix': '📅',
    'results-cal-suffix': '已記錄在您的行事曆！',
    'results-stab-super': '超穩定 🟢',
    'results-stab-good': '良好 🟡',
    'results-stab-fair': '普通 🟠',
    'results-stab-erratic': '不穩定 🔴',
    'results-title-excellent': '太棒了！',
    'results-title-great': '做得好！',
    'results-title-keep': '繼續加油！',
    'results-title-effort': '很努力！',
    /* Calendar */
    'cal-header': '訓練行事曆',
    'cal-streak-lbl': '連續天數',
    'cal-total-lbl': '總天數',
    'cal-sun': '日', 'cal-mon': '一', 'cal-tue': '二', 'cal-wed': '三',
    'cal-thu': '四', 'cal-fri': '五', 'cal-sat': '六',
    'cal-day-labels': ['日','一','二','三','四','五','六'],
    'mile-header': '里程碑進度',
    /* Badges */
    'badges-header': '成就',
    'badges-unlocked-lbl': '個徽章已解鎖',
    'awards-header': '準確率獎項',
    /* Months */
    'months-long': ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'],
    'months-short': ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    /* Report */
    'report-header': '每週報告',
    'rpt-days-lbl': '訓練天數',
    'rpt-time-lbl': '總時長',
    'rpt-acc-lbl': '平均準確率',
    'rpt-stab-lbl': '平均穩定性',
    'chart-title-time': '每日訓練時間（分鐘）',
    'chart-title-freq': '頻率等級',
    'chart-title-trend': '準確率趨勢',
    'freq-descs': {
      1: '剛剛開始！多訓練幾天以提升等級。',
      2: 'F2 — 養成習慣！再訓練 7 天達到 F3。',
      3: 'F3 — 邁向精通的一半！繼續加油。',
      4: 'F4 — 進階訓練者！再 7 天即達 F5。',
      5: 'F5 — 大師級堅持！🏆',
    },
    /* Settings */
    'settings-header': '設定',
    'set-mic-title': '麥克風測試',
    'btn-mic-test': '🎤 測試麥克風',
    'btn-mic-stop': '⏹ 停止測試',
    'set-calib-title': '卡祖笛校準',
    'set-calib-desc': '校準您的低、中、高哼鳴音調，以獲得精確的遊戲評分。',
    'btn-calib-pitches': '⚙️ 校準音調',
    'set-tol-title': '音調容差',
    'set-tol-desc': '音調偵測的容許範圍。數值越高越容易。',
    'tol-strict': '嚴格',
    'tol-relaxed': '寬鬆',
    'tol-prefix': '容差：',
    'set-speed-title': '遊戲速度',
    'speed-slow': '🐢 慢速',
    'speed-normal': '🎵 正常',
    'speed-fast': '⚡ 快速',
    'set-song-title': '歌曲／模式',
    'set-data-title': '資料管理',
    'btn-clear-data': '🗑 清除所有資料',
    'set-data-desc': '這將清除您所有的訓練記錄、徽章和行事曆進度。',
    /* Confirm */
    'confirm-clear-title': '清除所有資料？',
    'confirm-clear-msg': '這將清除所有訓練記錄、徽章和行事曆資料，且無法撤銷。',
    'btn-cancel': '取消',
    'btn-confirm-yes': '是的，刪除',
    /* Badge flash */
    'flash-badge-h2': '解鎖徽章！',
    'btn-close-flash': '太棒了！🎉',
    /* Songs */
    'song-warmup-name': '暖身訓練',
    'song-warmup-desc': '緩慢輕柔的音符——初學者首選',
    'song-daily-name': '每日訓練',
    'song-daily-desc': '中等節奏，包含多種音調變化',
    'song-challenge-name': '強力哼鳴',
    'song-challenge-desc': '更快的音符，需要更高的準確率',
    /* Badges */
    'badge-day1-name': '初次踏步',    'badge-day1-desc': '完成了您的第一個訓練日！',
    'badge-day2-name': '再接再厲',    'badge-day2-desc': '兩天訓練已完成！',
    'badge-day3-name': '三天堅持',    'badge-day3-desc': '建立連續記錄——3天！',
    'badge-day7-name': '週間勇士',    'badge-day7-desc': '整整一週的口腔訓練！',
    'badge-day14-name': '兩週堅強',   'badge-day14-desc': '兩週的持續訓練！',
    'badge-day21-name': '鐵顎挑戰',   'badge-day21-desc': '完成終極 21 天挑戰！',
  },
};

/* i18n helpers */
function t(key) {
  const lang = App ? App.lang : 'en';
  return (LANG[lang] && LANG[lang][key] !== undefined) ? LANG[lang][key] : (LANG.en[key] || key);
}

function toggleLang() {
  setLang(App.lang === 'en' ? 'zh' : 'en');
}

function setLang(code) {
  App.lang = code;
  localStorage.setItem('kazoo_lang', code);
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = code === 'en' ? '繁' : 'EN';
  applyLang();
}

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (typeof val === 'string') el.textContent = val;
  });
  // Update html lang attribute
  document.documentElement.lang = App.lang === 'zh' ? 'zh-TW' : 'en';
}

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
  lang: localStorage.getItem('kazoo_lang') || 'en',
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
      const labels = t('cal-day-labels');
      week.push({ date: d, key, mins, avgAcc, label: labels[d.getDay()] });
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
          
          if (el) el.style.boxShadow = `0 0 20px var(--clr-accent)`;
        } else {
          
          if (el) el.style.boxShadow = '';
        }

        
      }

      // Note has passed or expired
      if (note.yPos > laneH + 60) {
        const accuracy = note.totalWindowFrames > 0
          ? note.hitFrames / note.totalWindowFrames
          : 0;

        if (accuracy >= 0.25) {
          G.hits++;
          noteEffect(G.noteDomElements.get(note), 'hit');
          showFeedbackToast(accuracy >= 0.9 ? t('toast-perfect') : accuracy >= 0.7 ? t('toast-good') : t('toast-ok'));
        } else {
          G.misses++;
          noteEffect(G.noteDomElements.get(note), 'miss');
          if (note.totalWindowFrames > 0) showFeedbackToast(t('toast-missed'));
          else showFeedbackToast(t('toast-skipped'));
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
  const title = accuracy >= 90 ? t('results-title-excellent') : accuracy >= 75 ? t('results-title-great') : accuracy >= 50 ? t('results-title-keep') : t('results-title-effort');

  setText('results-icon', icon);
  setText('results-title', title);

  const stabilityLabel = stability >= 80 ? t('results-stab-super') : stability >= 60 ? t('results-stab-good') : stability >= 40 ? t('results-stab-fair') : t('results-stab-erratic');
  setText('res-accuracy', `${accuracy}%`);
  setText('res-stability', `${stability}%`);
  setText('res-stability-label', stabilityLabel);
  setText('res-time', formatTime(durationS));
  setText('res-notes', `${hits}/${total}`);
  setText('results-sub', t('results-sub'));

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
  const readableDate = getReadableDate(dateKey);
  setText('results-cal-text', `${t('results-cal-prefix')} ${readableDate} ${t('results-cal-suffix')}`);

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

  const MONTHS = t('months-long');
  setText('cal-month-label', `${MONTHS[month]} ${year}`);

  // Build grid (day labels are handled via data-i18n)
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
    const bName = t(`badge-${b.id}-name`);
    const bDesc = t(`badge-${b.id}-desc`);
    grid.innerHTML += `
      <div class="badge-item ${unlocked ? 'unlocked' : ''}">
        <div class="badge-item-icon">${b.icon}</div>
        <div class="badge-item-title">${bName}</div>
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
  const MONTHS = t('months-short');
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

  const freqDescs = t('freq-descs');
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
    const sName = t(`song-${s.id}-name`);
    const sDesc = t(`song-${s.id}-desc`);
    songSel.innerHTML += `
      <div class="song-option ${App.settings.selectedSong === s.id ? 'selected' : ''}" onclick="selectSong('${s.id}')">
        <div class="song-option-icon">${s.icon}</div>
        <div class="song-option-info">
          <div class="song-opt-name">${sName}</div>
          <div class="song-opt-desc">${sDesc} · ${s.difficulty}</div>
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
  setText('btn-mic-test', t('btn-mic-stop'));
  micTestLoop();
}

function stopMicTest() {
  App.mic.testActive = false;
  if (App.mic.testAnimFrame) cancelAnimationFrame(App.mic.testAnimFrame);
  setText('btn-mic-test', t('btn-mic-test'));
  setText('mic-test-hz', '-- Hz');
  document.querySelectorAll('.mic-bar').forEach(b => b.style.height = '20%');
}

function micTestLoop() {
  if (!App.mic.testActive) return;
  const hz = detectPitch();
  if (hz > 60 && hz < 1200) setText('mic-test-hz', `${Math.round(hz)} Hz`);
  else setText('mic-test-hz', t('toast-hum-test'));

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
  const steps = [
    { id: 'low',  title: t('calib-step-low-title'),  desc: t('calib-step-low-desc'),  btn: t('calib-btn-low')  },
    { id: 'mid',  title: t('calib-step-mid-title'),  desc: t('calib-step-mid-desc'),  btn: t('calib-btn-mid')  },
    { id: 'high', title: t('calib-step-high-title'), desc: t('calib-step-high-desc'), btn: t('calib-btn-high') },
  ];
  if (calibStep < 3) {
    const step = steps[calibStep];
    setText('calib-step-title', step.title);
    setText('calib-step-desc', step.desc);
    setText('btn-calib-record', step.btn);
    document.getElementById('btn-calib-record').classList.remove('btn-success');
    document.getElementById('btn-calib-record').classList.add('btn-primary');
  } else {
    setText('calib-step-title', t('calib-done-title'));
    setText('calib-step-desc', t('calib-done-desc'));
    setText('btn-calib-record', t('calib-btn-done'));
    document.getElementById('btn-calib-record').classList.remove('btn-primary');
    document.getElementById('btn-calib-record').classList.add('btn-success');
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
    showToast(t('calib-err-pitch'));
    return;
  }

  const stepKey = CALIB_STEPS[calibStep].id;
  App.settings.calibration[stepKey] = hz;
  
  calibStep++;
  updateCalibrationUI();
  
  if (calibStep >= 3) {
    showToast(t('calib-success'));
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
   15. BADGE FLASH  (uses badge name/desc from LANG dynamically)
   ══════════════════════════════════ */
function showBadgeFlash(badge) {
  setText('flash-badge-icon', badge.icon);
  setText('flash-badge-name', t(`badge-${badge.id}-name`));
  setText('flash-badge-desc', t(`badge-${badge.id}-desc`));
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
  setText('confirm-title', t('confirm-clear-title'));
  setText('confirm-msg', t('confirm-clear-msg'));
  document.getElementById('confirm-ok').onclick = () => {
    DB.save(DB.defaults());
    closeConfirm();
    showToast(t('toast-data-cleared'));
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
  const MONTHS = t('months-short');
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
  // Restore saved language
  const savedLang = localStorage.getItem('kazoo_lang') || 'en';
  App.lang = savedLang;
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = savedLang === 'en' ? '繁' : 'EN';

  // Init home on load
  nav('home');
  applyLang();

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
