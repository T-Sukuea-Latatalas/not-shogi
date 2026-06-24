import * as THREE from 'three';
import { GROUND_Y, STATE } from './constants.js';

export class DummyEnemy {
    constructor(type, scale = 1.0) {
        this.type = type;
        this.hp = Math.max(10, scale * 10);
        this.maxHp = this.hp;
        this.alive = true;

        const geometry = new THREE.BoxGeometry(scale * 1.5, scale * 3.0, scale * 1.5);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xff3333, 
            roughness: 0.5, 
            transparent: true, 
            opacity: 0.85 
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        
        const angle = Math.random() * Math.PI * 2;
        const radius = 15 + Math.random() * 35; // 15 から 50 の範囲
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
        
        if (this.hp <= 0) {
            this.alive = false;
            return true;
        }
        return false;
    }

    destroy() {
        this.alive = false;
        if (this.mesh) {
            if (STATE.scene) {
                STATE.scene.remove(this.mesh);
            }
            if (this.mesh.geometry) {
                this.mesh.geometry.dispose();
            }
            if (this.mesh.material) {
                if (Array.isArray(this.mesh.material)) {
                    this.mesh.material.forEach(mat => {
                        if (mat) mat.dispose();
                    });
                } else {
                    this.mesh.material.dispose();
                }
            }
        }
    }
}
