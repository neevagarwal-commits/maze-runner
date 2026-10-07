import * as THREE from 'three';

// ============================================================
// DOM REFERENCES
// ============================================================
const uiOverlay = document.getElementById('uiOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const riddleOverlay = document.getElementById('riddleOverlay');
const transitionOverlay = document.getElementById('transitionOverlay');
const hud = document.getElementById('hud');
const hudStage = document.getElementById('hudStage');
const hudObjective = document.getElementById('hudObjective');
const interactionPrompt = document.getElementById('interactionPrompt');

const transitionTitle = document.getElementById('transitionTitle');
const endTitle = document.getElementById('endTitle');
const endSubtitle = document.getElementById('endSubtitle');
const restartBtn = document.getElementById('restartBtn');

const riddleInputContainer = document.getElementById('riddleInputContainer');
const riddleText = document.getElementById('riddleText');
const riddleFeedback = document.getElementById('riddleFeedback');
const riddleTimerEl = document.getElementById('riddleTimer');
const riddleHeading = document.getElementById('riddleHeading');
const riddleSubheading = document.getElementById('riddleSubheading');

const enemyAlertEl = document.getElementById('enemyAlert');
const hiddenStatusEl = document.getElementById('hiddenStatus');

// Compass, Exit, Scare, Seed
const enemyCompassEl = document.getElementById('enemyCompass');
const compassArrowEl = document.getElementById('compassArrow');
const compassDistEl = document.getElementById('compassDist');
const seedDisplayEl = document.getElementById('seedDisplay');
const exitMeterEl = document.getElementById('exitMeter');
const exitDistanceEl = document.getElementById('exitDistance');
const exitTrendEl = document.getElementById('exitTrend');
const scareOverlay = document.getElementById('scareOverlay');

// ============================================================
// AUDIO SYSTEM (WEB AUDIO API)
// ============================================================
let audioCtx = null;
let ambientGain = null;
let enemyOsc = null;
let enemyGain = null;
let lastFootstepTime = 0;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Ambient Wind (Brown Noise)
    const bufferSize = audioCtx.sampleRate * 5;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Gain compensation
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    
    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0.15; // Increased for better audibility
    
    noise.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(audioCtx.destination);
    noise.start();
    
    setInterval(() => {
        if(audioCtx && audioCtx.state === 'running') {
            filter.frequency.linearRampToValueAtTime(200 + Math.random() * 400, audioCtx.currentTime + 2);
        }
    }, 2000);

    // Enemy Proximity Audio
    enemyOsc = audioCtx.createOscillator();
    enemyOsc.type = 'triangle';
    enemyOsc.frequency.value = 60;
    
    enemyGain = audioCtx.createGain();
    enemyGain.gain.value = 0;
    
    enemyOsc.connect(enemyGain);
    enemyGain.connect(audioCtx.destination);
    enemyOsc.start();
}

function playFootstep(isSprinting) {
    if(!audioCtx || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime;
    const interval = isSprinting ? 0.35 : 0.55;
    if(now - lastFootstepTime < interval) return;
    lastFootstepTime = now;
    
    const bufferSize = audioCtx.sampleRate * 0.1;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = isSprinting ? 1200 : 800;
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.4, now); // Increased for better audibility
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(now);
}

function updateEnemyAudio(dist) {
    if(!enemyGain || !audioCtx) return;
    const now = audioCtx.currentTime;
    const MAX_DIST = 60;
    if (dist > MAX_DIST) {
        enemyGain.gain.setTargetAtTime(0, now, 0.5);
    } else {
        const vol = 1.0 - (dist / MAX_DIST);
        enemyGain.gain.setTargetAtTime(vol * 0.8, now, 0.5); // Increased for better audibility
        enemyOsc.frequency.setTargetAtTime(50 + vol * 60, now, 0.5);
    }
}

function playScareSound() {
    if(!audioCtx) return;
    const now = audioCtx.currentTime;
    
    if(ambientGain) ambientGain.gain.setTargetAtTime(0, now, 0.1);
    if(enemyGain) enemyGain.gain.setTargetAtTime(0, now, 0.1);
    
    // Create loud discordant burst
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    
    osc1.frequency.setValueAtTime(120, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 0.2);
    
    osc2.frequency.setValueAtTime(115, now);
    osc2.frequency.exponentialRampToValueAtTime(750, now + 0.2);
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(2.0, now); // Increased for better audibility
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.5);
    osc2.stop(now + 1.5);
}

// ============================================================
// SCENE, CAMERA, RENDERER
// ============================================================
let camera, scene, renderer;
let playerGroup;
let walls = [];
let floorMeshRef = null;
let enemyMesh, finishTriggerMesh, doorMesh;
let bushMeshes = [];
let bushGridPositions = [];
let propMeshes = []; 
let signMeshes = [];
let intermediateDoorMeshes = [];

// ============================================================
// MAZE CONSTANTS
// ============================================================
const ROWS = 21;
const COLS = 21;
const CELL_SIZE = 5;
const WALL_HEIGHT = 6;

// ============================================================
// SEEDED RNG
// ============================================================
let currentSeed = 0;
let rngState = 0;

function seedRng(seed) {
    currentSeed = seed;
    rngState = seed;
}

function seededRandom() {
    rngState = (rngState * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (rngState >>> 0) / 0xFFFFFFFF;
}

function newSeed() {
    return Math.floor(Math.random() * 2147483647) + 1;
}

// ============================================================
// MAZE & GRID STATE
// ============================================================
let maze = [];
let enemyGrid = { x: 1, z: ROWS - 2, targetX: 1, targetZ: ROWS - 2 };
let doorGrid = { x: COLS - 2, z: ROWS - 2 };
let finishGrid = { x: COLS - 1, z: ROWS - 2 };
let intermediateDoors = [];

// ============================================================
// GAME STATE
// ============================================================
let gameState = 'start'; // start, playing, paused, riddle, door_opening, scare, won, lost
let lastTime = performance.now();
let enemyMoveTimer = 0;
let exitDistTimer = 0;
let lastExitDist = 0;

let currentStage = 1;
let currentEnemyInterval = 350;
let currentRiddleTimeLeft = 20;
let riddleTimer = 0;
let currentPuzzle = null;
let doorLocked = true;
let interactKey = false;
let activeRiddleDoor = null;
let isJumpScareActive = false;

// ============================================================
// MOVEMENT STATE
// ============================================================
let jumpVelocity = 0;
let isGrounded = true;
const GRAVITY = -20;
const JUMP_FORCE = 8;
const GROUND_Y = 0;
let playerY = 0;

let isSprinting = false;
const WALK_SPEED = 30.0;
const SPRINT_SPEED = 55.0;
const SENSITIVITY = 0.0013; // reduced 10-15% from 0.0015

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
const velocity = new THREE.Vector3();
let yaw = 0;
let pitch = 0;

// ============================================================
// ENEMY AI / STEALTH
// ============================================================
let enemyBehavior = 'patrol';
let enemyPatrolTarget = null;
let enemySearchTimer = 0;
const ENEMY_DETECT_RANGE = 30;
const ENEMY_LOSE_RANGE = 40;
const ENEMY_SEARCH_DURATION = 4000;
let enemyLastKnownPlayerPos = null;

let isHiddenInBush = false;
let currentBushIndex = -1;
let enemySawPlayerEnterBush = false;

// ============================================================
// PUZZLE POOL
// ============================================================
const puzzles = [
    { type: 'choice', q: "I speak without a mouth and hear without ears. What am I?", options: ["A ghost", "An echo", "A shadow"], a: "An echo" },
    { type: 'text', q: "The more of this there is, the less you see. What is it?", a: "darkness" },
    { type: 'text', q: "Sequence: 2, 4, 8, 16... What is next?", a: "32" },
    { type: 'choice', q: "What has keys but can't open locks?", options: ["Piano", "Map", "Door"], a: "Piano" },
    { type: 'choice', q: "Find the odd one out.", options: ["Apple", "Banana", "Carrot"], a: "Carrot" },
    { type: 'text', q: "If you multiply me by any other number, the answer will always remain the same. What am I?", a: "0" },
    { type: 'choice', q: "I have branches, but no fruit, trunk or leaves. What am I?", options: ["Bank", "Tree", "River"], a: "Bank" },
    { type: 'text', q: "Sequence: 1, 1, 2, 3, 5, 8... What is next?", a: "13" },
    { type: 'text', q: "What 5-letter word becomes shorter when you add two letters?", a: "short" },
    { type: 'choice', q: "Which symbol completes the pattern: ◼ ◻ ◼ ◻ ?", options: ["◼", "◻", "◯"], a: "◼" },
    { type: 'text', q: "I have cities, but no houses. I have mountains, but no trees. What am I?", a: "map" },
    { type: 'choice', q: "What comes once in a minute, twice in a moment, but never in a thousand years?", options: ["The letter M", "Time", "A second"], a: "The letter M" },
    { type: 'text', q: "Decode: Replace each number with a letter (1=A, 2=B...) → 3 1 20", a: "cat" },
    { type: 'text', q: "Sequence: 3, 6, 9, 12... What is next?", a: "15" },
    { type: 'choice', q: "Which is heaviest?", options: ["A ton of feathers", "A ton of bricks", "Both weigh the same"], a: "Both weigh the same" },
    { type: 'text', q: "What has a heart that doesn't beat?", a: "artichoke" },
    { type: 'choice', q: "What disappears as soon as you say its name?", options: ["Silence", "Darkness", "A secret"], a: "Silence" },
    { type: 'text', q: "Sequence: 100, 81, 64, 49... What is next?", a: "36" },
    { type: 'choice', q: "Which number is a palindrome?", options: ["12321", "12345", "11234"], a: "12321" },
    { type: 'text', q: "I am not alive, but I grow. I don't have lungs, but I need air. What am I?", a: "fire" },
];

const confusingPhrases = [
    "You're almost there.", "Are you sure?", "Wrong way?", 
    "The exit is closer than you think.", "Trust the signs.", 
    "Don't trust the signs.", "Keep going.", "Turn back."
];

// ============================================================
// TEXTURES
// ============================================================
function createHedgeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, size = Math.random() * 10 + 2;
        ctx.fillStyle = Math.random() > 0.5 ? '#32CD32' : '#006400';
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
}

function createPathTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#D2B48C';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 500; i++) {
        const x = Math.random() * 256, y = Math.random() * 256;
        ctx.fillStyle = Math.random() > 0.5 ? '#A0522D' : '#F4A460';
        ctx.fillRect(x, y, 4, 4);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(COLS, ROWS);
    return texture;
}

function createSignTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(0,0,512,256);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 45px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 128);
    return new THREE.CanvasTexture(canvas);
}

// ============================================================
// INIT
// ============================================================
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 20, 150);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    playerGroup = new THREE.Group();
    scene.add(playerGroup);
    camera.position.set(0, 2, 0);
    playerGroup.add(camera);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 250;
    scene.add(dirLight);

    // Controls
    uiOverlay.addEventListener('click', () => {
        initAudio(); // Required to init on user interaction
        document.body.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement === document.body;
        if (isLocked) {
            uiOverlay.classList.add('hidden');
            gameOverOverlay.classList.add('hidden');
            if (gameState === 'start' || gameState === 'won' || gameState === 'lost') {
                currentStage = 1;
                initGame();
            } else if (gameState === 'paused') {
                gameState = 'playing';
            }
        } else {
            if (gameState === 'playing') {
                uiOverlay.classList.remove('hidden');
                gameState = 'paused';
            }
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === document.body && gameState === 'playing') {
            yaw -= e.movementX * SENSITIVITY;
            pitch -= e.movementY * SENSITIVITY;
            pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
            playerGroup.rotation.y = yaw;
            camera.rotation.x = pitch;
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyE') interactKey = true;
        if (e.code === 'Space' && gameState === 'playing') {
            e.preventDefault();
            if (isGrounded) {
                jumpVelocity = JUMP_FORCE;
                isGrounded = false;
            }
        }
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') isSprinting = true;
        switch (e.code) {
            case 'ArrowUp': case 'KeyW': moveForward = true; break;
            case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
            case 'ArrowDown': case 'KeyS': moveBackward = true; break;
            case 'ArrowRight': case 'KeyD': moveRight = true; break;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'KeyE') interactKey = false;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') isSprinting = false;
        switch (e.code) {
            case 'ArrowUp': case 'KeyW': moveForward = false; break;
            case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
            case 'ArrowDown': case 'KeyS': moveBackward = false; break;
            case 'ArrowRight': case 'KeyD': moveRight = false; break;
        }
    });

    restartBtn.addEventListener('click', () => {
        document.body.requestPointerLock();
    });

    window.addEventListener('resize', onWindowResize);
}

// ============================================================
// BFS REACHABILITY & DISTANCE
// ============================================================
function bfsPathLength(sx, sz, gx, gz) {
    if (sx === gx && sz === gz) return 0;
    const visited = Array(ROWS).fill().map(() => Array(COLS).fill(false));
    const queue = [{ x: sx, z: sz, dist: 0 }];
    visited[sz][sx] = true;
    const dirs = [{ dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 }];
    
    while (queue.length > 0) {
        const c = queue.shift();
        for (const d of dirs) {
            const nx = c.x + d.dx;
            const nz = c.z + d.dz;
            if (nx < 0 || nx >= COLS || nz < 0 || nz >= ROWS) continue;
            if (visited[nz][nx]) continue;
            if (maze[nz][nx] === 1) continue; // treat doors (2,3) as passable
            visited[nz][nx] = true;
            if (nx === gx && nz === gz) return c.dist + 1;
            queue.push({ x: nx, z: nz, dist: c.dist + 1 });
        }
    }
    return null;
}

// ============================================================
// SEEDED MAZE GENERATION
// ============================================================
function generateMaze() {
    maze = Array(ROWS).fill().map(() => Array(COLS).fill(1));
    const stack = [];
    const startX = 1; const startZ = 1;
    maze[startZ][startX] = 0;
    stack.push({ x: startX, z: startZ });

    const dirs = [{ dx: 0, dz: -2 }, { dx: 2, dz: 0 }, { dx: 0, dz: 2 }, { dx: -2, dz: 0 }];

    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const neighbors = [];
        for (let d of dirs) {
            const nx = current.x + d.dx, nz = current.z + d.dz;
            if (nz > 0 && nz < ROWS - 1 && nx > 0 && nx < COLS - 1 && maze[nz][nx] === 1) {
                neighbors.push({ x: nx, z: nz, wallX: current.x + d.dx / 2, wallZ: current.z + d.dz / 2 });
            }
        }
        if (neighbors.length > 0) {
            const next = neighbors[Math.floor(seededRandom() * neighbors.length)];
            maze[next.wallZ][next.wallX] = 0; maze[next.z][next.x] = 0;
            stack.push({ x: next.x, z: next.z });
        } else {
            stack.pop();
        }
    }

    for (let i = 0; i < 40; i++) {
        const rx = 1 + Math.floor(seededRandom() * (COLS - 2));
        const rz = 1 + Math.floor(seededRandom() * (ROWS - 2));
        if (maze[rz][rx] === 1 && rx % 2 !== 0 && rz % 2 !== 0) maze[rz][rx] = 0;
    }

    let bestDoor = { x: COLS - 2, z: ROWS - 2 }, bestDist = 0;
    for (let attempts = 0; attempts < 30; attempts++) {
        const cx = 1 + Math.floor(seededRandom() * (COLS - 2));
        const cz = 1 + Math.floor(seededRandom() * (ROWS - 2));
        if (maze[cz][cx] !== 0) continue;
        const dist = Math.abs(cx - 1) + Math.abs(cz - 1);
        if (dist > bestDist) { bestDist = dist; bestDoor = { x: cx, z: cz }; }
    }

    doorGrid = bestDoor;
    const toRight = COLS - 1 - doorGrid.x, toBottom = ROWS - 1 - doorGrid.z;
    finishGrid = (toRight <= toBottom) ? { x: Math.min(doorGrid.x + 1, COLS - 1), z: doorGrid.z } : { x: doorGrid.x, z: Math.min(doorGrid.z + 1, ROWS - 1) };

    maze[doorGrid.z][doorGrid.x] = 2; 
    maze[finishGrid.z][finishGrid.x] = 0;
    
    const adjCells = [{ x: doorGrid.x - 1, z: doorGrid.z }, { x: doorGrid.x + 1, z: doorGrid.z }, { x: doorGrid.x, z: doorGrid.z - 1 }, { x: doorGrid.x, z: doorGrid.z + 1 }];
    for (const ac of adjCells) {
        if (ac.x > 0 && ac.x < COLS - 1 && ac.z > 0 && ac.z < ROWS - 1) {
            if (ac.x === finishGrid.x && ac.z === finishGrid.z) continue;
            if (maze[ac.z][ac.x] === 1) { maze[ac.z][ac.x] = 0; break; }
        }
    }
}

// ============================================================
// GENERATE ENTITIES
// ============================================================
function placeIntermediateDoors() {
    intermediateDoors = [];
    const numDoors = 2 + Math.floor(seededRandom() * 3);
    for (let i = 0; i < numDoors; i++) {
        for (let att = 0; att < 60; att++) {
            const cx = 2 + Math.floor(seededRandom() * (COLS - 4));
            const cz = 2 + Math.floor(seededRandom() * (ROWS - 4));

            if (maze[cz][cx] !== 0) continue;
            if (cx === 1 && cz === 1) continue;
            if (cx === doorGrid.x && cz === doorGrid.z) continue;

            maze[cz][cx] = 3; 
            if (bfsPathLength(1, 1, doorGrid.x, doorGrid.z) === null) {
                maze[cz][cx] = 0; 
                continue;
            }

            intermediateDoors.push({ gridX: cx, gridZ: cz, locked: true, puzzle: puzzles[Math.floor(seededRandom() * puzzles.length)], meshIndex: -1 });
            break;
        }
    }
}

function placeBushes() {
    bushGridPositions = [];
    const numBushes = 4 + Math.floor(seededRandom() * 2); // 4-5 bushes
    
    for (let attempts=0; bushGridPositions.length < numBushes && attempts < 200; attempts++) {
        const bx = 1 + Math.floor(seededRandom() * (COLS - 2));
        const bz = 1 + Math.floor(seededRandom() * (ROWS - 2));

        if (maze[bz][bx] !== 0) continue;
        if (bx === 1 && bz === 1) continue;
        if (bx === doorGrid.x && bz === doorGrid.z) continue;

        if (bushGridPositions.some(b => Math.abs(b.x - bx) + Math.abs(b.z - bz) < 5)) continue; // Keep them spread out

        // Prefer walls
        let adjacentWalls = 0;
        if (bz > 0 && maze[bz - 1][bx] === 1) adjacentWalls++;
        if (bz < ROWS - 1 && maze[bz + 1][bx] === 1) adjacentWalls++;
        if (bx > 0 && maze[bz][bx - 1] === 1) adjacentWalls++;
        if (bx < COLS - 1 && maze[bz][bx + 1] === 1) adjacentWalls++;

        if (adjacentWalls === 0 && seededRandom() < 0.7) continue;

        bushGridPositions.push({ x: bx, z: bz });
    }
}

function placeSigns() {
    const numSigns = 3 + Math.floor(seededRandom() * 3);
    const placedSigns = [];
    
    for (let i = 0; i < numSigns; i++) {
        for (let att = 0; att < 50; att++) {
            const cx = 1 + Math.floor(seededRandom() * (COLS - 2));
            const cz = 1 + Math.floor(seededRandom() * (ROWS - 2));
            
            if (maze[cz][cx] !== 0) continue;
            
            // Intersections
            let openNeighbors = [];
            const dirs = [{dx:1, dz:0}, {dx:-1, dz:0}, {dx:0, dz:1}, {dx:0, dz:-1}];
            for (let d of dirs) {
                if (cz+d.dz > 0 && cz+d.dz < ROWS-1 && cx+d.dx > 0 && cx+d.dx < COLS-1) {
                    if (maze[cz+d.dz][cx+d.dx] !== 1) openNeighbors.push(d);
                }
            }
            if (openNeighbors.length < 2) continue;
            
            let baseDist = bfsPathLength(cx, cz, doorGrid.x, doorGrid.z);
            if (!baseDist) continue;
            
            let bestDir = openNeighbors[0];
            let worstDir = openNeighbors[0];
            for (let d of openNeighbors) {
                let dist = bfsPathLength(cx + d.dx, cz + d.dz, doorGrid.x, doorGrid.z);
                if (dist < baseDist) bestDir = d;
                if (dist > baseDist) worstDir = d;
            }
            
            let isTruthful = seededRandom() > 0.5;
            let pointedDir = isTruthful ? bestDir : worstDir;
            
            let text = "";
            if (seededRandom() > 0.8) {
                text = confusingPhrases[Math.floor(seededRandom() * confusingPhrases.length)];
            } else {
                text = "EXIT THIS WAY →"; 
            }
            
            placedSigns.push({ x: cx, z: cz, dir: pointedDir, text: text, emptyDir: openNeighbors[0] });
            break;
        }
    }
    return placedSigns;
}

function placeProps() {
    const propPositions = [];
    const numProps = 5 + Math.floor(seededRandom() * 4);
    for (let i = 0; i < numProps; i++) {
        for (let att = 0; att < 50; att++) {
            const px = 1 + Math.floor(seededRandom() * (COLS - 2));
            const pz = 1 + Math.floor(seededRandom() * (ROWS - 2));
            if (maze[pz][px] !== 0) continue;
            if (px === 1 && pz === 1) continue;
            if (bushGridPositions.some(b => b.x === px && b.z === pz)) continue;
            if (intermediateDoors.some(d => d.gridX === px && d.gridZ === pz)) continue;
            if (propPositions.some(p => Math.abs(p.x - px) + Math.abs(p.z - pz) < 3)) continue;
            propPositions.push({ x: px, z: pz, type: Math.floor(seededRandom() * 3) }); // 0=rock, 1=barrel, 2=tree
            break;
        }
    }
    return propPositions;
}

// ============================================================
// BUILD WORLD
// ============================================================
function buildWorld() {
    walls.forEach(w => scene.remove(w)); walls = [];
    if (floorMeshRef) scene.remove(floorMeshRef);
    if (enemyMesh) scene.remove(enemyMesh);
    if (finishTriggerMesh) scene.remove(finishTriggerMesh);
    if (doorMesh) scene.remove(doorMesh);
    bushMeshes.forEach(b => scene.remove(b)); bushMeshes = [];
    intermediateDoorMeshes.forEach(d => scene.remove(d)); intermediateDoorMeshes = [];
    propMeshes.forEach(p => scene.remove(p)); propMeshes = [];
    signMeshes.forEach(s => scene.remove(s)); signMeshes = [];

    generateMaze();
    placeBushes();
    placeIntermediateDoors();
    const signPositions = placeSigns();
    const propPositions = placeProps();

    if (bfsPathLength(1, 1, doorGrid.x, doorGrid.z) === null) {
        seedRng(newSeed());
        buildWorld();
        return;
    }

    const hedgeTex = createHedgeTexture();
    const wallMat = new THREE.MeshStandardMaterial({ map: hedgeTex, roughness: 1.0 });
    const pathTex = createPathTexture();
    const floorMat = new THREE.MeshStandardMaterial({ map: pathTex, roughness: 0.9 });

    // Floor
    const floorGeo = new THREE.PlaneGeometry(COLS * CELL_SIZE, ROWS * CELL_SIZE);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((COLS * CELL_SIZE) / 2, 0, (ROWS * CELL_SIZE) / 2);
    floor.receiveShadow = true;
    scene.add(floor); floorMeshRef = floor;

    // Walls - using InstancedMesh for performance
    const boxGeo = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    let wallCount = 0;
    for (let z = 0; z < ROWS; z++) {
        for (let x = 0; x < COLS; x++) {
            if (maze[z][x] === 1) wallCount++;
        }
    }
    const wallInstanced = new THREE.InstancedMesh(boxGeo, wallMat, wallCount);
    wallInstanced.castShadow = true;
    wallInstanced.receiveShadow = true;
    
    let wIndex = 0;
    const dummy = new THREE.Object3D();
    for (let z = 0; z < ROWS; z++) {
        for (let x = 0; x < COLS; x++) {
            if (maze[z][x] === 1) {
                dummy.position.set(x * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, z * CELL_SIZE + CELL_SIZE / 2);
                dummy.updateMatrix();
                wallInstanced.setMatrixAt(wIndex++, dummy.matrix);
            }
        }
    }
    scene.add(wallInstanced);
    walls.push(wallInstanced);

    // Doors
    const doorGeo = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE * 0.5);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 });
    doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(doorGrid.x * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, doorGrid.z * CELL_SIZE + CELL_SIZE / 2);
    doorMesh.castShadow = true; doorMesh.receiveShadow = true;
    scene.add(doorMesh);

    // Finish
    const triggerGeo = new THREE.TorusKnotGeometry(1, 0.3, 100, 16);
    const triggerMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.5 });
    finishTriggerMesh = new THREE.Mesh(triggerGeo, triggerMat);
    finishTriggerMesh.position.set(finishGrid.x * CELL_SIZE + CELL_SIZE / 2, 2, finishGrid.z * CELL_SIZE + CELL_SIZE / 2);
    finishTriggerMesh.add(new THREE.PointLight(0xffd700, 1, 10));
    scene.add(finishTriggerMesh);

    // Enemy
    let enemyStartX = 1, enemyStartZ = ROWS - 2;
    for (let att = 0; att < 30; att++) {
        const ex = 1 + Math.floor(seededRandom() * (COLS - 2));
        const ez = 1 + Math.floor(seededRandom() * (ROWS - 2));
        if (maze[ez][ex] === 0 && (Math.abs(ex - 1) + Math.abs(ez - 1)) > 10) { enemyStartX = ex; enemyStartZ = ez; break; }
    }
    const enemyGeo = new THREE.IcosahedronGeometry(1.5, 1);
    const enemyMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff0000, emissiveIntensity: 0.8 });
    enemyMesh = new THREE.Mesh(enemyGeo, enemyMat);
    enemyGrid = { x: enemyStartX, z: enemyStartZ, targetX: enemyStartX, targetZ: enemyStartZ };
    enemyMesh.position.set(enemyStartX * CELL_SIZE + CELL_SIZE / 2, 2, enemyStartZ * CELL_SIZE + CELL_SIZE / 2);
    enemyMesh.add(new THREE.PointLight(0xff0000, 2, 15));
    enemyMesh.castShadow = true;
    scene.add(enemyMesh);

    // Bushes
    for (const bp of bushGridPositions) {
        const bushGroup = new THREE.Group();
        const sizes = [{ r: 1.2, x: 0, y: 1.0, z: 0 }, { r: 0.9, x: 0.8, y: 0.8, z: 0.3 }, { r: 0.9, x: -0.7, y: 0.8, z: -0.4 }, { r: 0.7, x: 0.2, y: 1.6, z: 0.2 }];
        for (const s of sizes) {
            const geo = new THREE.SphereGeometry(s.r, 8, 6);
            const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.1 + seededRandom() * 0.15, 0.35 + seededRandom() * 0.3, 0.1 + seededRandom() * 0.1), roughness: 1.0 });
            const sphere = new THREE.Mesh(geo, mat); sphere.position.set(s.x, s.y, s.z); sphere.castShadow = true;
            bushGroup.add(sphere);
        }
        bushGroup.position.set(bp.x * CELL_SIZE + CELL_SIZE / 2, 0, bp.z * CELL_SIZE + CELL_SIZE / 2);
        scene.add(bushGroup); bushMeshes.push(bushGroup);
    }

    // Intermediate Doors
    const intDoorGeo = new THREE.BoxGeometry(CELL_SIZE * 0.9, WALL_HEIGHT, CELL_SIZE * 0.3);
    const intDoorMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.7 });
    for (let i = 0; i < intermediateDoors.length; i++) {
        const id = intermediateDoors[i];
        const mesh = new THREE.Mesh(intDoorGeo, intDoorMat.clone());
        mesh.position.set(id.gridX * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, id.gridZ * CELL_SIZE + CELL_SIZE / 2);
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh); intermediateDoorMeshes.push(mesh); id.meshIndex = i;
    }

    // Signs
    for (const s of signPositions) {
        const signGroup = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 8), new THREE.MeshStandardMaterial({ color: 0x4B3621 }));
        post.position.y = 1; signGroup.add(post);
        
        const boardMat = new THREE.MeshStandardMaterial({ map: createSignTexture(s.text) });
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.1), boardMat);
        board.position.set(0, 1.8, 0); 
        signGroup.add(board);
        
        signGroup.position.set(s.x * CELL_SIZE + CELL_SIZE / 2, 0, s.z * CELL_SIZE + CELL_SIZE / 2);
        signGroup.rotation.y = Math.atan2(s.dir.dx, s.dir.dz) + Math.PI/2;
        scene.add(signGroup);
        signMeshes.push(signGroup);
    }

    // Props
    for (const pp of propPositions) {
        let propGroup = new THREE.Group();
        if (pp.type === 0) {
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + seededRandom() * 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.95 }));
            rock.position.y = 0.5; rock.rotation.y = seededRandom() * Math.PI; rock.castShadow = true; propGroup.add(rock);
        } else if (pp.type === 1) {
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.8 }));
            barrel.position.y = 0.7; barrel.castShadow = true; propGroup.add(barrel);
        } else {
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2, 6), new THREE.MeshStandardMaterial({ color: 0x654321 }));
            trunk.position.y = 1; trunk.castShadow = true; propGroup.add(trunk);
            const leaves = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2E8B57 }));
            leaves.position.y = 2.5; leaves.castShadow = true; propGroup.add(leaves);
        }
        propGroup.position.set(pp.x * CELL_SIZE + CELL_SIZE / 2, 0, pp.z * CELL_SIZE + CELL_SIZE / 2);
        scene.add(propGroup); propMeshes.push(propGroup);
    }
}

// ============================================================
// INIT GAME & SETUP STAGE
// ============================================================
function initGame() {
    hud.classList.remove('hidden');
    currentStage = 1;
    setupStage();
}

function setupStage() {
    seedRng(newSeed());
    seedDisplayEl.innerText = `SEED: ${currentSeed}`;
    seedDisplayEl.classList.remove('hidden');

    buildWorld();

    playerGroup.position.set(1 * CELL_SIZE + CELL_SIZE / 2, 0, 1 * CELL_SIZE + CELL_SIZE / 2);
    playerY = 0; jumpVelocity = 0; isGrounded = true; yaw = 0; pitch = 0;
    playerGroup.rotation.y = yaw; camera.rotation.x = pitch; velocity.set(0, 0, 0);

    currentEnemyInterval = Math.max(150, 400 - (currentStage * 40));
    currentRiddleTimeLeft = Math.max(8, 20 - (currentStage - 1) * 2);

    doorLocked = true; interactKey = false; isHiddenInBush = false; currentBushIndex = -1;
    enemySawPlayerEnterBush = false; enemyMoveTimer = 0; activeRiddleDoor = null;
    isJumpScareActive = false; exitDistTimer = 0; lastExitDist = 0;

    enemyBehavior = 'patrol'; enemyPatrolTarget = null; enemySearchTimer = 0; enemyLastKnownPlayerPos = null;

    gameState = 'playing';

    hudStage.innerText = `STAGE ${currentStage}`;
    transitionOverlay.classList.add('hidden');
    enemyAlertEl.classList.add('hidden');
    hiddenStatusEl.classList.add('hidden');
    enemyCompassEl.classList.remove('hidden');
    exitMeterEl.classList.remove('hidden');
    scareOverlay.classList.add('hidden');
}

// ============================================================
// RIDDLES
// ============================================================
function triggerRiddle(doorType, puzzle) {
    gameState = 'riddle';
    activeRiddleDoor = doorType;
    document.exitPointerLock();
    riddleOverlay.classList.remove('hidden');

    if (doorType === 'exit') {
        riddleHeading.innerText = 'EXIT LOCKED'; riddleSubheading.innerText = 'Something is preventing the door from opening...';
    } else {
        riddleHeading.innerText = 'LOCKED DOOR'; riddleSubheading.innerText = 'This passage is blocked. Solve the puzzle to proceed.';
    }

    currentPuzzle = puzzle || puzzles[Math.floor(seededRandom() * puzzles.length)];
    riddleText.innerText = currentPuzzle.q; riddleFeedback.innerText = ""; riddleTimer = currentRiddleTimeLeft;
    riddleInputContainer.innerHTML = '';

    if (currentPuzzle.type === 'choice') {
        currentPuzzle.options.forEach(opt => {
            const btn = document.createElement('button'); btn.className = 'riddle-choice-btn'; btn.innerText = opt;
            btn.onclick = () => submitRiddle(opt); riddleInputContainer.appendChild(btn);
        });
    } else {
        const inp = document.createElement('input'); inp.type = 'text'; inp.id = 'riddleInput'; inp.placeholder = "Type your answer..."; inp.autocomplete = "off";
        inp.onkeydown = (e) => { if (e.key === 'Enter') submitRiddle(inp.value); };
        const btn = document.createElement('button'); btn.innerText = "SUBMIT"; btn.onclick = () => submitRiddle(inp.value);
        riddleInputContainer.appendChild(inp); riddleInputContainer.appendChild(btn);
        setTimeout(() => inp.focus(), 100);
    }
}

function submitRiddle(answer) {
    if (gameState !== 'riddle') return;
    const ans = (answer || "").toLowerCase().trim();
    if (ans.includes(currentPuzzle.a.toLowerCase())) {
        if (activeRiddleDoor === 'exit') {
            doorLocked = false; maze[doorGrid.z][doorGrid.x] = 0;
            riddleOverlay.classList.add('hidden'); document.body.requestPointerLock(); gameState = 'door_opening';
        } else if (typeof activeRiddleDoor === 'number') {
            const id = intermediateDoors[activeRiddleDoor]; id.locked = false; maze[id.gridZ][id.gridX] = 0;
            if (id.meshIndex >= 0 && intermediateDoorMeshes[id.meshIndex]) intermediateDoorMeshes[id.meshIndex].userData.opening = true;
            riddleOverlay.classList.add('hidden'); document.body.requestPointerLock(); gameState = 'playing';
        }
        activeRiddleDoor = null;
    } else {
        riddleFeedback.innerText = "Wrong! Try again!";
    }
}

// ============================================================
// ENEMY AI
// ============================================================
function bfsPathTo(startX, startZ, goalX, goalZ) {
    if (goalX < 0 || goalX >= COLS || goalZ < 0 || goalZ >= ROWS) return null;
    if (startX === goalX && startZ === goalZ) return null;
    const queue = [{ x: startX, z: startZ, path: [] }];
    const visited = Array(ROWS).fill().map(() => Array(COLS).fill(false));
    visited[startZ][startX] = true;
    const dirs = [{ dx: 0, dz: -1 }, { dx: 1, dz: 0 }, { dx: 0, dz: 1 }, { dx: -1, dz: 0 }];
    while (queue.length > 0) {
        const curr = queue.shift();
        if (curr.x === goalX && curr.z === goalZ) return curr.path.length > 0 ? curr.path[0] : null;
        for (let d of dirs) {
            const nx = curr.x + d.dx, nz = curr.z + d.dz;
            if (nz >= 0 && nz < ROWS && nx >= 0 && nx < COLS && maze[nz][nx] === 0 && !visited[nz][nx]) {
                visited[nz][nx] = true; queue.push({ x: nx, z: nz, path: [...curr.path, { x: nx, z: nz }] });
            }
        }
    }
    return null;
}

function getRandomOpenCell() {
    for (let att = 0; att < 100; att++) {
        const rx = 1 + Math.floor(seededRandom() * (COLS - 2));
        const rz = 1 + Math.floor(seededRandom() * (ROWS - 2));
        if (maze[rz][rx] === 0) return { x: rx, z: rz };
    }
    return { x: 1, z: 1 };
}

function getEnemyNextMove(deltaMs) {
    const playerGridX = Math.floor(playerGroup.position.x / CELL_SIZE);
    const playerGridZ = Math.floor(playerGroup.position.z / CELL_SIZE);
    const enemyWorldX = enemyGrid.targetX * CELL_SIZE + CELL_SIZE / 2;
    const enemyWorldZ = enemyGrid.targetZ * CELL_SIZE + CELL_SIZE / 2;
    const distToPlayer = Math.sqrt(Math.pow(playerGroup.position.x - enemyWorldX, 2) + Math.pow(playerGroup.position.z - enemyWorldZ, 2));

    if (enemyBehavior === 'patrol') {
        if (distToPlayer < ENEMY_DETECT_RANGE && !isHiddenInBush) {
            enemyBehavior = 'chase'; enemyLastKnownPlayerPos = { x: playerGridX, z: playerGridZ };
        } else {
            if (!enemyPatrolTarget || (enemyGrid.targetX === enemyPatrolTarget.x && enemyGrid.targetZ === enemyPatrolTarget.z)) enemyPatrolTarget = getRandomOpenCell();
            return bfsPathTo(enemyGrid.targetX, enemyGrid.targetZ, enemyPatrolTarget.x, enemyPatrolTarget.z);
        }
    }
    if (enemyBehavior === 'chase') {
        if (isHiddenInBush && !enemySawPlayerEnterBush) {
            enemyBehavior = 'search'; enemySearchTimer = ENEMY_SEARCH_DURATION; enemyLastKnownPlayerPos = { x: playerGridX, z: playerGridZ };
        } else if (distToPlayer > ENEMY_LOSE_RANGE && !enemySawPlayerEnterBush) {
            enemyBehavior = 'search'; enemySearchTimer = ENEMY_SEARCH_DURATION;
        } else {
            enemyLastKnownPlayerPos = { x: playerGridX, z: playerGridZ }; return bfsPathTo(enemyGrid.targetX, enemyGrid.targetZ, playerGridX, playerGridZ);
        }
    }
    if (enemyBehavior === 'search') {
        enemySearchTimer -= deltaMs;
        if (distToPlayer < ENEMY_DETECT_RANGE && !isHiddenInBush) {
            enemyBehavior = 'chase'; return bfsPathTo(enemyGrid.targetX, enemyGrid.targetZ, playerGridX, playerGridZ);
        }
        if (enemySearchTimer <= 0) {
            enemyBehavior = 'patrol'; enemyPatrolTarget = getRandomOpenCell(); enemySawPlayerEnterBush = false;
            return bfsPathTo(enemyGrid.targetX, enemyGrid.targetZ, enemyPatrolTarget.x, enemyPatrolTarget.z);
        }
        if (enemyLastKnownPlayerPos) {
            if (enemyGrid.targetX === enemyLastKnownPlayerPos.x && enemyGrid.targetZ === enemyLastKnownPlayerPos.z) enemyLastKnownPlayerPos = getRandomOpenCell();
            return bfsPathTo(enemyGrid.targetX, enemyGrid.targetZ, enemyLastKnownPlayerPos.x, enemyLastKnownPlayerPos.z);
        }
    }
    return null;
}

// ============================================================
// COLLISION & ALERTS
// ============================================================
function checkCollision(pos) {
    const margin = 0.7;
    const points = [{ x: pos.x - margin, z: pos.z - margin }, { x: pos.x + margin, z: pos.z - margin }, { x: pos.x - margin, z: pos.z + margin }, { x: pos.x + margin, z: pos.z + margin }];
    for (let p of points) {
        const gx = Math.floor(p.x / CELL_SIZE), gz = Math.floor(p.z / CELL_SIZE);
        if (gz < 0 || gz >= ROWS || gx < 0 || gx >= COLS) return true;
        const cell = maze[gz][gx]; if (cell === 1 || cell === 2 || cell === 3) return true;
    }
    return false;
}

function checkBushHiding() {
    const playerGridX = Math.floor(playerGroup.position.x / CELL_SIZE), playerGridZ = Math.floor(playerGroup.position.z / CELL_SIZE);
    let insideBush = -1;
    for (let i = 0; i < bushGridPositions.length; i++) {
        if (bushGridPositions[i].x === playerGridX && bushGridPositions[i].z === playerGridZ) { insideBush = i; break; }
    }
    if (insideBush >= 0) {
        if (!isHiddenInBush) {
            const distToEnemy = Math.sqrt(Math.pow(playerGroup.position.x - (enemyGrid.targetX * CELL_SIZE + CELL_SIZE / 2), 2) + Math.pow(playerGroup.position.z - (enemyGrid.targetZ * CELL_SIZE + CELL_SIZE / 2), 2));
            if (distToEnemy < ENEMY_DETECT_RANGE * 0.6 && enemyBehavior === 'chase') enemySawPlayerEnterBush = true;
        }
        isHiddenInBush = true; currentBushIndex = insideBush; hiddenStatusEl.classList.remove('hidden');
    } else {
        if (isHiddenInBush) { isHiddenInBush = false; currentBushIndex = -1; enemySawPlayerEnterBush = false; hiddenStatusEl.classList.add('hidden'); }
    }
}

function updateEnemyAlert(distToEnemy) {
    if (distToEnemy < CELL_SIZE * 3) { enemyAlertEl.innerText = '⚠ DANGER — ENEMY CLOSE'; enemyAlertEl.className = 'danger'; }
    else if (distToEnemy < CELL_SIZE * 6) { enemyAlertEl.innerText = '⚠ ENEMY NEARBY'; enemyAlertEl.className = 'warning'; }
    else { enemyAlertEl.className = 'hidden'; }
}

function updateEnemyCompass(dx, dz, dist) {
    const angleToEnemy = Math.atan2(dx, -dz);
    compassArrowEl.style.transform = `rotate(${angleToEnemy - yaw}rad)`;
    compassDistEl.innerText = `~${Math.round(dist)}m`;
    if (dist < CELL_SIZE * 3) enemyCompassEl.className = 'danger';
    else if (dist < CELL_SIZE * 6) enemyCompassEl.className = 'near';
    else enemyCompassEl.className = '';
}

function updateExitMeter(deltaMs) {
    exitDistTimer += deltaMs;
    if (exitDistTimer > 500) {
        exitDistTimer = 0;
        const pgX = Math.floor(playerGroup.position.x / CELL_SIZE), pgZ = Math.floor(playerGroup.position.z / CELL_SIZE);
        const pathLen = bfsPathLength(pgX, pgZ, doorGrid.x, doorGrid.z);
        if (pathLen !== null) {
            const distMeters = pathLen * CELL_SIZE;
            exitDistanceEl.innerText = `${distMeters} m`;
            if (lastExitDist > 0) {
                if (distMeters < lastExitDist) { exitTrendEl.innerText = "↑ Getting closer"; exitTrendEl.style.color = "#32cd32"; }
                else if (distMeters > lastExitDist) { exitTrendEl.innerText = "↓ Moving away"; exitTrendEl.style.color = "#ff4444"; }
                else { exitTrendEl.innerText = "..."; exitTrendEl.style.color = "#aaa"; }
            }
            lastExitDist = distMeters;
        }
    }
}

// ============================================================
// GAME OVER & SCARE
// ============================================================
function triggerJumpScare() {
    isJumpScareActive = true;
    gameState = 'scare';
    
    playScareSound();
    scareOverlay.classList.remove('hidden');
    
    // Snap enemy to front
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    enemyMesh.position.copy(playerGroup.position).add(dir.multiplyScalar(2));
    enemyMesh.position.y = playerGroup.position.y + 2;
    enemyMesh.scale.set(1.5, 1.5, 1.5);
    
    // Shake camera
    let scareTime = 0;
    const scareInterval = setInterval(() => {
        scareTime += 50;
        camera.position.x = (Math.random() - 0.5) * 0.5;
        camera.position.y = 2 + (Math.random() - 0.5) * 0.5;
        if (scareTime > 1500) {
            clearInterval(scareInterval);
            camera.position.set(0,2,0);
            scareOverlay.classList.add('hidden');
            showGameOver(false);
        }
    }, 50);
}

function showGameOver(won) {
    gameState = won ? 'won' : 'lost';
    document.exitPointerLock();
    riddleOverlay.classList.add('hidden');
    interactionPrompt.classList.add('hidden');
    hud.classList.add('hidden');
    enemyAlertEl.classList.add('hidden');
    hiddenStatusEl.classList.add('hidden');
    enemyCompassEl.classList.add('hidden');
    exitMeterEl.classList.add('hidden');
    gameOverOverlay.classList.remove('hidden');

    if (won) {
        endTitle.textContent = 'GAME CLEARED!'; endTitle.style.color = '#32cd32'; endSubtitle.textContent = 'You conquered all the stages.';
    } else {
        endTitle.textContent = 'YOU WERE CAUGHT'; endTitle.style.color = '#ff0055'; endSubtitle.textContent = 'The maze remembers nothing.';
    }
}

function lerp(start, end, amt) { return (1 - amt) * start + amt * end; }
function onWindowResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }

// ============================================================
// MAIN ANIMATION LOOP
// ============================================================
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = Math.min((time - lastTime) / 1000, 0.1);
    const deltaMs = time - lastTime;
    lastTime = time;

    if (gameState === 'door_opening') {
        doorMesh.position.y -= delta * 5;
        if (doorMesh.position.y < -WALL_HEIGHT) gameState = 'playing';
    }

    for (let i = 0; i < intermediateDoorMeshes.length; i++) {
        const mesh = intermediateDoorMeshes[i];
        if (mesh.userData.opening && mesh.position.y > -WALL_HEIGHT) mesh.position.y -= delta * 5;
    }

    if (gameState === 'playing' || gameState === 'door_opening') {
        velocity.x -= velocity.x * 10.0 * delta; velocity.z -= velocity.z * 10.0 * delta;

        const dir = new THREE.Vector3();
        if (moveForward) dir.z -= 1; if (moveBackward) dir.z += 1;
        if (moveLeft) dir.x -= 1; if (moveRight) dir.x += 1;
        dir.normalize(); dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

        let speed = isSprinting ? SPRINT_SPEED : WALK_SPEED;
        if (isHiddenInBush) speed *= 0.5;

        velocity.x += dir.x * speed * delta; velocity.z += dir.z * speed * delta;

        const oldX = playerGroup.position.x; playerGroup.position.x += velocity.x * delta;
        if (checkCollision(playerGroup.position)) playerGroup.position.x = oldX;

        const oldZ = playerGroup.position.z; playerGroup.position.z += velocity.z * delta;
        if (checkCollision(playerGroup.position)) playerGroup.position.z = oldZ;

        if (!isGrounded) {
            jumpVelocity += GRAVITY * delta; playerY += jumpVelocity * delta;
            if (playerY <= GROUND_Y) { playerY = GROUND_Y; jumpVelocity = 0; isGrounded = true; }
        }
        playerGroup.position.y = playerY;

        const isMoving = moveForward || moveBackward || moveLeft || moveRight;
        if (isGrounded && isMoving) {
            const bobSpeed = isSprinting ? 70 : 100; const bobAmt = isSprinting ? 0.2 : 0.15;
            camera.position.y = 2 + Math.sin(time / bobSpeed) * bobAmt; camera.rotation.z = Math.sin(time / 150) * 0.03;
            playFootstep(isSprinting); // trigger footstep audio
        } else {
            camera.position.y = 2; camera.rotation.z = 0;
        }

        checkBushHiding();

        let showingPrompt = false;
        const doorWorldPos = new THREE.Vector3(doorGrid.x * CELL_SIZE + CELL_SIZE / 2, 2, doorGrid.z * CELL_SIZE + CELL_SIZE / 2);
        if (playerGroup.position.distanceTo(doorWorldPos) < CELL_SIZE * 1.5 && doorLocked) {
            interactionPrompt.classList.remove('hidden'); showingPrompt = true;
            if (interactKey) { interactKey = false; triggerRiddle('exit', null); }
        }

        if (!showingPrompt) {
            for (let i = 0; i < intermediateDoors.length; i++) {
                const id = intermediateDoors[i]; if (!id.locked) continue;
                if (playerGroup.position.distanceTo(new THREE.Vector3(id.gridX * CELL_SIZE + CELL_SIZE / 2, 2, id.gridZ * CELL_SIZE + CELL_SIZE / 2)) < CELL_SIZE * 1.5) {
                    interactionPrompt.classList.remove('hidden'); showingPrompt = true;
                    if (interactKey) { interactKey = false; triggerRiddle(i, id.puzzle); }
                    break;
                }
            }
        }
        if (!showingPrompt) interactionPrompt.classList.add('hidden');

        if (playerGroup.position.distanceTo(finishTriggerMesh.position) < CELL_SIZE) {
            gameState = 'paused';
            enemyAlertEl.classList.add('hidden'); hiddenStatusEl.classList.add('hidden'); enemyCompassEl.classList.add('hidden'); exitMeterEl.classList.add('hidden');
            transitionTitle.innerText = `STAGE ${currentStage} CLEARED`; transitionOverlay.classList.remove('hidden');
            setTimeout(() => { currentStage++; setupStage(); }, 2000);
        }

        if(enemyMesh) {
            const dist = playerGroup.position.distanceTo(enemyMesh.position);
            updateEnemyAlert(dist);
            updateEnemyCompass(enemyMesh.position.x - playerGroup.position.x, enemyMesh.position.z - playerGroup.position.z, dist);
            updateEnemyAudio(dist);
        }
        
        updateExitMeter(deltaMs);
    }

    if (gameState === 'playing' || gameState === 'riddle' || gameState === 'door_opening') {
        enemyMoveTimer += deltaMs;
        if (enemyMoveTimer > currentEnemyInterval) {
            enemyMoveTimer = 0;
            const nextMove = getEnemyNextMove(currentEnemyInterval);
            if (nextMove) { enemyGrid.targetX = nextMove.x; enemyGrid.targetZ = nextMove.z; }
        }

        if(enemyMesh && !isJumpScareActive) {
            const distToEnemy = playerGroup.position.distanceTo(enemyMesh.position);
            if (distToEnemy < CELL_SIZE) {
                if (!isHiddenInBush || enemySawPlayerEnterBush) {
                    triggerJumpScare();
                }
            }
        }

        if (gameState === 'riddle') {
            riddleTimer -= delta; riddleTimerEl.innerText = `Time left: ${Math.max(0, Math.ceil(riddleTimer))}s`;
            if (riddleTimer <= 0 && !isJumpScareActive) triggerJumpScare();
        }
    }

    if (enemyMesh && !isJumpScareActive) {
        enemyMesh.position.x = lerp(enemyMesh.position.x, enemyGrid.targetX * CELL_SIZE + CELL_SIZE / 2, 0.1);
        enemyMesh.position.z = lerp(enemyMesh.position.z, enemyGrid.targetZ * CELL_SIZE + CELL_SIZE / 2, 0.1);
        enemyMesh.position.y = playerY + 2 + Math.sin(time / 200) * 0.5;
        enemyMesh.rotation.x += 0.02; enemyMesh.rotation.y += 0.03;
    }
    
    if (finishTriggerMesh) { finishTriggerMesh.rotation.x += 0.02; finishTriggerMesh.rotation.y += 0.05; }
    renderer.render(scene, camera);
}

// ============================================================
// START
// ============================================================
init();
animate();
