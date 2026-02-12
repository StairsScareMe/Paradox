const TILE = 64;
const TICK_MS = 16;
const MOVE_SPEED = 0.14;
const PLAYER_RADIUS = 0.28;
const STORAGE_PREFIX = 'paradoxSprite:';

const SPRITE_CONFIG = {
  player: 'assets/models/player.png',
  ghost: 'assets/models/ghost.png',
  box: 'assets/models/box.png',
  wall: 'assets/models/wall.png',
  buttonOn: 'assets/models/button_on.png',
  buttonOff: 'assets/models/button_off.png',
  doorOpen: 'assets/models/door_open.png',
  doorClosed: 'assets/models/door_closed.png',
  goal: 'assets/models/goal.png'
};

const SPRITE_LABELS = {
  player: 'Player',
  ghost: 'Ghost',
  box: 'Box',
  wall: 'Wall',
  buttonOn: 'Button (On)',
  buttonOff: 'Button (Off)',
  doorOpen: 'Door (Open)',
  doorClosed: 'Door (Closed)',
  goal: 'Goal'
};

const LEVELS = [
  {
    name: 'Level 1 — Basic Cooperation',
    objective: 'Press both buttons at the same time to open the door.',
    hint: 'Stand on one button, press R, then run to the other button.',
    requiredLoops: 1,
    width: 10,
    height: 8,
    walls: [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[0,1],[9,1],[0,2],[9,2],[0,3],[9,3],[0,4],[9,4],[0,5],[9,5],[0,6],[9,6],[0,7],[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7],[8,7],[9,7],[4,1],[4,2],[4,3],[4,4]],
    buttons: [[2, 2], [7, 5]],
    door: [5, 3],
    start: [2, 5],
    goal: [7, 2],
    boxes: []
  },
  {
    name: 'Level 2 — Timing Puzzle',
    objective: 'Hold both pressure plates with your past and present selves.',
    hint: 'Record yourself on one plate, rewind, then stand on the other plate.',
    requiredLoops: 1,
    width: 10,
    height: 8,
    walls: [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[0,1],[9,1],[0,2],[9,2],[0,3],[9,3],[0,4],[9,4],[0,5],[9,5],[0,6],[9,6],[0,7],[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7],[8,7],[9,7],[3,1],[3,2],[3,3],[3,4],[6,3],[7,3]],
    buttons: [[2, 1], [7, 5]],
    door: [5, 3],
    start: [2, 5],
    goal: [7, 5],
    boxes: []
  },
  {
    name: 'Level 3 — Paradox Protocol',
    objective: 'Reach the exit without blocking your own timeline.',
    hint: 'Crossing your ghost now warns you, but never kills you.',
    requiredLoops: 1,
    width: 10,
    height: 8,
    walls: [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[0,1],[9,1],[0,2],[9,2],[0,3],[9,3],[0,4],[9,4],[0,5],[9,5],[0,6],[9,6],[0,7],[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7],[8,7],[9,7],[4,1],[5,1],[6,1],[6,2],[6,4],[6,5],[3,5],[4,5]],
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
const spriteInputsEl = document.getElementById('spriteInputs');
const clearSpritesBtn = document.getElementById('clearSprites');

const dirs = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]
};

let state = null;
const keysDown = new Set();
let queuedInteract = false;
const sprites = {};

function loadSprite(name, src) {
  const img = new Image();
  img.addEventListener('load', () => { sprites[name] = img; });
  img.src = src;
}

function loadSprites() {
  Object.entries(SPRITE_CONFIG).forEach(([name, path]) => loadSprite(name, path));
}

function loadUserSpritesFromStorage() {
  Object.keys(SPRITE_CONFIG).forEach((name) => {
    const key = `${STORAGE_PREFIX}${name}`;
    const dataUrl = localStorage.getItem(key);
    if (dataUrl) loadSprite(name, dataUrl);
  });
}

function buildSpriteUploader() {
  Object.keys(SPRITE_CONFIG).forEach((name) => {
    const label = document.createElement('label');
    label.textContent = SPRITE_LABELS[name];
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/*';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const dataUrl = String(reader.result);
        localStorage.setItem(`${STORAGE_PREFIX}${name}`, dataUrl);
        loadSprite(name, dataUrl);
        state.status = `${SPRITE_LABELS[name]} photo loaded.`;
        syncHud();
      });
      reader.readAsDataURL(file);
    });
    label.appendChild(input);
    spriteInputsEl.appendChild(label);
  });

  clearSpritesBtn.addEventListener('click', () => {
    Object.keys(SPRITE_CONFIG).forEach((name) => {
      localStorage.removeItem(`${STORAGE_PREFIX}${name}`);
      delete sprites[name];
      loadSprite(name, SPRITE_CONFIG[name]);
    });
    state.status = 'Uploaded photos cleared.';
    syncHud();
  });
}

function initLevel(index) {
  const base = LEVELS[index];
  state = {
    levelIndex: index,
    level: structuredClone(base),
    player: { x: base.start[0] + 0.5, y: base.start[1] + 0.5 },
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

function resetLevel(keepLoops = true) {
  const levelIndex = state.levelIndex;
  const loops = keepLoops ? state.loops : 0;
  initLevel(levelIndex);
  state.loops = loops;
  state.status = 'Level reset.';
  syncHud();
}

function syncHud() {
  levelNameEl.textContent = state.level.name;
  loopsEl.textContent = state.loops;
  statusEl.textContent = state.status;
  statusEl.classList.toggle('glitch', state.status.includes('timeline warning'));
  objectiveEl.textContent = state.level.objective;
  hintEl.textContent = state.level.hint;
}

function key(x, y) { return `${x},${y}`; }
function onGrid(x, y) { return x >= 0 && y >= 0 && x < state.level.width && y < state.level.height; }
function isWall(x, y) { return state.level.walls.some(([wx, wy]) => wx === x && wy === y); }
function isBox(x, y) { return state.boxes.find((b) => b.x === x && b.y === y); }
function isGoal(x, y) {
  const [gx, gy] = state.level.goal;
  return x === gx && y === gy;
}

function solidTile(tx, ty) {
  const [dx, dy] = state.level.door;
  if (isWall(tx, ty)) return true;
  if (!state.doorOpen && tx === dx && ty === dy) return true;
  if (!state.doorOpen && isGoal(tx, ty)) return true;
  return false;
}

function walkable(x, y) {
  if (!onGrid(x, y)) return false;
  const minX = Math.floor(x - PLAYER_RADIUS);
  const maxX = Math.floor(x + PLAYER_RADIUS);
  const minY = Math.floor(y - PLAYER_RADIUS);
  const maxY = Math.floor(y + PLAYER_RADIUS);
  for (let ty = minY; ty <= maxY; ty += 1) {
    for (let tx = minX; tx <= maxX; tx += 1) {
      if (solidTile(tx, ty)) return false;
    }
  }
  return true;
}

function buttonPressedMap() {
  const pressed = new Set();
  const everyone = [state.player, ...state.ghosts.map((g) => g.pos), ...state.boxes];
  for (const [bx, by] of state.level.buttons) {
    if (everyone.some((e) => e.x === bx && e.y === by)) pressed.add(key(bx, by));
  }
  return pressed;
}

function updateDoorState() {
  const pressed = buttonPressedMap();
  state.doorOpen = state.level.buttons.every(([bx, by]) => pressed.has(key(bx, by)));
}

function attemptMove(entity, dx, dy) {
  const nx = entity.x + dx;
  const ny = entity.y + dy;
  if (!walkable(nx, ny)) {
    if (entity === state.player && isGoal(nx, ny) && !state.doorOpen) {
      state.status = 'Goal is sealed. Unlock the door first.';
      syncHud();
    }
    return false;
  }
  entity.x = nx;
  entity.y = ny;
  return true;
}

function rewind() {
  if (!state.recording.length) {
    state.status = 'No history to rewind yet.';
    syncHud();
    return;
  }
  state.ghosts.push({
    path: state.recording.map((f) => ({ ...f })),
    pos: { x: state.level.start[0] + 0.5, y: state.level.start[1] + 0.5 }
  });
  state.loops += 1;
  state.player = { x: state.level.start[0] + 0.5, y: state.level.start[1] + 0.5 };
  state.recording = [];
  state.tick = 0;
  state.status = 'Loop created. Work with your past self.';
  queuedInteract = false;
  syncHud();
}

function paradoxWarningTriggered() {
  if (state.tick === 0) return false;
  return state.ghosts.some((ghost) => Math.hypot(ghost.pos.x - state.player.x, ghost.pos.y - state.player.y) < 0.25);
}

function tryFinishLevel() {
  const [gx, gy] = state.level.goal;
  if (Math.floor(state.player.x) === gx && Math.floor(state.player.y) === gy) {
    if (state.loops < state.level.requiredLoops) {
      state.status = `Create at least ${state.level.requiredLoops} copy before exiting.`;
      syncHud();
      return;
    }

    if (!state.doorOpen) {
      state.status = 'Exit is locked. Keep required buttons pressed.';
      syncHud();
      return;
    }

    state.finished = true;
    state.status = state.levelIndex === LEVELS.length - 1 ? 'You escaped the paradox!' : 'Level complete! Press M for next level.';
    syncHud();
  }
}

function step() {
  if (!state || state.finished) return;

  for (const ghost of state.ghosts) {
    const frame = ghost.path[state.tick];
    if (!frame) continue;
    ghost.pos.x = frame.x;
    ghost.pos.y = frame.y;
  }

  updateDoorState();
  let mx = 0;
  let my = 0;
  if (keysDown.has('ArrowUp') || keysDown.has('w')) my -= 1;
  if (keysDown.has('ArrowDown') || keysDown.has('s')) my += 1;
  if (keysDown.has('ArrowLeft') || keysDown.has('a')) mx -= 1;
  if (keysDown.has('ArrowRight') || keysDown.has('d')) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    attemptMove(state.player, (mx / len) * MOVE_SPEED, (my / len) * MOVE_SPEED);
  }

  if (queuedInteract) {
    state.status = state.doorOpen ? 'Interaction successful: timeline aligned.' : 'Interaction failed: no active target.';
  }

  if (paradoxWarningTriggered()) {
    state.status = 'You crossed your ghost (timeline warning only).';
    state.glitchedUntil = performance.now() + 450;
    syncHud();
  }

  updateDoorState();
  tryFinishLevel();

  state.recording.push({
    t: state.tick,
    x: state.player.x,
    y: state.player.y,
    action: queuedInteract ? 'interact' : null
  });

  queuedInteract = false;
  state.tick += 1;

  if (!state.finished && !state.status.includes('timeline warning') && !state.status.includes('Interaction')) {
    state.status = state.doorOpen ? 'Door is open.' : 'Door is closed.';
    syncHud();
  }
}

function drawSprite(name, x, y, inset = 0, alpha = 1) {
  const sprite = sprites[name];
  if (!sprite) return false;
  const px = x * TILE + inset;
  const py = y * TILE + inset;
  const size = TILE - (inset * 2);
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, px, py, size, size);
  ctx.globalAlpha = 1;
  return true;
}

function draw() {
  if (!state) return;
  const glitch = performance.now() < state.glitchedUntil;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (glitch) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);

  for (let y = 0; y < state.level.height; y++) {
    for (let x = 0; x < state.level.width; x++) {
      ctx.fillStyle = '#131a2a';
      ctx.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
    }
  }

  for (const [x, y] of state.level.walls) {
    if (!drawSprite('wall', x, y)) {
      ctx.fillStyle = '#3a4664';
      ctx.fillRect(x * TILE, y * TILE, TILE - 1, TILE - 1);
    }
  }

  for (const [x, y] of state.level.buttons) {
    const down = buttonPressedMap().has(key(x, y));
    if (!drawSprite(down ? 'buttonOn' : 'buttonOff', x, y, 16)) {
      ctx.fillStyle = down ? '#89ff9a' : '#f7d45c';
      ctx.fillRect(x * TILE + 16, y * TILE + 16, TILE - 32, TILE - 32);
    }
  }

  const [doorX, doorY] = state.level.door;
  if (!drawSprite(state.doorOpen ? 'doorOpen' : 'doorClosed', doorX, doorY, 8)) {
    ctx.fillStyle = state.doorOpen ? '#304860' : '#af4f63';
    ctx.fillRect(doorX * TILE + 8, doorY * TILE + 8, TILE - 16, TILE - 16);
  }

  const [goalX, goalY] = state.level.goal;
  if (!drawSprite('goal', goalX, goalY, 12)) {
    ctx.fillStyle = '#68d7ff';
    ctx.beginPath();
    ctx.arc(goalX * TILE + TILE / 2, goalY * TILE + TILE / 2, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const box of state.boxes) {
    if (!drawSprite('box', box.x, box.y, 12)) {
      ctx.fillStyle = '#b58f66';
      ctx.fillRect(box.x * TILE + 12, box.y * TILE + 12, TILE - 24, TILE - 24);
    }
  }

  for (const ghost of state.ghosts) {
    if (!drawSprite('ghost', ghost.pos.x - 0.5, ghost.pos.y - 0.5, 12, 0.55)) {
      ctx.fillStyle = '#88a8ff';
      ctx.globalAlpha = 0.55;
      ctx.fillRect((ghost.pos.x - 0.5) * TILE + 12, (ghost.pos.y - 0.5) * TILE + 12, TILE - 24, TILE - 24);
      ctx.globalAlpha = 1;
    }
  }

  if (!drawSprite('player', state.player.x - 0.5, state.player.y - 0.5, 12)) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect((state.player.x - 0.5) * TILE + 12, (state.player.y - 0.5) * TILE + 12, TILE - 24, TILE - 24);
  }

  if (glitch) {
    ctx.fillStyle = 'rgba(255, 110, 127, 0.16)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.restore();
  requestAnimationFrame(draw);
}

window.addEventListener('keydown', (event) => {
  if (event.key in dirs) keysDown.add(event.key);
  if (event.key.toLowerCase() === 'e') queuedInteract = true;
  if (event.key.toLowerCase() === 'r') rewind();
  if (event.key.toLowerCase() === 'n') resetLevel();
  if (event.key.toLowerCase() === 'm') {
    if (!state.finished) {
      state.status = 'Finish the current level before moving on.';
      syncHud();
      return;
    }
    initLevel((state.levelIndex + 1) % LEVELS.length);
  }
});
window.addEventListener('keyup', (event) => {
  if (event.key in dirs) keysDown.delete(event.key);
});

loadSprites();
loadUserSpritesFromStorage();
buildSpriteUploader();
initLevel(0);
setInterval(step, TICK_MS);
requestAnimationFrame(draw);
