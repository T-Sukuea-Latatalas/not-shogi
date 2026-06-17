import * as THREE from 'three';
import { 
    COLORS, STATE, PIECE_NAMES, GRAVITY, JUMP_FORCE, GROUND_Y, EYE_HEIGHT, 
    DASH_MULT, BOARD_SIZE, BOARD_THICKNESS, PLAYER, UPGRADE_COSTS, upgradeKeys, 
    joystickVector, SPREADSHEET_ID, SHEET_GID, FALLBACK_STAGES, PRACTICE_PIECES, isTouchDevice
} from './constants.js';
import { AssetFactory, createBamboo, createRock, createLantern } from './assets.js';
import { Projectile, Item, Enemy } from './entities.js';

let selectedShopIndex = 0;
const keys = {};
const debugKeys = ['d', 'e', 'b', 'u', 'g'];
let debugIndex = 0;

// すでに constants.js の PRACTICE_PIECES にヨットを含むすべての駒が定義されているため、そのまま使用します。
const ALL_PRACTICE_PIECES = PRACTICE_PIECES;

// フォールバックステージに「ヨット」ステージ（第16局、盤上最終決戦）を追加
const EXTENDED_FALLBACK_STAGES = [
    { stage: 1, name: "第1局", 歩: 3 },
    { stage: 2, name: "第2局", 歩: 5, 香: 1 },
    { stage: 3, name: "第3局", 歩: 4, 香: 2, 桂: 1 },
    { stage: 4, name: "第4局", 歩: 6, 香: 2, 桂: 2, 銀: 1 },
    { stage: 5, name: "第5局", 歩: 5, 香: 3, 桂: 2, 銀: 2, 金: 1 },
    { stage: 6, name: "第6局", 歩: 8, 香: 2, 桂: 2, 銀: 2, 金: 2, 角: 1 },
    { stage: 7, name: "第7局", 歩: 6, 香: 4, 桂: 3, 銀: 3, 金: 2, 角: 1, 飛: 1 },
    { stage: 8, name: "第8局", 歩: 10, 香: 3, 桂: 3, 銀: 3, 金: 3, 角: 2, 飛: 1 },
    { stage: 9, name: "第9局", 歩: 8, 香: 4, 桂: 4, 銀: 4, 金: 4, 角: 2, 飛: 2 },
    { stage: 10, name: "第10局", 歩: 12, 香: 5, 桂: 4, 銀: 4, 金: 4, 角: 2, 飛: 2, 王: 1 },
    { stage: 11, name: "異界の尖兵", 歩: 4, 銀: 2, ポーン: 6, ナイト: 2 },
    { stage: 12, name: "黒鉄の城塞", 歩: 2, 銀: 4, 金: 2, ポーン: 4, ルーク: 3 },
    { stage: 13, name: "天空の支配者", 銀: 2, 金: 2, 角: 2, 飛: 2, ポーン: 2, ナイト: 2, ビショップ: 2, クイーン: 2 },
    { stage: 14, name: "漆黒の盤上遊戯", 歩: 5, 香: 2, 桂: 2, 銀: 3, 金: 3, 角: 2, 飛: 2, ポーン: 8, ナイト: 4, ビショップ: 4, ルーク: 2, クイーン: 1 },
    { stage: 15, name: "覇王と皇帝", 歩: 4, 香: 2, 桂: 2, 銀: 4, 金: 4, 角: 3, 飛: 3, 王: 1, ポーン: 10, ナイト: 6, ビショップ: 4, ルーク: 4, クイーン: 2, キング: 1 },
    { stage: 16, name: "盤上の支配者・ヨット", 歩: 2, ポーン: 2, ヨット: 1 },
    { stage: 50, name: "盤上最終決戦", 歩: 15, 香: 8, 桂: 8, 銀: 8, 金: 8, 角: 5, 飛: 5, 王: 1, ポーン: 20, ナイト: 10, ビショップ: 10, ルーク: 8, クイーン: 4, キング: 2, ヨット: 1 }
];

class DummyEnemy {
    constructor(type, scale = 1.0) {
        this.type = type;
        this.hp = Math.max(10, scale * 10);
        this.maxHp = this.hp;

        const geometry = new THREE.BoxGeometry(scale * 1.5, scale * 3.0, scale * 1.5);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xff3333, 
            roughness: 0.5, 
            transparent: true, 
            opacity: 0.85 
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        
        const angle = Math.random() * Math.PI * 2;
        const radius = 15 + Math.random() * 35;
        this.mesh.position.set(
            Math.cos(angle) * radius,
            GROUND_Y,
            Math.sin(angle) * radius
        );
        
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        if (STATE.scene) {
            STATE.scene.add(this.mesh);
        }
    }

    update(playerPosition, otherEnemies) {
        if (!this.mesh || !playerPosition) return;
        const dir = new THREE.Vector3().subVectors(playerPosition, this.mesh.position);
        dir.y = 0;
        const distance = dir.length();
        if (distance > 1.5) {
            dir.normalize();
            this.mesh.position.addScaledVector(dir, 0.05);
            this.mesh.lookAt(playerPosition.x, this.mesh.position.y, playerPosition.z);
        }
    }

    takeHit(power) {
        this.hp -= power;
        if (this.mesh && this.mesh.material) {
            const mat = this.mesh.material;
            const originalColor = mat.color.getHex();
            mat.color.setHex(0xffffff);
            setTimeout(() => {
                if (mat) mat.color.setHex(originalColor);
            }, 100);
        }
        return this.hp <= 0;
    }
}

function start() {
    initGame();
    setupEvents();
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
} else {
    window.addEventListener('DOMContentLoaded', start);
}

function initGame() {
    const hour = new Date().getHours();
    let skyColor, fogColor, sunColor, sunIntensity, ambientColor, ambientIntensity;
    let celestialColor, celestialPos, celestialRadius;

    if (hour >= 5 && hour < 9) { 
        skyColor = 0xe5cca9; fogColor = 0xe5cca9; sunColor = 0xfff2e0; sunIntensity = 1.0; ambientColor = 0xffeadd; ambientIntensity = 0.7;
        celestialColor = 0xffaa66; celestialPos = new THREE.Vector3(120, 150, 50); celestialRadius = 14;
    } else if (hour >= 9 && hour < 16) { 
        skyColor = 0xd2dad2; fogColor = 0xd2dad2; sunColor = 0xfffcf3; sunIntensity = 1.3; ambientColor = 0xffffff; ambientIntensity = 0.8;
        celestialColor = 0xfffbe0; celestialPos = new THREE.Vector3(40, 200, 40); celestialRadius = 15;
    } else if (hour >= 16 && hour < 19) { 
        skyColor = 0xb84a39; fogColor = 0xb84a39; sunColor = 0xffaa44; sunIntensity = 1.1; ambientColor = 0xffebd5; ambientIntensity = 0.6;
        celestialColor = 0xee3311; celestialPos = new THREE.Vector3(-120, 140, -30); celestialRadius = 16;
    } else { 
        skyColor = 0x0c0d1a; fogColor = 0x0c0d1a; sunColor = 0x90a0ff; sunIntensity = 0.7; ambientColor = 0x161a2b; ambientIntensity = 0.45;
        celestialColor = 0xe0e8ff; celestialPos = new THREE.Vector3(80, 180, -80); celestialRadius = 11;
    }

    STATE.takeDamage = takeDamage;
    STATE.playerStunTime = 0;
    STATE.introActive = false; // 登場演出フラグ初期化
    STATE.introUpdate = null;

    STATE.scene = new THREE.Scene();
    STATE.scene.background = new THREE.Color(skyColor);
    STATE.scene.fog = new THREE.FogExp2(fogColor, 0.0035);

    STATE.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    STATE.camera.rotation.order = 'YXZ';
    STATE.camera.position.set(0, GROUND_Y + EYE_HEIGHT, 0);

    STATE.renderer = new THREE.WebGLRenderer({ antialias: true });
    STATE.renderer.setSize(window.innerWidth, window.innerHeight);
    STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    STATE.renderer.shadowMap.enabled = true;
    STATE.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(STATE.renderer.domElement);

    const ambient = new THREE.AmbientLight(ambientColor, ambientIntensity); 
    STATE.scene.add(ambient);
    
    STATE.sun = new THREE.DirectionalLight(sunColor, sunIntensity); 
    STATE.sun.position.set(60, 80, 40); 
    STATE.sun.castShadow = true; 
    STATE.sun.shadow.mapSize.width = 2048;
    STATE.sun.shadow.mapSize.height = 2048;
    STATE.sun.shadow.camera.near = 0.5;
    STATE.sun.shadow.camera.far = 200;
    const d = 60;
    STATE.sun.shadow.camera.left = -d;
    STATE.sun.shadow.camera.right = d;
    STATE.sun.shadow.camera.top = d;
    STATE.sun.shadow.camera.bottom = -d;
    STATE.sun.shadow.bias = -0.0005;
    STATE.scene.add(STATE.sun);

    const celestialGeom = new THREE.SphereGeometry(celestialRadius, 32, 32);
    const celestialMat = new THREE.MeshBasicMaterial({ color: celestialColor, fog: false });
    const celestialMesh = new THREE.Mesh(celestialGeom, celestialMat);
    celestialMesh.position.copy(celestialPos);
    STATE.scene.add(celestialMesh);
    STATE.celestialBody = celestialMesh;

    const cloudCount = 12 + Math.floor(Math.random() * 4);
    for (let i = 0; i < cloudCount; i++) {
        const cloudGroup = new THREE.Group();
        const partCount = 3 + Math.floor(Math.random() * 4);
        const cloudColor = (hour >= 19 || hour < 5) ? 0x3d435e : 0xffffff;
        const cloudOpacity = (hour >= 19 || hour < 5) ? 0.4 : 0.55;

        for (let j = 0; j < partCount; j++) {
            const rx = 5 + Math.random() * 8;
            const ry = 2.5 + Math.random() * 3.5;
            const rz = 5 + Math.random() * 8;
            const geom = new THREE.DodecahedronGeometry(1, 1);
            geom.scale(rx, ry, rz);

            const mat = new THREE.MeshBasicMaterial({
                color: cloudColor, transparent: true, opacity: cloudOpacity, fog: false
            });
            const part = new THREE.Mesh(geom, mat);
            part.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 14);
            cloudGroup.add(part);
        }

        const cx = (Math.random() - 0.5) * 600;
        const cy = 60 + Math.random() * 20;
        const cz = (Math.random() - 0.5) * 500;
        cloudGroup.position.set(cx, cy, cz);
        cloudGroup.userData = { speed: 0.04 + Math.random() * 0.08 };

        STATE.scene.add(cloudGroup);
        STATE.clouds.push(cloudGroup);
    }

    AssetFactory.init();

    const mossTex = AssetFactory.createMossTexture();
    mossTex.wrapS = THREE.RepeatWrapping;
    mossTex.wrapT = THREE.RepeatWrapping;
    mossTex.repeat.set(12, 12);
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000), 
        new THREE.MeshStandardMaterial({ map: mossTex, roughness: 1.0, metalness: 0.0 })
    );
    floor.rotation.x = -Math.PI / 2; 
    floor.receiveShadow = true; 
    STATE.scene.add(floor);

    const sandTex = AssetFactory.createKaresansuiTexture();
    const sandFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(160, 160),
        new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.9, metalness: 0.0 })
    );
    sandFloor.rotation.x = -Math.PI / 2;
    sandFloor.position.y = 0.02; 
    sandFloor.receiveShadow = true;
    STATE.scene.add(sandFloor);

    const bambooGroup = new THREE.Group();
    const bambooCount = 120;
    for (let i = 0; i < bambooCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 85 + Math.random() * 115; 
        const bx = Math.cos(angle) * dist;
        const bz = Math.sin(angle) * dist;
        
        const bamboo = createBamboo();
        bamboo.position.set(bx, 0, bz);
        bamboo.rotation.x = (Math.random() - 0.5) * 0.06;
        bamboo.rotation.z = (Math.random() - 0.5) * 0.06;
        bamboo.rotation.y = Math.random() * Math.PI;
        bambooGroup.add(bamboo);
    }
    STATE.scene.add(bambooGroup);

    const rockGroup = new THREE.Group();
    const rockCount = 20;
    for (let i = 0; i < rockCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 65 + Math.random() * 25;
        const rx = Math.cos(angle) * dist;
        const rz = Math.sin(angle) * dist;
        
        const rock = createRock();
        rock.position.set(rx, 0, rz);
        rockGroup.add(rock);
    }
    STATE.scene.add(rockGroup);

    const lanternPositions = [
        { x: -55, z: -55 }, { x: 55, z: -55 }, { x: -55, z: 55 }, { x: 55, z: 55 }
    ];
    lanternPositions.forEach(pos => {
        const lantern = createLantern();
        lantern.position.set(pos.x, 0, pos.z);
        lantern.scale.set(1.5, 1.5, 1.5); 
        STATE.scene.add(lantern);
    });

    STATE.boardGroup = new THREE.Group();

    const boardTopTex = AssetFactory.createWoodCanvas(null, COLORS.ink, true);
    const boardSideTex = AssetFactory.createWoodCanvas(null);
    const boardMaterials = [
        new THREE.MeshStandardMaterial({ map: boardSideTex, roughness: 0.8 }), 
        new THREE.MeshStandardMaterial({ map: boardSideTex, roughness: 0.8 }), 
        new THREE.MeshStandardMaterial({ map: boardTopTex, roughness: 0.8 }),  
        new THREE.MeshStandardMaterial({ map: boardSideTex, roughness: 0.8 }), 
        new THREE.MeshStandardMaterial({ map: boardSideTex, roughness: 0.8 }), 
        new THREE.MeshStandardMaterial({ map: boardSideTex, roughness: 0.8 })  
    ];

    const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(BOARD_SIZE, BOARD_THICKNESS, BOARD_SIZE), boardMaterials);
    boardMesh.position.y = GROUND_Y - BOARD_THICKNESS / 2; 
    boardMesh.receiveShadow = true;
    boardMesh.castShadow = true;
    STATE.boardGroup.add(boardMesh);

    const legMaterial = new THREE.MeshStandardMaterial({ map: boardSideTex, roughness: 0.8 });
    function createLeg(x, z) {
        const leg = new THREE.Group();
        const bottomPart = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 0.4, 16), legMaterial);
        bottomPart.position.y = 0.2; bottomPart.castShadow = true; leg.add(bottomPart);

        const midPart = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), legMaterial);
        midPart.scale.set(1, 0.6, 1); midPart.position.y = 1.1; midPart.castShadow = true; leg.add(midPart);

        const topPart = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.4, 16), legMaterial);
        topPart.position.y = 1.8; topPart.castShadow = true; leg.add(topPart);

        leg.position.set(x, 0, z);
        return leg;
    }

    const legOffset = BOARD_SIZE / 2 - 6;
    STATE.boardGroup.add(createLeg(-legOffset, -legOffset));
    STATE.boardGroup.add(createLeg(legOffset, -legOffset));
    STATE.boardGroup.add(createLeg(-legOffset, legOffset));
    STATE.boardGroup.add(createLeg(legOffset, legOffset));

    STATE.scene.add(STATE.boardGroup);

    window.addEventListener('resize', () => {
        if (STATE.camera && STATE.renderer) {
            STATE.camera.aspect = window.innerWidth / window.innerHeight;
            STATE.camera.updateProjectionMatrix();
            STATE.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    });

    if (isTouchDevice) {
        document.body.classList.add('touch-device');
        const shopCloseDesc = document.getElementById('shop-close-desc');
        if (shopCloseDesc) {
            shopCloseDesc.innerHTML = '[店] ボタン または [Tab] キーで閉じる<br>[控] で一時停止<br>項目タップで購入';
        }
    }

    // entities.jsからshowMsgを呼び出せるように安全にグローバル空間にエクスポート
    window.showMsg = showMsg;

    updateUI(); 
    animate();
}

function cleanUp3DObjects() {
    if (STATE.enemies) {
        STATE.enemies.forEach(en => { if(en && en.mesh && STATE.scene) STATE.scene.remove(en.mesh); });
    }
    if (STATE.bullets) {
        STATE.bullets.forEach(b => { if(b && b.mesh && STATE.scene) STATE.scene.remove(b.mesh); });
    }
    if (STATE.enemyBullets) {
        STATE.enemyBullets.forEach(eb => { if(eb && eb.mesh && STATE.scene) STATE.scene.remove(eb.mesh); });
    }
    if (STATE.items) {
        STATE.items.forEach(it => { if(it && it.mesh && STATE.scene) STATE.scene.remove(it.mesh); });
    }

    STATE.enemies = [];
    STATE.bullets = [];
    STATE.enemyBullets = [];
    STATE.items = [];
}

function cleanUpStage() {
    STATE.stageActive = false;
    STATE.isPaused = false;
    STATE.isGameOver = false;
    STATE.introActive = false;
    STATE.introUpdate = null;

    const introOverlay = document.getElementById('boss-intro-overlay');
    if (introOverlay && introOverlay.parentNode) {
        introOverlay.parentNode.removeChild(introOverlay);
    }
    
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'none';
    
    cleanUp3DObjects();

    const stageClearMenu = document.getElementById('stage-clear-menu');
    if (stageClearMenu) stageClearMenu.style.display = 'none';

    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.style.display = 'none';

    const gameOverMenu = document.getElementById('game-over');
    if (gameOverMenu) gameOverMenu.style.display = 'none';

    if (!isTouchDevice && document.pointerLockElement) {
        document.exitPointerLock();
    }
}

function getClearedStages() {
    try {
        const data = localStorage.getItem('non_shogi_progress');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveClearedStage(stageNum) {
    try {
        const cleared = getClearedStages();
        if (!cleared.includes(stageNum)) {
            cleared.push(stageNum);
            localStorage.setItem('non_shogi_progress', JSON.stringify(cleared));
        }
    } catch (e) {
        console.error("セーブデータの保存に失敗しました:", e);
    }
}

function getUnlockedPieces() {
    const unlocked = new Set();
    if (!STATE.stages || STATE.stages.length === 0) return unlocked;

    const cleared = getClearedStages();
    
    STATE.stages.forEach((stg, index) => {
        let isUnlocked = false;
        if (index === 0) {
            isUnlocked = true;
        } else {
            const prevStage = STATE.stages[index - 1];
            if (prevStage && cleared.includes(prevStage.stage)) {
                isUnlocked = true;
            }
        }

        if (isUnlocked) {
            const pieces = ['歩', '香', '桂', '銀', '金', '角', '飛', '王', 'ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング', 'ヨット'];
            pieces.forEach(p => {
                if (stg[p] && stg[p] > 0) {
                    unlocked.add(p);
                }
            });
        }
    });

    return unlocked;
}

function filterEmptyStages(stageList) {
    if (!stageList) return [];
    const enemyTypes = ['歩', '香', '桂', '銀', '金', '角', '飛', '王', 'ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング', 'ヨット'];
    return stageList.filter(stg => {
        let totalEnemies = 0;
        enemyTypes.forEach(type => {
            totalEnemies += (stg[type] || 0);
        });
        return totalEnemies > 0;
    });
}

async function loadStages() {
    let input = SPREADSHEET_ID.trim();
    let cleanedId = input;
    if (cleanedId.includes('/d/')) {
        cleanedId = cleanedId.split('/d/')[1].split('/')[0];
    }

    const url = `https://docs.google.com/spreadsheets/d/${cleanedId}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

    try {
        if (cleanedId === "" || cleanedId.includes("YOUR_SPREADSHEET_ID")) {
            throw new Error("スプレッドシートID、またはURLが設定されていません。予備データを使用します。");
        }
        
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
        const csvText = await res.text();
        const parsed = parseCSV(csvText);
        
        STATE.stages = filterEmptyStages(parsed);
        
        if (STATE.stages.length === 0) throw new Error("Parsed empty stages");

        buildStageSelectUI();
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.style.display = 'none';
        const stageSelectMenu = document.getElementById('stage-select-menu');
        if (stageSelectMenu) stageSelectMenu.style.display = 'flex';
    } catch (e) {
        console.warn("スプレッドシートのロードに失敗しました。ローカル予備ステージデータを使用します。");
        startWithFallback();
    }
}

function startWithFallback() {
    STATE.stages = filterEmptyStages(JSON.parse(JSON.stringify(EXTENDED_FALLBACK_STAGES)));
    buildStageSelectUI();
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';
    const stageSelectMenu = document.getElementById('stage-select-menu');
    if (stageSelectMenu) stageSelectMenu.style.display = 'flex';
}

function parseCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return [];
    
    let delimiter = ',';
    if (lines[0].includes('\t')) delimiter = '\t';
    else if (lines[0].includes(';')) delimiter = ';';

    function splitCSVLine(line, delim) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const transform_char = line[i];
            if (transform_char === '"' || transform_char === "'") {
                inQuotes = !inQuotes;
            } else if (transform_char === delim && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += transform_char;
            }
        }
        result.push(current.trim());
        return result;
    }

    const headers = splitCSVLine(lines[0], delimiter).map(h => h.replace(/^[\uFEFF"']|["']$/g, ''));
    const parsed = [];
    
    for (let i = 1; i < lines.length; i++) {
        const cols = splitCSVLine(lines[i], delimiter).map(c => c.replace(/^["']|["']$/g, ''));
        if (cols.length < headers.length) continue;
        
        const rowObj = {};
        headers.forEach((header, index) => {
            const val = cols[index];
            if (header === 'stage') {
                rowObj[header] = parseInt(val, 10);
            } else if (header === 'name') {
                rowObj[header] = val;
            } else {
                rowObj[header] = parseInt(val, 10) || 0;
            }
        });
        parsed.push(rowObj);
    }
    return parsed;
}

// --- ボスステージ枠の豪華化対応 ---
function buildStageSelectUI() {
    const container = document.getElementById('stage-list');
    if (!container) return;
    container.innerHTML = '';
    const cleared = getClearedStages();
    
    STATE.stages.forEach((stg, index) => {
        let isUnlocked = false;
        if (index === 0) {
            isUnlocked = true;
        } else {
            const prevStage = STATE.stages[index - 1];
            if (prevStage && cleared.includes(prevStage.stage)) {
                isUnlocked = true;
            }
        }

        if (!isUnlocked) return;

        const btn = document.createElement('button');
        btn.className = 'stage-btn';
        
        // ステージにボス（ヨット）が存在するかチェック
        const hasBoss = (stg['ヨット'] && stg['ヨット'] > 0) ||
                        (stg['Yacht'] && stg['Yacht'] > 0);
                        
        if (hasBoss) {
            // ボス専用のCSSスタイルを直接流し込み（金色ボーダーとシャドウ）
            btn.classList.add('boss-stage-btn');
            btn.style.border = '2px solid #d4af37';
            btn.style.boxShadow = '0 0 12px rgba(212, 175, 55, 0.7)';
            btn.style.background = 'rgba(212, 175, 55, 0.12)';
        }
        
        const kanjis = ["零","一","二","三","四","五","六","七","八","九","十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十"];
        const waveName = kanjis[stg.stage] || stg.stage;
        
        btn.onclick = () => selectStage(index);
        btn.innerHTML = `<span>第${waveName}局：${stg.name}</span> <span style="color:#d4af37;">開始</span>`;
        container.appendChild(btn);
    });
}

function selectStage(index) {
    const stageSelectMenu = document.getElementById('stage-select-menu');
    if (stageSelectMenu) stageSelectMenu.style.display = 'none';
    const stageClearMenu = document.getElementById('stage-clear-menu');
    if (stageClearMenu) stageClearMenu.style.display = 'none';
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.style.display = 'none';
    const gameOverMenu = document.getElementById('game-over');
    if (gameOverMenu) gameOverMenu.style.display = 'none';

    STATE.currentStageIndex = index; // 修正：現在のステージインデックスを同期
    STATE.isPaused = false;
    STATE.isGameOver = false;
    startStage(STATE.stages[index]);
}

function buildPracticeMenu() {
    const container = document.getElementById('practice-piece-list');
    if (!container) return;
    container.innerHTML = '';
    const unlockedPieces = getUnlockedPieces();

    ALL_PRACTICE_PIECES.forEach(type => {
        const isUnlocked = unlockedPieces.has(type);
        if (!isUnlocked) return;

        const btn = document.createElement('button');
        btn.className = 'stage-btn';
        const fullName = PIECE_NAMES[type] || type;
        
        btn.onclick = () => startPracticeStage(type);
        btn.innerHTML = `<span>修練：${fullName}</span> <span style="color:#d4af37;">手合わせ</span>`;
        container.appendChild(btn);
    });
}

function startPracticeStage(type) {
    const practiceSelectMenu = document.getElementById('practice-select-menu');
    if (practiceSelectMenu) practiceSelectMenu.style.display = 'none';
    STATE.isPractice = true;
    
    const fullName = PIECE_NAMES[type] || type;
    const practiceStage = {
        stage: 0,
        name: `修練・${fullName}`,
        歩: type === '歩' ? 1 : 0,
        香: type === '香' ? 1 : 0,
        桂: type === '桂' ? 1 : 0,
        銀: type === '銀' ? 1 : 0,
        金: type === '金' ? 1 : 0,
        角: type === '角' ? 1 : 0,
        飛: type === '飛' ? 1 : 0,
        王: type === '王' ? 1 : 0,
        ポーン: type === 'ポーン' ? 1 : 0,
        ナイト: type === 'ナイト' ? 1 : 0,
        ビショップ: type === 'ビショップ' ? 1 : 0,
        ルーク: type === 'ルーク' ? 1 : 0,
        クイーン: type === 'クイーン' ? 1 : 0,
        キング: type === 'キング' ? 1 : 0,
        ヨット: type === 'ヨット' ? 1 : 0
    };
    STATE.currentPracticeStage = practiceStage;
    startStage(practiceStage);
}

// --- ボス登場演出（イントロフェーズ）のトリガー処理 ---
function triggerBossIntro(boss) {
    STATE.introActive = true;
    STATE.stageActive = true; 
    STATE.isPaused = false;
    
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'none'; 

    // 画面中央に警告用テキストオーバーレイを作成
    const introOverlay = document.createElement('div');
    introOverlay.id = 'boss-intro-overlay';
    introOverlay.style.position = 'absolute';
    introOverlay.style.top = '50%';
    introOverlay.style.left = '50%';
    introOverlay.style.transform = 'translate(-50%, -50%)';
    introOverlay.style.color = '#ff3333';
    introOverlay.style.fontSize = '34px';
    introOverlay.style.fontWeight = 'bold';
    introOverlay.style.fontFamily = 'serif';
    introOverlay.style.textAlign = 'center';
    introOverlay.style.lineHeight = '1.6';
    introOverlay.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.8), 2px 2px 4px #000';
    introOverlay.style.pointerEvents = 'none';
    introOverlay.style.zIndex = '9999';
    
    const bossName = (boss.type === 'ヨット' || boss.type === 'Yacht') ? 'ヨット' : 'キング';
    introOverlay.innerHTML = `⚠️ 警告 ⚠️<br>盤上の支配者『${bossName}』出現`;
    document.body.appendChild(introOverlay);

    // カメラの初期開始値
    const originalPos = new THREE.Vector3(0, GROUND_Y + EYE_HEIGHT, 0);
    const originalRotation = new THREE.Euler().copy(STATE.camera.rotation);
    
    const startTime = Date.now();
    const duration = 3000; // 3秒間ズーム演出を行う
    
    // 描画ループ内で毎フレーム実行されるカメラ追従関数
    STATE.introUpdate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1.0, elapsed / duration);
        
        if (boss && boss.mesh) {
            const bossPos = boss.mesh.position.clone();
            // ボスに最大45%までカメラをズームイン
            const targetCamPos = new THREE.Vector3().lerpVectors(
                originalPos, 
                bossPos.clone().add(new THREE.Vector3(0, -2.0, 0)), 
                progress * 0.45 
            );
            STATE.camera.position.copy(targetCamPos);
            STATE.camera.lookAt(bossPos.x, bossPos.y + 1.5, bossPos.z);
        }
        
        if (progress >= 1.0) {
            // 演出終了
            STATE.introActive = false;
            STATE.introUpdate = null;
            if (introOverlay.parentNode) {
                introOverlay.parentNode.removeChild(introOverlay);
            }
            
            // カメラをプレイヤー位置に戻して戦闘開始
            STATE.camera.position.copy(originalPos);
            STATE.camera.rotation.copy(originalRotation);
            
            if (uiLayer) uiLayer.style.display = 'block';
            updateUI();
            
            if (!isTouchDevice) {
                document.body.requestPointerLock();
            }
        }
    };
}

function startStage(stageData) {
    cleanUp3DObjects();

    PLAYER.hp = PLAYER.maxHp;
    PLAYER.vy = 0;
    PLAYER.isGrounded = true;
    PLAYER.isShooting = false;
    if (STATE.camera) {
        STATE.camera.position.set(0, GROUND_Y + EYE_HEIGHT, 0);
        STATE.camera.rotation.set(0, 0, 0);
    }
    
    STATE.playerStunTime = 0;

    const kanjis = ["零","一","二","三","四","五","六","七","八","九","十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十"];
    const waveValEl = document.getElementById('wave-val');
    if (stageData.stage === 0) {
        if (waveValEl) waveValEl.innerText = "修";
        showMsg(stageData.name);
    } else {
        const waveName = kanjis[stageData.stage] || stageData.stage;
        if (waveValEl) waveValEl.innerText = waveName;
        showMsg("第" + waveName + "局：" + stageData.name);
    }

    const enemyTypes = ['歩', '香', '桂', '銀', '金', '角', '飛', '王', 'ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング', 'ヨット'];
    const scale = 1 + (stageData.stage * 0.1);

    let bossEnemy = null;

    enemyTypes.forEach(type => {
        const count = stageData[type] || 0;
        for (let i = 0; i < count; i++) {
            // 修正：王、キング、K をボス枠（スケール拡大）から除外し、ヨットのみに制限
            const enemyScale = (type === 'ヨット' || type === 'Yacht') ? scale * 2.5 : scale;
            try {
                const enemy = new Enemy(type, enemyScale);
                STATE.enemies.push(enemy);
                // 修正：王、キング、K を演出対象のボス検知から除外し、ヨットのみに制限
                if (type === 'ヨット' || type === 'Yacht') {
                    bossEnemy = enemy;
                }
            } catch (error) {
                console.error(`エネミー [${type}] の生成に失敗しました。ダミーで代用します:`, error);
                try {
                    STATE.enemies.push(new DummyEnemy(type, enemyScale));
                } catch (fallbackError) {
                    console.error("フォールバック用ダミーエネミーの生成にも失敗しました:", fallbackError);
                }
            }
        }
    });

    STATE.isGameOver = false;

    // ボス検知時は戦闘を開始せずに演出に切り替える
    if (bossEnemy) {
        triggerBossIntro(bossEnemy);
    } else {
        STATE.stageActive = true;
        STATE.isPaused = false;
        STATE.introActive = false;
        const uiLayer = document.getElementById('ui-layer');
        if (uiLayer) uiLayer.style.display = 'block';
        updateUI();

        if (!isTouchDevice) {
            document.body.requestPointerLock();
        }
    }
}

function restartStage() {
    const gameOverMenu = document.getElementById('game-over');
    if (gameOverMenu) gameOverMenu.style.display = 'none';
    STATE.isGameOver = false;
    STATE.isPaused = false;
    if (STATE.isPractice) {
        startStage(STATE.currentPracticeStage);
    } else {
        startStage(STATE.stages[STATE.currentStageIndex]);
    }
}

function showStageClear() {
    STATE.stageActive = false;
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'none';
    
    if (!isTouchDevice && document.pointerLockElement) {
        document.exitPointerLock();
    }
    
    if (!STATE.isPractice) {
        const currentStage = STATE.stages[STATE.currentStageIndex];
        if (currentStage && typeof currentStage.stage !== 'undefined') {
            saveClearedStage(currentStage.stage);
        }
    }

    const stageClearMenu = document.getElementById('stage-clear-menu');
    if (stageClearMenu) stageClearMenu.style.display = 'flex';
    
    const nextBtn = document.getElementById('btn-next-stage');
    const clearPracticeBtn = document.getElementById('btn-clear-practice');
    const clearBackBtn = document.getElementById('btn-clear-back');

    if (STATE.isPractice) {
        if (nextBtn) nextBtn.style.display = 'none';
        if (clearBackBtn) clearBackBtn.style.display = 'none';
        if (clearPracticeBtn) clearPracticeBtn.style.display = 'inline-block';
    } else {
        if (clearPracticeBtn) clearPracticeBtn.style.display = 'none';
        if (clearBackBtn) clearBackBtn.style.display = 'inline-block';
        if (STATE.currentStageIndex + 1 < STATE.stages.length) {
            if (nextBtn) nextBtn.style.display = 'inline-block';
        } else {
            if (nextBtn) nextBtn.style.display = 'none'; 
        }
    }
}

function nextStage() {
    if (STATE.currentStageIndex + 1 < STATE.stages.length) {
        selectStage(STATE.currentStageIndex + 1);
    }
}

function togglePause() {
    if (!STATE.stageActive || STATE.isGameOver || STATE.introActive) return; // 演出中のポーズを抑制
    if (STATE.isPaused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

function pauseGame() {
    if (!STATE.stageActive || STATE.isGameOver || STATE.isPaused) return;
    if (STATE.shopOpen) {
        STATE.shopOpen = false;
        const shopMenu = document.getElementById('shop-menu');
        if (shopMenu) shopMenu.style.display = 'none';
    }
    STATE.isPaused = true;
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.style.display = 'flex';
    if (!isTouchDevice && document.pointerLockElement) {
        document.exitPointerLock();
    }
    PLAYER.isShooting = false;

    const pauseBack = document.getElementById('btn-pause-back');
    const pausePractice = document.getElementById('btn-pause-practice');
    if (STATE.isPractice) {
        if (pauseBack) pauseBack.style.display = 'none';
        if (pausePractice) pausePractice.style.display = 'inline-block';
    } else {
        if (pauseBack) pauseBack.style.display = 'inline-block';
        if (pausePractice) pausePractice.style.display = 'none';
    }
    updateUI();
}

function resumeGame() {
    if (!STATE.stageActive || STATE.isGameOver || !STATE.isPaused) return;
    STATE.isPaused = false;
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.style.display = 'none';
    if (!isTouchDevice) {
        document.body.requestPointerLock();
    }
    updateUI();
}

function quitStageToSelect() {
    cleanUpStage();
    if (STATE.isPractice) {
        const practiceSelectMenu = document.getElementById('practice-select-menu');
        if (practiceSelectMenu) practiceSelectMenu.style.display = 'flex';
        buildPracticeMenu();
    } else {
        const stageSelectMenu = document.getElementById('stage-select-menu');
        if (stageSelectMenu) stageSelectMenu.style.display = 'flex';
        buildStageSelectUI();
    }
}

function shoot() {
    if (!STATE.camera) return;
    const dir = new THREE.Vector3(); 
    STATE.camera.getWorldDirection(dir);
    if (STATE.bullets) {
        STATE.bullets.push(new Projectile(STATE.camera.position.clone().add(new THREE.Vector3(0,-0.5,0)), dir, false, 3.0, 0.25));
    }
    PLAYER.lastShot = Date.now();
}

export function takeDamage(amt) {
    if (STATE.isGameOver) return;
    PLAYER.hp -= amt;
    const vignette = document.getElementById('damage-vignette');
    if (vignette) {
        vignette.classList.add('hit');
        setTimeout(() => {
            if (vignette) vignette.classList.remove('hit');
        }, 200);
    }
    updateUI();
    if (PLAYER.hp <= 0) {
        STATE.isGameOver = true;
        STATE.stageActive = false;
        const uiLayer = document.getElementById('ui-layer');
        if (uiLayer) uiLayer.style.display = 'none';
        const gameOverMenu = document.getElementById('game-over');
        if (gameOverMenu) gameOverMenu.style.display = 'flex';
        
        const goBack = document.getElementById('btn-go-back');
        const goPractice = document.getElementById('btn-go-practice');
        if (STATE.isPractice) {
            if (goBack) goBack.style.display = 'none';
            if (goPractice) goPractice.style.display = 'inline-block';
        } else {
            if (goBack) goBack.style.display = 'inline-block';
            if (goPractice) goPractice.style.display = 'none';
        }

        if (!isTouchDevice && document.pointerLockElement) document.exitPointerLock();
    }
}

function flashCrosshair() {
    const ch = document.getElementById('crosshair');
    if (ch) {
        ch.classList.add('hit-mark');
        setTimeout(() => {
            if (ch) ch.classList.remove('hit-mark');
        }, 100);
    }
}

function upgrade(type) {
    if (STATE.score < UPGRADE_COSTS[type]) return;
    STATE.score -= UPGRADE_COSTS[type];
    if (type === 'power') PLAYER.power += 1;
    if (type === 'rate') PLAYER.fireRate = Math.max(60, PLAYER.fireRate - 40);
    if (type === 'speed') PLAYER.speed += 0.06;
    if (type === 'hp') { PLAYER.maxHp += 50; PLAYER.hp += 50; }
    UPGRADE_COSTS[type] = Math.floor(UPGRADE_COSTS[type] * 1.5);
    updateUI();
}

function upgradeByIndex(index) {
    const key = upgradeKeys[index];
    if (key) {
        upgrade(key);
    }
}

function updateShopHighlight() {
    for (let i = 0; i < 4; i++) {
        const itemEl = document.getElementById(`shop-item-${i}`);
        if (!itemEl) continue;
        const markerEl = itemEl.querySelector('.shop-marker');
        if (i === selectedShopIndex) {
            itemEl.classList.add('selected');
            if (markerEl) markerEl.innerText = '▶';
        } else {
            itemEl.classList.remove('selected');
            if (markerEl) markerEl.innerText = '　';
        }
    }
}

function updateUI() {
    const hpBar = document.getElementById('hp-bar');
    if (hpBar) {
        hpBar.style.width = Math.max(0, (PLAYER.hp/PLAYER.maxHp*100)) + "%";
    }
    const scoreVal = document.getElementById('score-val');
    if (scoreVal) {
        scoreVal.innerText = STATE.score;
    }
    const enemyCount = document.getElementById('enemy-count');
    if (enemyCount) {
        enemyCount.innerText = STATE.enemies ? STATE.enemies.length : 0;
    }
    for(let k in UPGRADE_COSTS) {
        const costEl = document.getElementById('cost-'+k);
        if (costEl) costEl.innerText = UPGRADE_COSTS[k];
    }
    updateShopHighlight();
}

function showMsg(txt) {
    const el = document.getElementById('msg-overlay');
    if (el) {
        el.innerText = txt; 
        el.style.opacity = 1; 
        el.style.transform = "scale(1)";
        setTimeout(() => { 
            if (el) {
                el.style.opacity = 0; 
                el.style.transform = "scale(1.5)"; 
            }
        }, 2000);
    }
}

function toggleShop() {
    if(!STATE.stageActive || STATE.isPaused || STATE.introActive) return; // 演出中のショップ防止
    STATE.shopOpen = !STATE.shopOpen;
    const shopMenu = document.getElementById('shop-menu');
    if (shopMenu) {
        shopMenu.style.display = STATE.shopOpen ? 'block' : 'none';
    }
    if(STATE.shopOpen) {
        PLAYER.isShooting = false;
        updateShopHighlight();
    }
}

function activateDebugMode() {
    PLAYER.maxHp = 9999;
    PLAYER.hp = 9999;
    PLAYER.power = 100;
    PLAYER.fireRate = 50;
    PLAYER.speed = 1.2;
    STATE.score = 999999;
    showMsg("神変不可思議（全能力極限解放）");
    updateUI();
}

function setupEvents() {
    const addSafeEvent = (id, eventName, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(eventName, handler);
    };

    addSafeEvent('btn-campaign-start', 'click', () => {
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.style.display = 'none';
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.style.display = 'flex';
        STATE.isPractice = false;
        loadStages();
    });

    addSafeEvent('btn-practice-start', 'click', () => {
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.style.display = 'none';
        const practiceSelectMenu = document.getElementById('practice-select-menu');
        if (practiceSelectMenu) practiceSelectMenu.style.display = 'flex';
        STATE.isPractice = true;
        if (!STATE.stages || STATE.stages.length === 0) {
            STATE.stages = filterEmptyStages(JSON.parse(JSON.stringify(EXTENDED_FALLBACK_STAGES)));
        }
        buildPracticeMenu();
    });

    addSafeEvent('btn-fallback-start', 'click', startWithFallback);

    addSafeEvent('btn-back-to-title', 'click', () => {
        const stageSelectMenu = document.getElementById('stage-select-menu');
        if (stageSelectMenu) stageSelectMenu.style.display = 'none';
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.style.display = 'flex';
    });

    addSafeEvent('btn-back-to-title-practice', 'click', () => {
        const practiceSelectMenu = document.getElementById('practice-select-menu');
        if (practiceSelectMenu) practiceSelectMenu.style.display = 'none';
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.style.display = 'flex';
    });

    addSafeEvent('btn-next-stage', 'click', nextStage);

    addSafeEvent('btn-clear-practice', 'click', () => {
        cleanUpStage();
        const practiceSelectMenu = document.getElementById('practice-select-menu');
        if (practiceSelectMenu) practiceSelectMenu.style.display = 'flex';
        buildPracticeMenu();
    });

    addSafeEvent('btn-clear-back', 'click', quitStageToSelect);

    addSafeEvent('btn-clear-title', 'click', () => {
        cleanUpStage();
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.style.display = 'flex';
    });

    addSafeEvent('btn-resume-game', 'click', resumeGame);

    addSafeEvent('btn-pause-practice', 'click', () => {
        cleanUpStage();
        const practiceSelectMenu = document.getElementById('practice-select-menu');
        if (practiceSelectMenu) practiceSelectMenu.style.display = 'flex';
        buildPracticeMenu();
    });

    addSafeEvent('btn-pause-back', 'click', quitStageToSelect);

    addSafeEvent('btn-pause-title', 'click', () => {
        cleanUpStage();
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.style.display = 'flex';
    });

    addSafeEvent('btn-restart-stage', 'click', restartStage);

    addSafeEvent('btn-go-practice', 'click', () => {
        cleanUpStage();
        const practiceSelectMenu = document.getElementById('practice-select-menu');
        if (practiceSelectMenu) practiceSelectMenu.style.display = 'flex';
        buildPracticeMenu();
    });

    addSafeEvent('btn-go-back', 'click', quitStageToSelect);

    addSafeEvent('btn-go-title', 'click', () => {
        cleanUpStage();
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.style.display = 'flex';
    });

    for (let i = 0; i < 4; i++) {
        addSafeEvent(`shop-item-${i}`, 'click', () => upgradeByIndex(i));
    }

    window.addEventListener('keydown', e => {
        keys[e.code] = true;
        if(e.code === 'Tab') {
            e.preventDefault();
            toggleShop();
        }
        if(e.code === 'Escape') {
            e.preventDefault();
            togglePause();
        }
        
        if(e.code === 'Space' && PLAYER.isGrounded && !STATE.shopOpen && STATE.stageActive && !STATE.isPaused && !STATE.introActive) {
            if (STATE.playerStunTime <= 0) {
                PLAYER.vy = JUMP_FORCE;
                PLAYER.isGrounded = false;
            }
        }

        const k = e.key.toLowerCase();
        if (k === debugKeys[debugIndex]) {
            debugIndex++;
            if (debugIndex === debugKeys.length) {
                activateDebugMode();
                debugIndex = 0;
            }
        } else {
            if (k === debugKeys[0]) debugIndex = 1;
            else debugIndex = 0;
        }
    });
    window.addEventListener('keyup', e => keys[e.code] = false);

    let clickCount = 0;
    let lastClickTime = 0;
    const scoreContainer = document.getElementById('score-container');
    if (scoreContainer) {
        scoreContainer.addEventListener('click', e => {
            e.stopPropagation();
            const now = Date.now();
            if (now - lastClickTime > 2000) clickCount = 0;
            clickCount++;
            lastClickTime = now;
            if (clickCount >= 5) {
                activateDebugMode();
                clickCount = 0;
            }
        });
    }

    window.addEventListener('mousemove', e => {
        if (!isTouchDevice && document.pointerLockElement && STATE.stageActive && !STATE.isPaused && STATE.camera && !STATE.introActive) {
            STATE.camera.rotation.y -= e.movementX * 0.0025;
            STATE.camera.rotation.x = Math.max(-1.4, Math.min(1.4, STATE.camera.rotation.x - e.movementY * 0.0025));
        }
    });

    window.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('wheel', e => {
        if (!STATE.shopOpen) return;
        if (e.deltaY > 0) {
            selectedShopIndex = (selectedShopIndex + 1) % 4;
        } else if (e.deltaY < 0) {
            selectedShopIndex = (selectedShopIndex - 1 + 4) % 4;
        }
        updateShopHighlight();
    }, { passive: true });

    window.addEventListener('mousedown', (e) => {
        if (!STATE.stageActive || STATE.isGameOver || STATE.isPaused || STATE.introActive) return;

        if (e.button === 2) {
            if (STATE.shopOpen) {
                upgradeByIndex(selectedShopIndex);
            }
            return;
        }

        if (STATE.shopOpen || isTouchDevice) return;
        if (!document.pointerLockElement) { document.body.requestPointerLock(); return; }
        
        if (e.button === 0 && STATE.playerStunTime <= 0) {
            PLAYER.isShooting = true;
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (isTouchDevice) return;
        if (e.button === 0) PLAYER.isShooting = false;
    });

    document.addEventListener('pointerlockchange', () => {
        if (!isTouchDevice && !document.pointerLockElement) {
            if (STATE.stageActive && !STATE.isGameOver && !STATE.shopOpen && !STATE.isPaused && !STATE.introActive) {
                pauseGame();
            }
        }
    });

    if (isTouchDevice) {
        setupTouchControls();
    }
}

function setupTouchControls() {
    let lookTouchId = null;
    let lastLookX = 0;
    let lastLookY = 0;

    window.addEventListener('touchstart', e => {
        if (STATE.shopOpen || STATE.isGameOver || !STATE.stageActive || STATE.isPaused || STATE.introActive) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            let target = touch.target;
            let isUI = false;
            
            while (target && target !== document.body) {
                if (target.id === 'joystick-outer' || 
                    target.id === 'joystick-knob' || 
                    target.classList.contains('touch-btn') || 
                    target.id === 'shop-menu' ||
                    target.id === 'pause-menu') {
                    isUI = true;
                    break;
                }
                target = target.parentNode;
            }
            
            if (!isUI && lookTouchId === null) {
                lookTouchId = touch.identifier;
                lastLookX = touch.clientX;
                lastLookY = touch.clientY;
            }
        }
    }, { passive: false });

    window.addEventListener('touchmove', e => {
        if (STATE.shopOpen || STATE.isGameOver || !STATE.stageActive || STATE.isPaused || STATE.introActive) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === lookTouchId && STATE.camera) {
                const dx = touch.clientX - lastLookX;
                const dy = touch.clientY - lastLookY;
                
                STATE.camera.rotation.y -= dx * 0.005; 
                STATE.camera.rotation.x = Math.max(-1.4, Math.min(1.4, STATE.camera.rotation.x - dy * 0.005));
                
                lastLookX = touch.clientX;
                lastLookY = touch.clientY;
                e.preventDefault(); 
            }
        }
    }, { passive: false });

    const endLook = e => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === lookTouchId) {
                lookTouchId = null;
            }
        }
    };
    window.addEventListener('touchend', endLook);
    window.addEventListener('touchcancel', endLook);

    const joystickOuter = document.getElementById('joystick-outer');
    const joystickKnob = document.getElementById('joystick-knob');
    let joystickTouchId = null;
    let joystickCenter = { x: 0, y: 0 };
    const maxRadius = 40; 

    if (joystickOuter && joystickKnob) {
        joystickOuter.addEventListener('touchstart', e => {
            if (STATE.shopOpen || STATE.isGameOver || !STATE.stageActive || STATE.isPaused || STATE.introActive) return;
            e.preventDefault();
            const touch = e.changedTouches[0];
            joystickTouchId = touch.identifier;
            
            const rect = joystickOuter.getBoundingClientRect();
            joystickCenter.x = rect.left + rect.width / 2;
            joystickCenter.y = rect.top + rect.height / 2;
        }, { passive: false });

        window.addEventListener('touchmove', e => {
            if (joystickTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === joystickTouchId) {
                    e.preventDefault();
                    let dx = touch.clientX - joystickCenter.x;
                    let dy = touch.clientY - joystickCenter.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > maxRadius) {
                        dx = (dx / distance) * maxRadius;
                        dy = (dy / distance) * maxRadius;
                    }
                    
                    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
                    joystickVector.x = dx / maxRadius;
                    joystickVector.y = dy / maxRadius;
                }
            }
        }, { passive: false });

        const endJoystick = e => {
            if (joystickTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === joystickTouchId) {
                    joystickTouchId = null;
                    joystickKnob.style.transform = 'translate(0px, 0px)';
                    joystickVector.x = 0;
                    joystickVector.y = 0;
                }
            }
        };
        window.addEventListener('touchend', endJoystick);
        window.addEventListener('touchcancel', endJoystick);
    }

    const addSafeTouchStart = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('touchstart', handler, { passive: false });
    };

    addSafeTouchStart('btn-shoot', e => {
        e.preventDefault();
        if (STATE.shopOpen || STATE.isGameOver || !STATE.stageActive || STATE.isPaused || STATE.playerStunTime > 0 || STATE.introActive) return;
        PLAYER.isShooting = true;
    });
    
    const btnShoot = document.getElementById('btn-shoot');
    if (btnShoot) {
        btnShoot.addEventListener('touchend', e => {
            e.preventDefault();
            PLAYER.isShooting = false;
        }, { passive: false });
        btnShoot.addEventListener('touchcancel', e => {
            PLAYER.isShooting = false;
        });
    }

    addSafeTouchStart('btn-jump', e => {
        e.preventDefault();
        if (STATE.shopOpen || STATE.isGameOver || !STATE.stageActive || STATE.isPaused || STATE.playerStunTime > 0 || STATE.introActive) return;
        if (PLAYER.isGrounded) {
            PLAYER.vy = JUMP_FORCE;
            PLAYER.isGrounded = false;
        }
    });

    const btnDash = document.getElementById('btn-dash');
    if (btnDash) {
        btnDash.addEventListener('touchstart', e => {
            e.preventDefault();
            if (STATE.shopOpen || STATE.isGameOver || !STATE.stageActive || STATE.isPaused || STATE.introActive) return;
            STATE.dashActive = !STATE.dashActive;
            if (STATE.dashActive) {
                btnDash.classList.add('active');
            } else {
                btnDash.classList.remove('active');
            }
        }, { passive: false });
    }

    addSafeTouchStart('btn-shop', e => {
        e.preventDefault();
        if (STATE.isGameOver || !STATE.stageActive || STATE.isPaused || STATE.introActive) return;
        toggleShop();
    });

    addSafeTouchStart('btn-pause', e => {
        e.preventDefault();
        if (STATE.isGameOver || !STATE.stageActive || STATE.introActive) return;
        togglePause();
    });
}

function animate() {
    requestAnimationFrame(animate);
    if (STATE.isGameOver) return;

    if (STATE.clouds) {
        STATE.clouds.forEach(cloud => {
            if (!cloud) return;
            cloud.position.x += cloud.userData?.speed ?? 0.05;
            if (cloud.position.x > 320) {
                cloud.position.x = -320;
                cloud.position.z = (Math.random() - 0.5) * 500;
                cloud.position.y = 60 + Math.random() * 20;
            }
        });
    }

    if (!STATE.stageActive && STATE.camera) {
        const time = Date.now() * 0.00015;
        const radius = 65;
        const height = 38;
        STATE.camera.position.x = Math.cos(time) * radius;
        STATE.camera.position.z = Math.sin(time) * radius;
        STATE.camera.position.y = GROUND_Y + height;
        STATE.camera.lookAt(0, GROUND_Y, 0);
    }

    if (STATE.renderer && STATE.scene && STATE.camera) {
        STATE.renderer.render(STATE.scene, STATE.camera);
    }

    if (!STATE.stageActive) return;
    if (STATE.isPaused) return;

    // --- ボス登場演出（イントロフェーズ）中の割り込みアップデート ---
    if (STATE.introActive) {
        if (typeof STATE.introUpdate === 'function') {
            STATE.introUpdate();
        }
        return; // 移動・射撃、エネミー更新等はすべてスルーする
    }

    if (STATE.playerStunTime > 0) {
        STATE.playerStunTime -= 16.67; 
        if (STATE.playerStunTime < 0) STATE.playerStunTime = 0;
        PLAYER.isShooting = false; 
    }

    const move = new THREE.Vector3();
    
    if (STATE.playerStunTime <= 0) {
        if (keys['KeyW']) move.z -= 1; if (keys['KeyS']) move.z += 1;
        if (keys['KeyA']) move.x -= 1; if (keys['KeyD']) move.x += 1;
        
        if (isTouchDevice && (joystickVector.x !== 0 || joystickVector.y !== 0)) {
            move.x += joystickVector.x;
            move.z += joystickVector.y;
        }
    }

    if (move.length() > 0 && STATE.camera) {
        const camRot = STATE.camera.rotation?.y ?? 0;
        const combinedMove = new THREE.Vector3(
            move.x * Math.cos(camRot) + move.z * Math.sin(camRot), 0,
            -move.x * Math.sin(camRot) + move.z * Math.cos(camRot)
        );
        let currentSpeed = PLAYER.speed;
        const isDashing = keys['ShiftLeft'] || keys['ShiftRight'] || (isTouchDevice && STATE.dashActive);
        if (isDashing) currentSpeed *= DASH_MULT;
        STATE.camera.position.add(combinedMove.normalize().multiplyScalar(currentSpeed));
    }

    if (STATE.camera) {
        const pLimit = BOARD_SIZE / 2 - 2.0;
        STATE.camera.position.x = Math.max(-pLimit, Math.min(pLimit, STATE.camera.position.x));
        STATE.camera.position.z = Math.max(-pLimit, Math.min(pLimit, STATE.camera.position.z));

        PLAYER.vy += GRAVITY;
        STATE.camera.position.y += PLAYER.vy;
        if (STATE.camera.position.y <= GROUND_Y + EYE_HEIGHT) {
            STATE.camera.position.y = GROUND_Y + EYE_HEIGHT;
            PLAYER.vy = 0;
            PLAYER.isGrounded = true;
        }
    }

    if (PLAYER.isShooting && !STATE.shopOpen && (document.pointerLockElement || isTouchDevice)) {
        if (Date.now() - PLAYER.lastShot > PLAYER.fireRate) {
            try {
                shoot();
            } catch (err) {
                console.error("射撃時にエラーが発生しました:", err);
            }
        }
    }

    if (STATE.bullets) {
        for (let i = STATE.bullets.length - 1; i >= 0; i--) {
            const b = STATE.bullets[i];
            if (!b) continue;
            try {
                b.update();
            } catch (err) {
                console.error("弾の更新中にエラーが発生しました:", err);
                b.alive = false;
            }
            if (!b.alive) STATE.bullets.splice(i, 1);
        }
    }

    if (STATE.enemyBullets) {
        for (let i = STATE.enemyBullets.length - 1; i >= 0; i--) {
            const eb = STATE.enemyBullets[i];
            if (!eb) continue;
            try {
                eb.update();
            } catch (err) {
                console.error("敵の弾の更新中にエラーが発生しました:", err);
                eb.alive = false;
            }
            if (!eb.alive) STATE.enemyBullets.splice(i, 1);
        }
    }

    if (STATE.items) {
        for (let i = STATE.items.length - 1; i >= 0; i--) {
            const item = STATE.items[i];
            if (!item) continue;
            try {
                item.update();
            } catch (err) {
                console.error("アイテムの更新中にエラーが発生しました:", err);
                item.alive = false;
            }
            if (!item.alive) {
                STATE.items.splice(i, 1);
                continue;
            }

            if (STATE.camera && item.mesh) {
                const playerGroundPos = new THREE.Vector3(STATE.camera.position.x, GROUND_Y, STATE.camera.position.z);
                const dist = item.mesh.position.distanceTo(playerGroundPos);
                if (dist < 2.5) {
                    PLAYER.hp = Math.min(PLAYER.maxHp, PLAYER.hp + 25);
                    updateUI();
                    try {
                        item.destroy();
                    } catch (err) {
                        console.error("アイテム破壊時にエラーが発生しました:", err);
                    }
                    STATE.items.splice(i, 1);
                }
            }
        }
    }

    if (STATE.enemies && STATE.camera) {
        for (let i = STATE.enemies.length - 1; i >= 0; i--) {
            const en = STATE.enemies[i];
            if (!en) continue;

            try {
                en.update(STATE.camera.position, STATE.enemies);
            } catch (err) {
                console.error("敵の挙動更新中にエラーが発生しました:", err);
            }
            
            if (STATE.bullets) {
                for (let j = STATE.bullets.length - 1; j >= 0; j--) {
                    const b = STATE.bullets[j];
                    if (!b || !b.alive || !b.mesh || !en.mesh) continue;
                    
                    const dx = b.mesh.position.x - en.mesh.position.x;
                    const dz = b.mesh.position.z - en.mesh.position.z;
                    
                    // ヨット(浮遊)用の高さを考慮した被弾判定
                    let targetCenterY = en.mesh.position.y + 1.2;
                    if (en.type === 'ヨット' || en.type === 'Yacht') {
                        targetCenterY = en.mesh.position.y;
                    }
                    const dy = b.mesh.position.y - targetCenterY;

                    // ボス「ヨット」用の大きめの当たり判定(球状・半径4.5付近)
                    const hitRadiusSq = (en.type === 'ヨット' || en.type === 'Yacht') ? 25.0 : 6.25;
                    const hitHeightLimit = (en.type === 'ヨット' || en.type === 'Yacht') ? 5.0 : 3.0;

                    if (dx*dx + dz*dz < hitRadiusSq && Math.abs(dy) < hitHeightLimit) {
                        flashCrosshair();
                        
                        let isKilled = false;
                        try {
                            isKilled = en.takeHit(PLAYER.power);
                        } catch (err) {
                            console.error("被弾処理中にエラーが発生しました。強制撃破とみなします:", err);
                            isKilled = true;
                        }

                        if (isKilled) {
                            const isBoss = (en.type === '王' || en.type === 'キング' || en.type === 'K' || en.type === 'ヨット' || en.type === 'Yacht');
                            STATE.score += (isBoss ? 10000 : 200);
                            
                            const dropProb = isBoss ? 1.0 : 0.3;
                            if (Math.random() < dropProb && STATE.items) {
                                try {
                                    STATE.items.push(new Item(en.mesh.position));
                                } catch (err) {
                                    console.error("アイテム生成中にエラーが発生しました:", err);
                                }
                            }

                            if (STATE.scene && en.mesh) {
                                STATE.scene.remove(en.mesh);
                            }
                            STATE.enemies.splice(i, 1);
                            updateUI();
                        }
                        
                        try {
                            b.destroy();
                        } catch (err) {
                            console.error("弾の破壊処理中にエラーが発生しました:", err);
                        }
                        STATE.bullets.splice(j, 1);
                        break;
                    }
                }
            }
        }
    }

    if (STATE.enemies && STATE.enemies.length === 0 && !STATE.shopOpen) {
        showStageClear();
    }
}
