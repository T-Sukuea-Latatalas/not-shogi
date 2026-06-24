import { STATE, PLAYER, UPGRADE_COSTS } from './constants.js';
import { Item } from './entities.js'; // 一括撃破時の安全なアイテムドロップ生成用にインポート
import { resetPlayerStatus, resetGameProgress, savePlayerData } from './save-manager.js';
import { MapSystem } from './map-system.js';

// キー入力履歴を保持するバッファ（「debug」の検知用）
const DEBUG_SEQUENCE = 'debug';
let inputQueue = [];

/**
 * 安全にグローバル関数を呼び出すためのヘルパー
 * 関数が存在しない場合でも例外を発生させず、安全にスキップ（または代替動作）します
 */
function safeCall(funcName, ...args) {
    if (typeof window[funcName] === 'function') {
        try {
            return window[funcName](...args);
        } catch (err) {
            console.error(`[Debug] window.${funcName} の実行中にエラーが発生しました:`, err);
        }
    } else {
        console.warn(`[Debug] window.${funcName} は現在利用できません（初期化前、または未定義）。`);
    }
    return null;
}

/**
 * 画面へのメッセージ通知を安全に実行するヘルパー
 * showMsg が未定義の場合は、開発用コンソールへの出力にフォールバックします
 */
function safeShowMsg(msg) {
    if (typeof window.showMsg === 'function') {
        try {
            window.showMsg(msg);
        } catch (err) {
            console.error('[Debug] window.showMsg の実行中にエラーが発生しました:', err);
        }
    } else {
        console.log(`%c[Debug Alert]: ${msg}`, 'color: #00ffff; font-weight: bold;');
    }
}

/**
 * UIの更新とプレイヤーデータのセーブを安全にまとめて呼び出す処理
 */
function safeUpdateAndSave() {
    safeCall('updateUI');
    savePlayerData();
}

/**
 * ゲーム内の最新データ（STATE, PLAYER）からデバッグ画面UIの状態を同期します
 */
function syncDebugPanelFromData() {
    const godMode = document.getElementById('debug-god-mode');
    if (godMode) godMode.checked = !!STATE.isGodMode;

    const freezeEnemies = document.getElementById('debug-freeze-enemies');
    if (freezeEnemies) freezeEnemies.checked = !!STATE.isEnemiesFrozen;

    const creativeMode = document.getElementById('debug-creative-mode');
    if (creativeMode) creativeMode.checked = !!STATE.isCreativeMode;

    const hpRange = document.getElementById('range-debug-hp');
    const hpVal = document.getElementById('val-debug-hp');
    if (hpRange) {
        hpRange.value = PLAYER.hp;
        if (hpVal) hpVal.innerText = Math.round(PLAYER.hp);
    }

    const powerRange = document.getElementById('range-debug-power');
    const powerVal = document.getElementById('val-debug-power');
    if (powerRange) {
        powerRange.value = PLAYER.power;
        if (powerVal) powerVal.innerText = PLAYER.power;
    }

    const rateRange = document.getElementById('range-debug-rate');
    const rateVal = document.getElementById('val-debug-rate');
    if (rateRange) {
        rateRange.value = PLAYER.fireRate;
        if (rateVal) rateVal.innerText = PLAYER.fireRate;
    }

    const speedRange = document.getElementById('range-debug-speed');
    const speedVal = document.getElementById('val-debug-speed');
    if (speedRange) {
        speedRange.value = PLAYER.speed;
        if (speedVal) speedVal.innerText = PLAYER.speed.toFixed(2);
    }

    const scoreRange = document.getElementById('range-debug-score');
    const scoreVal = document.getElementById('val-debug-score');
    if (scoreRange) {
        scoreRange.value = STATE.score;
        if (scoreVal) scoreVal.innerText = STATE.score;
    }
}

/**
 * トグルスイッチ（無敵、一時停止、浮遊）の入力イベントを設定
 */
function setupSwitches() {
    const godMode = document.getElementById('debug-god-mode');
    if (godMode) {
        godMode.addEventListener('change', (e) => {
            STATE.isGodMode = e.target.checked;
            safeShowMsg(STATE.isGodMode ? '金剛不壊 (無敵)：有効' : '金剛不壊 (無敵)：無効');
            safeUpdateAndSave();
        });
    }

    const freezeEnemies = document.getElementById('debug-freeze-enemies');
    if (freezeEnemies) {
        freezeEnemies.addEventListener('change', (e) => {
            STATE.isEnemiesFrozen = e.target.checked;
            safeShowMsg(STATE.isEnemiesFrozen ? '刻の静止 (敵一時停止)：有効' : '刻の静止 (敵一時停止)：無効');
            safeUpdateAndSave();
        });
    }

    const creativeMode = document.getElementById('debug-creative-mode');
    if (creativeMode) {
        creativeMode.addEventListener('change', (e) => {
            STATE.isCreativeMode = e.target.checked;
            safeShowMsg(STATE.isCreativeMode ? '万物浮揚 (空中移動)：有効' : '万物浮揚 (空中移動)：無効');
            safeUpdateAndSave();
        });
    }
}

/**
 * スライドバー（生命、腕力、連射速度、瞬身、所持銭）のリアルタイム更新イベントを設定
 */
function setupSliders() {
    const hpRange = document.getElementById('range-debug-hp');
    const hpVal = document.getElementById('val-debug-hp');
    if (hpRange) {
        hpRange.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            PLAYER.hp = val;
            PLAYER.maxHp = Math.max(PLAYER.maxHp, val); // ゲージ比率の崩れ防止のために最大生命も連動
            if (hpVal) hpVal.innerText = Math.round(val);
            safeUpdateAndSave();
        });
    }

    const powerRange = document.getElementById('range-debug-power');
    const powerVal = document.getElementById('val-debug-power');
    if (powerRange) {
        powerRange.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            PLAYER.power = val;
            if (powerVal) powerVal.innerText = val;
            safeUpdateAndSave();
        });
    }

    const rateRange = document.getElementById('range-debug-rate');
    const rateVal = document.getElementById('val-debug-rate');
    if (rateRange) {
        rateRange.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            PLAYER.fireRate = val;
            if (rateVal) rateVal.innerText = val;
            safeUpdateAndSave();
        });
    }

    const speedRange = document.getElementById('range-debug-speed');
    const speedVal = document.getElementById('val-debug-speed');
    if (speedRange) {
        speedRange.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            PLAYER.speed = val;
            if (speedVal) speedVal.innerText = val.toFixed(2);
            safeUpdateAndSave();
        });
    }

    const scoreRange = document.getElementById('range-debug-score');
    const scoreVal = document.getElementById('val-debug-score');
    if (scoreRange) {
        scoreRange.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            STATE.score = val;
            if (scoreVal) scoreVal.innerText = val;
            safeUpdateAndSave();
        });
    }
}

/**
 * 各種初期化ボタンおよび閉じるボタンのアクションを設定
 */
function setupButtons() {
    const resetStatusBtn = document.getElementById('btn-debug-reset-status');
    if (resetStatusBtn) {
        resetStatusBtn.addEventListener('click', () => {
            try {
                resetPlayerStatus();
                syncDebugPanelFromData();
                safeUpdateAndSave();
                safeShowMsg("能力値を初期化しました");
            } catch (err) {
                console.error('[Debug] resetPlayerStatus 実行エラー:', err);
            }
        });
    }

    const resetProgressBtn = document.getElementById('btn-debug-reset-progress');
    if (resetProgressBtn) {
        resetProgressBtn.addEventListener('click', () => {
            try {
                resetGameProgress();
                // マップのアンロック進捗を即座に再描画・更新
                if (MapSystem && typeof MapSystem.updateMapState === 'function') {
                    MapSystem.updateMapState();
                } else if (MapSystem && typeof MapSystem.updateUnlockState === 'function') {
                    MapSystem.updateUnlockState();
                }
                syncDebugPanelFromData();
                safeUpdateAndSave();
                safeShowMsg("盤上進捗を初期化しました");
            } catch (err) {
                console.error('[Debug] resetGameProgress 実行エラー:', err);
            }
        });
    }

    const closeBtn = document.getElementById('btn-debug-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const debugPanel = document.getElementById('debug-menu-panel');
            if (debugPanel) {
                debugPanel.style.display = 'none';
                STATE.debugMenuOpen = false;
                STATE.isDebugMode = false;
            }
        });
    }
}

/**
 * キーボードイベントのハンドラ
 */
function handleKeyDown(event) {
    // テキスト入力欄など、文字入力を伴う要素にフォーカスがある場合はデバッグ機能を無効化
    if (
        event.target.tagName === 'INPUT' || 
        event.target.tagName === 'TEXTAREA' || 
        event.target.isContentEditable
    ) {
        return;
    }

    const key = event.key.toLowerCase();

    // --- 隠しコマンド判定（d-e-b-u-g キー入力） ---
    inputQueue.push(key);
    if (inputQueue.length > DEBUG_SEQUENCE.length) {
        inputQueue.shift();
    }

    if (inputQueue.join('') === DEBUG_SEQUENCE) {
        // ステータスを極限化
        PLAYER.hp = 9999;
        PLAYER.maxHp = 9999;
        PLAYER.power = 100;
        PLAYER.fireRate = 50;
        PLAYER.speed = 1.2;
        STATE.score = 999999; 

        STATE.isDebugMode = true;
        STATE.debugMenuOpen = true;

        const debugPanel = document.getElementById('debug-menu-panel');
        if (debugPanel) {
            debugPanel.style.display = 'flex';
        }

        syncDebugPanelFromData();
        safeUpdateAndSave();
        safeShowMsg('神変不可思議（全能力極限解放）');

        inputQueue = []; // 判定バッファをクリア
        return;
    }

    // --- 無敵モード（G キー） ---
    if (event.key === 'g' || event.key === 'G') {
        STATE.isGodMode = !STATE.isGodMode;
        const msg = STATE.isGodMode ? '無敵：有効' : '無敵：無効';
        safeShowMsg(msg);
        syncDebugPanelFromData();
        safeUpdateAndSave();
    }

    // --- 敵一括撃破（K キー） ---
    if (event.key === 'k' || event.key === 'K') {
        if (STATE.enemies && Array.isArray(STATE.enemies) && STATE.enemies.length > 0) {
            const activeEnemies = [...STATE.enemies];

            activeEnemies.forEach(enemy => {
                if (!enemy) return;

                if (typeof enemy.takeHit === 'function') {
                    try {
                        enemy.takeHit(999999);
                    } catch (err) {
                        console.error('[Debug] enemy.takeHit 実行エラー:', err);
                    }
                }

                const isBoss = (enemy.type === '王' || enemy.type === 'キング' || enemy.type === 'K' || enemy.type === 'ヨット' || enemy.type === 'Yacht');
                
                if (typeof STATE.score !== 'number') {
                    STATE.score = 0;
                }
                STATE.score += isBoss ? 10000 : 200;

                const dropProb = isBoss ? 1.0 : 0.3;
                if (Math.random() < dropProb && STATE.items) {
                    try {
                        if (enemy.mesh && enemy.mesh.position) {
                            STATE.items.push(new Item(enemy.mesh.position));
                        }
                    } catch (err) {
                        console.error('[Debug] アイテム生成エラー:', err);
                    }
                }

                if (STATE.scene && enemy.mesh) {
                    try {
                        STATE.scene.remove(enemy.mesh);
                    } catch (err) {
                        console.error('[Debug] scene.remove 実行エラー:', err);
                    }
                }

                if (typeof enemy.destroy === 'function') {
                    try {
                        enemy.destroy();
                    } catch (err) {
                        console.error('[Debug] enemy.destroy 実行エラー:', err);
                    }
                }
            });

            STATE.enemies.length = 0;
            syncDebugPanelFromData();
            safeUpdateAndSave();
            safeShowMsg('敵を一括撃破しました');
        }
    }

    // --- ステージ即時クリア（L キー） ---
    if (event.key === 'l' || event.key === 'L') {
        safeCall('showStageClear');
    }

    // --- デバッグ専用画面の表示・非表示トグル（P キー） ---
    if (event.key === 'p' || event.key === 'P') {
        const debugPanel = document.getElementById('debug-menu-panel');
        if (debugPanel) {
            const isHidden = debugPanel.style.display === 'none' || debugPanel.style.display === '';
            debugPanel.style.display = isHidden ? 'flex' : 'none';
            STATE.debugMenuOpen = isHidden;
            STATE.isDebugMode = isHidden;
            syncDebugPanelFromData();
        }
        event.preventDefault();
    }

    // --- 敵の動作停止機能（F キー） ---
    if (event.key === 'f' || event.key === 'F') {
        STATE.isEnemiesFrozen = !STATE.isEnemiesFrozen;
        const msg = STATE.isEnemiesFrozen ? '敵の動作：一時停止' : '敵の動作：通常';
        safeShowMsg(msg);
        syncDebugPanelFromData();
        safeUpdateAndSave();
    }

    // --- クリエイティブモード機能（C キー） ---
    if (event.key === 'c' || event.key === 'C') {
        STATE.isCreativeMode = !STATE.isCreativeMode;
        const msg = STATE.isCreativeMode 
            ? 'クリエイティブモード：有効 (Spaceで上昇 / Cで下降)' 
            : 'クリエイティブモード：無効';
        safeShowMsg(msg);
        syncDebugPanelFromData();
        safeUpdateAndSave();
    }
}

/**
 * デバッグ機能の初期化
 */
function initDebugTools() {
    console.log('%c[開発用プレビュー] デバッグツール起動完了', 'color: #00ff00; font-weight: bold;');
    console.log('--- デバッグショートカット一覧 ---');
    console.log('・d -> e -> b -> u -> g (順番に入力): 隠しデバッグ起動 (ステータス極限化)');
    console.log('・G キー: 無敵モードの切り替え (トグル)');
    console.log('・K キー: 盤上の全敵を撃破 (スコア獲得 ＆ リソースの完全解放)');
    console.log('・L キー: ステージを即時クリア');
    console.log('・P キー: デバッグ調整板（#debug-menu-panel）の表示・非表示のトグル');
    console.log('・F キー: 敵の動作一時停止の切り替え (トグル)');
    console.log('・C キー: クリエイティブモード (自由移動) の切り替え (トグル)');
    console.log('          ※有効時：Spaceキーで上昇、Cキーで下降');
    console.log('----------------------------------');

    // キーボードイベントの登録
    window.addEventListener('keydown', handleKeyDown);

    // 各種スイッチ・スライダー・ボタンの設定
    setupSwitches();
    setupSliders();
    setupButtons();

    // 起動時の初期データ同期
    syncDebugPanelFromData();
}

/**
 * ページの読み込み完了タイミングに応じた制御
 */
if (document.readyState === 'complete') {
    initDebugTools();
} else {
    window.addEventListener('load', initDebugTools);
}