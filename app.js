// Modak Path — Reference-Accurate Engine
// Aesthetic: Slate stone obstacles with engraved mandala, Baby Ganesha start, Modak bowl end, mandatory 100% block visit rule.

const defaultSave = { current: 1, completed: {}, hints: 3, sound: true };
let save = loadSave();
let level = save.current;
let puzzle = null;
let path = [];
let drawing = false;
let startedAt = 0;
let timer = null;
let audioCtx = null;

const $ = id => document.getElementById(id);

function loadSave() {
  try {
    return { ...defaultSave, ...JSON.parse(localStorage.getItem("modak-path-save") || "{}") };
  } catch {
    return { ...defaultSave };
  }
}

function persist() {
  localStorage.setItem("modak-path-save", JSON.stringify(save));
}

// Procedural Web Audio synthesizer
function playSound(type) {
  if (!save.sound) return;
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

// Dimensions for level: 4x4 up to 5x5 / 6x6
function dimsFor(n) {
  if (n <= 2) return { rows: 4, cols: 4 };
  if (n <= 12) return { rows: 4, cols: 5 }; // Level 5 matches the 4x5 reference screenshot
  if (n <= 35) return { rows: 5, cols: 5 };
  if (n <= 80) return { rows: 5, cols: 6 };
  if (n <= 200) return { rows: 6, cols: 6 };
  return { rows: 6, cols: 7 };
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

// Generate guaranteed solvable puzzle where obstacles are SCATTERED throughout the entire grid.
// Evaluates candidate self-avoiding paths for spatial scatter:
// - Obstacles distributed across all 4 quadrants
// - Spread across multiple rows and columns
// - Clumps of 3+ strictly avoided, keeping obstacles as isolated or pairwise stones like Image 2
function makePuzzle(n) {
  const { rows, cols } = dimsFor(n);
  const totalCells = rows * cols;
  const start = { r: 0, c: 0 };
  const end = { r: rows - 1, c: cols - 1 };

  // Parity rule: Start (0,0) is parity 0.
  // A path of length L ending on (end.r, end.c) requires:
  // L % 2 !== (end.r + end.c) % 2
  const endParity = (end.r + end.c) % 2;
  const reqLenParity = (endParity === 1) ? 0 : 1;

  // Target obstacle density: ~22% to 35% of total cells
  const minObs = Math.max(3, Math.floor(totalCells * 0.22));
  const maxObs = Math.max(minObs + 1, Math.floor(totalCells * 0.35));

  const candidateLengths = [];
  for (let obs = minObs; obs <= maxObs; obs++) {
    const walkLen = totalCells - obs;
    if (walkLen % 2 === reqLenParity && walkLen >= rows + cols - 1) {
      candidateLengths.push(walkLen);
    }
  }

  // Prioritize lengths with ideal ~30% obstacle density
  candidateLengths.sort((a, b) => {
    const obsA = totalCells - a;
    const obsB = totalCells - b;
    const ideal = totalCells * 0.30;
    return Math.abs(obsA - ideal) - Math.abs(obsB - ideal);
  });

  function evaluate(path) {
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
        for (const [dr, dc] of [[0,1],[1,0],[0,-1],[-1,0]]) {
          const nk = `${curr.r + dr},${curr.c + dc}`;
          if (obsSet.has(nk)) {
            if (curr.r < curr.r + dr || (curr.r === curr.r + dr && curr.c < curr.c + dc)) {
              adjPairs++;
            }
            if (!visited.has(nk)) {
              visited.add(nk);
              q.push({ r: curr.r + dr, c: curr.c + dc });
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
    const maxInRow = Math.max(...rowCounts);
    const maxInCol = Math.max(...colCounts);

    return { maxCluster, adjPairs, quad, obsRows, obsCols, maxInRow, maxInCol, count: obs.length, obs };
  }

  let bestSol = null;
  let bestScore = -Infinity;

  for (const walkLen of candidateLengths) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const rand = seeded((n * 104729 + attempt * 3571 + walkLen * 101) % 233280);
      const visited = new Set();
      const path = [];
      let found = false;

      function dfs(r, c) {
        if (found) return;
        const key = `${r},${c}`;
        visited.add(key);
        path.push({ r, c });

        if (r === end.r && c === end.c) {
          if (path.length === walkLen) {
            found = true;
            return;
          }
          visited.delete(key);
          path.pop();
          return;
        }

        const dist = (end.r - r) + (end.c - c);
        if (dist > walkLen - path.length) {
          visited.delete(key);
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
          if (visited.has(`${nr},${nc}`)) continue;
          if (nr === end.r && nc === end.c && path.length < walkLen - 1) continue;
          dfs(nr, nc);
          if (found) break;
        }

        if (!found) {
          visited.delete(key);
          path.pop();
        }
      }

      dfs(start.r, start.c);

      if (found) {
        const stats = evaluate(path);
        let score = (stats.quad / 4) * 60 +
                    (stats.obsRows / rows) * 40 +
                    (stats.obsCols / cols) * 40;

        // Anti-clustering: reward isolated stones, penalize large clumps
        if (stats.maxCluster > 2) score -= 250;
        else if (stats.maxCluster === 1) score += 70;

        if (stats.maxInRow > 2) score -= 120;
        if (stats.maxInCol > 2) score -= 120;

        score -= stats.adjPairs * 25;

        if (score > bestScore) {
          bestScore = score;
          bestSol = [...path];
          if (stats.maxCluster <= 2 && stats.quad === 4 && stats.obsRows >= rows - 1 && stats.obsCols >= cols - 1 && stats.maxInRow <= 2 && stats.maxInCol <= 2 && stats.adjPairs <= 2) {
            break;
          }
        }
      }
    }
  }

  // Guaranteed fallback: Snake boustrophedon
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
    totalBlocks: bestSol.length
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

  show("gameScreen");
  $("levelNumber").textContent = level;
  $("moveCount").textContent = 0;
  updateHUD();

  renderBoard();
  drawPath();
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
  playSound("win");

  const moves = path.length - 1;
  const time = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const old = save.completed[level];
  const optimalMoves = puzzle.totalBlocks - 1;
  const stars = moves === optimalMoves ? 3 : moves <= optimalMoves + 4 ? 2 : 1;

  save.completed[level] = { stars, moves, time };
  if (level < 500) {
    save.current = Math.max(save.current, level + 1);
  }
  persist();

  $("resultMoves").textContent = moves;
  $("resultTime").textContent = `${time}s`;
  $("resultBest").textContent = old?.moves || moves;
  $("stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  $("newBest").classList.toggle("hidden", !!old && old.moves <= moves);
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
  playSound("step");
  drawPath();
  $("moveCount").textContent = 0;
  updateHUD();
}

function hint() {
  if (!puzzle || save.hints < 1) return;

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
    save.hints--;
    persist();
    $("hintCount").textContent = save.hints;
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
    const wrap = document.createElement("section");
    wrap.className = "level-group";
    wrap.innerHTML = `<h3>${g * 50 + 1} — ${(g + 1) * 50}</h3><div class="level-grid"></div>`;
    const grid = wrap.querySelector(".level-grid");

    for (let n = g * 50 + 1; n <= g * 50 + 50; n++) {
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
  if (e.target.closest("#board")) {
    onPointerDown(e);
  }
});

document.addEventListener("pointermove", onPointerMove, { passive: false });
document.addEventListener("pointerup", stopDrawing);
document.addEventListener("pointercancel", stopDrawing);

// Tap cell support
document.addEventListener("click", e => {
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

  if (action === "play") startGame(save.current);
  if (action === "playFromHowto") {
    $("howtoModal").classList.add("hidden");
    startGame(1);
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
  if (action === "sound") {
    save.sound = !save.sound;
    persist();
    document.querySelectorAll('[data-action="sound"]').forEach(b => {
      b.textContent = save.sound ? "🔊" : "🔇";
    });
  }
});

document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "r") reset();
  if (e.key.toLowerCase() === "z") undo();
  if (e.key.toLowerCase() === "h") hint();
  if (e.key === "Escape") {
    $("overlay").classList.add("hidden");
    $("howtoModal").classList.add("hidden");
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

// Initialize UI
$("playLabel").textContent = save.current > 1 ? `CONTINUE · ${save.current}` : "PLAY";
document.querySelectorAll('[data-action="sound"]').forEach(b => {
  b.textContent = save.sound ? "🔊" : "🔇";
});
