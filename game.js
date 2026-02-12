const TILE = 64;
const TICK_MS = 190;

const LEVELS = [
  {
    name: 'Level 1 — Basic Cooperation',
    objective: 'Press both buttons at the same time to open the door.',
    hint: 'Stand on one button, press R, then run to the other button.',
    width: 10,
    height: 8,
    walls: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
      [0, 1], [9, 1], [0, 2], [9, 2], [0, 3], [9, 3], [0, 4], [9, 4], [0, 5], [9, 5], [0, 6], [9, 6],
      [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7],
      [4, 1], [4, 2], [4, 3], [4, 4]
    ],
    buttons: [[2, 2], [7, 5]],
    door: [5, 3],
    start: [2, 5],
    goal: [7, 2],
    boxes: []
  },
  {
    name: 'Level 3 — Timing Puzzle',
    objective: 'Get the box onto the pressure plate while your past self holds the door.',
    hint: 'Past-you stands on the button. Present-you pushes the box through the open door.',
    width: 10,
    height: 8,
    walls: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
      [0, 1], [9, 1], [0, 2], [9, 2], [0, 3], [9, 3], [0, 4], [9, 4], [0, 5], [9, 5], [0, 6], [9, 6],
      [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7],
      [3, 1], [3, 2], [3, 3], [3, 4], [6, 3], [7, 3]
    ],
    buttons: [[2, 1]],
    door: [5, 3],
    start: [2, 5],
    goal: [7, 5],
    boxes: [[4, 5]]
  },
  {
    name: 'Level 6 — Paradox Protocol',
    objective: 'Reach the exit without crossing your own timeline.',
    hint: 'If you block your past self, reality glitches and the loop collapses.',
    width: 10,
    height: 8,
    walls: [
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
      [0, 1], [9, 1], [0, 2], [9, 2], [0, 3], [9, 3], [0, 4], [9, 4], [0, 5], [9, 5], [0, 6], [9, 6],
      [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7],
      [4, 1], [5, 1], [6, 1], [6, 2], [6, 4], [6, 5], [3, 5], [4, 5]
    ],
    buttons: [[2, 2]],
    door: [6, 3],
    start: [2, 5],
    goal: [7, 2],
    boxes: []
  }
];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const levelNameEl = document.getElementById('levelName');
const loopsEl = document.getElementById('loops');
const statusEl = document.getElementById('status');
const objectiveEl = document.getElementById('objective');
const hintEl = document.getElementById('hint');

const dirs = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0]
};

let state = null;
let queuedMove = null;
let queuedInteract = false;
let gameInterval = null;

function initLevel(index) {
  const base = LEVELS[index];
  state = {
    levelIndex: index,
    level: structuredClone(base),
    player: { x: base.start[0], y: base.start[1] },
    boxes: base.boxes.map(([x, y]) => ({ x, y })),
    ghosts: [],
    recording: [],
    tick: 0,
    loops: 0,
    status: 'Ready',
    glitchedUntil: 0,
    doorOpen: false,
    finished: false
  };
  syncHud();
}

function syncHud() {
  const { level } = state;
  levelNameEl.textContent = level.name;
  loopsEl.textContent = state.loops;
  statusEl.textContent = state.status;
  statusEl.classList.toggle('glitch', state.status.includes('timeline'));
  objectiveEl.textContent = level.objective;
  hintEl.textContent = level.hint;
}

function key(x, y) {
  return `${x},${y}`;
}

function onGrid(x, y) {
  return x >= 0 && y >= 0 && x < state.level.width && y < state.level.height;
}

function isWall(x, y) {
  return state.level.walls.some(([wx, wy]) => wx === x && wy === y);
}

function doorTile() {
  const [x, y] = state.level.door;
  return { x, y };
}

function isBox(x, y) {
  return state.boxes.find((b) => b.x === x && b.y === y);
}

function walkable(x, y) {
  if (!onGrid(x, y) || isWall(x, y)) return false;
  const door = doorTile();
  if (!state.doorOpen && door.x === x && door.y === y) return false;
  return true;
}

function buttonPressedMap() {
  const pressed = new Set();
  const everyone = [state.player, ...state.ghosts.map((g) => g.pos), ...state.boxes];
  for (const [bx, by] of state.level.buttons) {
    if (everyone.some((entity) => entity.x === bx && entity.y === by)) {
      pressed.add(key(bx, by));
    }
  }
  return pressed;
}

function updateDoorState() {
  const pressed = buttonPressedMap();
  state.doorOpen = state.level.buttons.every(([bx, by]) => pressed.has(key(bx, by)));
}

function attemptMove(entity, dx, dy) {
  const nextX = entity.x + dx;
  const nextY = entity.y + dy;
  if (!walkable(nextX, nextY)) return false;

  if (entity === state.player) {
    const box = isBox(nextX, nextY);
    if (box) {
      const pushX = box.x + dx;
      const pushY = box.y + dy;
      if (!walkable(pushX, pushY) || isBox(pushX, pushY)) return false;
      box.x = pushX;
      box.y = pushY;
    }
  }

  entity.x = nextX;
  entity.y = nextY;
  return true;
}

function rewind() {
  if (!state.recording.length) {
    state.status = 'No history to rewind yet.';
    syncHud();
    return;
  }

  state.ghosts.push({
    path: state.recording.map((frame) => ({ ...frame })),
    pos: { x: state.level.start[0], y: state.level.start[1] }
  });

  state.loops += 1;
  state.player = { x: state.level.start[0], y: state.level.start[1] };
  state.recording = [];
  state.tick = 0;
  state.status = 'Loop created. Work with your past self.';
  queuedMove = null;
  queuedInteract = false;
  syncHud();
}

function triggerParadox() {
  state.status = 'You cannot sabotage yourself. (timeline break)';
  state.glitchedUntil = performance.now() + 1200;
  syncHud();

  const idx = state.levelIndex;
  setTimeout(() => initLevel(idx), 380);
}

function advanceGhosts() {
  for (const ghost of state.ghosts) {
    const frame = ghost.path[state.tick];
    if (!frame) continue;
    ghost.pos.x = frame.x;
    ghost.pos.y = frame.y;
  }
}

function detectParadox() {
  return state.ghosts.some((ghost) => ghost.pos.x === state.player.x && ghost.pos.y === state.player.y);
}

function tryFinishLevel() {
  const [gx, gy] = state.level.goal;
  if (state.player.x === gx && state.player.y === gy) {
    state.finished = true;
    state.status = state.levelIndex === LEVELS.length - 1 ? 'You escaped the paradox!' : 'Level complete! Press N for next level.';
    syncHud();
  }
}

function step() {
  if (!state || state.finished) return;

  advanceGhosts();
  updateDoorState();

  if (queuedMove) {
    attemptMove(state.player, queuedMove[0], queuedMove[1]);
  }

  if (queuedInteract) {
    state.status = state.doorOpen ? 'Interaction successful: timeline aligned.' : 'Interaction failed: no active target.';
  }

  if (detectParadox()) {
    triggerParadox();
    return;
  }

  updateDoorState();
  tryFinishLevel();

  state.recording.push({
    t: state.tick,
    x: state.player.x,
    y: state.player.y,
    action: queuedInteract ? 'interact' : null
  });

  queuedMove = null;
  queuedInteract = false;
  state.tick += 1;

  if (!state.finished && !state.status.includes('timeline')) {
    state.status = state.doorOpen ? 'Door is open.' : 'Door is closed.';
    syncHud();
  }
}

function draw() {
  if (!state) return;

  const now = performance.now();
  const glitch = now < state.glitchedUntil;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (glitch) {
    const shakeX = (Math.random() - 0.5) * 8;
    const shakeY = (Math.random() - 0.5) * 8;
    ctx.translate(shakeX, shakeY);
  }

  for (let y = 0; y < state.level.height; y++) {
    for (let x = 0; x < state.level.width; x++) {
      ctx.fillStyle = '#131a2a';
      ctx.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
    }
  }

  for (const [x, y] of state.level.walls) {
    ctx.fillStyle = '#3a4664';
    ctx.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
  }

  for (const [x, y] of state.level.buttons) {
    const down = buttonPressedMap().has(key(x, y));
    ctx.fillStyle = down ? '#89ff9a' : '#f7d45c';
    ctx.fillRect(x * TILE + 16, y * TILE + 16, TILE - 32, TILE - 32);
  }

  const [doorX, doorY] = state.level.door;
  ctx.fillStyle = state.doorOpen ? '#304860' : '#af4f63';
  ctx.fillRect(doorX * TILE + 8, doorY * TILE + 8, TILE - 16, TILE - 16);

  const [goalX, goalY] = state.level.goal;
  ctx.fillStyle = '#68d7ff';
  ctx.beginPath();
  ctx.arc(goalX * TILE + TILE / 2, goalY * TILE + TILE / 2, 14, 0, Math.PI * 2);
  ctx.fill();

  for (const box of state.boxes) {
    ctx.fillStyle = '#b58f66';
    ctx.fillRect(box.x * TILE + 12, box.y * TILE + 12, TILE - 24, TILE - 24);
  }

  for (const ghost of state.ghosts) {
    ctx.fillStyle = glitch ? '#ff6e7f' : '#88a8ff';
    ctx.globalAlpha = 0.55;
    ctx.fillRect(ghost.pos.x * TILE + 12, ghost.pos.y * TILE + 12, TILE - 24, TILE - 24);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(state.player.x * TILE + 12, state.player.y * TILE + 12, TILE - 24, TILE - 24);

  if (glitch) {
    ctx.fillStyle = 'rgba(255, 110, 127, 0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.restore();
  requestAnimationFrame(draw);
}

window.addEventListener('keydown', (event) => {
  if (event.key in dirs) {
    queuedMove = dirs[event.key];
  }

  if (event.key.toLowerCase() === 'e') {
    queuedInteract = true;
  }

  if (event.key.toLowerCase() === 'r') {
    rewind();
  }

  if (event.key.toLowerCase() === 'n') {
    const next = (state.levelIndex + 1) % LEVELS.length;
    initLevel(next);
  }
});

initLevel(0);
gameInterval = setInterval(step, TICK_MS);
requestAnimationFrame(draw);
