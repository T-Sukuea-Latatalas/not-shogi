// assets.js に以下を追加、および一部修正

import * as THREE from 'three';
import { COLORS, PIECE_NAMES } from './constants.js';

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
    createWoodCanvas(text, colorNum = COLORS.ink, isBoard = false) {
        const canvas = document.createElement('canvas'); 
        canvas.width = 1024; 
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#e3c88d'; 
        ctx.fillRect(0, 0, 1024, 1024);
        
        ctx.strokeStyle = '#d1b272';
        for(let i=0; i<40; i++) { 
            ctx.lineWidth = Math.random()*3+1.5; 
            let x = Math.random()*1024; 
            ctx.beginPath(); 
            ctx.moveTo(x, 0); 
            ctx.lineTo(x+(Math.random()-0.5)*80, 1024); 
            ctx.stroke(); 
        }

        if (isBoard) {
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 4;
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

            const dotRadius = 10;
            ctx.fillStyle = '#1a1a1a';
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
            let cssColor = '#1a1a1a';
            if (typeof colorNum === 'number') {
                cssColor = "#" + colorNum.toString(16).padStart(6, '0');
            } else if (typeof colorNum === 'string') {
                cssColor = colorNum;
            }
            ctx.fillStyle = cssColor; 
            ctx.textAlign = "center"; 
            ctx.textBaseline = "middle"; 

            if (text.length === 2) {
                ctx.font = "bold 320px 'Yuji Syuku', 'Klee One', 'Yu Mincho', 'MS Mincho', serif"; 
                ctx.fillText(text[0], 512, 420); 

                ctx.font = "bold 260px 'Yuji Syuku', 'Klee One', 'Yu Mincho', 'MS Mincho', serif"; 
                ctx.fillText(text[1], 512, 710); 
            } else {
                ctx.font = "bold 460px 'Yuji Syuku', 'Klee One', 'Yu Mincho', 'MS Mincho', serif"; 
                ctx.fillText(text, 512, 540); 
            }
        }
        return new THREE.CanvasTexture(canvas);
    },
    getMaterials(type) {
        const isGold = (type === '王' || type === '金');
        const fullName = PIECE_NAMES[type] || type;
        const textColor = COLORS.ink; 

        const frontTex = this.createWoodCanvas(fullName, textColor);
        const sideTex = this.createWoodCanvas(null);

        return [
            new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.8, color: isGold ? COLORS.gold : 0xffffff, emissive: new THREE.Color(0x000000) }),
            new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.8 })
        ];
    },

    // --- チェス用のアセット生成メソッド（追加） ---
    createChessCanvas(symbol) {
        const canvas = document.createElement('canvas'); 
        canvas.width = 1024; 
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // 高級感のある黒漆・ダーク大理石風のベース
        ctx.fillStyle = '#151515'; 
        ctx.fillRect(0, 0, 1024, 1024);
        
        // 微細なヘアライン模様
        ctx.strokeStyle = '#282828';
        for(let i=0; i<35; i++) { 
            ctx.lineWidth = Math.random() * 4 + 1.5; 
            let x = Math.random() * 1024; 
            ctx.beginPath(); 
            ctx.moveTo(x, 0); 
            ctx.lineTo(x + (Math.random() - 0.5) * 80, 1024); 
            ctx.stroke(); 
        }

        if (symbol) { 
            ctx.fillStyle = '#d4af37'; // シンボルは金色の装飾
            ctx.textAlign = "center"; 
            ctx.textBaseline = "middle"; 
            ctx.font = "bold 550px 'Segoe UI Symbol', 'Apple Color Emoji', 'sans-serif'"; 
            ctx.fillText(symbol, 512, 512); 
        }
        return new THREE.CanvasTexture(canvas);
    },
    getChessMaterials(type) {
        const symbols = {
            'ポーン': '♟', 'P': '♟',
            'ナイト': '♞', 'N': '♞',
            'ビショップ': '♝', 'B': '♝',
            'ルーク': '♜', 'R': '♜',
            'クイーン': '♛', 'Q': '♛',
            'キング': '♚', 'K': '♚'
        };
        const symbol = symbols[type] || '♟';
        const frontTex = this.createChessCanvas(symbol);
        const sideTex = this.createChessCanvas(null);

        // 低ラフネス・高メタルネスによる光沢のある金属的な反射光
        return [
            new THREE.MeshStandardMaterial({ 
                map: frontTex, 
                roughness: 0.1, 
                metalness: 0.8, 
                color: 0x333333,
                emissive: new THREE.Color(0x000000) 
            }),
            new THREE.MeshStandardMaterial({ 
                map: sideTex, 
                roughness: 0.1, 
                metalness: 0.8,
                color: 0x333333
            })
        ];
    },

    createMossTexture() {
        const canvas = document.createElement('canvas'); 
        canvas.width = 512; 
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#2d5a27'; 
        ctx.fillRect(0, 0, 512, 512);
        
        for (let i = 0; i < 8000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const r = Math.random() * 4 + 1;
            const green = Math.floor(Math.random() * 60) + 40; 
            ctx.fillStyle = `rgb(${Math.floor(green * 0.45)}, ${green}, ${Math.floor(green * 0.2)})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        return new THREE.CanvasTexture(canvas);
    },
    createKaresansuiTexture() {
        const canvas = document.createElement('canvas'); 
        canvas.width = 1024; 
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#dbd7c9'; 
        ctx.fillRect(0, 0, 1024, 1024);
        
        ctx.fillStyle = 'rgba(0,0,0,0.03)';
        for (let i = 0; i < 20000; i++) {
            ctx.fillRect(Math.random()*1024, Math.random()*1024, 2, 2);
        }
        
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 4;
        for (let y = -50; y < 1074; y += 24) {
            ctx.beginPath();
            for (let x = 0; x <= 1024; x += 10) {
                const wave = Math.sin(x * 0.03) * 6;
                if (x === 0) ctx.moveTo(x, y + wave);
                else ctx.lineTo(x, y + wave);
            }
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        const ripples = [
            {x: 350, y: 350, maxR: 120},
            {x: 700, y: 650, maxR: 150},
            {x: 200, y: 800, maxR: 100},
            {x: 850, y: 250, maxR: 130}
        ];
        ripples.forEach(rip => {
            for (let r = 10; r < rip.maxR; r += 24) {
                ctx.beginPath();
                ctx.arc(rip.x, rip.y, r, 0, Math.PI * 2);
                ctx.stroke();
            }
        });

        return new THREE.CanvasTexture(canvas);
    }
};

export function createBamboo() {
    const bamboo = new THREE.Group();
    const segmentHeight = 4.0;
    const numSegments = 6 + Math.floor(Math.random() * 4); 
    const baseRadius = 0.25 + Math.random() * 0.1;
    
    const bambooColor = new THREE.Color().setHSL(0.28 + Math.random() * 0.06, 0.5, 0.2 + Math.random() * 0.1);
    const material = new THREE.MeshStandardMaterial({
        color: bambooColor, roughness: 0.6, metalness: 0.1
    });
    const jointMaterial = new THREE.MeshStandardMaterial({
        color: bambooColor.clone().multiplyScalar(0.6), roughness: 0.8
    });

    for (let i = 0; i < numSegments; i++) {
        const rBottom = baseRadius * (1 - (i * 0.03));
        const rTop = baseRadius * (1 - ((i + 1) * 0.03));
        const segGeom = new THREE.CylinderGeometry(rTop, rBottom, segmentHeight - 0.15, 8);
        const segment = new THREE.Mesh(segGeom, material);
        segment.position.y = (i * segmentHeight) + (segmentHeight / 2);
        segment.castShadow = true;
        segment.receiveShadow = true;
        bamboo.add(segment);

        if (i < numSegments - 1) {
            const jointGeom = new THREE.CylinderGeometry(rTop * 1.18, rTop * 1.18, 0.12, 8);
            const joint = new THREE.Mesh(jointGeom, jointMaterial);
            joint.position.y = (i + 1) * segmentHeight;
            joint.castShadow = true;
            bamboo.add(joint);
        }
    }
    return bamboo;
}

export function createRock() {
    const size = 1.8 + Math.random() * 2.2;
    const geom = new THREE.DodecahedronGeometry(size, 1);
    
    const posAttr = geom.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
        posAttr.setX(i, posAttr.getX(i) + (Math.random() - 0.5) * (size * 0.25));
        posAttr.setY(i, posAttr.getY(i) + (Math.random() - 0.5) * (size * 0.25));
        posAttr.setZ(i, posAttr.getZ(i) + (Math.random() - 0.5) * (size * 0.25));
    }
    geom.computeVertexNormals();

    const rockColor = new THREE.Color(0x60665d).lerp(new THREE.Color(0x3a4538), Math.random() * 0.4);
    const mat = new THREE.MeshStandardMaterial({
        color: rockColor, roughness: 0.95, metalness: 0.0
    });
    const rock = new THREE.Mesh(geom, mat);
    rock.scale.set(1.2 + Math.random() * 0.6, 0.7 + Math.random() * 0.4, 1.2 + Math.random() * 0.6);
    rock.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
    rock.position.y = -0.5; 
    rock.castShadow = true;
    rock.receiveShadow = true;
    return rock;
}

export function createLantern() {
    const lantern = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7a8077, roughness: 0.9 });
    const lightMat = new THREE.MeshStandardMaterial({ 
        color: 0xffd060, emissive: 0xffa040, emissiveIntensity: 2.0 
    });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), stoneMat);
    base.position.y = 0.15; base.castShadow = true; base.receiveShadow = true;
    lantern.add(base);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 1.6, 8), stoneMat);
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

    const light = new THREE.PointLight(0xffb050, 1.2, 20);
    light.position.set(0, 2.5, 0); light.castShadow = true; light.shadow.bias = -0.001;
    lantern.add(light);

    return lantern;
}
