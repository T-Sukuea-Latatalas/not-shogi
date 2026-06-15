import * as THREE from 'three';
import { COLORS, STATE, EYE_HEIGHT, GROUND_Y, BOARD_SIZE } from './constants.js';
import { AssetFactory } from './assets.js';
import { takeDamage } from './main.js';

export class Projectile {
    constructor(pos, dir, isEnemy = false, speed = 1.5, size = 0.25, isHoming = false) {
        this.isEnemy = isEnemy;
        this.isHoming = isHoming;
        this.speed = speed;
        this.velocity = dir.clone().normalize().multiplyScalar(speed);
        const mat = new THREE.MeshBasicMaterial({ color: isEnemy ? (isHoming ? 0x8000ff : COLORS.spirit) : COLORS.vermillion, transparent: true, opacity: 0.9 });
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
        this.mats = AssetFactory.getMaterials(type);
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
        
        STATE.scene.add(this.mesh);
    }

    getHPBase(t) {
        return { '歩':4, '香':6, '桂':5, '銀':8, '金':10, '角':12, '飛':15, '王':80 }[t] || 5;
    }
    getSpeedBase(t) {
        return { '歩':0.08, '香':0.09, '桂':0.12, '銀':0.07, '金':0.05, '角':0.04, '飛':0.04, '王':0.03 }[t] || 0.05;
    }

    update(playerPos, others) {
        if (this.type !== '桂') {
            this.mesh.position.y = GROUND_Y;
        }

        const diff = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
        const xzDist = Math.sqrt(diff.x * diff.x + diff.z * diff.z);
        const dir = diff.clone().normalize().multiplyScalar(1);
        dir.y = 0;

        if (xzDist < 2.8 && Math.abs(playerPos.y - (this.mesh.position.y + 1.2)) < 5.0) {
            takeDamage(0.5);
        }

        switch(this.type) {
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
        return this.hp <= 0;
    }
}