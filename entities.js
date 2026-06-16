import * as THREE from 'three';
import { COLORS, STATE, EYE_HEIGHT, GROUND_Y, BOARD_SIZE } from './constants.js';
import { AssetFactory, getChessGeometry } from './assets.js'; 

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

        // 1. マテリアル・ジオメトリ生成時のフェイルセーフ対応
        try {
            if (chessTypes.includes(type)) {
                mats = (AssetFactory && typeof AssetFactory.getChessMaterials === 'function') 
                    ? AssetFactory.getChessMaterials(type) 
                    : null;
                geom = (typeof getChessGeometry === 'function') 
                    ? getChessGeometry(type) 
                    : null;
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

        // フォールバック（未定義時の代替手段）
        if (!geom) {
            geom = new THREE.BoxGeometry(1, 2, 1);
        }
        if (!mats) {
            mats = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
        }

        // マテリアルを配列としてラップし一元管理できるように正規化
        this.mats = Array.isArray(mats) ? mats : [mats];
        
        this.mesh = new THREE.Mesh(geom, this.mats);
        this.mesh.castShadow = true;
        
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 15;
        const gy = (typeof GROUND_Y === 'number') ? GROUND_Y : 0;
        this.mesh.position.set(Math.cos(angle)*dist, gy, Math.sin(angle)*dist);
        
        const scale = (typeof waveScale === 'number') ? waveScale : 1.0;
        this.hp = (this.getHPBase(type)) * scale;
        this.maxHp = this.hp;
        this.speed = this.getSpeedBase(type);
        this.lastAttack = Date.now() + Math.random() * 1000;
        
        this.chargeState = 0; 
        this.chargeTarget = new THREE.Vector3();
        this.chargeStartTime = 0;

        // チェスキャラクター専用の状態変数
        this.knightState = 0; 
        this.knightTimer = 0;
        this.knightTargetY = 0;
        this.knightTargetX = 0;
        this.knightTargetZ = 0;

        this.bishopLastTeleport = Date.now();
        this.bishopTeleporting = false;
        this.bishopTeleportStep = 0;
        this.bishopOpacity = 1.0;
        
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
            'キング':100, 'K':100
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
            'キング':0.02, 'K':0.02
        };
        return speeds[t] || 0.05;
    }

    // 3. 安全に一括でemissiveを操作するメソッドの定義
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

        const isAirborne = ['桂', 'ナイト', 'N', 'クイーン', 'Q'].includes(this.type);
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
            } else {
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
                // 2. ナイトの挙動における例外・初期値チェックと安定化
                if (this.knightState === 0) {
                    this.mesh.position.y = gy;
                    this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                    if (xzDist < 20.0) {
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
                    if (Date.now() - this.bishopLastTeleport > 3500) {
                        this.bishopTeleporting = true;
                        this.bishopTeleportStep = 0; 
                    }
                } else {
                    if (this.bishopTeleportStep === 0) {
                        this.bishopOpacity -= 0.12;
                        if (this.mats) {
                            this.mats.forEach(m => { if (m) { m.transparent = true; m.opacity = Math.max(0, this.bishopOpacity); } });
                        }
                        if (this.bishopOpacity <= 0) {
                            this.mesh.position.add(dir.clone().multiplyScalar(8.0));
                            this.bishopTeleportStep = 1; 
                        }
                    } else {
                        this.bishopOpacity += 0.12;
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
        }

        if (others && Array.isArray(others)) {
            this.applySeparation(others);
        }

        const eLimit = boardSz / 2 - 2.0;
        this.mesh.position.x = Math.max(-eLimit, Math.min(eLimit, this.mesh.position.x));
        this.mesh.position.z = Math.max(-eLimit, Math.min(eLimit, this.mesh.position.z));

        if (this.type === '香' && this.chargeState === 1) {
            this.mesh.lookAt(this.chargeTarget.x, this.mesh.position.y, this.chargeTarget.z);
        } else {
            this.mesh.lookAt(pPos.x, this.mesh.position.y, pPos.z);
        }
    }

    applySeparation(others) {
        others.forEach(other => {
            if (other === this || !other || !other.mesh) return;
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
        this.hp -= dmg;
        this.setEmissiveColor(0xffffff, 2.0);
        setTimeout(() => { 
            if (this.alive) {
                this.setEmissiveColor(0x000000, 1.0);
            }
        }, 100);

        const isDead = this.hp <= 0;
        if (isDead) {
            if (this.type === 'キング' || this.type === 'K') {
                this.triggerKingExplosion();
            }
        }
        return isDead;
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
