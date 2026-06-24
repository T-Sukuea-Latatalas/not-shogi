import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS, PIECE_NAMES } from './constants.js';

/**
 * カラーコードが数値または不正な形式である場合に、
 * Canvasコンテキストが正しく読み込める16進数文字列（例: "#e3c88d"）に変換・補正するヘルパー。
 */
function ensureColorString(color) {
    if (typeof color === 'number') {
        return '#' + color.toString(16).padStart(6, '0');
    }
    return color || '#ffffff';
}

/**
 * ジオメトリの属性を position, normal, uv のみにクリーンアップし、
 * mergeGeometries 時の属性競合やグループのエラーを防ぐヘルパー関数。
 */
function prepareGeometry(geometry) {
    const nonIndexedGeom = geometry.toNonIndexed();
    geometry.dispose();

    const validKeys = ['position', 'normal', 'uv'];
    const attributeKeys = Object.keys(nonIndexedGeom.attributes);
    for (const key of attributeKeys) {
        if (!validKeys.includes(key)) {
            nonIndexedGeom.deleteAttribute(key);
        }
    }
    nonIndexedGeom.clearGroups();
    return nonIndexedGeom;
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
 * X=0, Z=0 中心アライメントを施してスケールを合わせるヘルパー。
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

    if (!geometry.groups || geometry.groups.length === 0) {
        geometry.addGroup(0, geometry.getAttribute('position').count, 0);
    }
}

/**
 * 指定したチェス駒の種類に応じた BufferGeometry を動的に生成して返します。
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

        const merged = mergeGeometries(geometries);
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

        const merged = mergeGeometries(geometries);
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

        const merged = mergeGeometries(geometries);
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

        const merged = mergeGeometries(geometries);
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

        const merged = mergeGeometries(geometries);
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

        const merged = mergeGeometries(geometries);
        adjustScaleAndAlignment(merged, 2.5); 
        return merged;
    }

    return getChessGeometry('P');
}

export const AssetFactory = {
    pieceGeom: null,
    init() {
        const shape = new THREE.Shape();
        shape.moveTo(-1.0, 0); shape.lineTo(1.0, 0); shape.lineTo(0.85, 1.8); shape.lineTo(0, 2.4); shape.lineTo(-0.85, 1.8); shape.closePath();
        
        const customUVGenerator = {
            generateTopUV: function ( geometry, vertices, indexA, indexB, indexC ) {
                const ax = vertices[ indexA * 3 ];
                const ay = vertices[ indexA * 3 + 1 ];
                const bx = vertices[ indexB * 3 ];
                const by = vertices[ indexB * 3 + 1 ];
                const cx = vertices[ indexC * 3 ];
                const cy = vertices[ indexC * 3 + 1 ];

                return [
                    new THREE.Vector2( ( ax + 1.0 ) / 2.0, ay / 2.4 ),
                    new THREE.Vector2( ( bx + 1.0 ) / 2.0, by / 2.4 ),
                    new THREE.Vector2( ( cx + 1.0 ) / 2.0, cy / 2.4 )
                ];
            },
            generateSideWallUV: function ( geometry, vertices, indexA, indexB, indexC, indexD ) {
                return [
                    new THREE.Vector2( 0, 0 ),
                    new THREE.Vector2( 1, 0 ),
                    new THREE.Vector2( 1, 1 ),
                    new THREE.Vector2( 0, 1 )
                ];
            }
        };

        this.pieceGeom = new THREE.ExtrudeGeometry(shape, { 
            depth: 0.4, 
            bevelEnabled: true, 
            bevelSize: 0.05, 
            bevelThickness: 0.05,
            UVGenerator: customUVGenerator
        });
        this.pieceGeom.center(); this.pieceGeom.translate(0, 1.2, 0);
    },
    
    /**
     * 将棋盤や駒のベースとなる木目のキャンバステクスチャを生成。
     */
    createWoodCanvas(text, textColor = '#1a1a1a', isBoard = false) {
        const canvas = document.createElement('canvas'); 
        canvas.width = 1024; 
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // 榧（かや）特有の温かみと高級感のある地色
        const baseColor = ensureColorString(COLORS.wood || '#e3c88d'); 
        ctx.fillStyle = baseColor; 
        ctx.fillRect(0, 0, 1024, 1024);
        
        // 自然な木目のうねり・雲状の濃淡グラデーションを多重に重ねる
        for (let i = 0; i < 6; i++) {
            const grad = ctx.createRadialGradient(
                200 + Math.random() * 600, -200 - Math.random() * 200, 50,
                512, 512, 1200
            );
            grad.addColorStop(0, 'rgba(253, 238, 204, 0.09)');
            grad.addColorStop(0.5, 'rgba(185, 138, 82, 0.04)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 1024, 1024);
        }
        
        // 本榧盤の美しい柾目（木目線）の描画
        for(let i = 0; i < 130; i++) { 
            ctx.lineWidth = Math.random() * 1.3 + 0.3; 
            
            // 柾目の色は淡い黄褐色から微妙な赤褐色
            const r = Math.floor(160 + Math.random() * 25);
            const g = Math.floor(125 + Math.random() * 20);
            const b = Math.floor(75 + Math.random() * 15);
            const alpha = Math.random() * 0.16 + 0.04;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`; 
            
            let x = Math.random() * 1024; 
            ctx.beginPath(); 
            ctx.moveTo(x, 0); 
            
            // 異なる周波数を組み合わせることで、デジタル感を廃した有機的な揺らぎを表現
            const waveFreq1 = Math.random() * 0.003 + 0.001;
            const waveAmp1 = Math.random() * 14 + 4;
            const waveFreq2 = Math.random() * 0.012 + 0.004;
            const waveAmp2 = Math.random() * 3.5 + 0.5;

            for (let y = 0; y <= 1024; y += 15) {
                const ox = x + Math.sin(y * waveFreq1) * waveAmp1 + Math.cos(y * waveFreq2) * waveAmp2;
                if (y === 0) ctx.moveTo(ox, y);
                else ctx.lineTo(ox, y);
            }
            ctx.stroke(); 
        }

        if (isBoard) {
            // 深みのある漆の黒茶色の格子線
            ctx.strokeStyle = 'rgba(28, 20, 17, 0.92)';
            ctx.lineWidth = 4.2;
            const margin = 80;
            const size = 1024 - margin * 2;
            const step = size / 9;
            
            for (let i = 0; i <= 9; i++) {
                const pos = margin + i * step;
                ctx.beginPath();
                ctx.moveTo(pos, margin);
                ctx.lineTo(pos, 1024 - margin);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(margin, pos);
                ctx.lineTo(1024 - margin, pos);
                ctx.stroke();
            }

            const dotRadius = 8.5;
            ctx.fillStyle = '#1e140f';
            const stars = [3, 6];
            stars.forEach(r => {
                stars.forEach(c => {
                    const px = margin + r * step;
                    const py = margin + c * step;
                    ctx.beginPath();
                    ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
                    ctx.fill();
                });
            });
        } else if (text) { 
            ctx.fillStyle = ensureColorString(textColor); 
            ctx.textAlign = "center"; 
            ctx.textBaseline = "middle"; 

            // 格調高い毛筆フォント・明朝体ファミリー
            const fontName = "'Yuji Syuku', 'SentySinoType', '游明朝', YuMincho, 'MS Mincho', 'Hiragino Mincho ProN', serif";
            
            // 墨が木に染み込み、かすかに立体的に馴染んだような影を表現
            ctx.shadowColor = 'rgba(28, 20, 17, 0.28)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 1.2;
            ctx.shadowOffsetY = 1.2;

            if (text.length === 2) {
                ctx.font = `bold 310px ${fontName}`; 
                ctx.fillText(text[0], 512, 415); 

                ctx.font = `bold 250px ${fontName}`; 
                ctx.fillText(text[1], 512, 715); 
            } else {
                ctx.font = `bold 440px ${fontName}`; 
                ctx.fillText(text, 512, 535); 
            }
            
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
        return new THREE.CanvasTexture(canvas);
    },

    /**
     * 駒のマテリアルを取得。
     */
    getMaterials(type) {
        const fullName = PIECE_NAMES[type] || type;
        
        let textColor = '#1e1a15'; // 漆黒に近い墨色 
        if (type === '王' || type === '玉') {
            textColor = ensureColorString(COLORS.gold || '#d4af37'); // 雅な金箔
        } else if (type === '金' || type === '金将') {
            textColor = ensureColorString(COLORS.vermillion || '#ae1f23'); // 伝統的な朱
        } else if (['と', '成香', '成桂', '成銀', '竜', '馬', '竜王', '竜馬'].includes(type) || type.includes('成')) {
            textColor = ensureColorString(COLORS.vermillion || '#ae1f23'); 
        }

        const frontTex = this.createWoodCanvas(fullName, textColor);
        const sideTex = this.createWoodCanvas(null);

        // しっとりとした気品のある高級木肌の風合い（反射やざらざら具合を最適化）
        // MeshPhysicalMaterial に変更し、上品なワックス研磨をイメージしたクリアコートを追加
        return [
            new THREE.MeshPhysicalMaterial({ 
                map: frontTex, 
                roughness: 0.44, 
                metalness: 0.04,
                clearcoat: 0.22,
                clearcoatRoughness: 0.32,
                reflectivity: 0.48
            }),
            new THREE.MeshPhysicalMaterial({ 
                map: sideTex, 
                roughness: 0.46, 
                metalness: 0.02,
                clearcoat: 0.18,
                clearcoatRoughness: 0.36,
                reflectivity: 0.42
            })
        ];
    },

    /**
     * チェス駒用のキャンバステクスチャ生成。
     */
    createChessCanvas(symbol, baseColor = '#151515', textColor = '#d4af37') {
        const canvas = document.createElement('canvas'); 
        canvas.width = 1024; 
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = ensureColorString(baseColor); 
        ctx.fillRect(0, 0, 1024, 1024);
        
        const isDarkBase = baseColor === '#151515' || baseColor === '#181818' || baseColor === '#0a0a0a';
        
        if (isDarkBase) {
            // 黒漆の磨き上げの質感を高めるため、極薄の金粉ノイズとしっとりとしたブラシラインを表現
            ctx.strokeStyle = 'rgba(212, 175, 55, 0.012)';
            for (let i = 0; i < 40; i++) {
                ctx.lineWidth = Math.random() * 1.5 + 0.5;
                let x = Math.random() * 1024;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x + (Math.random() - 0.5) * 40, 1024);
                ctx.stroke();
            }
            // 非常に繊細な蒔絵風の金粉ノイズ
            ctx.fillStyle = 'rgba(212, 175, 55, 0.035)';
            for (let i = 0; i < 800; i++) {
                ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1.5, 1.5);
            }
        } else {
            // 白磁や象牙のなめらかな材質感を表現するため、極薄の有機的な波模様を重ねる
            ctx.strokeStyle = 'rgba(142, 120, 92, 0.018)';
            for (let i = 0; i < 35; i++) {
                ctx.lineWidth = Math.random() * 2.2 + 0.5;
                let x = Math.random() * 1024;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                const waveFreq = Math.random() * 0.004 + 0.002;
                const waveAmp = Math.random() * 16 + 4;
                for (let y = 0; y <= 1024; y += 30) {
                    const ox = x + Math.sin(y * waveFreq) * waveAmp;
                    if (y === 0) ctx.moveTo(ox, y);
                    else ctx.lineTo(ox, y);
                }
                ctx.stroke();
            }
        }

        if (symbol) { 
            ctx.fillStyle = ensureColorString(textColor); 
            ctx.textAlign = "center"; 
            ctx.textBaseline = "middle"; 
            ctx.font = "bold 530px 'Times New Roman', 'Georgia', 'Segoe UI Symbol', serif"; 
            
            // 蒔絵や象嵌が施されたような格調高い陰影
            ctx.shadowColor = isDarkBase ? 'rgba(212, 175, 55, 0.38)' : 'rgba(0, 0, 0, 0.16)';
            ctx.shadowBlur = 8;
            ctx.fillText(symbol, 512, 512); 
            ctx.shadowBlur = 0;
        }
        return new THREE.CanvasTexture(canvas);
    },

    /**
     * チェス駒のマテリアルを取得します。
     */
    getChessMaterials(type, isWhite = false) {
        const symbols = {
            'ポーン': '♟', 'P': '♟',
            'ナイト': '♞', 'N': '♞',
            'ビショップ': '♝', 'B': '♝',
            'ルーク': '♜', 'R': '♜',
            'クイーン': '♛', 'Q': '♛',
            'キング': '♚', 'K': '♚'
        };
        const symbol = symbols[type] || '♟';
        
        // 白：高級な白磁・象牙（アイボリー）、黒：美しい磨き上げられた黒漆
        const baseColor = isWhite ? '#fdfcf7' : '#0a0a0a';  
        const textColor = isWhite ? '#1c1815' : ensureColorString(COLORS.gold || '#d4af37');  
        
        const frontTex = this.createChessCanvas(symbol, baseColor, textColor);
        const sideTex = this.createChessCanvas(null, baseColor, textColor);

        // 白駒：象牙や陶器のようなソフトでなめらかな光沢、適度な光の透過性
        // 黒駒：周囲の光線をしっとりと受け止める、深く磨き上げられた黒漆の輝き
        const roughnessValue = isWhite ? 0.18 : 0.08;
        const metalnessValue = isWhite ? 0.04 : 0.08; 
        const clearcoatValue = isWhite ? 0.65 : 0.95;
        const clearcoatRoughnessValue = isWhite ? 0.15 : 0.04;

        return [
            new THREE.MeshPhysicalMaterial({ 
                map: frontTex, 
                roughness: roughnessValue, 
                metalness: metalnessValue, 
                color: 0xffffff,
                emissive: new THREE.Color(0x000000),
                clearcoat: clearcoatValue,
                clearcoatRoughness: clearcoatRoughnessValue,
                reflectivity: isWhite ? 0.6 : 0.9
            }),
            new THREE.MeshPhysicalMaterial({ 
                map: sideTex, 
                roughness: roughnessValue, 
                metalness: metalnessValue,
                color: 0xffffff,
                clearcoat: clearcoatValue,
                clearcoatRoughness: clearcoatRoughnessValue,
                reflectivity: isWhite ? 0.6 : 0.9
            })
        ];
    },

    createMossTexture() {
        const canvas = document.createElement('canvas'); 
        canvas.width = 512; 
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // 深みのある地（深緑 - Fukamidori）
        ctx.fillStyle = '#0c2012'; 
        ctx.fillRect(0, 0, 512, 512);
        
        // 日本の伝統的な緑色のレイヤー表現
        const colors = [
            'rgba(17, 53, 31, 0.82)',   // 常盤色（Tokiwa-iro: 暗く深い緑）
            'rgba(27, 77, 44, 0.72)',   // 苔色（Koke-iro: 湿度のある青緑）
            'rgba(105, 130, 27, 0.60)', // 鶯色（Uguisu-iro: くすんだ黄緑）
            'rgba(146, 140, 60, 0.52)', // 枯葉をまじえた侘茶色（Wabicha-iro）
            'rgba(167, 202, 44, 0.42)'  // 瑞々しい萌黄色（Moegi: ハイライト）
        ];

        // 各レイヤーを異なるサイズと密度でドット描画し、ふかふかした立体感と湿度を再現
        colors.forEach((color, layerIndex) => {
            const count = 12000 - layerIndex * 1500;
            const radiusMax = 6.0 - layerIndex * 0.8;
            
            for (let i = 0; i < count; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const r = Math.random() * radiusMax + 1.0;
                
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        // 朝露のようなかすかな微光沢ドット
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        for (let i = 0; i < 400; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            ctx.beginPath();
            ctx.arc(x, y, Math.random() * 1.5 + 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // わずかにブラーをかけて各色のエッジを美しくなじませる
        ctx.filter = 'blur(0.8px)';
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';

        return new THREE.CanvasTexture(canvas);
    },

    createKaresansuiTexture() {
        const canvas = document.createElement('canvas'); 
        canvas.width = 1024; 
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // 温かみのある京都の白砂（白川砂）を表現した色調
        ctx.fillStyle = '#e5e1d7'; 
        ctx.fillRect(0, 0, 1024, 1024);
        
        // 砂粒の陰影を表現する超高密度なノイズ
        // 暗い砂粒
        ctx.fillStyle = 'rgba(100, 95, 85, 0.04)'; 
        for (let i = 0; i < 50000; i++) {
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1.2, 1.2);
        }
        // 白く反射する砂粒
        ctx.fillStyle = 'rgba(255, 255, 255, 0.09)'; 
        for (let i = 0; i < 50000; i++) {
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1.2, 1.2);
        }
        
        // 砂紋の凹凸（立体感）をエンボス風に表現する描画用ヘルパー。
        // コントラストを優しく繊細に抑え、本物の砂に刻まれた柔らかな陰影を表現
        const drawRippleShadowAndLight = (drawFn) => {
            ctx.lineWidth = 3.5;
            
            // 陰影（凹部分の影）- 温かみのあるグレー
            ctx.strokeStyle = 'rgba(140, 133, 120, 0.09)';
            ctx.save();
            ctx.translate(1.2, 1.2);
            drawFn();
            ctx.restore();
            
            // ハイライト（凸部分の光）- 清潔な純白
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
            ctx.save();
            ctx.translate(-1.2, -1.2);
            drawFn();
            ctx.restore();

            // 砂の溝自体のベースのなじみ線
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(175, 168, 153, 0.04)';
            drawFn();
        };

        // 平行な波紋（砂紋）
        drawRippleShadowAndLight(() => {
            for (let y = -50; y < 1074; y += 22) {
                ctx.beginPath();
                for (let x = 0; x <= 1024; x += 10) {
                    // 自然な揺らぎを加えた緩やかな正弦波
                    const wave = Math.sin(x * 0.025) * 5 + Math.cos(x * 0.008) * 2;
                    if (x === 0) ctx.moveTo(x, y + wave);
                    else ctx.lineTo(x, y + wave);
                }
                ctx.stroke();
            }
        });

        // 庭石周辺の同心円状の砂紋
        const ripples = [
            {x: 350, y: 350, maxR: 140},
            {x: 700, y: 650, maxR: 160},
            {x: 200, y: 800, maxR: 120},
            {x: 850, y: 250, maxR: 150}
        ];
        
        drawRippleShadowAndLight(() => {
            ripples.forEach(rip => {
                for (let r = 10; r < rip.maxR; r += 22) {
                    ctx.beginPath();
                    ctx.arc(rip.x, rip.y, r, 0, Math.PI * 2);
                    ctx.stroke();
                }
            });
        });

        return new THREE.CanvasTexture(canvas);
    }
};

/**
 * 竹の生成。
 */
export function createBamboo() {
    const bamboo = new THREE.Group();
    const numSegments = 6 + Math.floor(Math.random() * 4); 
    const baseRadius = 0.25 + Math.random() * 0.1;
    const baseHue = 0.25 + Math.random() * 0.06; // HSL: 穏やかな緑〜オリーブの基調色
    
    let currentY = 0;

    for (let i = 0; i < numSegments; i++) {
        const rBottom = baseRadius * (1 - (i * 0.025));
        const rTop = baseRadius * (1 - ((i + 1) * 0.025));
        
        const segmentHeight = (4.0 * (1 - i * 0.03));
        const actualSegmentHeight = segmentHeight - 0.15;
        
        const segGeom = new THREE.CylinderGeometry(rTop, rBottom, actualSegmentHeight, 16);
        
        // 根元から上部に向けて徐々に瑞々しくなる（または枯れてゆく）自然なグラデーション
        const segHue = baseHue - (i * 0.006);
        const segSat = 0.35 + (i * 0.02);
        const segLight = 0.18 + (i * 0.012);
        const segmentColor = new THREE.Color().setHSL(segHue, segSat, segLight);
        
        // 竹特有の適度な光沢（皮部分）を表現
        const material = new THREE.MeshPhysicalMaterial({
            color: segmentColor, 
            roughness: 0.52, 
            metalness: 0.02,
            clearcoat: 0.18,
            clearcoatRoughness: 0.35
        });
        
        const segment = new THREE.Mesh(segGeom, material);
        segment.position.y = currentY + (actualSegmentHeight / 2);
        segment.castShadow = true;
        segment.receiveShadow = true;
        bamboo.add(segment);

        currentY += actualSegmentHeight;

        if (i < numSegments - 1) {
            // 節（Joint）: 乾燥してざらついた、わずかに茶がかった質感
            const jointColor = segmentColor.clone().multiplyScalar(0.75).add(new THREE.Color(0.06, 0.05, 0.01));
            const jointMaterial = new THREE.MeshStandardMaterial({
                color: jointColor, 
                roughness: 0.88,
                metalness: 0.02
            });
            
            const jointGeom = new THREE.CylinderGeometry(rTop * 1.15, rTop * 1.15, 0.15, 16);
            const joint = new THREE.Mesh(jointGeom, jointMaterial);
            joint.position.y = currentY + 0.075;
            joint.castShadow = true;
            bamboo.add(joint);
            
            currentY += 0.15; 
        }
    }
    return bamboo;
}

/**
 * 石の生成。
 */
export function createRock() {
    const size = 1.8 + Math.random() * 2.2;
    // 頂点の分割数を上げて、岩肌のリアリティと複雑さを向上
    const geom = new THREE.DodecahedronGeometry(size, 2);
    
    const posAttr = geom.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
        // 微細なディテールをランダムにノイズ化
        posAttr.setX(i, posAttr.getX(i) + (Math.random() - 0.5) * (size * 0.18));
        posAttr.setY(i, posAttr.getY(i) + (Math.random() - 0.5) * (size * 0.18));
        posAttr.setZ(i, posAttr.getZ(i) + (Math.random() - 0.5) * (size * 0.18));
    }
    geom.computeVertexNormals();

    // 湿り気のある深い庭石、あるいは雨に濡れた青石を思わせる、深みのある濃灰色〜暗オリーブ色
    const baseColor = new THREE.Color(0x2f322e);
    const rockColor = baseColor.clone().lerp(new THREE.Color(0x1e211d), Math.random() * 0.5);
    
    const mat = new THREE.MeshStandardMaterial({
        color: rockColor, 
        roughness: 0.9, 
        metalness: 0.05
    });
    const rock = new THREE.Mesh(geom, mat);
    rock.scale.set(1.2 + Math.random() * 0.5, 0.75 + Math.random() * 0.35, 1.2 + Math.random() * 0.5);
    rock.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
    rock.position.y = -0.4; 
    rock.castShadow = true;
    rock.receiveShadow = true;
    return rock;
}

/**
 * 石灯籠。
 */
export function createLantern() {
    const lantern = new THREE.Group();
    // 味わい深い石造り（御影石）の渋み
    const stoneMat = new THREE.MeshStandardMaterial({ 
        color: 0x4d4d4d, 
        roughness: 0.9,
        metalness: 0.03
    });
    // 和紙の障子を透かしてにじむ、柔らかく温かい和の火影
    const lightMat = new THREE.MeshStandardMaterial({ 
        color: 0xffda8a, 
        emissive: 0xff6200, 
        emissiveIntensity: 3.5 
    });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), stoneMat);
    base.position.y = 0.15; base.castShadow = true; base.receiveShadow = true;
    lantern.add(base);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 1.6, 12), stoneMat);
    pillar.position.y = 1.1; pillar.castShadow = true; pillar.receiveShadow = true;
    lantern.add(pillar);

    const platform = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 1.2), stoneMat);
    platform.position.y = 2.025; platform.castShadow = true; platform.receiveShadow = true;
    lantern.add(platform);

    const fireBoxLight = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), lightMat);
    fireBoxLight.position.y = 2.5;
    lantern.add(fireBoxLight);
    
    for (let x of [-0.38, 0.38]) {
        for (let z of [-0.38, 0.38]) {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), stoneMat);
            frame.position.set(x, 2.5, z); frame.castShadow = true;
            lantern.add(frame);
        }
    }
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.9), stoneMat);
    frameTop.position.y = 2.89;
    lantern.add(frameTop);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.5, 4), stoneMat);
    roof.rotation.y = Math.PI / 4; roof.position.y = 3.18; roof.castShadow = true;
    lantern.add(roof);

    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), stoneMat);
    jewel.scale.set(1, 1.3, 1); jewel.position.y = 3.53; jewel.castShadow = true;
    lantern.add(jewel);

    // 幽玄な和の陰影を引き立てる、灯篭本来の温かみ（1800K相当の橙黄色）を持たせたポイントライト
    // 物理的な減衰（decay: 2.0）を適用し、闇夜に静かに溶け込む落ち着いた光景を演出
    const light = new THREE.PointLight(0xff5a05, 3.2, 12, 2.0);
    light.position.set(0, 2.5, 0); light.castShadow = true; light.shadow.bias = -0.002;
    lantern.add(light);

    return lantern;
}