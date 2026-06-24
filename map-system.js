import { STATE, PIECE_NAMES } from './constants.js';

const nodeCoords = [];
let isEventsBound = false;
let scrollAnimationId = null; // スムーズな絵巻物風スクロールを制御するアニメーションID

// 横一直線配置のための定数
const SPACING_X = 350;     // ノード間の距離
const OFFSET_X = 250;      // 最初のノードのX開始位置
const CONSTANT_Y = 1600;   // マップの高さ2500pxの下方位置へ修正（要件1：1250から1600へ変更）

/**
 * ステージデータから敵の構成を解析して難易度スコアを計算します。
 * @param {Object} stageData ステージ情報
 * @returns {number} 難易度スコアの合計値
 */
function calculateDifficultyScore(stageData) {
    const weights = {
        '歩': 1, 'ポーン': 1, 'P': 1,
        '香': 2, 'ナイト': 2, 'N': 2,
        '桂': 3, 'ビショップ': 3, 'B': 3,
        '銀': 4,
        '金': 5,
        '角': 6,
        '飛': 7, 'ルーク': 7, 'R': 7,
        'クイーン': 15, 'Q': 15,
        '王': 15, 'キング': 15, 'K': 15,
        'ヨット': 30, 'Yacht': 30
    };
    let score = 0;
    for (const key in weights) {
        if (stageData[key]) {
            score += stageData[key] * weights[key];
        }
    }
    return score;
}

/**
 * 計算された難易度スコアに基づき、5段階の難易度クラスを判定します（要件3）。
 * @param {number} score 難易度スコア
 * @returns {string} 難易度クラス名
 */
function getDifficultyClass(score) {
    if (score <= 3) return 'node-easy';      // 極易（若葉・萌黄）
    if (score <= 7) return 'node-normal';    // 容易（山吹・黄金）
    if (score <= 15) return 'node-medium';   // 中等（赤銅・渋柿）
    if (score <= 25) return 'node-hard';     // 至難（本朱）
    return 'node-expert';                    // 極難（江戸紫・漆黒金箔）
}

/**
 * カスタムのイージング関数を用いて、ビューポートを滑らかにスクロールさせます。
 * @param {HTMLElement} viewport 対象となるスクロールコンテナ
 * @param {number} targetLeft 目標とするスクロール位置X
 * @param {number} targetTop 目標とするスクロール位置Y
 */
function smoothScrollTo(viewport, targetLeft, targetTop) {
    if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId);
    }

    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
    const clampedTargetLeft = Math.max(0, Math.min(targetLeft, maxScrollLeft));
    const clampedTargetTop = Math.max(0, Math.min(targetTop, maxScrollTop));

    const easeFactor = 0.07;

    function step() {
        const currentLeft = viewport.scrollLeft;
        const currentTop = viewport.scrollTop;

        const diffLeft = clampedTargetLeft - currentLeft;
        const diffTop = clampedTargetTop - currentTop;

        if (Math.abs(diffLeft) < 0.5 && Math.abs(diffTop) < 0.5) {
            viewport.scrollLeft = clampedTargetLeft;
            viewport.scrollTop = clampedTargetTop;
            return;
        }

        viewport.scrollLeft = currentLeft + diffLeft * easeFactor;
        viewport.scrollTop = currentTop + diffTop * easeFactor;

        scrollAnimationId = requestAnimationFrame(step);
    }

    step();
}

/**
 * アクティブなステージにアバターの位置を合わせ、
 * forceScroll が有効な場合のみビューポートの中央にスクロール追従させます。
 * @param {boolean} forceScroll 強制的に自動スクロール追従を行うか否か
 */
function updateAvatarAndScroll(forceScroll = false) {
    const currentIndex = Number(STATE.currentStageIndex);
    const coords = nodeCoords[currentIndex];
    const avatar = document.getElementById('player-avatar');
    if (avatar && coords) {
        avatar.style.left = `${coords.x}px`;
        avatar.style.top = `${coords.y}px`;
    }

    const viewport = document.querySelector('.map-viewport');
    if (forceScroll && viewport && coords) {
        const viewportWidth = viewport.clientWidth;
        const viewportHeight = viewport.clientHeight;
        
        const targetLeft = coords.x - viewportWidth / 2;
        const targetTop = coords.y - viewportHeight / 2;

        smoothScrollTo(viewport, targetLeft, targetTop);
    }
}

/**
 * 現在選択されているアクティブなステージアイコンの真上に直接吹き出すポップアップ形式で
 * ステージ情報パネルを配置・表示し、難易度の和風テキスト表記を動的に追加します。
 */
function updateStageInfoPanel() {
    const currentIndex = Number(STATE.currentStageIndex);
    const stage = MapSystem.stagesData[currentIndex];
    const panel = document.getElementById('stage-info-panel');
    
    if (!stage) {
        if (panel) panel.style.display = 'none';
        return;
    }

    if (panel) {
        panel.style.display = 'flex';
        const coords = nodeCoords[currentIndex];
        
        // モバイルかつ縦画面の判定 (CSS側のドッキング固定レイアウトとインライン指定の競合を防ぐ)
        const isMobilePortrait = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;

        if (isMobilePortrait) {
            panel.style.position = '';
            panel.style.left = '';
            panel.style.top = '';
            panel.style.bottom = '';
            panel.style.right = '';
            panel.style.transform = '';
            panel.style.zIndex = '';
            panel.style.borderRadius = '';
            panel.style.boxShadow = '';
        } else if (coords) {
            // デスクトップ環境：選択中のアイコンの真上に配置
            panel.style.position = 'absolute';
            panel.style.right = 'auto';
            panel.style.top = 'auto';
            panel.style.bottom = 'auto';
            panel.style.left = `${coords.x}px`;
            panel.style.top = `${coords.y - 45}px`;
            panel.style.transform = 'translate(-50%, -100%)';
            panel.style.zIndex = '1000';
            panel.style.pointerEvents = 'auto';
            panel.style.borderRadius = '4px';
            panel.style.boxShadow = '0 -8px 24px rgba(0,0,0,0.65)';
        }

        const infoStageName = document.getElementById('info-stage-name');
        if (infoStageName) {
            const kanjis = ["零","一","二","三","四","五","六","七","八","九","十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十"];
            const prefix = stage.stage === 0 ? "修練" : `第${kanjis[stage.stage] || stage.stage}局`;
            infoStageName.innerText = `${prefix}: ${stage.name}`;
        }

        // 難易度の判定と和風表示エリアの動的追加（要件4）
        const difficultyScore = calculateDifficultyScore(stage);
        const diffClass = getDifficultyClass(difficultyScore);
        
        let difficultyText = "極易（初心）";
        let difficultyColor = "#3a7d44"; // 若葉色
        if (diffClass === 'node-normal') {
            difficultyText = "容易（並級）";
            difficultyColor = "#d49a37"; // 山吹色
        } else if (diffClass === 'node-medium') {
            difficultyText = "中等（練達）";
            difficultyColor = "#a05a2c"; // 赤銅色
        } else if (diffClass === 'node-hard') {
            difficultyText = "至難（特級）";
            difficultyColor = "#9e2a2b"; // 本朱色
        } else if (diffClass === 'node-expert') {
            difficultyText = "極難（神域）";
            difficultyColor = "#4a154b"; // 江戸紫
        }

        let difficultyEl = document.getElementById('info-stage-difficulty');
        if (!difficultyEl) {
            difficultyEl = document.createElement('div');
            difficultyEl.id = 'info-stage-difficulty';
            difficultyEl.style.fontSize = '13px';
            difficultyEl.style.fontWeight = 'bold';
            difficultyEl.style.marginTop = '6px';
            difficultyEl.style.textAlign = 'center';
            difficultyEl.style.letterSpacing = '0.15em';
            
            const header = panel.querySelector('.panel-header');
            if (header) {
                header.appendChild(difficultyEl);
            }
        }
        
        difficultyEl.innerHTML = `難易度：<span style="color: ${difficultyColor}; text-shadow: 0 0 8px ${difficultyColor}55;">${difficultyText}</span>`;

        const infoEnemyList = document.getElementById('info-enemy-list');
        if (infoEnemyList) {
            infoEnemyList.innerHTML = '';
            const enemyTypes = ['歩', '香', '桂', '銀', '金', '角', '飛', '王', 'ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング', 'ヨット'];
            
            enemyTypes.forEach(type => {
                const count = stage[type] || 0;
                if (count > 0) {
                    const li = document.createElement('li');
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'enemy-name';
                    nameSpan.innerText = PIECE_NAMES[type] || type;

                    const countSpan = document.createElement('span');
                    countSpan.className = 'enemy-count';
                    countSpan.innerText = `× ${count}`;

                    li.appendChild(nameSpan);
                    li.appendChild(countSpan);
                    infoEnemyList.appendChild(li);
                }
            });
        }

        const clearedIndicesRaw = window.getClearedStages ? window.getClearedStages() : [];
        const clearedIndices = clearedIndicesRaw.map(x => Number(x));
        const isUnlocked = (currentIndex === 0) || clearedIndices.includes(currentIndex - 1);
        const startBtn = document.getElementById('stage-start-btn');
        if (startBtn) {
            startBtn.disabled = !isUnlocked;
        }
    }
}

/**
 * 各種UIの状態を最新に更新します。
 * @param {boolean} forceScroll 自動スクロール追従を強制するか否か
 */
function updateActiveStageUI(forceScroll = false) {
    updateUnlockState();
    updateAvatarAndScroll(forceScroll);
    updateStageInfoPanel();
}

/**
 * ステージ選択画面の各種パネルボタンへのイベントバインドを行います。
 */
function bindPanelEvents() {
    if (isEventsBound) return;
    
    const startBtn = document.getElementById('stage-start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            MapSystem.startSelectedStage();
        });
    }

    const backBtn = document.getElementById('stage-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            MapSystem.hide();
            const titleScreen = document.getElementById('title-screen');
            if (titleScreen) titleScreen.style.display = 'flex';
        });
    }
    
    isEventsBound = true;
}

/**
 * 進捗状況に合わせて各マスのアンロッククラス、難易度5段階自動着色、およびSVGラインを更新します。
 */
function updateUnlockState() {
    const clearedIndicesRaw = window.getClearedStages ? window.getClearedStages() : [];
    const clearedIndices = clearedIndicesRaw.map(x => Number(x));
    const currentIndex = Number(STATE.currentStageIndex);

    const nodes = document.querySelectorAll('.stage-node');
    nodes.forEach((node, idx) => {
        const currentIdxNum = Number(idx);
        const stage = MapSystem.stagesData[currentIdxNum];
        if (!stage) return;

        const isCleared = clearedIndices.includes(currentIdxNum);
        const isUnlocked = (currentIdxNum === 0) || clearedIndices.includes(currentIdxNum - 1);
        const isActive = (currentIdxNum === currentIndex);

        // 5段階の難易度クラスをリセットして再判定（要件3）
        node.classList.remove('locked', 'unlocked', 'cleared', 'active');
        node.classList.remove('node-easy', 'node-normal', 'node-medium', 'node-hard', 'node-expert');

        const difficultyScore = calculateDifficultyScore(stage);
        const diffClass = getDifficultyClass(difficultyScore);
        node.classList.add(diffClass);

        if (isActive) {
            node.classList.add('active');
        } else if (isCleared) {
            node.classList.add('cleared');
        } else if (isUnlocked) {
            node.classList.add('unlocked');
        } else {
            node.classList.add('locked');
        }

        // 難易度クラスに応じた5つの和風モダン色をマスのデザインへ同期（要件3）
        let difficultyColor = '#3a7d44'; // node-easy: 若葉・萌黄
        if (diffClass === 'node-normal') {
            difficultyColor = '#d49a37'; // node-normal: 山吹・黄金
        } else if (diffClass === 'node-medium') {
            difficultyColor = '#a05a2c'; // node-medium: 赤銅・渋柿
        } else if (diffClass === 'node-hard') {
            difficultyColor = '#9e2a2b'; // node-hard: 本朱・印泥
        } else if (diffClass === 'node-expert') {
            difficultyColor = '#4a154b'; // node-expert: 江戸紫・漆黒金箔
        }

        const icon = node.querySelector('.node-icon');
        if (icon) {
            icon.style.color = '';
            icon.style.background = '';
            icon.style.border = '';
            icon.style.boxShadow = '';

            if (isActive) {
                icon.style.border = `2.5px solid ${difficultyColor}`;
                icon.style.boxShadow = `0 0 16px ${difficultyColor}`;
                icon.style.color = difficultyColor;
                icon.style.background = '#1a1a1a'; // 漆黒の台座
            } else if (isCleared) {
                icon.style.border = `1.5px solid ${difficultyColor}aa`;
                icon.style.color = difficultyColor;
                icon.style.background = '#2c2a29'; // 煤黒
                icon.style.opacity = '0.95';
            } else if (isUnlocked) {
                icon.style.border = `1.5px dashed ${difficultyColor}99`;
                icon.style.color = `${difficultyColor}dd`;
                icon.style.background = '#eedcb3'; // 経年和紙調
            } else {
                icon.style.border = '1.2px solid rgba(139, 122, 102, 0.15)';
                icon.style.color = 'rgba(139, 122, 102, 0.22)';
                icon.style.background = 'rgba(139, 122, 102, 0.05)';
            }
        }
    });

    // SVG接続ルート線の更新（未クリア初期ロード時でも進行ルート線が途切れることなく可視化されるように修正）（要件2）
    MapSystem.stagesData.forEach((stage, idx) => {
        const currentIdxNum = Number(idx);
        const line = document.getElementById(`route-line-${currentIdxNum}`);
        if (line) {
            const isCleared = clearedIndices.includes(currentIdxNum);
            
            const current = nodeCoords[currentIdxNum];
            const next = nodeCoords[currentIdxNum + 1];
            let estimatedLength = SPACING_X;
            if (current && next) {
                const dx = Number(next.x) - Number(current.x);
                const dy = Number(next.y) - Number(current.y);
                estimatedLength = Math.sqrt(dx * dx + dy * dy);
            }
            
            let length = estimatedLength;
            try {
                if (line.getTotalLength && line.getTotalLength() > 0) {
                    length = line.getTotalLength();
                }
            } catch (e) {
                length = estimatedLength;
            }

            if (isNaN(length) || length <= 0) {
                length = estimatedLength;
            }

            const isSourceUnlocked = (currentIdxNum === 0) || clearedIndices.includes(currentIdxNum - 1);

            if (isCleared) {
                // 1. 完全開通済みのルート（実線、アニメーションなし）
                line.classList.remove('unlocked');
                line.style.strokeDasharray = '';
                line.style.strokeDashoffset = '0';
                line.style.opacity = '0.96';
            } else if (isSourceUnlocked) {
                // 2. 開放済み・次に挑戦可能（アニメーションをCSSに委ねるトグルを追加。インラインを初期化して途切れを解消）
                line.classList.add('unlocked');
                line.style.strokeDasharray = '';
                line.style.strokeDashoffset = '';
                line.style.opacity = '0.6';
            } else {
                // 3. 未解放領域
                line.classList.remove('unlocked');
                line.style.strokeDasharray = `${length}`;
                line.style.strokeDashoffset = `${length}`;
                line.style.opacity = '0';
            }
        }
    });
}

export const MapSystem = {
    stagesData: [],
    selectStageCallback: null,

    /**
     * ステージデータ配列とコールバック関数を受け取って一直線マップを初期化します。
     */
    init(stages, selectStageCallbackFn) {
        this.stagesData = stages;
        this.selectStageCallback = selectStageCallbackFn;
        nodeCoords.length = 0;

        const nodesContainer = document.getElementById('map-nodes-container');
        const svgContainer = document.getElementById('map-routes-svg');
        const template = document.getElementById('stage-node-template');

        if (nodesContainer) nodesContainer.innerHTML = '';
        if (svgContainer) svgContainer.innerHTML = '';

        // 1. 横一直線（等間隔）の座標算出 (CONSTANT_Y は修正後の定数を参照)
        stages.forEach((stage, index) => {
            const x = OFFSET_X + index * SPACING_X;
            const y = CONSTANT_Y;
            nodeCoords.push({ x, y });
        });

        // マップスクロール可能領域を自動拡張
        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            const totalWidth = OFFSET_X * 2 + (stages.length - 1) * SPACING_X;
            mapContainer.style.width = `${totalWidth}px`;
            mapContainer.style.height = `2500px`;
        }

        // 2. SVGによる街道風接続ルート線の構築
        if (svgContainer) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.innerHTML = `
                <filter id="emaki-brush-filter" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
                </filter>
            `;
            svgContainer.appendChild(defs);

            for (let i = 0; i < stages.length - 1; i++) {
                const current = nodeCoords[i];
                const next = nodeCoords[i + 1];
                if (current && next) {
                    const waveAmplitude = Math.sin(i * 1.5) * 15; 
                    const controlX = (current.x + next.x) / 2;
                    const controlY = (current.y + next.y) / 2 + waveAmplitude;
                    
                    const pathD = `M ${current.x} ${current.y} Q ${controlX} ${controlY} ${next.x} ${next.y}`;

                    // 【背景線】かすれ墨街道
                    const bgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    bgPath.setAttribute('d', pathD);
                    bgPath.setAttribute('class', 'map-route-line route-bg');
                    bgPath.setAttribute('filter', 'url(#emaki-brush-filter)');
                    bgPath.style.fill = 'none';
                    bgPath.style.stroke = '#8b7a66';
                    bgPath.style.strokeWidth = '3.5px';
                    bgPath.style.strokeDasharray = '7 4 2 4';
                    bgPath.style.opacity = '0.4';
                    svgContainer.appendChild(bgPath);

                    // 【進行線】アンロックに同期して満ちる辰砂朱
                    const activePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    activePath.setAttribute('d', pathD);
                    activePath.setAttribute('class', 'map-route-line route-active');
                    activePath.setAttribute('id', `route-line-${i}`);
                    activePath.setAttribute('filter', 'url(#emaki-brush-filter)');
                    activePath.style.fill = 'none';
                    activePath.style.stroke = '#c93a20'; // 辰砂朱
                    activePath.style.strokeWidth = '4.5px';
                    activePath.style.strokeLinecap = 'round';
                    activePath.style.opacity = '0';
                    activePath.style.transition = 'stroke-dashoffset 2.2s cubic-bezier(0.42, 0, 0.58, 1), opacity 0.6s ease';
                    svgContainer.appendChild(activePath);
                }
            }
        }

        // 3. 各ステージマスの動的生成
        if (nodesContainer && template) {
            stages.forEach((stage, index) => {
                const coords = nodeCoords[index];
                if (!coords) return;

                const clone = template.content.cloneNode(true);
                const node = clone.querySelector('.stage-node');
                
                node.style.left = `${coords.x}px`;
                node.style.top = `${coords.y}px`;
                node.setAttribute('data-stage-index', index);

                const icon = node.querySelector('.node-icon');
                if (icon) {
                    icon.innerText = stage.stage;
                }

                node.addEventListener('click', () => {
                    const clearedIndicesRaw = window.getClearedStages ? window.getClearedStages() : [];
                    const clearedIndices = clearedIndicesRaw.map(x => Number(x));
                    const isUnlocked = (index === 0) || clearedIndices.includes(index - 1);
                    if (isUnlocked) {
                        STATE.currentStageIndex = index;
                        updateActiveStageUI(true); // クリック時は強制追従スクロール
                    }
                });

                nodesContainer.appendChild(node);
            });
        }

        // 初期アバターの強制位置・スクロール同期
        const clearedIndicesRaw = window.getClearedStages ? window.getClearedStages() : [];
        const clearedIndices = clearedIndicesRaw.map(x => Number(x));
        let defaultIndex = 0;
        if (clearedIndices.length > 0) {
            const maxClearedIndex = Math.max(...clearedIndices);
            if (maxClearedIndex + 1 < stages.length) {
                defaultIndex = maxClearedIndex + 1;
            } else {
                defaultIndex = maxClearedIndex;
            }
        }
        
        const isCurrentUnlocked = (STATE.currentStageIndex === 0) || clearedIndices.includes(STATE.currentStageIndex - 1);
        if (STATE.currentStageIndex === undefined || STATE.currentStageIndex === null || Number(STATE.currentStageIndex) < 0 || Number(STATE.currentStageIndex) >= stages.length || !isCurrentUnlocked) {
            STATE.currentStageIndex = defaultIndex;
        }

        bindPanelEvents();
        updateActiveStageUI(true); // 初期ロード時は中央に強制追従
    },

    /**
     * マップ画面を表示し、スクロールを対象に強制追従させます。
     */
    show() {
        const stageSelectMenu = document.getElementById('stage-select-menu');
        if (stageSelectMenu) {
            stageSelectMenu.style.display = 'flex';
        }
        updateActiveStageUI(true);
    },

    /**
     * マップ画面を非表示にします。
     */
    hide() {
        const stageSelectMenu = document.getElementById('stage-select-menu');
        if (stageSelectMenu) {
            stageSelectMenu.style.display = 'none';
        }
        if (scrollAnimationId) {
            cancelAnimationFrame(scrollAnimationId);
        }
    },

    /**
     * 進行度の変化を検知してクラス適用状態を更新します。
     */
    updateMapState() {
        updateActiveStageUI(false);
    },

    /**
     * 進行度の変化を検知してクラス適用状態を更新します（互換性用）。
     */
    updateUnlockState() {
        updateActiveStageUI(false);
    },

    /**
     * キーボード（矢印キー、WASD、Enter）での移動および決定入力を処理します。
     */
    handleKeyDown(event) {
        switch (event.code) {
            case 'ArrowLeft':
            case 'KeyA':
                event.preventDefault();
                this.moveAvatar('left');
                break;
            case 'ArrowRight':
            case 'KeyD':
                event.preventDefault();
                this.moveAvatar('right');
                break;
            case 'Enter':
            case 'NumpadEnter':
                event.preventDefault();
                this.startSelectedStage();
                break;
        }
    },

    /**
     * 操作方向に基づき、隣接するアンロック済みノードへ移動させます。
     * @param {string} direction 移動方向 (left / right)
     */
    moveAvatar(direction) {
        const currentIndex = Number(STATE.currentStageIndex);
        const currentCoords = nodeCoords[currentIndex];
        if (!currentCoords) return;

        const candidates = [];
        if (currentIndex > 0) candidates.push(currentIndex - 1);
        if (currentIndex < this.stagesData.length - 1) candidates.push(currentIndex + 1);

        const clearedIndicesRaw = window.getClearedStages ? window.getClearedStages() : [];
        const clearedIndices = clearedIndicesRaw.map(x => Number(x));
        const validCandidates = candidates.filter(idx => {
            const currentCandidateIdx = Number(idx);
            return (currentCandidateIdx === 0) || clearedIndices.includes(currentCandidateIdx - 1);
        });

        let bestTargetIndex = -1;
        let minDistance = Infinity;

        for (const i of validCandidates) {
            const currentCandidateIdx = Number(i);
            const targetCoords = nodeCoords[currentCandidateIdx];
            if (!targetCoords) continue;

            const dx = Number(targetCoords.x) - Number(currentCoords.x);
            const distance = Math.abs(dx);

            let nodeDir = dx > 0 ? 'right' : 'left';

            if (nodeDir === direction) {
                if (distance < minDistance) {
                    minDistance = distance;
                    bestTargetIndex = currentCandidateIdx;
                }
            }
        }

        if (bestTargetIndex !== -1) {
            STATE.currentStageIndex = bestTargetIndex;
            updateActiveStageUI(true); // 方向操作による移動時は強制追従
        }
    },

    /**
     * 仮想操作パッド入力用移動処理（moveAvatarへ委譲）。
     */
    handleMapMovement(direction) {
        this.moveAvatar(direction);
    },

    /**
     * 現在選択中のステージを開始させます。
     */
    startSelectedStage() {
        const currentIndex = Number(STATE.currentStageIndex);
        const clearedIndicesRaw = window.getClearedStages ? window.getClearedStages() : [];
        const clearedIndices = clearedIndicesRaw.map(x => Number(x));
        const isUnlocked = (currentIndex === 0) || clearedIndices.includes(currentIndex - 1);

        if (isUnlocked && typeof this.selectStageCallback === 'function') {
            this.selectStageCallback(currentIndex);
        }
    }
};