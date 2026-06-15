// entities.js に以下を追加、および一部修正

import * as THREE from 'three';
import { COLORS, STATE, EYE_HEIGHT, GROUND_Y, BOARD_SIZE } from './constants.js';
import { AssetFactory } from './assets.js';

import * as THREE from 'three';
import { COLORS, STATE, EYE_HEIGHT, GROUND_Y, BOARD_SIZE } from './constants.js';
import { AssetFactory } from './assets.js';
// 循環参照を避けるため、main.js からの直接インポートは行いません

export class Projectile {
    constructor(pos, dir, isEnemy = false, speed = 1.5, size = 0.25, isHoming = false, isStun = false) {
        this.isEnemy = isEnemy;
        this.isHoming = isHoming;
        this.isStun = isStun; 
        this.speed = speed;
        this.velocity = dir.clone().normalize().multiplyScalar(speed);
        
        let color = isEnemy ? (isHoming ? 0x8000ff : COLORS.spirit) : COLORS.vermillion;
        if (isEnemy && isStun) {
            color = 0xff6600;
        }
        
        const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 });
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(size), mat);
        this.mesh.position.copy(pos);
        this.alive = true;
        this.life = 300;
        STATE.scene.add(this.mesh);
    }
    update() {
        if (this.isHoming && this.isEnemy) {
            const targetDir = new THREE.Vector3().subVectors(STATE.camera.position, this.mesh.position).normalize();
            this.velocity = this.velocity.lerp(targetDir.multiplyScalar(this.speed), 0.03);
        }
        this.mesh.position.add(this.velocity);
        this.life--;
        if (this.life <= 0) this.destroy();

        if (this.isEnemy) {
            const playerBody = STATE.camera.position.clone().add(new THREE.Vector3(0, -EYE_HEIGHT / 2, 0));
            const dist = this.mesh.position.distanceTo(playerBody);
            if (dist < 2.0) {
                // STATE にバインドされた関数を安全に実行
                if (typeof STATE.takeDamage === 'function') {
                    STATE.takeDamage(this.isHoming ? 5 : 10);
                }
                
                if (this.isStun) {
                    STATE.playerStunTime = 1000; 
                }
                
                this.destroy();
            }
        }
    }
    destroy() { this.alive = false; STATE.scene.remove(this.mesh); }
}

// (Item クラスはそのまま)

export class Enemy {
    // (constructor などの初期化処理はそのまま)

    update(playerPos, others) {
        const isAirborne = ['桂', 'ナイト', 'N', 'クイーン', 'Q'].includes(this.type);
        if (!isAirborne) {
            this.mesh.position.y = GROUND_Y;
        }

        const diff = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
        const xzDist = Math.sqrt(diff.x * diff.x + diff.z * diff.z);
        const dir = diff.clone().normalize().multiplyScalar(1);
        dir.y = 0;

        if (xzDist < 2.8 && Math.abs(playerPos.y - (this.mesh.position.y + 1.2)) < 5.0) {
            if (this.type === 'ルーク' || this.type === 'R') {
                if (typeof STATE.takeDamage === 'function') {
                    STATE.takeDamage(10);
                }
                STATE.playerStunTime = 1000; 
            } else {
                if (typeof STATE.takeDamage === 'function') {
                    STATE.takeDamage(0.5);
                }
            }
        }

        switch(this.type) {
            // (各駒の挙動分岐処理はそのまま)
            
            case 'ナイト':
            case 'N':
                // (ナイトの処理はそのまま)
                if (this.knightState === 3) {
                    this.mesh.position.y -= 0.6;
                    const dropDir = new THREE.Vector3(this.knightTargetX - this.mesh.position.x, 0, this.knightTargetZ - this.mesh.position.z);
                    if (dropDir.length() > 0.2) {
                        this.mesh.position.add(dropDir.normalize().multiplyScalar(this.speed * 1.5));
                    }
                    if (this.mesh.position.y <= GROUND_Y) {
                        this.mesh.position.y = GROUND_Y;
                        this.knightState = 0; 
                        
                        const distToLanding = this.mesh.position.distanceTo(new THREE.Vector3(playerPos.x, GROUND_Y, playerPos.z));
                        if (distToLanding < 4.0) {
                            if (typeof STATE.takeDamage === 'function') {
                                STATE.takeDamage(25);
                            }
                        }
                        
                        const circleGeom = new THREE.RingGeometry(0.1, 4.0, 32);
                        const circleMat = new THREE.MeshBasicMaterial({ color: 0xff3300, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
                        const circle = new THREE.Mesh(circleGeom, circleMat);
                        circle.rotation.x = Math.PI / 2;
                        circle.position.set(this.mesh.position.x, GROUND_Y + 0.05, this.mesh.position.z);
                        STATE.scene.add(circle);
                        setTimeout(() => { STATE.scene.remove(circle); }, 300);
                    }
                }
                break;
                
            // (ビショップ、ルーク、クイーン、キング等の分岐はそのまま)
        }

        this.applySeparation(others);

        const eLimit = BOARD_SIZE / 2 - 2.0;
        this.mesh.position.x = Math.max(-eLimit, Math.min(eLimit, this.mesh.position.x));
        this.mesh.position.z = Math.max(-eLimit, Math.min(eLimit, this.mesh.position.z));

        if (this.type === '香' && this.chargeState === 1) {
            this.mesh.lookAt(this.chargeTarget.x, this.mesh.position.y, this.chargeTarget.z);
        } else {
            this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);
        }
    }

    // (applySeparation, firePattern, takeHit などの処理はそのまま)

    triggerKingExplosion() {
        const explosionOrigin = this.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        
        const expGeom = new THREE.SphereGeometry(1.0, 32, 32);
        const expMat = new THREE.MeshBasicMaterial({ color: 0xff1100, transparent: true, opacity: 0.8 });
        const expMesh = new THREE.Mesh(expGeom, expMat);
        expMesh.position.copy(explosionOrigin);
        STATE.scene.add(expMesh);
        
        let currentScale = 1.0;
        const interval = setInterval(() => {
            currentScale += 0.4;
            if (expMesh) {
                expMesh.scale.set(currentScale, currentScale, currentScale);
                expMat.opacity -= 0.04;
                if (expMat.opacity <= 0) {
                    clearInterval(interval);
                    STATE.scene.remove(expMesh);
                }
            } else {
                clearInterval(interval);
            }
        }, 16);

        const playerPos = STATE.camera.position.clone();
        const dist = explosionOrigin.distanceTo(playerPos);
        if (dist < 8.0) {
            if (typeof STATE.takeDamage === 'function') {
                STATE.takeDamage(50);
            }
        }
    }
}

export class Projectile {
    // コンストラクタに isStun = false を追加
    constructor(pos, dir, isEnemy = false, speed = 1.5, size = 0.25, isHoming = false, isStun = false) {
        this.isEnemy = isEnemy;
        this.isHoming = isHoming;
        this.isStun = isStun; // 追加：ルーク弾などの気絶フラグ
        this.speed = speed;
        this.velocity = dir.clone().normalize().multiplyScalar(speed);
        
        // スタン属性持ちは色をオレンジ色（0xff6600）にして差別化
        let color = isEnemy ? (isHoming ? 0x8000ff : COLORS.spirit) : COLORS.vermillion;
        if (isEnemy && isStun) {
            color = 0xff6600;
        }
        
        const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 });
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(size), mat);
        this.mesh.position.copy(pos);
        this.alive = true;
        this.life = 300;
        STATE.scene.add(this.mesh);
    }
    update() {
        if (this.isHoming && this.isEnemy) {
            const targetDir = new THREE.Vector3().subVectors(STATE.camera.position, this.mesh.position).normalize();
            this.velocity = this.velocity.lerp(targetDir.multiplyScalar(this.speed), 0.03);
        }
        this.mesh.position.add(this.velocity);
        this.life--;
        if (this.life <= 0) this.destroy();

        if (this.isEnemy) {
            const playerBody = STATE.camera.position.clone().add(new THREE.Vector3(0, -EYE_HEIGHT / 2, 0));
            const dist = this.mesh.position.distanceTo(playerBody);
            if (dist < 2.0) {
                takeDamage(this.isHoming ? 5 : 10);
                
                // ルーク弾などのスタン蓄積（STATEにスタン時間をミリ秒で設定）
                if (this.isStun) {
                    STATE.playerStunTime = 1000; // 1.0秒間
                }
                
                this.destroy();
            }
        }
    }
    destroy() { this.alive = false; STATE.scene.remove(this.mesh); }
}

export class Item {
    constructor(pos) {
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 16, 16),
            new THREE.MeshStandardMaterial({
                color: 0x2ecc71, emissive: 0x2ecc71, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.1
            })
        );
        this.baseY = GROUND_Y;
        this.mesh.position.set(pos.x, this.baseY, pos.z);
        this.alive = true;
        this.life = 900; 
        STATE.scene.add(this.mesh);
    }
    update() {
        this.mesh.rotation.y += 0.02;
        this.mesh.rotation.x += 0.01;
        
        const time = Date.now() * 0.003;
        this.mesh.position.y = this.baseY + Math.sin(time) * 0.3 + 0.2;

        this.life--;
        if (this.life <= 0) this.destroy();
    }
    destroy() { this.alive = false; STATE.scene.remove(this.mesh); }
}

export class Enemy {
    constructor(type, waveScale) {
        this.type = type;
        
        // チェス駒は getChessMaterials を使用、将棋駒は getMaterials を使用
        const chessTypes = ['ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング', 'P', 'N', 'B', 'R', 'Q', 'K'];
        if (chessTypes.includes(type)) {
            this.mats = AssetFactory.getChessMaterials(type);
        } else {
            this.mats = AssetFactory.getMaterials(type);
        }
        
        this.mesh = new THREE.Mesh(AssetFactory.pieceGeom, this.mats);
        this.mesh.castShadow = true;
        
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 15;
        this.mesh.position.set(Math.cos(angle)*dist, GROUND_Y, Math.sin(angle)*dist);
        
        this.hp = (this.getHPBase(type)) * waveScale;
        this.maxHp = this.hp;
        this.speed = this.getSpeedBase(type);
        this.lastAttack = Date.now() + Math.random() * 1000;
        
        this.chargeState = 0; 
        this.chargeTarget = new THREE.Vector3();
        this.chargeStartTime = 0;

        // --- 追加：チェスキャラクター専用の状態変数 ---
        // ナイト (Knight) 用
        this.knightState = 0; // 0: 接近, 1: ジャンプ上昇, 2: 滞空・狙い調整, 3: 急降下
        this.knightTimer = 0;
        this.knightTargetY = 0;
        this.knightTargetX = 0;
        this.knightTargetZ = 0;

        // ビショップ (Bishop) 用
        this.bishopLastTeleport = Date.now();
        this.bishopTeleporting = false;
        this.bishopTeleportStep = 0;
        this.bishopOpacity = 1.0;
        
        STATE.scene.add(this.mesh);
    }

    getHPBase(t) {
        // 将棋駒 + チェス駒のHPベース
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
        // 将棋駒 + チェス駒のスピードベース
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

    update(playerPos, others) {
        // ナイトとクイーンは空中移動が発生するため、Y位置固定をバイパスする
        const isAirborne = ['桂', 'ナイト', 'N', 'クイーン', 'Q'].includes(this.type);
        if (!isAirborne) {
            this.mesh.position.y = GROUND_Y;
        }

        const diff = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
        const xzDist = Math.sqrt(diff.x * diff.x + diff.z * diff.z);
        const dir = diff.clone().normalize().multiplyScalar(1);
        dir.y = 0;

        // プレイヤー近接時の衝突ダメージ
        if (xzDist < 2.8 && Math.abs(playerPos.y - (this.mesh.position.y + 1.2)) < 5.0) {
            if (this.type === 'ルーク' || this.type === 'R') {
                takeDamage(10);
                STATE.playerStunTime = 1000; // 体当たり時も1秒スタン
            } else {
                takeDamage(0.5);
            }
        }

        switch(this.type) {
            // --- 将棋の駒 ---
            case '歩':
                this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                break;
            case '桂':
                const jumpCycle = Date.now() * 0.005;
                const jumpHeight = Math.max(0, Math.sin(jumpCycle) * 6);
                this.mesh.position.y = GROUND_Y + jumpHeight;
                if (jumpHeight > 0.1) { 
                    this.mesh.position.add(dir.clone().multiplyScalar(this.speed * 2.0)); 
                }
                break;
            case '香':
                if (this.chargeState === 0) {
                    this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                    
                    if (xzDist < 25 && Date.now() - this.lastAttack > 2000) { 
                        this.chargeState = 1; 
                        this.chargeTarget.copy(playerPos).add(dir.clone().multiplyScalar(4));
                        this.chargeStartTime = Date.now();
                        this.mats[0].emissive.setRGB(0.8, 0, 0); 
                    }
                } else if (this.chargeState === 1) {
                    const cDir = new THREE.Vector3().subVectors(this.chargeTarget, this.mesh.position);
                    cDir.y = 0;
                    const distToTarget = cDir.length();
                    cDir.normalize();
                    
                    this.mesh.position.add(cDir.multiplyScalar(this.speed * 6));
                    
                    const elapsed = Date.now() - this.chargeStartTime;
                    const limit = BOARD_SIZE / 2 - 2.5;
                    const isAtWall = Math.abs(this.mesh.position.x) >= limit || Math.abs(this.mesh.position.z) >= limit;
                    
                    if (distToTarget < 2.0 || elapsed > 1500 || isAtWall) {
                        this.chargeState = 0; 
                        this.lastAttack = Date.now(); 
                        this.mats[0].emissive.setRGB(0, 0, 0); 
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

            // --- チェスの駒（新規追加） ---
            case 'ポーン':
            case 'P':
                // 素早い直線的な突撃
                this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                break;

            case 'ナイト':
            case 'N':
                if (this.knightState === 0) {
                    // 地上移動で接近
                    this.mesh.position.y = GROUND_Y;
                    this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                    
                    // 一定距離に入ったらジャンプシーケンス起動
                    if (xzDist < 20.0) {
                        this.knightState = 1;
                        this.knightTargetY = GROUND_Y + 10.0 + Math.random() * 2.0; // 上空 Y=10〜12
                    }
                } else if (this.knightState === 1) {
                    // 上空へ大きく上昇
                    this.mesh.position.y += 0.3;
                    this.mesh.position.add(dir.clone().multiplyScalar(this.speed * 0.5)); // 上昇中も少し詰め寄る
                    if (this.mesh.position.y >= this.knightTargetY) {
                        this.knightState = 2;
                        this.knightTimer = Date.now();
                    }
                } else if (this.knightState === 2) {
                    // 滞空状態 (約1秒) & プレイヤー位置に頭上を吸い付かせる
                    this.mesh.position.y = this.knightTargetY;
                    const pHeadPos = playerPos.clone();
                    pHeadPos.y = this.knightTargetY;
                    this.mesh.position.lerp(pHeadPos, 0.08);

                    if (Date.now() - this.knightTimer > 1000) {
                        this.knightState = 3;
                        this.knightTargetX = playerPos.x;
                        this.knightTargetZ = playerPos.z;
                    }
                } else if (this.knightState === 3) {
                    // プレイヤーを狙って急降下
                    this.mesh.position.y -= 0.6;
                    
                    const dropDir = new THREE.Vector3(this.knightTargetX - this.mesh.position.x, 0, this.knightTargetZ - this.mesh.position.z);
                    if (dropDir.length() > 0.2) {
                        this.mesh.position.add(dropDir.normalize().multiplyScalar(this.speed * 1.5));
                    }
                    
                    // 着地処理
                    if (this.mesh.position.y <= GROUND_Y) {
                        this.mesh.position.y = GROUND_Y;
                        this.knightState = 0; // 地上状態へ移行
                        
                        // 着地地点の爆発半径4.0に大ダメージ
                        const distToLanding = this.mesh.position.distanceTo(new THREE.Vector3(playerPos.x, GROUND_Y, playerPos.z));
                        if (distToLanding < 4.0) {
                            takeDamage(25);
                        }
                        
                        // 簡易的な爆破サークルエフェクトをシーンに追加
                        const circleGeom = new THREE.RingGeometry(0.1, 4.0, 32);
                        const circleMat = new THREE.MeshBasicMaterial({ color: 0xff3300, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
                        const circle = new THREE.Mesh(circleGeom, circleMat);
                        circle.rotation.x = Math.PI / 2;
                        circle.position.set(this.mesh.position.x, GROUND_Y + 0.05, this.mesh.position.z);
                        STATE.scene.add(circle);
                        setTimeout(() => { STATE.scene.remove(circle); }, 300);
                    }
                }
                break;

            case 'ビショップ':
            case 'B':
                // テレポート移動を伴うトリッキーな接近
                if (!this.bishopTeleporting) {
                    this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                    
                    // 3.5秒おきにテレポート発動
                    if (Date.now() - this.bishopLastTeleport > 3500) {
                        this.bishopTeleporting = true;
                        this.bishopTeleportStep = 0; // フェードアウトフェーズ
                    }
                } else {
                    if (this.bishopTeleportStep === 0) {
                        // フェードアウト
                        this.bishopOpacity -= 0.12;
                        this.mats.forEach(m => { m.transparent = true; m.opacity = Math.max(0, this.bishopOpacity); });
                        
                        if (this.bishopOpacity <= 0) {
                            // プレイヤー方向へ8ユニット瞬間移動
                            this.mesh.position.add(dir.clone().multiplyScalar(8.0));
                            this.bishopTeleportStep = 1; // フェードインフェーズ
                        }
                    } else {
                        // フェードイン
                        this.bishopOpacity += 0.12;
                        this.mats.forEach(m => { m.opacity = Math.min(1.0, this.bishopOpacity); });
                        
                        if (this.bishopOpacity >= 1.0) {
                            this.mats.forEach(m => { m.transparent = false; m.opacity = 1.0; });
                            this.bishopTeleporting = false;
                            this.bishopLastTeleport = Date.now();
                        }
                    }
                }
                break;

            case 'ルーク':
            case 'R':
                // 高耐久の重戦車
                this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                this.firePattern('ROOK');
                break;

            case 'クイーン':
            case 'Q':
                // ホバリング移動（Y = 5.0〜7.0 付近を揺れる）
                const hoverOffset = Math.sin(Date.now() * 0.0025) * 1.0;
                this.mesh.position.y = GROUND_Y + 6.0 + hoverOffset;
                
                // 距離を一定に保つように旋回接近
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
                // 非常に遅いボス
                this.mesh.position.add(dir.clone().multiplyScalar(this.speed));
                this.firePattern('OMNI');
                break;
        }

        this.applySeparation(others);

        const eLimit = BOARD_SIZE / 2 - 2.0;
        this.mesh.position.x = Math.max(-eLimit, Math.min(eLimit, this.mesh.position.x));
        this.mesh.position.z = Math.max(-eLimit, Math.min(eLimit, this.mesh.position.z));

        // 旋回方向の補正
        if (this.type === '香' && this.chargeState === 1) {
            this.mesh.lookAt(this.chargeTarget.x, this.mesh.position.y, this.chargeTarget.z);
        } else {
            this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);
        }
    }

    applySeparation(others) {
        others.forEach(other => {
            if (other === this) return;
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
        
        const toPlayer = new THREE.Vector3().subVectors(STATE.camera.position, origin);
        toPlayer.y = 0;
        toPlayer.normalize();

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
        // --- ルーク・クイーン用の弾幕パターン ---
        } else if (mode === 'ROOK') {
            // ルーク：スタン属性を持つ高弾速の大型弾を放つ
            STATE.enemyBullets.push(new Projectile(origin, toPlayer, true, 2.8, 0.55, false, true));
        } else if (mode === 'QUEEN') {
            // クイーン：FAN弾幕とホーミング弾幕を交互に発射
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
        this.mats[0].emissive.setRGB(1, 1, 1); 
        this.mats[0].emissiveIntensity = 2.0;
        setTimeout(() => { 
            if(this.mesh && this.mats[0]) {
                this.mats[0].emissive.setRGB(0,0,0); 
                this.mats[0].emissiveIntensity = 1.0;
            }
        }, 100);

        const isDead = this.hp <= 0;
        if (isDead) {
            // キング撃破時に即死級大爆発
            if (this.type === 'キング' || this.type === 'K') {
                this.triggerKingExplosion();
            }
        }
        return isDead;
    }

    // キング大爆発演出およびダメージ処理
    triggerKingExplosion() {
        const explosionOrigin = this.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        
        // 視覚的エフェクト：膨張する赤い半透明の球体
        const expGeom = new THREE.SphereGeometry(1.0, 32, 32);
        const expMat = new THREE.MeshBasicMaterial({ color: 0xff1100, transparent: true, opacity: 0.8 });
        const expMesh = new THREE.Mesh(expGeom, expMat);
        expMesh.position.copy(explosionOrigin);
        STATE.scene.add(expMesh);
        
        let currentScale = 1.0;
        const interval = setInterval(() => {
            currentScale += 0.4;
            if (expMesh) {
                expMesh.scale.set(currentScale, currentScale, currentScale);
                expMat.opacity -= 0.04;
                if (expMat.opacity <= 0) {
                    clearInterval(interval);
                    STATE.scene.remove(expMesh);
                }
            } else {
                clearInterval(interval);
            }
        }, 16);

        // ダメージ判定：半径8.0ユニット以内のプレイヤーに50ダメージ
        const playerPos = STATE.camera.position.clone();
        const dist = explosionOrigin.distanceTo(playerPos);
        if (dist < 8.0) {
            takeDamage(50);
        }
    }
}
