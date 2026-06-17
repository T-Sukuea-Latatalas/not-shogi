import * as THREE from 'three';
import { COLORS, STATE, EYE_HEIGHT, GROUND_Y, BOARD_SIZE } from './constants.js';
import { AssetFactory, getChessGeometry } from './assets.js'; 

// --- ヨット判定用補助関数 ---
function evaluateYachtHand(dice) {
    const counts = {};
    dice.forEach(d => counts[d] = (counts[d] || 0) + 1);
    const uniqueValues = Object.keys(counts).map(Number).sort((a,b)=>a-b);
    
    // 1. Yacht (5つがすべて同じ目)
    if (uniqueValues.length === 1) {
        return { name: 'Yacht', score: 50 };
    }
    
    // 2. Four of a Kind (4つ以上が同じ目)
    for (let val in counts) {
        if (counts[val] >= 4) {
            return { name: 'Four of a Kind', score: dice.reduce((a,b)=>a+b, 0) };
        }
    }
    
    // 3. Full House (3つが同じ目 ＆ 2つが同じ目)
    let hasThree = false;
    let hasTwo = false;
    for (let val in counts) {
        if (counts[val] === 3) hasThree = true;
        if (counts[val] === 2) hasTwo = true;
    }
    if (hasThree && hasTwo) {
        return { name: 'Full House', score: dice.reduce((a,b)=>a+b, 0) };
    }
    
    // 4. Large Straight (5つの連番)
    const diceStr = uniqueValues.join('');
    if (diceStr === '12345' || diceStr === '23456') {
        return { name: 'Large Straight', score: 30 };
    }
    
    // 5. Small Straight (4つの連番)
    let isSmallStraight = false;
    if (uniqueValues.includes(1) && uniqueValues.includes(2) && uniqueValues.includes(3) && uniqueValues.includes(4)) isSmallStraight = true;
    if (uniqueValues.includes(2) && uniqueValues.includes(3) && uniqueValues.includes(4) && uniqueValues.includes(5)) isSmallStraight = true;
    if (uniqueValues.includes(3) && uniqueValues.includes(4) && uniqueValues.includes(5) && uniqueValues.includes(6)) isSmallStraight = true;
    if (isSmallStraight) {
        return { name: 'Small Straight', score: 20 };
    }
    
    // 6. Choice および エース〜シックス (基本役の中で最大のスコアとなるものを選択)
    let bestBasicName = 'Choice';
    let bestBasicScore = dice.reduce((a,b)=>a+b, 0); // Choiceは全合計
    
    for (let i = 1; i <= 6; i++) {
        const score = (counts[i] || 0) * i;
        if (score > bestBasicScore) {
            bestBasicScore = score;
            const names = ['Aces', 'Deuces', 'Threes', 'Fours', 'Fives', 'Sixes'];
            bestBasicName = names[i - 1];
        }
    }
    
    return { name: bestBasicName, score: bestBasicScore };
}

export class Projectile {
    constructor(pos, dir, isEnemy = false, speed = 1.5, size = 0.25, isHoming = false, isStun = false) {
        this.isEnemy = isEnemy;
        this.isHoming = isHoming;
        this.isStun = isStun; 
        this.speed = speed;
        this.velocity = dir ? dir.clone().normalize().multiplyScalar(speed) : new THREE.Vector3();
        
        const colorSpirit = (COLORS && COLORS.spirit !== undefined) ? COLORS.spirit : 0x00ffff;
        const colorVermillion = (COLORS && COLORS.vermillion !== undefined) ? COLORS.vermillion : 0xff3300;

        let color = isEnemy ? (isHoming ? 0x8000ff : colorSpirit) : colorVermillion;
        if (isEnemy && isStun) {
            color = 0xff6600;
        }
        
        const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 });
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(size), mat);
        if (pos) {
            this.mesh.position.copy(pos);
        }
        this.alive = true;
        this.life = 300;
        if (STATE && STATE.scene) {
            STATE.scene.add(this.mesh);
        }
    }
    update() {
        if (!this.alive) return;
        const cameraPos = (STATE && STATE.camera && STATE.camera.position) ? STATE.camera.position : null;
        if (this.isHoming && this.isEnemy && cameraPos) {
            const targetDir = new THREE.Vector3().subVectors(cameraPos, this.mesh.position).normalize();
            this.velocity = this.velocity.lerp(targetDir.multiplyScalar(this.speed), 0.03);
        }
        this.mesh.position.add(this.velocity);
        this.life--;
        if (this.life <= 0) {
            this.destroy();
            return;
        }

        if (this.isEnemy && cameraPos) {
            const eyeH = (typeof EYE_HEIGHT === 'number') ? EYE_HEIGHT : 1.6;
            const playerBody = cameraPos.clone().add(new THREE.Vector3(0, -eyeH / 2, 0));
            const dist = this.mesh.position.distanceTo(playerBody);
            if (dist < 2.0) {
                if (STATE && typeof STATE.takeDamage === 'function') {
                    STATE.takeDamage(this.isHoming ? 5 : 10);
                }
                
                if (this.isStun && STATE) {
                    STATE.playerStunTime = 1000; 
                }
                
                this.destroy();
            }
        }
    }
    destroy() { 
        if (!this.alive) return;
        this.alive = false; 
        if (STATE && STATE.scene && this.mesh) {
            STATE.scene.remove(this.mesh); 
        }
        if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) {
                if (Array.isArray(this.mesh.material)) {
                    this.mesh.material.forEach(m => { if (m) m.dispose(); });
                } else {
                    this.mesh.material.dispose();
                }
            }
        }
    }
}

export class Item {
    constructor(pos) {
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 16, 16),
            new THREE.MeshStandardMaterial({
                color: 0x2ecc71, emissive: 0x2ecc71, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.1
            })
        );
        this.baseY = (typeof GROUND_Y === 'number') ? GROUND_Y : 0;
        if (pos) {
            this.mesh.position.set(pos.x, this.baseY, pos.z);
        } else {
            this.mesh.position.set(0, this.baseY, 0);
        }
        this.alive = true;
        this.life = 900; 
        if (STATE && STATE.scene) {
            STATE.scene.add(this.mesh);
        }
    }
    update() {
        if (!this.alive) return;
        this.mesh.rotation.y += 0.02;
        this.mesh.rotation.x += 0.01;
        
        const time = Date.now() * 0.003;
        this.mesh.position.y = this.baseY + Math.sin(time) * 0.3 + 0.2;

        this.life--;
        if (this.life <= 0) this.destroy();
    }
    destroy() { 
        if (!this.alive) return;
        this.alive = false; 
        if (STATE && STATE.scene && this.mesh) {
            STATE.scene.remove(this.mesh); 
        }
        if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) {
                if (Array.isArray(this.mesh.material)) {
                    this.mesh.material.forEach(m => { if (m) m.dispose(); });
                } else {
                    this.mesh.material.dispose();
                }
            }
        }
    }
}

export class Enemy {
    constructor(type, waveScale = 1.0) {
        this.type = type;
        this.alive = true;
        
        const chessTypes = ['ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング', 'P', 'N', 'B', 'R', 'Q', 'K'];
        let geom = null;
        let mats = null;

        try {
            if (chessTypes.includes(type)) {
                mats = (AssetFactory && typeof AssetFactory.getChessMaterials === 'function') 
                    ? AssetFactory.getChessMaterials(type) 
                    : null;
                geom = (typeof getChessGeometry === 'function') 
                    ? getChessGeometry(type) 
                    : null;
            } else if (type === 'ヨット' || type === 'Yacht') {
                // 3Dヨット(浮遊船風)の構築
                const group = new THREE.Group();
                const hullGeom = new THREE.ConeGeometry(3.0, 8.0, 4);
                hullGeom.rotateX(Math.PI / 2);
                hullGeom.scale(1.0, 0.5, 2.0);
                const hullMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.2, metalness: 0.8 });
                const hull = new THREE.Mesh(hullGeom, hullMat);
                group.add(hull);

                const sailGeom = new THREE.ConeGeometry(2.0, 6.0, 3);
                sailGeom.rotateY(Math.PI / 6);
                sailGeom.position.set(0, 4.0, -1.0);
                const sailMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1, roughness: 0.5, emissive: 0x222222 });
                const sail = new THREE.Mesh(sailGeom, sailMat);
                group.add(sail);
                
                mats = [hullMat, sailMat];
                geom = null;
                this.mesh = group;
                group.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
            } else {
                mats = (AssetFactory && typeof AssetFactory.getMaterials === 'function') 
                    ? AssetFactory.getMaterials(type) 
                    : null;
                geom = (AssetFactory && AssetFactory.pieceGeom) 
                    ? AssetFactory.pieceGeom 
                    : null; 
            }
        } catch (e) {
            console.warn(`Failed to initialize geometry or material for ${type}:`, e);
        }

        if (!this.mesh) {
            if (!geom) {
                geom = new THREE.BoxGeometry(1, 2, 1);
            }
            if (!mats) {
                mats = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
            }
            this.mats = Array.isArray(mats) ? mats : [mats];
            this.mesh = new THREE.Mesh(geom, this.mats);
            this.mesh.castShadow = true;
        } else {
            this.mats = Array.isArray(mats) ? mats : [mats];
        }
        
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 15;
        const gy = (typeof GROUND_Y === 'number') ? GROUND_Y : 0;

        if (type === 'ヨット' || type === 'Yacht') {
            // 盤面外の空中に配置
            const boardSz = (typeof BOARD_SIZE === 'number') ? BOARD_SIZE : 60;
            const yDist = boardSz / 2 + 15;
            this.mesh.position.set(Math.cos(angle) * yDist, gy + 12.0, Math.sin(angle) * yDist);
        } else {
            this.mesh.position.set(Math.cos(angle)*dist, gy, Math.sin(angle)*dist);
        }
        
        const scale = (typeof waveScale === 'number') ? waveScale : 1.0;
        this.hp = (this.getHPBase(type)) * scale;
        this.maxHp = this.hp;
        this.speed = this.getSpeedBase(type);
        this.lastAttack = Date.now() + Math.random() * 1000;
        
        this.chargeState = 0; 
        this.chargeTarget = new THREE.Vector3();
        this.chargeStartTime = 0;

        this.knightState = 0; 
        this.knightTimer = 0;
        this.knightTargetY = 0;
        this.knightTargetX = 0;
        this.knightTargetZ = 0;
        this.lastKnightJumpTime = 0; 

        this.bishopLastTeleport = Date.now();
        this.bishopTeleporting = false;
        this.bishopTeleportStep = 0;
        this.bishopOpacity = 1.0;

        // ヨット専用パラメータ
        this.yachtInitialized = false;
        this.yachtState = 'none'; // 'rolling', 'judging', 'attacking', 'cooldown'
        this.yachtDice = [];
        this.yachtDiceMeshes = [];
        this.yachtStateTimer = 0;
        this.yachtShieldMesh = null;
        this.yachtAttackTriggered = false;
        
        if (STATE && STATE.scene) {
            STATE.scene.add(this.mesh);
        }
    }

    getHPBase(t) {
        const hps = { 
            '歩':4, '香':6, '桂':5, '銀':8, '金':10, '角':12, '飛':15, '王':80,
            'ポーン':4, 'P':4,
            'ナイト':12, 'N':12,
            'ビショップ':10, 'B':10,
            'ルーク':35, 'R':35,
            'クイーン':25, 'Q':25,
            'キング':100, 'K':100,
            'ヨット':250, 'Yacht':250
        };
        return hps[t] || 5;
    }
    getSpeedBase(t) {
        const speeds = { 
            '歩':0.08, '香':0.09, '桂':0.12, '銀':0.07, '金':0.05, '角':0.04, '飛':0.04, '王':0.03,
            'ポーン':0.15, 'P':0.15,
            'ナイト':0.06, 'N':0.06,
            'ビショップ':0.05, 'B':0.05,
            'ルーク':0.03, 'R':0.03,
            'クイーン':0.07, 'Q':0.07,
            'キング':0.02, 'K':0.02,
            'ヨット':0.01, 'Yacht':0.01
        };
        return speeds[t] || 0.05;
    }

    setEmissiveColor(color, intensity = 1.0) {
        if (!this.mats) return;
        this.mats.forEach(mat => {
            if (mat && mat.emissive && typeof mat.emissive.set === 'function') {
                mat.emissive.set(color);
                if ('emissiveIntensity' in mat) {
                    mat.emissiveIntensity = intensity;
                }
            }
        });
    }

    update(playerPos, others) {
        if (!this.alive) return;
        
        const gy = (typeof GROUND_Y === 'number') ? GROUND_Y : 0;
        const boardSz = (typeof BOARD_SIZE === 'number') ? BOARD_SIZE : 60;
        const pPos = playerPos ? playerPos.clone() : new THREE.Vector3();

        const isAirborne = ['桂', 'ナイト', 'N', 'クイーン', 'Q', 'ヨット', 'Yacht'].includes(this.type);
        if (!isAirborne) {
            this.mesh.position.y = gy;
        }

        const diff = new THREE.Vector3().subVectors(pPos, this.mesh.position);
        const xzDist = Math.sqrt(diff.x * diff.x + diff.z * diff.z);
        const dir = diff.clone().normalize().multiplyScalar(1);
        dir.y = 0;

        if (xzDist < 2.8 && Math.abs(pPos.y - (this.mesh.position.y + 1.2)) < 5.0) {
            if (this.type === 'ルーク' || this.type === 'R') {
                if (STATE && typeof STATE.takeDamage === 'function') {
                    STATE.takeDamage(10);
                }
                if (STATE) {
                    STATE.playerStunTime = 1000; 
                }
            } else if (this.type !== 'ヨット' && this.type !== 'Yacht') {
                if (STATE && typeof STATE.takeDamage === 'function') {
                    STATE.takeDamage(0.5);
                }
            }
        }

        switch(this.type) {
            case '歩':
                this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                break;
            case '桂':
                const jumpCycle = Date.now() * 0.005;
                const jumpHeight = Math.max(0, Math.sin(jumpCycle) * 6);
                this.mesh.position.y = gy + jumpHeight;
                if (jumpHeight > 0.1) { 
                    this.mesh.position.add(dir.clone().multiplyScalar(this.speed * 2.0)); 
                }
                break;
            case '香':
                if (this.chargeState === 0) {
                    this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                    
                    if (xzDist < 25 && Date.now() - this.lastAttack > 2000) { 
                        this.chargeState = 1; 
                        this.chargeTarget.copy(pPos).add(dir.clone().multiplyScalar(4));
                        this.chargeStartTime = Date.now();
                        this.setEmissiveColor(0xcc0000, 1.0); 
                    }
                } else if (this.chargeState === 1) {
                    const cDir = new THREE.Vector3().subVectors(this.chargeTarget, this.mesh.position);
                    cDir.y = 0;
                    const distToTarget = cDir.length();
                    cDir.normalize();
                    
                    this.mesh.position.add(cDir.multiplyScalar(this.speed * 6));
                    
                    const elapsed = Date.now() - this.chargeStartTime;
                    const limit = boardSz / 2 - 2.5;
                    const isAtWall = Math.abs(this.mesh.position.x) >= limit || Math.abs(this.mesh.position.z) >= limit;
                    
                    if (distToTarget < 2.0 || elapsed > 1500 || isAtWall) {
                        this.chargeState = 0; 
                        this.lastAttack = Date.now(); 
                        this.setEmissiveColor(0x000000, 1.0); 
                    }
                }
                break;
            case '角':
                if (xzDist > 35) this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                else if (xzDist < 30) this.mesh.position.add(dir.clone().multiplyScalar(-this.speed));
                this.firePattern('X');
                break;
            case '飛':
                if (xzDist > 40) this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                else if (xzDist < 35) this.mesh.position.add(dir.clone().multiplyScalar(-this.speed));
                this.firePattern('HOMING');
                break;
            case '金':
                this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                this.firePattern('FAN');
                break;
            case '銀':
                this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                this.firePattern('TRIPLE');
                break;
            case '王':
                this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                this.firePattern('OMNI');
                break;

            case 'ポーン':
            case 'P':
                this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                break;

            case 'ナイト':
            case 'N':
                if (this.knightState === 0) {
                    this.mesh.position.y = gy;
                    this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                    
                    const knightCooldown = 5500;
                    if (xzDist < 20.0 && (Date.now() - this.lastKnightJumpTime > knightCooldown)) {
                        this.knightState = 1;
                        this.knightTargetY = gy + 10.0 + Math.random() * 2.0; 
                    }
                } else if (this.knightState === 1) {
                    this.mesh.position.y += 0.3;
                    this.mesh.position.add(dir.clone().multiplyScalar(this.speed * 0.5)); 
                    const targetY = typeof this.knightTargetY === 'number' ? this.knightTargetY : (gy + 10.0);
                    if (this.mesh.position.y >= targetY) {
                        this.mesh.position.y = targetY;
                        this.knightState = 2;
                        this.knightTimer = Date.now();
                    }
                } else if (this.knightState === 2) {
                    const targetY = typeof this.knightTargetY === 'number' ? this.knightTargetY : (gy + 10.0);
                    this.mesh.position.y = targetY;
                    const pHeadPos = pPos.clone();
                    pHeadPos.y = targetY;
                    this.mesh.position.lerp(pHeadPos, 0.08);

                    const timer = typeof this.knightTimer === 'number' ? this.knightTimer : Date.now();
                    if (Date.now() - timer > 1000) {
                        this.knightState = 3;
                        this.knightTargetX = pPos.x;
                        this.knightTargetZ = pPos.z;
                    }
                } else if (this.knightState === 3) {
                    this.mesh.position.y -= 0.6;
                    
                    const targetX = typeof this.knightTargetX === 'number' ? this.knightTargetX : pPos.x;
                    const targetZ = typeof this.knightTargetZ === 'number' ? this.knightTargetZ : pPos.z;

                    const dropDir = new THREE.Vector3(targetX - this.mesh.position.x, 0, targetZ - this.mesh.position.z);
                    if (dropDir.length() > 0.2) {
                        this.mesh.position.add(dropDir.normalize().multiplyScalar(this.speed * 1.5));
                    }
                    if (this.mesh.position.y <= gy) {
                        this.mesh.position.y = gy;
                        this.knightState = 0; 
                        this.lastKnightJumpTime = Date.now(); 
                        
                        const distToLanding = this.mesh.position.distanceTo(new THREE.Vector3(pPos.x, gy, pPos.z));
                        if (distToLanding < 4.0) {
                            if (STATE && typeof STATE.takeDamage === 'function') {
                                STATE.takeDamage(25);
                            }
                        }
                        
                        if (STATE && STATE.scene) {
                            const circleGeom = new THREE.RingGeometry(0.1, 4.0, 32);
                            const circleMat = new THREE.MeshBasicMaterial({ color: 0xff3300, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
                            const circle = new THREE.Mesh(circleGeom, circleMat);
                            circle.rotation.x = Math.PI / 2;
                            circle.position.set(this.mesh.position.x, gy + 0.05, this.mesh.position.z);
                            STATE.scene.add(circle);
                            setTimeout(() => { 
                                if (STATE && STATE.scene) {
                                    STATE.scene.remove(circle); 
                                }
                                circleGeom.dispose();
                                circleMat.dispose();
                            }, 300);
                        }
                    }
                }
                break;

            case 'ビショップ':
            case 'B':
                if (!this.bishopTeleporting) {
                    this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                    const teleportInterval = 1800;
                    if (Date.now() - this.bishopLastTeleport > teleportInterval) {
                        this.bishopTeleporting = true;
                        this.bishopTeleportStep = 0; 
                    }
                } else {
                    if (this.bishopTeleportStep === 0) {
                        this.bishopOpacity -= 0.25;
                        if (this.mats) {
                            this.mats.forEach(m => { if (m) { m.transparent = true; m.opacity = Math.max(0, this.bishopOpacity); } });
                        }
                        if (this.bishopOpacity <= 0) {
                            const angleWarp = Math.random() * Math.PI * 2;
                            const distWarp = 4.0 + Math.random() * 4.0;
                            const targetWarpX = pPos.x + Math.cos(angleWarp) * distWarp;
                            const targetWarpZ = pPos.z + Math.sin(angleWarp) * distWarp;

                            const limit = boardSz / 2 - 2.0;
                            this.mesh.position.x = Math.max(-limit, Math.min(limit, targetWarpX));
                            this.mesh.position.z = Math.max(-limit, Math.min(limit, targetWarpZ));
                            this.mesh.position.y = gy;

                            this.bishopTeleportStep = 1; 
                        }
                    } else {
                        this.bishopOpacity += 0.25;
                        if (this.mats) {
                            this.mats.forEach(m => { if (m) { m.opacity = Math.min(1.0, this.bishopOpacity); } });
                        }
                        if (this.bishopOpacity >= 1.0) {
                            if (this.mats) {
                                this.mats.forEach(m => { if (m) { m.transparent = false; m.opacity = 1.0; } });
                            }
                            this.bishopTeleporting = false;
                            this.bishopLastTeleport = Date.now();
                        }
                    }
                }
                break;

            case 'ルーク':
            case 'R':
                this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                this.firePattern('ROOK');
                break;

            case 'クイーン':
            case 'Q':
                const hoverOffset = Math.sin(Date.now() * 0.0025) * 1.0;
                this.mesh.position.y = gy + 6.0 + hoverOffset;
                if (xzDist > 30) {
                    this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                } else if (xzDist < 18) {
                    this.mesh.position.add(dir.clone().multiplyScalar(-this.speed));
                } else {
                    const tangent = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
                    this.mesh.position.add(tangent.multiplyScalar(this.speed * 0.8));
                }
                this.firePattern('QUEEN');
                break;

            case 'キング':
            case 'K':
                this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                this.firePattern('OMNI');
                break;

            case 'ヨット':
            case 'Yacht':
                this.updateYacht(pPos, others);
                break;
        }

        if (this.type !== 'ヨット' && this.type !== 'Yacht' && others && Array.isArray(others)) {
            this.applySeparation(others);
        }

        const eLimit = boardSz / 2 - 2.0;
        if (this.type !== 'ヨット' && this.type !== 'Yacht') {
            this.mesh.position.x = Math.max(-eLimit, Math.min(eLimit, this.mesh.position.x));
            this.mesh.position.z = Math.max(-eLimit, Math.min(eLimit, this.mesh.position.z));
        }

        if (this.type === '香' && this.chargeState === 1) {
            this.mesh.lookAt(this.chargeTarget.x, this.mesh.position.y, this.chargeTarget.z);
        } else {
            this.mesh.lookAt(pPos.x, this.mesh.position.y, pPos.z);
        }
    }

    applySeparation(others) {
        others.forEach(other => {
            if (other === this || !other || !other.mesh || other.type === 'ヨット' || other.type === 'Yacht') return;
            const dx = this.mesh.position.x - other.mesh.position.x;
            const dz = this.mesh.position.z - other.mesh.position.z;
            const distSq = dx * dx + dz * dz;
            const minDist = 4.5;
            
            if (distSq < minDist * minDist && distSq > 0.001) {
                const dist = Math.sqrt(distSq);
                const force = (minDist - dist) * 0.15; 
                const nx = dx / dist;
                const nz = dz / dist;
                this.mesh.position.x += nx * force;
                this.mesh.position.z += nz * force;
            }
        });
    }

    firePattern(mode) {
        const now = Date.now();
        let interval = 2500;
        if (mode === 'OMNI') interval = 1800;
        if (mode === 'ROOK') interval = 3000;
        if (mode === 'QUEEN') interval = 2000;
        if (now - this.lastAttack < interval) return;

        const origin = this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        const cameraPos = (STATE && STATE.camera && STATE.camera.position) ? STATE.camera.position : new THREE.Vector3();
        const toPlayer = new THREE.Vector3().subVectors(cameraPos, origin);
        toPlayer.y = 0;
        toPlayer.normalize();

        if (!STATE || !Array.isArray(STATE.enemyBullets)) return;

        if (mode === 'X') {
            const baseAngle = Math.atan2(toPlayer.z, toPlayer.x);
            for(let i=0; i<4; i++) {
                const angle = baseAngle + (i * Math.PI / 2);
                const bDir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
                STATE.enemyBullets.push(new Projectile(origin, bDir, true, 2.2));
            }
        } else if (mode === 'HOMING') {
            STATE.enemyBullets.push(new Projectile(origin, toPlayer, true, 0.8, 0.6, true));
        } else if (mode === 'FAN') {
            for(let i=-2; i<=2; i++) {
                const bDir = toPlayer.clone().applyAxisAngle(new THREE.Vector3(0,1,0), i * 0.35);
                STATE.enemyBullets.push(new Projectile(origin, bDir, true, 1.5));
            }
        } else if (mode === 'TRIPLE') {
            const angles = [0, Math.PI * 0.75, -Math.PI * 0.75];
            angles.forEach(a => {
                const bDir = toPlayer.clone().applyAxisAngle(new THREE.Vector3(0,1,0), a);
                STATE.enemyBullets.push(new Projectile(origin, bDir, true, 1.8));
            });
        } else if (mode === 'OMNI') {
            const baseAngle = Math.atan2(toPlayer.z, toPlayer.x);
            for(let i=0; i<12; i++) {
                const angle = baseAngle + (i / 12) * Math.PI * 2;
                const bDir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
                STATE.enemyBullets.push(new Projectile(origin, bDir, true, 1.2, 0.8));
            }
        } else if (mode === 'ROOK') {
            STATE.enemyBullets.push(new Projectile(origin, toPlayer, true, 2.8, 0.55, false, true));
        } else if (mode === 'QUEEN') {
            const flip = Math.random() > 0.5;
            if (flip) {
                for(let i=-2; i<=2; i++) {
                    const bDir = toPlayer.clone().applyAxisAngle(new THREE.Vector3(0,1,0), i * 0.28);
                    STATE.enemyBullets.push(new Projectile(origin, bDir, true, 1.8));
                }
            } else {
                STATE.enemyBullets.push(new Projectile(origin, toPlayer, true, 1.1, 0.5, true));
            }
        }
        this.lastAttack = now;
    }

    takeHit(dmg) {
        // ヨットの無敵フェーズ(rolling)判定
        if ((this.type === 'ヨット' || this.type === 'Yacht') && this.yachtState === 'rolling') {
            this.triggerShieldFlash();
            return false;
        }

        this.hp -= dmg;
        this.setEmissiveColor(0xffffff, 2.0);
        setTimeout(() => { 
            if (this.alive) {
                this.setEmissiveColor(0x000000, 1.0);
            }
        }, 100);

        const isDead = this.hp <= 0;
        if (isDead) {
            // ボスとしての撃破時爆発エフェクト（およびダイス消去）の対象を「ヨット / Yacht」のみに限定
            if (this.type === 'ヨット' || this.type === 'Yacht') {
                this.triggerKingExplosion();
                this.clearYachtDiceMeshes();
            }
        }
        return isDead;
    }

    triggerShieldFlash() {
        if (this.yachtShieldMesh) {
            this.yachtShieldMesh.visible = true;
            this.yachtShieldMesh.material.opacity = 0.6;
            setTimeout(() => {
                if (this.yachtShieldMesh) {
                    this.yachtShieldMesh.material.opacity = 0.25;
                }
            }, 100);
        }
    }

    // --- ヨット専用の3Dサイコロ生成/消去 ---
    createYachtDiceMeshes() {
        this.clearYachtDiceMeshes();
        this.yachtDiceMeshes = [];
        const diceCount = 5;
        const diceGeom = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        const diceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.1 });
        
        for (let i = 0; i < diceCount; i++) {
            const diceMesh = new THREE.Mesh(diceGeom, diceMat);
            const angle = (i / diceCount) * Math.PI * 2;
            const radius = 4.5;
            diceMesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
            this.mesh.add(diceMesh);
            this.yachtDiceMeshes.push(diceMesh);
        }
    }

    clearYachtDiceMeshes() {
        if (this.yachtDiceMeshes) {
            this.yachtDiceMeshes.forEach(mesh => {
                if (mesh) {
                    this.mesh.remove(mesh);
                    if (mesh.geometry) mesh.geometry.dispose();
                    if (mesh.material) mesh.material.dispose();
                }
            });
        }
        this.yachtDiceMeshes = [];
    }

    // --- ヨット更新ループ ---
    updateYacht(pPos, others) {
        const gy = (typeof GROUND_Y === 'number') ? GROUND_Y : 0;

        if (!this.yachtInitialized) {
            this.yachtInitialized = true;
            this.yachtState = 'rolling';
            this.yachtStateTimer = Date.now();
            
            // 無敵シールド球体を生成
            const shieldGeom = new THREE.SphereGeometry(6, 16, 16);
            const shieldMat = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.25,
                wireframe: true
            });
            this.yachtShieldMesh = new THREE.Mesh(shieldGeom, shieldMat);
            this.mesh.add(this.yachtShieldMesh);
            
            this.createYachtDiceMeshes();
        }

        // 浮遊アニメーション
        const hoverOffset = Math.sin(Date.now() * 0.002) * 1.5;
        this.mesh.position.y = gy + 12.0 + hoverOffset;
        this.mesh.lookAt(pPos.x, this.mesh.position.y, pPos.z);

        if (this.yachtState === 'rolling') {
            const elapsed = Date.now() - this.yachtStateTimer;
            const time = Date.now() * 0.005;
            
            this.yachtDiceMeshes.forEach((mesh, i) => {
                const angle = (i / 5) * Math.PI * 2 + time;
                const radius = 4.5;
                mesh.position.set(Math.cos(angle) * radius, Math.sin(time * 2 + i) * 0.5, Math.sin(angle) * radius);
                mesh.rotation.x += 0.1;
                mesh.rotation.y += 0.12;
            });
            
            if (this.yachtShieldMesh) {
                this.yachtShieldMesh.rotation.y += 0.01;
                this.yachtShieldMesh.rotation.x += 0.005;
                this.yachtShieldMesh.visible = true;
            }
            
            if (elapsed > 3000) {
                this.yachtDice = [];
                for (let i = 0; i < 5; i++) {
                    this.yachtDice.push(Math.floor(Math.random() * 6) + 1);
                }
                
                this.yachtHand = evaluateYachtHand(this.yachtDice);
                
                // main.js の showMsg またはコンソール
                const showMsgGlobal = window.showMsg || console.log;
                const diceStr = this.yachtDice.join(', ');
                showMsgGlobal(`ヨット：出目 [${diceStr}] -> 役『${this.yachtHand.name}』！`);
                
                this.yachtState = 'judging';
                this.yachtStateTimer = Date.now();
            }
        } 
        else if (this.yachtState === 'judging') {
            const elapsed = Date.now() - this.yachtStateTimer;
            
            this.yachtDiceMeshes.forEach((mesh) => {
                mesh.rotation.x *= 0.8;
                mesh.rotation.y *= 0.8;
            });
            
            if (this.yachtShieldMesh) {
                this.yachtShieldMesh.visible = false;
            }
            
            if (elapsed > 1500) {
                this.yachtState = 'attacking';
                this.yachtStateTimer = Date.now();
                this.yachtAttackTriggered = false;
            }
        } 
        else if (this.yachtState === 'attacking') {
            if (!this.yachtAttackTriggered) {
                this.yachtAttackTriggered = true;
                this.executeYachtAttack(this.yachtHand, pPos);
            }
            
            const elapsed = Date.now() - this.yachtStateTimer;
            if (elapsed > 5000) {
                this.yachtState = 'cooldown';
                this.yachtStateTimer = Date.now();
            }
        } 
        else if (this.yachtState === 'cooldown') {
            const elapsed = Date.now() - this.yachtStateTimer;
            if (elapsed > 2000) {
                this.yachtState = 'rolling';
                this.yachtStateTimer = Date.now();
                this.createYachtDiceMeshes();
            }
        }
    }

    executeYachtAttack(hand, pPos) {
        const name = hand.name;
        const score = hand.score;
        
        if (name === 'Yacht') {
            this.launchYachtMeteor();
        } else if (name === 'Four of a Kind') {
            this.launchFourOfAKind(pPos);
        } else if (name === 'Full House') {
            this.launchFullHouse();
        } else if (name === 'Large Straight') {
            this.launchLargeStraight();
        } else if (name === 'Small Straight') {
            this.launchSmallStraight();
        } else {
            this.summonMinions(score);
        }
    }

    // --- 各役の固有攻撃・召喚パターン ---

    // 基本役：スコアと同じ数（最大6にクランプ）の雑魚敵を召喚
    summonMinions(count) {
        const types = ['歩', '香', 'ポーン'];
        const numToSummon = Math.min(6, count);
        const gy = (typeof GROUND_Y === 'number') ? GROUND_Y : 0;
        
        for (let i = 0; i < numToSummon; i++) {
            const randomType = types[Math.floor(Math.random() * types.length)];
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 15;
            const spawnPos = new THREE.Vector3(Math.cos(angle) * dist, gy, Math.sin(angle) * dist);
            
            try {
                const enemy = new Enemy(randomType, 1.0);
                enemy.mesh.position.copy(spawnPos);
                if (STATE && STATE.enemies) {
                    STATE.enemies.push(enemy);
                }
            } catch (err) {
                console.error("Failed to summon minion during Yacht basic hand:", err);
            }
        }
    }

    // フォーダイス：追尾弾4発連続
    launchFourOfAKind(pPos) {
        let count = 0;
        const origin = this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        
        const intervalId = setInterval(() => {
            if (!this.alive || count >= 4) {
                clearInterval(intervalId);
                return;
            }
            
            const cameraPos = (STATE && STATE.camera && STATE.camera.position) ? STATE.camera.position : new THREE.Vector3();
            const toPlayer = new THREE.Vector3().subVectors(cameraPos, origin).normalize();
            
            if (STATE && STATE.enemyBullets) {
                const proj = new Projectile(origin, toPlayer, true, 1.2, 0.9, true);
                STATE.enemyBullets.push(proj);
            }
            count++;
        }, 800);
    }

    // フルハウス：スタン弾2発＋通常弾3発の扇状一斉射撃
    launchFullHouse() {
        const origin = this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        const cameraPos = (STATE && STATE.camera && STATE.camera.position) ? STATE.camera.position : new THREE.Vector3();
        const toPlayer = new THREE.Vector3().subVectors(cameraPos, origin);
        toPlayer.y = 0;
        toPlayer.normalize();
        
        const indices = [-2, -1, 0, 1, 2];
        indices.forEach(idx => {
            const bDir = toPlayer.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), idx * 0.25);
            const isStun = (idx === -1 || idx === 1);
            if (STATE && STATE.enemyBullets) {
                const speed = isStun ? 1.6 : 2.2;
                const size = isStun ? 0.45 : 0.35;
                const proj = new Projectile(origin, bDir, true, speed, size, false, isStun);
                STATE.enemyBullets.push(proj);
            }
        });
    }

    // ストレート：予告線付き超高速光弾
    launchStraightAttack(linesCount, isLarge) {
        const gy = (typeof GROUND_Y === 'number') ? GROUND_Y : 0;
        
        for (let i = 0; i < linesCount; i++) {
            setTimeout(() => {
                if (!this.alive) return;
                
                const cameraPos = (STATE && STATE.camera && STATE.camera.position) ? STATE.camera.position : new THREE.Vector3();
                const bossPos = this.mesh.position.clone();
                const targetPos = cameraPos.clone();
                
                if (i > 0) {
                    targetPos.x += (Math.random() - 0.5) * 8;
                    targetPos.z += (Math.random() - 0.5) * 8;
                }
                
                const dir = new THREE.Vector3().subVectors(targetPos, bossPos);
                dir.y = 0;
                const distance = dir.length();
                dir.normalize();
                
                const lineGeom = new THREE.BoxGeometry(0.3, 0.05, distance);
                const lineMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 });
                const lineMesh = new THREE.Mesh(lineGeom, lineMat);
                const midPoint = new THREE.Vector3().addVectors(bossPos, targetPos).multiplyScalar(0.5);
                
                lineMesh.position.set(midPoint.x, gy + 0.05, midPoint.z);
                lineMesh.lookAt(targetPos.x, gy + 0.05, targetPos.z);
                
                if (STATE && STATE.scene) {
                    STATE.scene.add(lineMesh);
                }
                
                setTimeout(() => {
                    if (STATE && STATE.scene) {
                        STATE.scene.remove(lineMesh);
                    }
                    lineGeom.dispose();
                    lineMat.dispose();
                    
                    if (!this.alive) return;
                    
                    const bulletSpeed = isLarge ? 4.5 : 3.5;
                    const bulletSize = isLarge ? 0.6 : 0.4;
                    const origin = bossPos.clone().add(new THREE.Vector3(0, 1.5, 0));
                    
                    if (STATE && STATE.enemyBullets) {
                        const proj = new Projectile(origin, dir, true, bulletSpeed, bulletSize);
                        STATE.enemyBullets.push(proj);
                    }
                }, 1000);
                
            }, i * 600);
        }
    }

    launchSmallStraight() {
        this.launchStraightAttack(4, false);
    }

    launchLargeStraight() {
        this.launchStraightAttack(5, true);
    }

    // ヨット：5発の巨大ダイスメテオ＆大爆発
    launchYachtMeteor() {
        const gy = (typeof GROUND_Y === 'number') ? GROUND_Y : 0;
        
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                if (!this.alive) return;
                
                const cameraPos = (STATE && STATE.camera && STATE.camera.position) ? STATE.camera.position : new THREE.Vector3();
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 8.0;
                const targetX = cameraPos.x + Math.cos(angle) * dist;
                const targetZ = cameraPos.z + Math.sin(angle) * dist;
                
                // 地面に赤いサークルの警告を表示
                const circleGeom = new THREE.RingGeometry(0.1, 4.0, 32);
                const circleMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
                const circle = new THREE.Mesh(circleGeom, circleMat);
                circle.rotation.x = Math.PI / 2;
                circle.position.set(targetX, gy + 0.05, targetZ);
                
                if (STATE && STATE.scene) {
                    STATE.scene.add(circle);
                }
                
                // 上空に巨大ダイスメテオ生成
                const meteorGeom = new THREE.BoxGeometry(3.0, 3.0, 3.0);
                const meteorMat = new THREE.MeshStandardMaterial({
                    color: 0xff3300,
                    emissive: 0xff1100,
                    emissiveIntensity: 1.5,
                    roughness: 0.2
                });
                const meteorMesh = new THREE.Mesh(meteorGeom, meteorMat);
                meteorMesh.position.set(targetX, gy + 35.0, targetZ);
                
                if (STATE && STATE.scene) {
                    STATE.scene.add(meteorMesh);
                }
                
                let meteorY = gy + 35.0;
                const fallSpeed = 0.8;
                
                const fallInterval = setInterval(() => {
                    if (!this.alive) {
                        clearInterval(fallInterval);
                        if (STATE && STATE.scene) {
                            STATE.scene.remove(meteorMesh);
                            STATE.scene.remove(circle);
                        }
                        meteorGeom.dispose();
                        meteorMat.dispose();
                        circleGeom.dispose();
                        circleMat.dispose();
                        return;
                    }
                    
                    meteorY -= fallSpeed;
                    meteorMesh.position.y = meteorY;
                    meteorMesh.rotation.x += 0.05;
                    meteorMesh.rotation.y += 0.08;
                    
                    if (meteorY <= gy + 1.5) {
                        clearInterval(fallInterval);
                        this.triggerMeteorExplosion(new THREE.Vector3(targetX, gy, targetZ));
                        
                        if (STATE && STATE.scene) {
                            STATE.scene.remove(meteorMesh);
                            STATE.scene.remove(circle);
                        }
                        meteorGeom.dispose();
                        meteorMat.dispose();
                        circleGeom.dispose();
                        circleMat.dispose();
                    }
                }, 16);
                
            }, i * 800);
        }
    }
    
    triggerMeteorExplosion(pos) {
        const gy = (typeof GROUND_Y === 'number') ? GROUND_Y : 0;
        
        const expGeom = new THREE.SphereGeometry(1.0, 32, 32);
        const expMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.9 });
        const expMesh = new THREE.Mesh(expGeom, expMat);
        expMesh.position.copy(pos).add(new THREE.Vector3(0, 1.0, 0));
        
        if (STATE && STATE.scene) {
            STATE.scene.add(expMesh);
        }
        
        let currentScale = 1.0;
        const interval = setInterval(() => {
            currentScale += 0.35;
            if (expMesh && expMat) {
                expMesh.scale.set(currentScale, currentScale, currentScale);
                expMat.opacity -= 0.05;
                if (expMat.opacity <= 0) {
                    clearInterval(interval);
                    if (STATE && STATE.scene) {
                        STATE.scene.remove(expMesh);
                    }
                    expGeom.dispose();
                    expMat.dispose();
                }
            } else {
                clearInterval(interval);
            }
        }, 16);
        
        const cameraPos = (STATE && STATE.camera && STATE.camera.position) ? STATE.camera.position : new THREE.Vector3();
        const dist = pos.distanceTo(new THREE.Vector3(cameraPos.x, gy, cameraPos.z));
        if (dist < 4.5) {
            if (STATE && typeof STATE.takeDamage === 'function') {
                STATE.takeDamage(40);
            }
        }
    }

    triggerKingExplosion() {
        const explosionOrigin = this.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        
        const expGeom = new THREE.SphereGeometry(1.0, 32, 32);
        const expMat = new THREE.MeshBasicMaterial({ color: 0xff1100, transparent: true, opacity: 0.8 });
        const expMesh = new THREE.Mesh(expGeom, expMat);
        expMesh.position.copy(explosionOrigin);
        
        if (STATE && STATE.scene) {
            STATE.scene.add(expMesh);
        }
        
        let currentScale = 1.0;
        const interval = setInterval(() => {
            currentScale += 0.4;
            if (expMesh && expMat) {
                expMesh.scale.set(currentScale, currentScale, currentScale);
                expMat.opacity -= 0.04;
                if (expMat.opacity <= 0) {
                    clearInterval(interval);
                    if (STATE && STATE.scene) {
                        STATE.scene.remove(expMesh);
                    }
                    expGeom.dispose();
                    expMat.dispose();
                }
            } else {
                clearInterval(interval);
            }
        }, 16);

        const cameraPos = (STATE && STATE.camera && STATE.camera.position) ? STATE.camera.position : new THREE.Vector3();
        const dist = explosionOrigin.distanceTo(cameraPos);
        if (dist < 8.0) {
            if (STATE && typeof STATE.takeDamage === 'function') {
                STATE.takeDamage(50);
            }
        }
    }

    destroy() {
        if (!this.alive) return;
        this.alive = false;
        if (this.type === 'ヨット' || this.type === 'Yacht') {
            this.clearYachtDiceMeshes();
        }
        if (STATE && STATE.scene && this.mesh) {
            STATE.scene.remove(this.mesh);
        }
        if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) {
                if (Array.isArray(this.mesh.material)) {
                    this.mesh.material.forEach(m => { if (m) m.dispose(); });
                } else {
                    this.mesh.material.dispose();
                }
            }
        }
    }
}
