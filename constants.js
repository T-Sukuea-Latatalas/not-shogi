// constants.js

export const COLORS = { wood: 0xe3c88d, gold: 0xd4af37, vermillion: 0xae1f23, ink: 0x1a1a1a, spirit: 0x800080 };

export const STATE = { 
    wave: 0, 
    score: 0, 
    isGameOver: false, 
    isPaused: false, 
    shopOpen: false, 
    enemies: [], 
    bullets: [], 
    enemyBullets: [], 
    items: [], 
    dashActive: false,
    stageActive: false,
    isPractice: false,               
    currentPracticeStage: null,       
    celestialBody: null,             
    clouds: [],
    // 3Dレンダラー関連
    scene: null,
    camera: null,
    renderer: null,
    sun: null,
    boardGroup: null,
    // ステージ情報管理
    stages: [],
    currentStageIndex: 0,
    playerStunTime: 0,
    takeDamage: null
};

// チェスの駒とヨット（Yacht）の定義を追加
export const PIECE_NAMES = {
    '歩': '歩兵', '香': '香車', '桂': '桂馬', '銀': '銀将', '金': '金将', '角': '角行', '飛': '飛車', '王': '玉将',
    'ポーン': 'ポーン', 'ナイト': 'ナイト', 'ビショップ': 'ビショップ', 'ルーク': 'ルーク', 'クイーン': 'クイーン', 'キング': 'キング',
    'ヨット': 'ヨット', 'Yacht': 'ヨット'
};

export const GRAVITY = -0.015;
export const JUMP_FORCE = 0.4;
export const GROUND_Y = 5.0; 
export const EYE_HEIGHT = 3.5; 
export const DASH_MULT = 1.8;
export const BOARD_SIZE = 80;
export const BOARD_THICKNESS = 3;

export const PLAYER = { 
    hp: 100, maxHp: 100, 
    speed: 0.5, power: 1, 
    fireRate: 300, lastShot: 0, 
    radius: 1.5,
    vy: 0, isGrounded: true, isShooting: false 
};

export const UPGRADE_COSTS = { power: 500, rate: 800, speed: 400, hp: 600 };
export const upgradeKeys = ['power', 'rate', 'speed', 'hp'];
export const joystickVector = { x: 0, y: 0 };

export const SPREADSHEET_ID = 'https://docs.google.com/spreadsheets/d/1n4711vrRLoDwGGBPO81u28C2fK2PvRZUY91MIbP05As/edit?usp=sharing'; 
export const SHEET_GID = '0';

export const FALLBACK_STAGES = [
    { stage: 1, name: "初陣・歩兵の壁", 歩: 5, 香: 0, 桂: 0, 銀: 0, 金: 0,角: 0, 飛: 0, 王: 0 },
    { stage: 2, name: "香車の一閃", 歩: 3, 香: 2, 桂: 0, 銀: 0, 金: 0, 角: 0, 飛: 0, 王: 0 },
    { stage: 3, name: "桂馬の奇襲", 歩: 4, 香: 0, 桂: 3, 銀: 1, 金: 0, 角: 0, 飛: 0, 王: 0 },
    { stage: 4, name: "飛角の盤上", 歩: 2, 香: 1, 桂: 0, 銀: 2, 金: 2, 角: 1, 飛: 1, 王: 0 },
    { stage: 5, name: "玉将の間", 歩: 6, 香: 2, 桂: 2, 銀: 2, 金: 2, 角: 1, 飛: 1, 王: 1 }
];

// 修練（練習）モード用にチェスの駒とヨットを末尾に追加
export const PRACTICE_PIECES = [
    '歩', '香', '桂', '銀', '金', '角', '飛', '王',
    'ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング', 'ヨット'
];

export const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
