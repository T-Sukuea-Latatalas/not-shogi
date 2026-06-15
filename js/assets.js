import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * ジオメトリの属性を position, normal, uv のみにクリーンアップし、
 * mergeGeometries 時の属性競合やグループのエラーを防ぐヘルパー関数。
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
    points.push(new THREE.Vector2(0, 0)); // 底面中心
    points.push(new THREE.Vector2(bottomRadius, 0)); // 底面エッジ
    points.push(new THREE.Vector2(bottomRadius, height * 0.15));
    points.push(new THREE.Vector2(bottomRadius * 0.85, height * 0.25)); // くびれ開始
    points.push(new THREE.Vector2(bottomRadius * 0.55, height * 0.5));  // 最も細い部分
    points.push(new THREE.Vector2(bottomRadius * 0.5, height * 0.75));
    points.push(new THREE.Vector2(topRadius * 1.15, height * 0.88));   // 上部リング膨らみ
    points.push(new THREE.Vector2(topRadius, height * 0.95));
    points.push(new THREE.Vector2(topRadius, height));
    points.push(new THREE.Vector2(0, height)); // 上面中心

    const geom = new THREE.LatheGeometry(points, 24);
    return prepareGeometry(geom);
}

/**
 * ジオメトリの寸法とピボットを調整し、接地アライメント（Y=0）および
 * X=0, Z=0 中心アライメントを施してスケールを合わせるヘルパー。
 */
function adjustScaleAndAlignment(geometry, targetHeight) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const currentHeight = box.max.y - box.min.y;
    
    // 指定の高さに合わせて一様スケール
    if (currentHeight > 0) {
        const scaleFactor = targetHeight / currentHeight;
        geometry.scale(scaleFactor, scaleFactor, scaleFactor);
    }
    
    // 底面を Y = 0 に接地
    geometry.computeBoundingBox();
    const newBox = geometry.boundingBox;
    geometry.translate(0, -newBox.min.y, 0);
    
    // X, Zの中心を原点 (0, 0) にアライメント
    const centerX = (newBox.max.x + newBox.min.x) / 2;
    const centerZ = (newBox.max.z + newBox.min.z) / 2;
    geometry.translate(-centerX, 0, -centerZ);
    
    // 後続処理（衝突判定や法線計算）のために更新
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
}

/**
 * 指定したチェス駒の種類に応じた BufferGeometry を動的に生成して返します。
 * @param {string} type - 'ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング' (または 'P','N','B','R','Q','K')
 * @returns {THREE.BufferGeometry} マージ済みかつアライメント・スケール調整済みの単一ジオメトリ
 */
export function getChessGeometry(type) {
    const normalizedType = type.toUpperCase();
    const geometries = [];

    if (normalizedType === 'P' || normalizedType === 'ポーン') {
        // --- ポーン ---
        // 共通台座
        const base = createBaseGeometry(0.7, 0.45, 0.9);
        geometries.push(base);

        // 首リング
        const collar = prepareGeometry(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 24));
        collar.translate(0, 0.92, 0);
        geometries.push(collar);

        // 頭部（球体）
        const head = prepareGeometry(new THREE.SphereGeometry(0.38, 24, 24));
        head.translate(0, 1.3, 0);
        geometries.push(head);

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 1.8); // 将棋の通常駒に近いポーンの高さ
        return merged;

    } else if (normalizedType === 'R' || normalizedType === 'ルーク') {
        // --- ルーク ---
        // 少し低めでがっしりした台座
        const base = createBaseGeometry(0.75, 0.6, 0.8);
        geometries.push(base);

        // テーパーのついた胴体
        const body = prepareGeometry(new THREE.CylinderGeometry(0.5, 0.6, 0.6, 24));
        body.translate(0, 1.1, 0);
        geometries.push(body);

        // 城壁ベースの頭部（お椀型）
        const head = prepareGeometry(new THREE.CylinderGeometry(0.65, 0.55, 0.4, 24));
        head.translate(0, 1.6, 0);
        geometries.push(head);

        // スリット（銃眼）を形作る4つの突起
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
        // --- ナイト ---
        // 低めの台座
        const base = createBaseGeometry(0.75, 0.55, 0.6);
        geometries.push(base);

        // 馬の頭部の2D輪郭
        const shape = new THREE.Shape();
        shape.moveTo(0.0, 0.0);
        shape.lineTo(0.45, 0.15);
        shape.quadraticCurveTo(0.7, 0.35, 0.7, 0.65); // 鼻
        shape.quadraticCurveTo(0.7, 0.85, 0.5, 0.95); // 口
        shape.lineTo(0.4, 0.8); // 口の切り込み
        shape.lineTo(0.42, 1.05);
        shape.quadraticCurveTo(0.15, 1.25, -0.2, 1.25); // 額
        shape.lineTo(-0.35, 1.55); // 耳
        shape.lineTo(-0.48, 1.55);
        shape.lineTo(-0.45, 1.25);
        shape.quadraticCurveTo(-0.6, 0.75, -0.35, 0.0); // たてがみ
        shape.closePath();

        const extrudeSettings = {
            depth: 0.32,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 1,
            bevelSize: 0.04,
            bevelThickness: 0.04
        };

        // 押し出しにより立体化
        const head = prepareGeometry(new THREE.ExtrudeGeometry(shape, extrudeSettings));
        head.center(); // X, Y, Zの原点に対称化
        head.rotateY(Math.PI / 2); // 押し出し方向（Z）を横に向けて、馬を正面にアライメント
        head.translate(0, 0.6 + 0.75, 0); // 台座の上に載せるための移動
        geometries.push(head);

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.1);
        return merged;

    } else if (normalizedType === 'B' || normalizedType === 'ビショップ') {
        // --- ビショップ ---
        const base = createBaseGeometry(0.72, 0.48, 0.9);
        geometries.push(base);

        // 首リング
        const collar = prepareGeometry(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 24));
        collar.translate(0, 0.92, 0);
        geometries.push(collar);

        // 涙型（楕円球）の頭部
        const head = prepareGeometry(new THREE.SphereGeometry(0.38, 24, 24));
        head.scale(1, 1.5, 1);
        head.translate(0, 1.45, 0);
        geometries.push(head);

        // 斜めのスリット表現（陰影を発生させるため、2つの出っ張りを少し隙間を開けて配置）
        const lip1 = prepareGeometry(new THREE.BoxGeometry(0.08, 0.35, 0.1));
        lip1.rotateX(0.5); // 斜めに傾ける
        lip1.translate(-0.06, 1.55, 0.25);
        geometries.push(lip1);

        const lip2 = prepareGeometry(new THREE.BoxGeometry(0.08, 0.35, 0.1));
        lip2.rotateX(0.5);
        lip2.translate(0.06, 1.55, 0.25);
        geometries.push(lip2);

        // 頂点の小さなポッチ（球体）
        const topSphere = prepareGeometry(new THREE.SphereGeometry(0.08, 12, 12));
        topSphere.translate(0, 2.05, 0);
        geometries.push(topSphere);

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.2);
        return merged;

    } else if (normalizedType === 'Q' || normalizedType === 'クイーン') {
        // --- クイーン ---
        // スマートで細身の台座
        const base = createBaseGeometry(0.72, 0.45, 1.0);
        geometries.push(base);

        // スレンダーな胴体部
        const body = prepareGeometry(new THREE.CylinderGeometry(0.32, 0.45, 0.6, 24));
        body.translate(0, 1.3, 0);
        geometries.push(body);

        // 王冠のベース
        const crown = prepareGeometry(new THREE.CylinderGeometry(0.58, 0.35, 0.4, 24));
        crown.translate(0, 1.8, 0);
        geometries.push(crown);

        // 放射状のティアラのギザギザ（コーン8個を円周上に配置）
        const r = 0.54;
        const h = 2.0;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const spike = prepareGeometry(new THREE.ConeGeometry(0.06, 0.15, 6));
            spike.rotateX(0.25); // 外側へ少し傾ける
            spike.rotateY(-angle); // 円周の接線方向に角度を合わせる
            spike.translate(Math.cos(angle) * r, h, Math.sin(angle) * r);
            geometries.push(spike);
        }

        // 王冠中央の小さな球体
        const topSphere = prepareGeometry(new THREE.SphereGeometry(0.1, 16, 16));
        topSphere.translate(0, 2.05, 0);
        geometries.push(topSphere);

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.4);
        return merged;

    } else if (normalizedType === 'K' || normalizedType === 'キング') {
        // --- キング ---
        // 最も重厚感のある台座
        const base = createBaseGeometry(0.75, 0.48, 1.1);
        geometries.push(base);

        // がっしりとした胴体部
        const body = prepareGeometry(new THREE.CylinderGeometry(0.35, 0.48, 0.7, 24));
        body.translate(0, 1.45, 0);
        geometries.push(body);

        // 広がりのある王冠の受け皿
        const crown = prepareGeometry(new THREE.CylinderGeometry(0.6, 0.38, 0.4, 24));
        crown.translate(0, 2.0, 0);
        geometries.push(crown);

        // 王冠の内側ドーム
        const dome = prepareGeometry(new THREE.SphereGeometry(0.48, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));
        dome.scale(1, 0.6, 1);
        dome.translate(0, 2.1, 0);
        geometries.push(dome);

        // 頂点の「十字架 (Cross)」
        const crossY = 2.45;
        const vertical = prepareGeometry(new THREE.BoxGeometry(0.08, 0.38, 0.08));
        vertical.translate(0, crossY, 0);
        geometries.push(vertical);

        const horizontal = prepareGeometry(new THREE.BoxGeometry(0.26, 0.08, 0.08));
        horizontal.translate(0, crossY + 0.1, 0);
        geometries.push(horizontal);

        const merged = BufferGeometryUtils.mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.5); // 最も背を高くアライメント
        return merged;
    }

    // 例外・フォールバック時はポーンを返却
    return getChessGeometry('P');
}
