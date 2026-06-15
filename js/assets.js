import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * ジオメトリの属性を position, normal, uv のみにクリーンアップし、
 * mergeGeometries 実行時の属性不一致エラーを防ぐヘルパー関数。
 */
function prepareGeometry(geometry) {
    const validKeys = ['position', 'normal', 'uv'];
    for (const key in geometry.attributes) {
        if (!validKeys.includes(key)) {
            geometry.deleteAttribute(key);
        }
    }
    geometry.clearGroups();
    return geometry;
}

/**
 * 共通のくびれのあるクラシックな台座を LatheGeometry で生成するヘルパー。
 */
function createBaseGeometry(bottomRadius, topRadius, height) {
    const points = [];
    points.push(new THREE.Vector2(0, 0)); 
    points.push(new THREE.Vector2(bottomRadius, 0)); 
    points.push(new THREE.Vector2(bottomRadius, height * 0.15));
    points.push(new THREE.Vector2(bottomRadius * 0.85, height * 0.25)); 
    points.push(new THREE.Vector2(bottomRadius * 0.55, height * 0.5));  
    points.push(new THREE.Vector2(bottomRadius * 0.5, height * 0.75));
    points.push(new THREE.Vector2(topRadius * 1.15, height * 0.88));   
    points.push(new THREE.Vector2(topRadius, height * 0.95));
    points.push(new THREE.Vector2(topRadius, height));
    points.push(new THREE.Vector2(0, height)); 

    const geom = new THREE.LatheGeometry(points, 24);
    return prepareGeometry(geom);
}

/**
 * ジオメトリの寸法とピボットを調整し、接地アライメント（Y=0）および
 * X=0, Z=0 中心アライメントを施してターゲットの高さにスケールするヘルパー。
 */
function adjustScaleAndAlignment(geometry, targetHeight) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const currentHeight = box.max.y - box.min.y;
    
    if (currentHeight > 0) {
        const scaleFactor = targetHeight / currentHeight;
        geometry.scale(scaleFactor, scaleFactor, scaleFactor);
    }
    
    geometry.computeBoundingBox();
    const newBox = geometry.boundingBox;
    geometry.translate(0, -newBox.min.y, 0);
    
    const centerX = (newBox.max.x + newBox.min.x) / 2;
    const centerZ = (newBox.max.z + newBox.min.z) / 2;
    geometry.translate(-centerX, 0, -centerZ);
    
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
}

/**
 * 指定したチェス駒の種類に応じた BufferGeometry を動的に生成して返却する。
 * @param {string} type - 'ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング' (または 'P','N','B','R','Q','K')
 * @returns {THREE.BufferGeometry} マージ済み・アライメント補正済みの単一ジオメトリ
 */
export function getChessGeometry(type) {
    const normalizedType = type.toUpperCase();
    const geometries = [];

    if (normalizedType === 'P' || normalizedType === 'ポーン') {
        const base = createBaseGeometry(0.7, 0.45, 0.9);
        geometries.push(base);

        const collar = prepareGeometry(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 24));
        collar.translate(0, 0.92, 0);
        geometries.push(collar);

        const head = prepareGeometry(new THREE.SphereGeometry(0.38, 24, 24));
        head.translate(0, 1.3, 0);
        geometries.push(head);

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 1.8); 
        return merged;

    } else if (normalizedType === 'R' || normalizedType === 'ルーク') {
        const base = createBaseGeometry(0.75, 0.6, 0.8);
        geometries.push(base);

        const body = prepareGeometry(new THREE.CylinderGeometry(0.5, 0.6, 0.6, 24));
        body.translate(0, 1.1, 0);
        geometries.push(body);

        const head = prepareGeometry(new THREE.CylinderGeometry(0.65, 0.55, 0.4, 24));
        head.translate(0, 1.6, 0);
        geometries.push(head);

        const r = 0.55;
        const h = 1.8 + 0.075;
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2;
            const box = prepareGeometry(new THREE.BoxGeometry(0.18, 0.15, 0.18));
            box.translate(Math.cos(angle) * r, h, Math.sin(angle) * r);
            geometries.push(box);
        }

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.1);
        return merged;

    } else if (normalizedType === 'N' || normalizedType === 'ナイト') {
        const base = createBaseGeometry(0.75, 0.55, 0.6);
        geometries.push(base);

        const shape = new THREE.Shape();
        shape.moveTo(0.0, 0.0);
        shape.lineTo(0.45, 0.15);
        shape.quadraticCurveTo(0.7, 0.35, 0.7, 0.65); 
        shape.quadraticCurveTo(0.7, 0.85, 0.5, 0.95); 
        shape.lineTo(0.4, 0.8); 
        shape.lineTo(0.42, 1.05);
        shape.quadraticCurveTo(0.15, 1.25, -0.2, 1.25); 
        shape.lineTo(-0.35, 1.55); 
        shape.lineTo(-0.48, 1.55);
        shape.lineTo(-0.45, 1.25);
        shape.quadraticCurveTo(-0.6, 0.75, -0.35, 0.0); 
        shape.closePath();

        const extrudeSettings = {
            depth: 0.32,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 1,
            bevelSize: 0.04,
            bevelThickness: 0.04
        };

        const head = prepareGeometry(new THREE.ExtrudeGeometry(shape, extrudeSettings));
        head.center(); 
        head.rotateY(Math.PI / 2); 
        head.translate(0, 0.6 + 0.75, 0); 
        geometries.push(head);

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.1);
        return merged;

    } else if (normalizedType === 'B' || normalizedType === 'ビショップ') {
        const base = createBaseGeometry(0.72, 0.48, 0.9);
        geometries.push(base);

        const collar = prepareGeometry(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 24));
        collar.translate(0, 0.92, 0);
        geometries.push(collar);

        const head = prepareGeometry(new THREE.SphereGeometry(0.38, 24, 24));
        head.scale(1, 1.5, 1);
        head.translate(0, 1.45, 0);
        geometries.push(head);

        const lip1 = prepareGeometry(new THREE.BoxGeometry(0.08, 0.35, 0.1));
        lip1.rotateX(0.5); 
        lip1.translate(-0.06, 1.55, 0.25);
        geometries.push(lip1);

        const lip2 = prepareGeometry(new THREE.BoxGeometry(0.08, 0.35, 0.1));
        lip2.rotateX(0.5);
        lip2.translate(0.06, 1.55, 0.25);
        geometries.push(lip2);

        const topSphere = prepareGeometry(new THREE.SphereGeometry(0.08, 12, 12));
        topSphere.translate(0, 2.05, 0);
        geometries.push(topSphere);

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.2);
        return merged;

    } else if (normalizedType === 'Q' || normalizedType === 'クイーン') {
        const base = createBaseGeometry(0.72, 0.45, 1.0);
        geometries.push(base);

        const body = prepareGeometry(new THREE.CylinderGeometry(0.32, 0.45, 0.6, 24));
        body.translate(0, 1.3, 0);
        geometries.push(body);

        const crown = prepareGeometry(new THREE.CylinderGeometry(0.58, 0.35, 0.4, 24));
        crown.translate(0, 1.8, 0);
        geometries.push(crown);

        const r = 0.54;
        const h = 2.0;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const spike = prepareGeometry(new THREE.ConeGeometry(0.06, 0.15, 6));
            spike.rotateX(0.25); 
            spike.rotateY(-angle); 
            spike.translate(Math.cos(angle) * r, h, Math.sin(angle) * r);
            geometries.push(spike);
        }

        const topSphere = prepareGeometry(new THREE.SphereGeometry(0.1, 16, 16));
        topSphere.translate(0, 2.05, 0);
        geometries.push(topSphere);

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.4);
        return merged;

    } else if (normalizedType === 'K' || normalizedType === 'キング') {
        const base = createBaseGeometry(0.75, 0.48, 1.1);
        geometries.push(base);

        const body = prepareGeometry(new THREE.CylinderGeometry(0.35, 0.48, 0.7, 24));
        body.translate(0, 1.45, 0);
        geometries.push(body);

        const crown = prepareGeometry(new THREE.CylinderGeometry(0.6, 0.38, 0.4, 24));
        crown.translate(0, 2.0, 0);
        geometries.push(crown);

        const dome = prepareGeometry(new THREE.SphereGeometry(0.48, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));
        dome.scale(1, 0.6, 1);
        dome.translate(0, 2.1, 0);
        geometries.push(dome);

        const crossY = 2.45;
        const vertical = prepareGeometry(new THREE.BoxGeometry(0.08, 0.38, 0.08));
        vertical.translate(0, crossY, 0);
        geometries.push(vertical);

        const horizontal = prepareGeometry(new THREE.BoxGeometry(0.26, 0.08, 0.08));
        horizontal.translate(0, crossY + 0.1, 0);
        geometries.push(horizontal);

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.5); 
        return merged;
    }

    return getChessGeometry('P');
}
