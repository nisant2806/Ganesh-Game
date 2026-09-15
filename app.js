// Modak Path — Reference-Accurate Engine
// Aesthetic: Slate stone obstacles with engraved mandala, Baby Ganesha start, Modak bowl end, mandatory 100% block visit rule.

const defaultSave = {
  current: 1,
  completed: {},
  hints: 3,
  sound: true,
  overallBestTime: null,
  audio: {
    bgm: true,
    mantra: true,
    mantraTrack: "sKofNltRivY",
    sfx: true
  }
};

let save = loadSave();
let level = save.current;
let puzzle = null;
let path = [];
let drawing = false;
let startedAt = 0;
let timer = null;
let audioCtx = null;

// State: 3 hints in every level, user profile, timing leaderboard
let levelHints = 3;
let currentUser = loadUser();
let pendingPlay = false;
let activeLbFilter = "all";

const $ = id => document.getElementById(id);

function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem("modak-path-save") || "{}");
    const merged = {
      ...defaultSave,
      ...raw,
      audio: { ...defaultSave.audio, ...(raw.audio || {}) }
    };
    if (merged.overallBestTime === undefined || merged.overallBestTime === null) {
      if (merged.completed) {
        const times = Object.values(merged.completed)
          .map(c => Number(c.exactTime || c.time))
          .filter(t => !isNaN(t) && t > 0);
        if (times.length > 0) {
          merged.overallBestTime = Math.min(...times);
        }
      }
    }
    return merged;
  } catch {
    return { ...defaultSave };
  }
}

function persist() {
  localStorage.setItem("modak-path-save", JSON.stringify(save));
}

// ----------------------------------------------------
// User Profile (Only Name and State)
// ----------------------------------------------------
function loadUser() {
  try {
    const raw = localStorage.getItem("modak-path-user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUser(user) {
  currentUser = user;
  localStorage.setItem("modak-path-user", JSON.stringify(user));
  updateProfileUI();
}

function updateProfileUI() {
  const nameEl = $("homePlayerName");
  const stateEl = $("homePlayerState");
  if (!nameEl || !stateEl) return;
  if (currentUser && currentUser.name) {
    nameEl.textContent = currentUser.name;
    stateEl.textContent = "📍 " + (currentUser.state || "India");
    const btn = document.querySelector(".profile-switch-btn");
    if (btn) btn.textContent = "Switch";
  } else {
    nameEl.textContent = "Guest Player";
    stateEl.textContent = "📍 Tap to set State & Name";
    const btn = document.querySelector(".profile-switch-btn");
    if (btn) btn.textContent = "Login";
  }
}

function openLogin(thenPlay = false) {
  pendingPlay = thenPlay;
  if (currentUser) {
    $("playerNameInput").value = currentUser.name || "";
    $("playerStateSelect").value = currentUser.state || "";
  } else {
    $("playerNameInput").value = "";
    $("playerStateSelect").selectedIndex = 0;
  }
  $("loginModal").classList.remove("hidden");
  setTimeout(() => {
    $("playerNameInput")?.focus();
  }, 100);
}

function closeLogin() {
  $("loginModal").classList.add("hidden");
  pendingPlay = false;
}

// ----------------------------------------------------
// Live Stopwatch, Real-Time Star Reduction & Timer Formatting
// ----------------------------------------------------
function formatTimer(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateHeaderStars(count) {
  const starsEl = $("headerStars");
  if (!starsEl) return;
  const stars = starsEl.querySelectorAll(".star");
  if (stars.length === 3) {
    stars[0].className = `star ${count >= 1 ? "lit" : "unlit"}`;
    stars[1].className = `star ${count >= 2 ? "lit" : "unlit"}`;
    stars[2].className = `star ${count >= 3 ? "lit" : "unlit"}`;
  }
}

function updateLiveTimer() {
  if (!startedAt) return;
  const elapsed = (Date.now() - startedAt) / 1000;
  const timerEl = $("gameTimer");
  if (timerEl) {
    timerEl.textContent = formatTimer(elapsed);
  }
  // Real-time star reduction based on elapsed time:
  // <= 25s: 3 stars (★★★)
  // 25s to 60s: 2 stars (★★☆)
  // > 60s (1 min): 1 star (★☆☆)
  const currentStars = elapsed <= 25 ? 3 : elapsed <= 60 ? 2 : 1;
  updateHeaderStars(currentStars);
}

function updateHintHUD() {
  const countEl = $("hintCount");
  if (countEl) countEl.textContent = levelHints;
  const btn = document.querySelector(".control-button.hint");
  if (btn) {
    btn.classList.toggle("exhausted", levelHints <= 0);
  }
}

// ----------------------------------------------------
// Timing-based Leaderboard System
// ----------------------------------------------------
const SEED_LEADERBOARD = [
  { id: "s1", name: "Aarav Sharma", state: "Maharashtra", level: 1, time: 2.7, formattedTime: "2.7s", moves: 12, date: "Today" },
  { id: "s2", name: "Diya Patel", state: "Gujarat", level: 1, time: 3.2, formattedTime: "3.2s", moves: 12, date: "Today" },
  { id: "s3", name: "Rohan Gowda", state: "Karnataka", level: 1, time: 3.9, formattedTime: "3.9s", moves: 13, date: "Yesterday" },
  { id: "s4", name: "Ananya Sen", state: "West Bengal", level: 1, time: 4.6, formattedTime: "4.6s", moves: 14, date: "2 days ago" },
  { id: "s5", name: "Kabir Mehra", state: "Delhi", level: 1, time: 5.4, formattedTime: "5.4s", moves: 15, date: "3 days ago" },
  
  { id: "s6", name: "Tanvi Rathore", state: "Rajasthan", level: 2, time: 3.8, formattedTime: "3.8s", moves: 14, date: "Today" },
  { id: "s7", name: "Vikram Gill", state: "Punjab", level: 2, time: 4.7, formattedTime: "4.7s", moves: 14, date: "Today" },
  { id: "s8", name: "Priya Nair", state: "Kerala", level: 2, time: 5.5, formattedTime: "5.5s", moves: 15, date: "Yesterday" },
  { id: "s9", name: "Aditya Varma", state: "Telangana", level: 2, time: 6.3, formattedTime: "6.3s", moves: 16, date: "2 days ago" },

  { id: "s10", name: "Sneha Das", state: "Odisha", level: 3, time: 5.1, formattedTime: "5.1s", moves: 15, date: "Today" },
  { id: "s11", name: "Kavya Iyer", state: "Tamil Nadu", level: 3, time: 6.0, formattedTime: "6.0s", moves: 15, date: "Today" },
  { id: "s12", name: "Aryan Singh", state: "Uttar Pradesh", level: 3, time: 7.2, formattedTime: "7.2s", moves: 16, date: "Yesterday" },

  { id: "s13", name: "Devendra Joshi", state: "Maharashtra", level: 4, time: 6.8, formattedTime: "6.8s", moves: 16, date: "Today" },
  { id: "s14", name: "Pooja Hegde", state: "Karnataka", level: 5, time: 8.4, formattedTime: "8.4s", moves: 18, date: "Today" }
];

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem("modak-path-leaderboard");
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem("modak-path-leaderboard", JSON.stringify(SEED_LEADERBOARD));
  return [...SEED_LEADERBOARD];
}

function saveLeaderboard(lb) {
  localStorage.setItem("modak-path-leaderboard", JSON.stringify(lb));
}

function recordLeaderboardEntry(lvl, timeSec, moves) {
  const user = currentUser || { name: "Guest Player", state: "India" };
  const lb = loadLeaderboard();
  const formattedTime = timeSec < 60 ? `${timeSec.toFixed(1)}s` : `${Math.floor(timeSec / 60)}m ${(timeSec % 60).toFixed(0)}s`;

  // Check if player has existing record on this level
  const existingIdx = lb.findIndex(item => item.name.toLowerCase() === user.name.toLowerCase() && item.level === lvl);
  let isNewBestTime = false;

  if (existingIdx !== -1) {
    if (timeSec < lb[existingIdx].time) {
      lb[existingIdx].time = timeSec;
      lb[existingIdx].formattedTime = formattedTime;
      lb[existingIdx].moves = moves;
      lb[existingIdx].state = user.state;
      lb[existingIdx].date = "Just now";
      isNewBestTime = true;
    }
  } else {
    lb.push({
      id: "run-" + Date.now(),
      name: user.name,
      state: user.state,
      level: lvl,
      time: timeSec,
      formattedTime: formattedTime,
      moves: moves,
      date: "Just now"
    });
    isNewBestTime = true;
  }

  saveLeaderboard(lb);

  // Calculate user's ranking on this level
  const levelRuns = lb.filter(i => i.level === lvl).sort((a, b) => a.time - b.time);
  const rank = levelRuns.findIndex(i => i.name.toLowerCase() === user.name.toLowerCase()) + 1;

  return { rank: rank > 0 ? rank : 1, total: levelRuns.length, isNewBestTime };
}

function openLeaderboard(filter = "all") {
  activeLbFilter = filter;
  populateLeaderboardDropdown();
  renderLeaderboard();
  $("leaderboardModal").classList.remove("hidden");
}

function closeLeaderboard() {
  $("leaderboardModal").classList.add("hidden");
}

function populateLeaderboardDropdown() {
  const select = $("lbSelectLevel");
  if (!select) return;
  select.innerHTML = '<option value="">More levels...</option>';
  const maxLvl = Math.max(10, save.current + 5);
  for (let i = 1; i <= Math.min(500, maxLvl); i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `Level ${i}`;
    if (String(activeLbFilter) === String(i)) opt.selected = true;
    select.appendChild(opt);
  }
}

function renderLeaderboard() {
  const lb = loadLeaderboard();
  const podiumEl = $("lbPodium");
  const listEl = $("lbList");
  const userBarEl = $("lbUserBar");
  const isAll = (activeLbFilter === "all");

  const timeHeader = $("lbTimeHeader");
  if (timeHeader) {
    timeHeader.textContent = isAll ? "AVG TIME" : "TIME";
  }

  // Update active chips
  document.querySelectorAll(".lb-filter-chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.filter === String(activeLbFilter));
  });

  let entries = [];

  if (isAll) {
    // In All Levels mode: each player has one single entry with their average time across levels
    const playerMap = new Map();
    lb.forEach(item => {
      const key = (item.name || "").trim().toLowerCase();
      if (!key) return;
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          name: item.name,
          state: item.state,
          times: []
        });
      }
      const p = playerMap.get(key);
      p.times.push(item.time);
      if (item.state) p.state = item.state;
    });

    entries = Array.from(playerMap.values()).map(p => {
      const sum = p.times.reduce((a, b) => a + b, 0);
      const avg = sum / p.times.length;
      const formattedAvg = avg < 60 ? `${avg.toFixed(1)}s` : `${Math.floor(avg / 60)}m ${(avg % 60).toFixed(0)}s`;
      return {
        name: p.name,
        state: p.state,
        time: avg,
        formattedTime: formattedAvg,
        levelCount: p.times.length
      };
    });
  } else {
    // In specific level mode: list entries for that level
    const lvlNum = parseInt(activeLbFilter, 10);
    entries = lb.filter(e => e.level === lvlNum).map(e => ({
      name: e.name,
      state: e.state,
      time: e.time,
      formattedTime: e.formattedTime,
      levelCount: 1
    }));
  }

  // Sort strictly by fastest timing / average timing (time ascending)
  entries.sort((a, b) => a.time - b.time);

  // Render Podium (Top 3)
  if (entries.length >= 1) {
    const top3 = entries.slice(0, 3);
    const slots = [
      { rank: 2, item: top3[1], medal: "🥈", cls: "second" },
      { rank: 1, item: top3[0], medal: "🥇", cls: "first" },
      { rank: 3, item: top3[2], medal: "🥉", cls: "third" }
    ];

    podiumEl.innerHTML = slots.map(s => {
      if (!s.item) return `<div class="podium-slot ${s.cls}"></div>`;
      return `
        <div class="podium-slot ${s.cls}">
          <div class="podium-avatar">👤<span class="podium-medal">${s.medal}</span></div>
          <div class="podium-name" title="${s.item.name}">${s.item.name}</div>
          <div class="podium-state" title="${s.item.state}">📍 ${s.item.state}</div>
          <div class="podium-time">⏱️ ${s.item.formattedTime}${isAll ? " avg" : ""}</div>
        </div>
      `;
    }).join("");
    podiumEl.classList.remove("hidden");
  } else {
    podiumEl.innerHTML = "";
    podiumEl.classList.add("hidden");
  }

  // Render List
  if (entries.length === 0) {
    listEl.innerHTML = `<div class="lb-empty">No times recorded for this level yet.<br>Be the first to set a speedrun record! 🚀</div>`;
  } else {
    listEl.innerHTML = entries.map((item, idx) => {
      const rank = idx + 1;
      const isUser = currentUser && item.name.toLowerCase() === currentUser.name.toLowerCase();
      const rankBadgeClass = rank <= 3 ? `top-${rank}` : "";
      return `
        <div class="lb-row ${isUser ? "user-row" : ""}">
          <div class="lb-player-col">
            <span class="lb-rank-badge ${rankBadgeClass}">#${rank}</span>
            <div class="lb-player-details">
              <span class="lb-player-name" title="${item.name}">${item.name}</span>
              ${isUser ? '<span class="lb-you-tag">YOU</span>' : ''}
            </div>
          </div>
          <div class="lb-state-col">
            <span class="lb-state-pill" title="${item.state}">📍 ${item.state}</span>
          </div>
          <div class="lb-time-col">
            ⏱️ ${item.formattedTime}${isAll && item.levelCount > 1 ? ` <small style="font-size:0.68rem;opacity:0.75;font-weight:600">(${item.levelCount} lvls)</small>` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  // Sticky User Standing Bar
  if (currentUser && currentUser.name) {
    const userEntry = entries.find(e => e.name.toLowerCase() === currentUser.name.toLowerCase());
    if (userEntry) {
      const userRank = entries.indexOf(userEntry) + 1;
      userBarEl.innerHTML = `
        <span>👤 <strong>${currentUser.name}</strong> (📍 ${currentUser.state})</span>
        <span>${isAll ? "Avg" : "Best"}: <strong>${userEntry.formattedTime}</strong>${isAll && userEntry.levelCount > 1 ? ` (${userEntry.levelCount} lvls)` : ""} · Rank: <strong>#${userRank}</strong></span>
      `;
    } else {
      userBarEl.innerHTML = `
        <span>👤 <strong>${currentUser.name}</strong> (📍 ${currentUser.state})</span>
        <span>Not ranked in this view yet · Complete a level to enter!</span>
      `;
    }
  } else {
    userBarEl.innerHTML = `
      <span>👤 Playing as <strong>Guest</strong></span>
      <button class="profile-switch-btn" type="button" data-action="openLogin">Login to Save Rank</button>
    `;
  }
}

// ----------------------------------------------------
// Dual-Layer YouTube Audio Architecture & Sound Engine
// Layer 1: Background Music (20% Vol) - Auto-looping
// Layer 2: Devotional Mantra Layer (30% Vol) - Auto-looping with Track Switcher
// ----------------------------------------------------
const YOUTUBE_TRACKS = {
  bgm: "LqPl7XPgpmI",
  mantra1: "sKofNltRivY", // Default Mantra
  mantra2: "TCOSGtzvuDc"  // Alternative Devotional Mantra
};

let ytBgmPlayer = null;
let ytMantraPlayer = null;
let ytApiReady = false;
let userInteracted = false;

window.onYouTubeIframeAPIReady = function() {
  ytApiReady = true;
  initYouTubePlayers();
};

function initYouTubePlayers() {
  if (!window.YT || !window.YT.Player) return;

  try {
    if (!ytBgmPlayer && $("ytBgmPlayer")) {
      ytBgmPlayer = new YT.Player("ytBgmPlayer", {
        height: "1",
        width: "1",
        videoId: YOUTUBE_TRACKS.bgm,
        playerVars: {
          autoplay: 0,
          loop: 1,
          playlist: YOUTUBE_TRACKS.bgm,
          controls: 0,
          showinfo: 0,
          disablekb: 1,
          playsinline: 1
        },
        events: {
          onReady: (e) => {
            e.target.setVolume(20); // 20% Volume for BGM
            if (save.audio && save.audio.bgm && userInteracted) {
              e.target.playVideo();
            }
          },
          onStateChange: (e) => {
            // Auto-repeat when music finishes
            if (e.data === YT.PlayerState.ENDED) {
              e.target.playVideo();
            }
          }
        }
      });
    }

    if (!ytMantraPlayer && $("ytMantraPlayer")) {
      const activeMantraId = (save.audio && save.audio.mantraTrack) ? save.audio.mantraTrack : YOUTUBE_TRACKS.mantra1;
      ytMantraPlayer = new YT.Player("ytMantraPlayer", {
        height: "1",
        width: "1",
        videoId: activeMantraId,
        playerVars: {
          autoplay: 0,
          loop: 1,
          playlist: activeMantraId,
          controls: 0,
          showinfo: 0,
          disablekb: 1,
          playsinline: 1
        },
        events: {
          onReady: (e) => {
            e.target.setVolume(30); // 30% Volume for Mantra
            if (save.audio && save.audio.mantra && userInteracted) {
              e.target.playVideo();
            }
          },
          onStateChange: (e) => {
            // Auto-repeat when music finishes
            if (e.data === YT.PlayerState.ENDED) {
              e.target.playVideo();
            }
          }
        }
      });
    }
  } catch (err) {
    console.warn("YouTube player init error:", err);
  }
}

function startAudioOnUserGesture() {
  if (userInteracted) return;
  userInteracted = true;

  if (ytBgmPlayer && typeof ytBgmPlayer.playVideo === "function") {
    ytBgmPlayer.setVolume(20);
    if (save.audio.bgm) ytBgmPlayer.playVideo();
    else ytBgmPlayer.pauseVideo();
  }

  if (ytMantraPlayer && typeof ytMantraPlayer.playVideo === "function") {
    ytMantraPlayer.setVolume(30);
    if (save.audio.mantra) ytMantraPlayer.playVideo();
    else ytMantraPlayer.pauseVideo();
  }
}

function toggleBGM() {
  startAudioOnUserGesture();
  save.audio.bgm = !save.audio.bgm;
  persist();
  updateAudioUI();

  if (ytBgmPlayer && typeof ytBgmPlayer.playVideo === "function") {
    if (save.audio.bgm) {
      ytBgmPlayer.setVolume(20);
      ytBgmPlayer.playVideo();
    } else {
      ytBgmPlayer.pauseVideo();
    }
  }
}

function toggleMantra() {
  startAudioOnUserGesture();
  save.audio.mantra = !save.audio.mantra;
  persist();
  updateAudioUI();

  if (ytMantraPlayer && typeof ytMantraPlayer.playVideo === "function") {
    if (save.audio.mantra) {
      ytMantraPlayer.setVolume(30);
      ytMantraPlayer.playVideo();
    } else {
      ytMantraPlayer.pauseVideo();
    }
  }
}

function switchMantraTrack(videoId) {
  startAudioOnUserGesture();
  save.audio.mantraTrack = videoId;
  persist();
  updateAudioUI();

  if (ytMantraPlayer && typeof ytMantraPlayer.loadVideoById === "function") {
    ytMantraPlayer.loadVideoById({
      videoId: videoId,
      startSeconds: 0
    });
    ytMantraPlayer.setVolume(30);
    if (!save.audio.mantra) {
      ytMantraPlayer.pauseVideo();
    }
  }
}

function toggleSFX() {
  save.audio.sfx = !save.audio.sfx;
  save.sound = save.audio.sfx;
  persist();
  updateAudioUI();
}

function openAudioModal() {
  updateAudioUI();
  $("audioModal")?.classList.remove("hidden");
}

function closeAudioModal() {
  $("audioModal")?.classList.add("hidden");
}

function updateAudioUI() {
  const bgmBtn = $("bgmToggleBtn");
  if (bgmBtn) {
    bgmBtn.textContent = save.audio.bgm ? "ON 🔊" : "MUTED 🔇";
    bgmBtn.className = `audio-toggle-btn ${save.audio.bgm ? "active" : "muted"}`;
  }

  const mantraBtn = $("mantraToggleBtn");
  if (mantraBtn) {
    mantraBtn.textContent = save.audio.mantra ? "ON 🔊" : "MUTED 🔇";
    mantraBtn.className = `audio-toggle-btn ${save.audio.mantra ? "active" : "muted"}`;
  }

  const sfxBtn = $("sfxToggleBtn");
  if (sfxBtn) {
    sfxBtn.textContent = save.audio.sfx ? "ON 🔊" : "MUTED 🔇";
    sfxBtn.className = `audio-toggle-btn ${save.audio.sfx ? "active" : "muted"}`;
  }

  const activeTrack = save.audio.mantraTrack || YOUTUBE_TRACKS.mantra1;
  const isMantra1 = (activeTrack === YOUTUBE_TRACKS.mantra1);
  const chip1 = $("mantraChip1");
  const chip2 = $("mantraChip2");
  if (chip1) {
    chip1.classList.toggle("active", isMantra1);
    const rad = chip1.querySelector("input");
    if (rad) rad.checked = isMantra1;
  }
  if (chip2) {
    chip2.classList.toggle("active", !isMantra1);
    const rad = chip2.querySelector("input");
    if (rad) rad.checked = !isMantra1;
  }

  const allMuted = !save.audio.bgm && !save.audio.mantra && !save.audio.sfx;
  document.querySelectorAll('[data-action="sound"], [data-action="openAudio"]').forEach(b => {
    b.textContent = allMuted ? "🔇" : "🔊";
  });
}

// Procedural Web Audio synthesizer for SFX
function playSound(type) {
  if (!save.audio?.sfx && !save.sound) return;
  try {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    if (type === "step") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      const pitch = 320 + Math.min(path.length * 18, 380);
      osc.frequency.setValueAtTime(pitch, now);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === "locked") {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(145, now);
      osc.frequency.linearRampToValueAtTime(115, now + 0.16);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === "win") {
      [392.0, 523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.14, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.28);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.28);
      });
    }
  } catch (err) { }
}

// Seeded PRNG for reproducible levels
function seeded(n) {
  let x = (n * 9301 + 49297) % 233280;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

// Dimensions for level: scales progressively up to 7x8 for higher difficulty
function dimsFor(n) {
  if (n <= 5) return { rows: 4, cols: 4 };
  if (n <= 15) return { rows: 4, cols: 5 }; // Level 5 matches 4x5 reference screenshot
  if (n <= 35) return { rows: 5, cols: 5 };
  if (n <= 50) return { rows: 5, cols: 6 };
  if (n <= 100) return { rows: 6, cols: 6 }; // Levels 51-100: 6x6 Hard matrix
  if (n <= 250) return { rows: 6, cols: 7 }; // Levels 101-250: 6x7 Expert matrix
  if (n <= 400) return { rows: 7, cols: 7 }; // Levels 251-400: 7x7 Master matrix
  return { rows: 7, cols: 8 };                // Levels 401-500: 7x8 Legend matrix
}

// Difficulty Tier configuration and visual metadata
function getDifficultyTier(n) {
  if (n <= 20) {
    return { name: "Easy", icon: "🟢", className: "diff-easy", tierName: "Apprentice", modalClass: "" };
  } else if (n <= 50) {
    return { name: "Medium", icon: "🟡", className: "diff-medium", tierName: "Challenger", modalClass: "" };
  } else if (n <= 100) {
    return { name: "Hard 🔥", icon: "🔥", className: "diff-hard", tierName: "Hard (Scattered Obstacles)", modalClass: "hard-tier" };
  } else if (n <= 250) {
    return { name: "Expert ⚡", icon: "⚡", className: "diff-expert", tierName: "Expert Labyrinth", modalClass: "expert-tier" };
  } else if (n <= 400) {
    return { name: "Master 👑", icon: "👑", className: "diff-master", tierName: "Master Maze", modalClass: "master-tier" };
  } else {
    return { name: "Legend 🌟", icon: "🌟", className: "diff-legend", tierName: "Grandmaster Legend", modalClass: "legend-tier" };
  }
}

// Target grey obstacle block density:
// Levels <= 50: modest density (15% - 28%) for accessible progression
// Levels > 50: increased density (30% - 44%) with randomly scattered grey obstacle blocks
function getObstacleConfig(n, totalCells) {
  if (n <= 10) return { minDensity: 0.15, maxDensity: 0.22 };
  if (n <= 30) return { minDensity: 0.20, maxDensity: 0.26 };
  if (n <= 50) return { minDensity: 0.22, maxDensity: 0.28 };
  if (n <= 100) return { minDensity: 0.30, maxDensity: 0.38 };
  if (n <= 250) return { minDensity: 0.33, maxDensity: 0.40 };
  return { minDensity: 0.35, maxDensity: 0.44 };
}

// SVGs for game board
const SVGS = {
  ganesha: `
    <svg viewBox="0 0 80 80" class="ganesha-svg" aria-label="Ganesh Ji">
      <path d="M40 7 L32 23 L48 23 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1.5" />
      <circle cx="40" cy="7" r="2.5" fill="#ef4444" />
      <circle cx="40" cy="16" r="2.5" fill="#ef4444" />
      <path d="M30 23 Q40 19 50 23 L48 27 Q40 24 32 27 Z" fill="#fbbf24" stroke="#d97706" stroke-width="1" />
      <path d="M28 30 C12 26 10 46 27 48 C26 42 26 36 28 30 Z" fill="#fed7aa" stroke="#ea580c" stroke-width="1.5" />
      <path d="M25 34 C16 32 16 42 25 44" fill="#fbcfe8" stroke="#f472b6" stroke-width="1" />
      <path d="M52 30 C68 26 70 46 53 48 C54 42 54 36 52 30 Z" fill="#fed7aa" stroke="#ea580c" stroke-width="1.5" />
      <path d="M55 34 C64 32 64 42 55 44" fill="#fbcfe8" stroke="#f472b6" stroke-width="1" />
      <ellipse cx="40" cy="36" rx="15" ry="13" fill="#fed7aa" stroke="#ea580c" stroke-width="1.5" />
      <ellipse cx="34" cy="33" rx="2" ry="3" fill="#3f2420" />
      <ellipse cx="46" cy="33" rx="2" ry="3" fill="#3f2420" />
      <circle cx="34.5" cy="32" r="0.8" fill="#fff" />
      <circle cx="46.5" cy="32" r="0.8" fill="#fff" />
      <path d="M38 25 Q40 27 42 25 L40 31 Z" fill="#dc2626" />
      <circle cx="40" cy="31.5" r="1" fill="#fbbf24" />
      <path d="M38 39 Q40 46 37 52 Q33 56 29 53 Q26 50 30 48 Q35 46 36 41" fill="#fed7aa" stroke="#ea580c" stroke-width="1.5" />
      <ellipse cx="40" cy="56" rx="14" ry="11" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5" />
      <path d="M28 52 Q40 56 52 52" stroke="#fbbf24" stroke-width="2.5" fill="none" />
      <circle cx="26" cy="50" r="3.5" fill="#fed7aa" stroke="#ea580c" stroke-width="1" />
      <circle cx="54" cy="50" r="3.5" fill="#fed7aa" stroke="#ea580c" stroke-width="1" />
      <ellipse cx="33" cy="65" rx="5" ry="2.8" fill="#fed7aa" stroke="#ea580c" stroke-width="1" />
      <ellipse cx="47" cy="65" rx="5" ry="2.8" fill="#fed7aa" stroke="#ea580c" stroke-width="1" />
    </svg>`,

  modak: `
    <svg viewBox="0 0 80 80" class="modak-svg" aria-label="Modak Sweet">
      <path d="M38 52 Q68 46 72 38 Q58 52 48 54 Z" fill="#4ade80" stroke="#16a34a" stroke-width="1.2" />
      <ellipse cx="40" cy="62" rx="26" ry="11" fill="#78350f" stroke="#451a03" stroke-width="1.5" />
      <ellipse cx="40" cy="59" rx="24" ry="8" fill="#92400e" />
      <path d="M24 57 C24 45 32 30 40 18 C48 30 56 45 56 57 C56 61 48 63 40 63 C32 63 24 61 24 57 Z" fill="#fffdf7" stroke="#d6cfc7" stroke-width="1.5" />
      <path d="M40 18 Q40 40 40 63" stroke="#e5ded5" stroke-width="1.5" fill="none" />
      <path d="M40 18 Q35 38 31 61" stroke="#e5ded5" stroke-width="1.5" fill="none" />
      <path d="M40 18 Q45 38 49 61" stroke="#e5ded5" stroke-width="1.5" fill="none" />
      <path d="M40 18 Q29 42 25 58" stroke="#e5ded5" stroke-width="1.2" fill="none" />
      <path d="M40 18 Q51 42 55 58" stroke="#e5ded5" stroke-width="1.2" fill="none" />
      <circle cx="40" cy="18" r="2" fill="#fef08a" />
    </svg>`,

  mandala: `
    <svg viewBox="0 0 60 60" class="mandala-svg">
      <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="30" cy="30" r="4" />
        <path d="M30 26 C27 16 33 16 30 26 Z" fill="currentColor" opacity="0.85" />
        <path d="M30 34 C27 44 33 44 30 34 Z" fill="currentColor" opacity="0.85" />
        <path d="M26 30 C16 27 16 33 26 30 Z" fill="currentColor" opacity="0.85" />
        <path d="M34 30 C44 27 44 33 34 30 Z" fill="currentColor" opacity="0.85" />
        <path d="M27.2 27.2 C20 20 24 16 27.2 27.2 Z" fill="currentColor" opacity="0.75" />
        <path d="M32.8 32.8 C40 40 36 44 32.8 32.8 Z" fill="currentColor" opacity="0.75" />
        <path d="M27.2 32.8 C20 40 16 36 27.2 32.8 Z" fill="currentColor" opacity="0.75" />
        <path d="M32.8 27.2 C40 20 44 24 32.8 27.2 Z" fill="currentColor" opacity="0.75" />
      </g>
    </svg>`,

  watermark: `
    <svg viewBox="0 0 60 60" class="watermark-svg">
      <g fill="none" stroke="#d5b89a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.55">
        <circle cx="30" cy="30" r="4" />
        <path d="M30 26 C27 16 33 16 30 26 Z" fill="#d5b89a" />
        <path d="M30 34 C27 44 33 44 30 34 Z" fill="#d5b89a" />
        <path d="M26 30 C16 27 16 33 26 30 Z" fill="#d5b89a" />
        <path d="M34 30 C44 27 44 33 34 30 Z" fill="#d5b89a" />
        <path d="M27.2 27.2 C20 20 24 16 27.2 27.2 Z" fill="#d5b89a" />
        <path d="M32.8 32.8 C40 40 36 44 32.8 32.8 Z" fill="#d5b89a" />
        <path d="M27.2 32.8 C20 40 16 36 27.2 32.8 Z" fill="#d5b89a" />
        <path d="M32.8 27.2 C40 20 44 24 32.8 27.2 Z" fill="#d5b89a" />
      </g>
    </svg>`
};

// Spatial evaluation of candidate self-avoiding paths:
// Ensures grey obstacle blocks are randomly and widely scattered across all quadrants,
// rows, and columns of the matrix to create rich, challenging labyrinth paths.
function evaluateScatter(path, rows, cols) {
  const pSet = new Set(path.map(p => `${p.r},${p.c}`));
  const obs = [];
  const rowCounts = Array(rows).fill(0);
  const colCounts = Array(cols).fill(0);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!pSet.has(`${r},${c}`)) {
        obs.push({ r, c });
        rowCounts[r]++;
        colCounts[c]++;
      }
    }
  }

  const obsSet = new Set(obs.map(p => `${p.r},${p.c}`));

  let maxCluster = 0;
  let adjPairs = 0;
  const visited = new Set();
  for (const p of obs) {
    const k = `${p.r},${p.c}`;
    if (visited.has(k)) continue;
    let sz = 0;
    const q = [p];
    visited.add(k);
    while (q.length) {
      const curr = q.shift();
      sz++;
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nr = curr.r + dr, nc = curr.c + dc;
        const nk = `${nr},${nc}`;
        if (obsSet.has(nk)) {
          if (curr.r < nr || (curr.r === nr && curr.c < nc)) adjPairs++;
          if (!visited.has(nk)) {
            visited.add(nk);
            q.push({ r: nr, c: nc });
          }
        }
      }
    }
    if (sz > maxCluster) maxCluster = sz;
  }

  const midR = (rows - 1) / 2;
  const midC = (cols - 1) / 2;
  let tl = 0, tr = 0, bl = 0, br = 0;
  for (const p of obs) {
    if (p.r <= midR && p.c <= midC) tl++;
    if (p.r <= midR && p.c >= midC) tr++;
    if (p.r >= midR && p.c <= midC) bl++;
    if (p.r >= midR && p.c >= midC) br++;
  }
  const quad = (tl > 0 ? 1 : 0) + (tr > 0 ? 1 : 0) + (bl > 0 ? 1 : 0) + (br > 0 ? 1 : 0);

  const obsRows = rowCounts.filter(cnt => cnt > 0).length;
  const obsCols = colCounts.filter(cnt => cnt > 0).length;

  // Measure path direction changes (turns) for winding labyrinth complexity
  let turns = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const dr1 = path[i].r - path[i - 1].r;
    const dc1 = path[i].c - path[i - 1].c;
    const dr2 = path[i + 1].r - path[i].r;
    const dc2 = path[i + 1].c - path[i].c;
    if (dr1 !== dr2 || dc1 !== dc2) turns++;
  }

  return {
    obsCount: obs.length,
    maxCluster,
    adjPairs,
    quad,
    obsRows,
    obsCols,
    turns,
    obs
  };
}

// Generate guaranteed solvable puzzle with random grey obstacle blocks scattered throughout the matrix.
// For levels > 50: increases matrix grid size and grey block density, distributing obstacles across the matrix.
function makePuzzle(n) {
  const { rows, cols } = dimsFor(n);
  const totalCells = rows * cols;
  const start = { r: 0, c: 0 };
  const end = { r: rows - 1, c: cols - 1 };

  // Parity check: (end.r + end.c) parity matches path step count
  const endParity = (end.r + end.c) % 2;
  const reqLenParity = (endParity === 1) ? 0 : 1;

  const cfg = getObstacleConfig(n, totalCells);
  const minObs = Math.max(2, Math.floor(totalCells * cfg.minDensity));
  const maxObs = Math.max(minObs + 1, Math.floor(totalCells * cfg.maxDensity));

  const candidateLengths = [];
  for (let obs = maxObs; obs >= minObs; obs--) {
    const walkLen = totalCells - obs;
    if (walkLen % 2 === reqLenParity && walkLen >= rows + cols - 1) {
      candidateLengths.push(walkLen);
    }
  }

  let bestSol = null;
  let bestScore = -Infinity;

  for (const walkLen of candidateLengths) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const rand = seeded((n * 104729 + attempt * 3571 + walkLen * 101) % 233280);
      const visited = new Uint8Array(rows * cols);
      const path = [];
      let found = false;
      let stepCount = 0;

      function dfs(r, c) {
        if (found) return;
        stepCount++;
        if (stepCount > 8000) return;

        const idx = r * cols + c;
        visited[idx] = 1;
        path.push({ r, c });

        if (r === end.r && c === end.c) {
          if (path.length === walkLen) {
            found = true;
            return;
          }
          visited[idx] = 0;
          path.pop();
          return;
        }

        const dist = (end.r - r) + (end.c - c);
        if (dist > walkLen - path.length) {
          visited[idx] = 0;
          path.pop();
          return;
        }

        let dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        const shift = (n + attempt) % 4;
        dirs = dirs.slice(shift).concat(dirs.slice(0, shift));
        for (let i = dirs.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
        }

        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const nidx = nr * cols + nc;
          if (visited[nidx]) continue;
          if (nr === end.r && nc === end.c && path.length < walkLen - 1) continue;
          dfs(nr, nc);
          if (found) break;
        }

        if (!found) {
          visited[idx] = 0;
          path.pop();
        }
      }

      dfs(start.r, start.c);

      if (found) {
        const stats = evaluateScatter(path, rows, cols);
        let score = (stats.quad / 4) * 50 +
                    (stats.obsRows / rows) * 30 +
                    (stats.obsCols / cols) * 30 +
                    (stats.turns / walkLen) * 40;

        // Anti-clustering: prefer distributed scatter across the matrix
        if (stats.maxCluster > 3) score -= (stats.maxCluster - 3) * 45;
        if (stats.obsCount >= minObs) score += 20;

        if (score > bestScore) {
          bestScore = score;
          bestSol = [...path];
          if (stats.quad === 4 && stats.maxCluster <= 3 && stats.obsRows >= rows - 1 && stats.obsCols >= cols - 1) {
            break;
          }
        }
      }
    }
    if (bestSol && bestScore >= 110) break;
  }

  // Guaranteed fallback: Snake path
  if (!bestSol) {
    bestSol = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) row.push({ r, c });
      if (r % 2 === 1) row.reverse();
      bestSol.push(...row);
    }
  }

  const walkable = new Set(bestSol.map(p => `${p.r},${p.c}`));
  const obstacles = new Set();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      if (!walkable.has(key)) obstacles.add(key);
    }
  }

  const watermarks = new Set();
  const interior = bestSol.slice(1, -1);
  if (interior.length >= 2) {
    const step = Math.floor(interior.length / 3);
    [step, step * 2].forEach(idx => {
      const pick = interior[Math.max(0, Math.min(interior.length - 1, idx))];
      if (pick) watermarks.add(`${pick.r},${pick.c}`);
    });
  }

  return {
    rows,
    cols,
    start: { r: 0, c: 0 },
    end: { r: rows - 1, c: cols - 1 },
    solution: bestSol,
    walkable,
    obstacles,
    watermarks,
    totalBlocks: bestSol.length,
    difficulty: getDifficultyTier(n)
  };
}

function show(screen) {
  ["homeScreen", "gameScreen", "levelsScreen"].forEach(id => {
    $(id).classList.toggle("hidden", id !== screen);
  });
}

function startGame(n = level) {
  level = Math.max(1, Math.min(500, n));
  puzzle = makePuzzle(level);
  path = [{ r: 0, c: 0 }]; // Start automatically with Ganesha active
  drawing = false;
  startedAt = Date.now();
  clearInterval(timer);
  updateHeaderStars(3);
  updateLiveTimer();
  timer = setInterval(updateLiveTimer, 200);

  levelHints = 3; // 3 hints in every level
  updateHintHUD();

  show("gameScreen");
  $("levelNumber").textContent = level;
  $("moveCount").textContent = 0;

  // Update Difficulty Pill in Header
  const diffBadge = $("diffBadge");
  if (diffBadge && puzzle.difficulty) {
    diffBadge.textContent = puzzle.difficulty.name;
    diffBadge.className = `pill-badge pill-difficulty ${puzzle.difficulty.className}`;
  }

  updateHUD();
  renderBoard();
  drawPath();
  startAudioOnUserGesture();
}

function renderBoard() {
  const board = $("board");
  board.innerHTML = "";
  board.style.setProperty("--grid-rows", puzzle.rows);
  board.style.setProperty("--grid-cols", puzzle.cols);
  board.style.gridTemplateRows = `repeat(${puzzle.rows}, 1fr)`;
  board.style.gridTemplateColumns = `repeat(${puzzle.cols}, 1fr)`;

  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.setAttribute("role", "gridcell");

      const key = `${r},${c}`;

      if (r === 0 && c === 0) {
        // Start: Baby Ganesha on golden yellow tile
        cell.classList.add("start");
        cell.innerHTML = SVGS.ganesha;
        cell.setAttribute("aria-label", "Start: Ganesh Ji");
      } else if (r === puzzle.end.r && c === puzzle.end.c) {
        // Goal: Modak in bowl on golden yellow tile
        cell.classList.add("end", "locked");
        cell.innerHTML = SVGS.modak;
        cell.setAttribute("aria-label", "Goal: Modak");
      } else if (puzzle.obstacles.has(key)) {
        // Obstacle: Dark slate stone with engraved mandala flower
        cell.classList.add("obstacle-stone");
        cell.innerHTML = SVGS.mandala;
        cell.setAttribute("aria-label", "Slate Stone Obstacle");
      } else {
        // Walkable cream tile
        cell.classList.add("walkable");
        if (puzzle.watermarks.has(key)) {
          cell.classList.add("has-watermark");
          cell.innerHTML = SVGS.watermark;
        }
      }

      board.appendChild(cell);
    }
  }
}

function cellAt(r, c) {
  return document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

function drawPath() {
  // Clear previous path status classes
  document.querySelectorAll(".cell.path, .cell.current").forEach(el => {
    el.classList.remove("path", "current");
  });

  const layer = $("pathSvg");
  const wrap = $("boardWrap").getBoundingClientRect();

  // Mark visited cells
  path.forEach(p => {
    const el = cellAt(p.r, p.c);
    if (el) el.classList.add("path");
  });

  if (path.length) {
    const last = path[path.length - 1];
    cellAt(last.r, last.c)?.classList.add("current");
  }

  // End sweet unlocks when player has covered all blocks
  const endCell = cellAt(puzzle.end.r, puzzle.end.c);
  if (endCell) {
    const allCovered = path.length >= puzzle.totalBlocks - 1;
    endCell.classList.toggle("locked", !allCovered);
    endCell.classList.toggle("unlocked", allCovered);
  }

  // Construct thick, vibrant rounded orange SVG path
  if (wrap.width > 0 && wrap.height > 0) {
    let svgHtml = `<svg class="path-svg" viewBox="0 0 ${wrap.width} ${wrap.height}" width="${wrap.width}" height="${wrap.height}">`;

    if (path.length > 1) {
      let d = "";
      path.forEach((p, i) => {
        const cell = cellAt(p.r, p.c);
        if (!cell) return;
        const rect = cell.getBoundingClientRect();
        const cx = rect.left + rect.width / 2 - wrap.left;
        const cy = rect.top + rect.height / 2 - wrap.top;
        if (i === 0) d += `M ${cx} ${cy}`;
        else d += ` L ${cx} ${cy}`;
      });
      svgHtml += `<path d="${d}" class="svg-path-line" />`;
    }

    path.forEach(p => {
      const cell = cellAt(p.r, p.c);
      if (!cell) return;
      const rect = cell.getBoundingClientRect();
      const cx = rect.left + rect.width / 2 - wrap.left;
      const cy = rect.top + rect.height / 2 - wrap.top;
      const radius = Math.max(5, Math.min(rect.width * 0.16, 12));
      svgHtml += `<circle cx="${cx}" cy="${cy}" r="${radius}" class="svg-path-dot" />`;
    });

    svgHtml += `</svg>`;
    layer.innerHTML = svgHtml;
  }
}

function updateHUD() {
  if (!puzzle) return;
  const visitedCount = path.length;
  const total = puzzle.totalBlocks;

  const blocksEl = $("blocksCount");
  if (blocksEl) blocksEl.textContent = `${visitedCount}/${total}`;

  const blocksBadge = $("blocksBadge");
  if (blocksBadge) {
    blocksBadge.classList.toggle("all-visited", visitedCount === total);
  }

  const instructionEl = $("instruction");
  if (visitedCount < total) {
    const remaining = total - visitedCount;
    instructionEl.innerHTML = `Visit every block before the Modak! (<b>${remaining}</b> block${remaining > 1 ? "s" : ""} remaining)`;
    instructionEl.classList.remove("success-text", "warn-text");
  } else {
    instructionEl.innerHTML = `✨ <b>All blocks visited!</b> Now connect to the Modak to win!`;
    instructionEl.classList.add("success-text");
    instructionEl.classList.remove("warn-text");
  }
}

function adjacent(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

function triggerShake(elements) {
  elements.forEach(el => {
    if (!el) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  });
}

function addCell(r, c) {
  if (!puzzle || r < 0 || c < 0 || r >= puzzle.rows || c >= puzzle.cols) return;

  const key = `${r},${c}`;
  // Cannot step on dark stone obstacles
  if (puzzle.obstacles.has(key)) return;

  const next = { r, c };
  const last = path[path.length - 1];

  // Start at Ganesha
  if (!last) {
    if (r !== 0 || c !== 0) return;
    path = [next];
    startedAt = Date.now();
    playSound("step");
  } else if (path.length > 1 && next.r === path[path.length - 2].r && next.c === path[path.length - 2].c) {
    // Backtrack / Undo 1 step
    path.pop();
    playSound("step");
  } else if (adjacent(last, next) && !path.some(p => p.r === r && p.c === c)) {
    // Stepping into the End Modak before all blocks are visited
    if (r === puzzle.end.r && c === puzzle.end.c) {
      // Must have covered all other walkable blocks
      if (path.length < puzzle.totalBlocks - 1) {
        playSound("locked");
        const remaining = puzzle.totalBlocks - (path.length + 1);

        // Highlight remaining unvisited walkable blocks
        const unvisitedCells = puzzle.solution
          .filter(pt => !(pt.r === puzzle.end.r && pt.c === puzzle.end.c) && !path.some(p => p.r === pt.r && p.c === pt.c))
          .map(pt => cellAt(pt.r, pt.c));

        triggerShake([cellAt(puzzle.end.r, puzzle.end.c), ...unvisitedCells]);

        const instructionEl = $("instruction");
        instructionEl.innerHTML = `⚠️ <b>You must visit every block!</b> ${remaining} block${remaining > 1 ? "s" : ""} left.`;
        instructionEl.classList.add("warn-text");
        instructionEl.classList.remove("success-text");
        return;
      }
    }

    path.push(next);
    playSound("step");
  } else {
    return;
  }

  drawPath();
  $("moveCount").textContent = Math.max(0, path.length - 1);
  updateHUD();

  // Victory check: reached end AND all blocks visited
  if (path.length === puzzle.totalBlocks && path.at(-1).r === puzzle.end.r && path.at(-1).c === puzzle.end.c) {
    complete();
  }
}

function pointerCell(e) {
  const rect = $("board").getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * puzzle.cols;
  const y = (e.clientY - rect.top) / rect.height * puzzle.rows;
  return { r: Math.floor(y), c: Math.floor(x) };
}

function onPointerDown(e) {
  if (e.button !== 0 && e.pointerType === "mouse") return;
  e.preventDefault();
  drawing = true;
  const p = pointerCell(e);
  addCell(p.r, p.c);
}

function onPointerMove(e) {
  if (!drawing) return;
  e.preventDefault();
  const p = pointerCell(e);
  const last = path.at(-1);
  if (!last || p.r !== last.r || p.c !== last.c) {
    addCell(p.r, p.c);
  }
}

function stopDrawing() {
  drawing = false;
}

function complete() {
  drawing = false;
  clearInterval(timer);
  playSound("win");

  const moves = path.length - 1;
  const timeSec = Math.max(0.2, (Date.now() - startedAt) / 1000);
  const timeSecRound = Math.round(timeSec);
  const formattedTime = timeSec < 60 ? `${timeSec.toFixed(1)}s` : `${Math.floor(timeSec / 60)}m ${(timeSec % 60).toFixed(0)}s`;

  // Timing Star Rules:
  // <= 25s: 3 stars (★★★)
  // 25s - 60s: 2 stars (★★☆)
  // > 60s (1 min): 1 star (★☆☆)
  const stars = timeSec <= 25 ? 3 : timeSec <= 60 ? 2 : 1;

  // Track overall personal best time across all levels played
  const currentExact = Number(timeSec.toFixed(1));
  let isNewOverallBest = false;
  if (save.overallBestTime === null || save.overallBestTime === undefined || currentExact < save.overallBestTime) {
    save.overallBestTime = currentExact;
    isNewOverallBest = true;
  }

  const old = save.completed[level];
  save.completed[level] = { stars, moves, time: timeSecRound, exactTime: timeSec.toFixed(1) };
  if (level < 500) {
    save.current = Math.max(save.current, level + 1);
  }
  persist();

  // Record into live Timing Leaderboard
  const lbResult = recordLeaderboardEntry(level, timeSec, moves);

  $("resultMoves").textContent = moves;
  $("resultTime").textContent = formattedTime;
  $("resultBest").textContent = save.overallBestTime ? `${save.overallBestTime}s` : formattedTime;
  $("stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  $("newBest").classList.toggle("hidden", !isNewOverallBest);

  const rankBadge = $("resultRankBadge");
  if (rankBadge) {
    rankBadge.classList.remove("hidden");
    $("resultRankText").textContent = `Rank #${lbResult.rank} on Leaderboard!`;
  }

  // Update Difficulty Cleared Badge in Modal
  const tier = puzzle?.difficulty || getDifficultyTier(level);
  const resDiff = $("resultDiffBadge");
  if (resDiff) {
    resDiff.textContent = `${tier.icon} ${tier.name} Cleared!`;
    resDiff.className = `diff-result-badge ${tier.modalClass}`;
    resDiff.classList.remove("hidden");
  }

  $("overlay").classList.remove("hidden");
}

function undo() {
  if (path.length > 1) {
    path.pop();
    playSound("step");
    drawPath();
    $("moveCount").textContent = Math.max(0, path.length - 1);
    updateHUD();
  }
}

function reset() {
  path = [{ r: 0, c: 0 }];
  levelHints = 3; // Reset hints to 3 on every level reset
  updateHintHUD();
  startedAt = Date.now();
  updateHeaderStars(3); // Reset to 3 lit stars
  updateLiveTimer();
  playSound("step");
  drawPath();
  $("moveCount").textContent = 0;
  updateHUD();
}

function hint() {
  if (!puzzle || levelHints < 1) return;

  // Find next cell on solution path
  let nextCell = null;
  for (let i = 0; i < puzzle.solution.length; i++) {
    const pt = puzzle.solution[i];
    if (!path.some(p => p.r === pt.r && p.c === pt.c)) {
      nextCell = pt;
      break;
    }
  }

  if (!nextCell && puzzle.solution.length) {
    nextCell = puzzle.solution[puzzle.solution.length - 1];
  }

  if (nextCell) {
    levelHints--;
    updateHintHUD();
    playSound("step");
    const cell = cellAt(nextCell.r, nextCell.c);
    if (cell) {
      cell.classList.add("hint-cell");
      setTimeout(() => cell.classList.remove("hint-cell"), 1800);
    }
  }
}

function openLevels() {
  show("levelsScreen");
  const groups = $("levelGroups");
  groups.innerHTML = "";

  for (let g = 0; g < 10; g++) {
    const startLvl = g * 50 + 1;
    const endLvl = (g + 1) * 50;
    const tier = getDifficultyTier(startLvl);
    let tierClass = "tier-easy";
    if (startLvl > 50 && startLvl <= 100) tierClass = "tier-hard";
    else if (startLvl > 100 && startLvl <= 250) tierClass = "tier-expert";
    else if (startLvl > 250 && startLvl <= 400) tierClass = "tier-master";
    else if (startLvl > 400) tierClass = "tier-legend";

    const wrap = document.createElement("section");
    wrap.className = "level-group";
    wrap.innerHTML = `
      <div class="level-group-header">
        <h3>${startLvl} — ${endLvl}</h3>
        <span class="level-group-tier ${tierClass}">${tier.name}</span>
      </div>
      <div class="level-grid"></div>
    `;
    const grid = wrap.querySelector(".level-grid");

    for (let n = startLvl; n <= endLvl; n++) {
      const b = document.createElement("button");
      const done = save.completed[n];
      const locked = n > Math.max(1, save.current);

      b.className = `level-button ${done ? "done" : ""} ${n === save.current ? "current" : ""} ${locked ? "locked" : ""}`;
      b.textContent = locked ? "🔒" : n;
      b.disabled = locked;

      if (done) {
        b.innerHTML = `${n}<span class="mini-stars">${"★".repeat(done.stars)}</span>`;
      }
      b.onclick = () => startGame(n);
      grid.appendChild(b);
    }
    groups.appendChild(wrap);
  }

  const doneCount = Object.keys(save.completed).length;
  const stars = Object.values(save.completed).reduce((a, x) => a + x.stars, 0);
  $("journeyComplete").textContent = doneCount;
  $("journeyStars").textContent = stars;
  $("journeyBar").style.width = `${(doneCount / 500) * 100}%`;
}

// Global Event Listeners
document.addEventListener("pointerdown", e => {
  startAudioOnUserGesture();
  if (e.target.closest("#board")) {
    onPointerDown(e);
  }
});

document.addEventListener("pointermove", onPointerMove, { passive: false });
document.addEventListener("pointerup", stopDrawing);
document.addEventListener("pointercancel", stopDrawing);

// Radio change for Mantra track
document.addEventListener("change", e => {
  if (e.target.name === "mantraTrack") {
    switchMantraTrack(e.target.value);
  }
});

// Tap and Action handling
document.addEventListener("click", e => {
  startAudioOnUserGesture();

  const cell = e.target.closest(".cell");
  if (cell && !drawing) {
    const r = parseInt(cell.dataset.r, 10);
    const c = parseInt(cell.dataset.c, 10);
    if (!isNaN(r) && !isNaN(c)) {
      addCell(r, c);
    }
  }

  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "play") {
    if (!currentUser) {
      openLogin(true);
    } else {
      startGame(save.current);
    }
  }
  if (action === "openLogin") openLogin(false);
  if (action === "closeLogin") closeLogin();
  if (action === "leaderboard") openLeaderboard("all");
  if (action === "closeLeaderboard") closeLeaderboard();
  if (action === "openAudio" || action === "sound") openAudioModal();
  if (action === "closeAudio") closeAudioModal();
  if (action === "toggleBGM") toggleBGM();
  if (action === "toggleMantra") toggleMantra();
  if (action === "toggleSFX") toggleSFX();

  if (action === "playFromHowto") {
    $("howtoModal").classList.add("hidden");
    if (!currentUser) {
      openLogin(true);
    } else {
      startGame(1);
    }
  }
  if (action === "howto") $("howtoModal").classList.remove("hidden");
  if (action === "closeHowto") $("howtoModal").classList.add("hidden");
  if (action === "levels") {
    $("overlay").classList.add("hidden");
    openLevels();
  }
  if (action === "home") {
    clearInterval(timer);
    show("homeScreen");
    $("playLabel").textContent = save.current > 1 ? `CONTINUE · ${save.current}` : "PLAY";
  }
  if (action === "reset") reset();
  if (action === "undo") undo();
  if (action === "hint") hint();
  if (action === "retry") {
    $("overlay").classList.add("hidden");
    startGame(level);
  }
  if (action === "next") {
    $("overlay").classList.add("hidden");
    startGame(Math.min(500, level + 1));
  }
});

document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "r") reset();
  if (e.key.toLowerCase() === "z") undo();
  if (e.key.toLowerCase() === "h") hint();
  if (e.key === "Escape") {
    $("overlay").classList.add("hidden");
    $("howtoModal").classList.add("hidden");
    $("loginModal").classList.add("hidden");
    $("leaderboardModal").classList.add("hidden");
    closeAudioModal();
  }
});

window.addEventListener("resize", () => {
  if (puzzle) drawPath();
});

window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    if (puzzle) drawPath();
  }, 100);
});

// Login Form Submission
const loginForm = $("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", e => {
    e.preventDefault();
    const nameInput = $("playerNameInput");
    const stateSelect = $("playerStateSelect");
    const name = nameInput ? nameInput.value.trim() : "";
    const state = stateSelect ? stateSelect.value.trim() : "";
    if (!name || !state) return;

    saveUser({ name, state });
    closeLogin();

    if (pendingPlay) {
      pendingPlay = false;
      startGame(save.current);
    }
  });
}

// Leaderboard Filter Chips & Select Level Listener
document.addEventListener("click", e => {
  const chip = e.target.closest(".lb-filter-chip");
  if (chip && chip.dataset.filter) {
    openLeaderboard(chip.dataset.filter);
  }
});

const lbSelect = $("lbSelectLevel");
if (lbSelect) {
  lbSelect.addEventListener("change", e => {
    if (e.target.value) {
      openLeaderboard(e.target.value);
    }
  });
}

// Initialize UI
updateProfileUI();
updateHintHUD();
updateAudioUI();
$("playLabel").textContent = save.current > 1 ? `CONTINUE · ${save.current}` : "PLAY";
