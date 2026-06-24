import { STATE, PLAYER, UPGRADE_COSTS, upgradeKeys } from './constants.js';
import { EXTENDED_FALLBACK_STAGES } from './stage-manager.js';

/**
 * プレイヤーの能力、アップグレードコスト、およびスコア（所持銭）をゲーム初期値にリセットします。
 */
export function resetPlayerStatus() {
    PLAYER.maxHp = 100;
    PLAYER.hp = 100;
    PLAYER.speed = 0.5;
    PLAYER.power = 1;
    PLAYER.fireRate = 300;
    PLAYER.regen = 0;
    STATE.score = 0;
    UPGRADE_COSTS.power = 500;
    UPGRADE_COSTS.rate = 800;
    UPGRADE_COSTS.speed = 400;
    UPGRADE_COSTS.hp = 600;
    UPGRADE_COSTS.regen = 700;
    
    savePlayerData();
}

/**
 * ゲームのステージクリア履歴を初期化（削除）します。
 */
export function resetGameProgress() {
    try {
        localStorage.removeItem('non_shogi_progress');
    } catch (e) {
        console.error("クリア情報の初期化に失敗しました:", e);
    }
}

/**
 * localStorage からプレイヤーの能力、所持銭、強化コストをロードします。
 */
export function loadPlayerData() {
    try {
        const json = localStorage.getItem('non_shogi_player_data');
        if (json) {
            const data = JSON.parse(json);
            if (data.score !== undefined) {
                STATE.score = data.score;
            }
            if (data.player) {
                if (data.player.maxHp !== undefined) PLAYER.maxHp = data.player.maxHp;
                if (data.player.speed !== undefined) PLAYER.speed = data.player.speed;
                if (data.player.power !== undefined) PLAYER.power = data.player.power;
                if (data.player.fireRate !== undefined) PLAYER.fireRate = data.player.fireRate;
            }
            if (data.upgradeCosts) {
                if (data.upgradeCosts.power !== undefined) UPGRADE_COSTS.power = data.upgradeCosts.power;
                if (data.upgradeCosts.rate !== undefined) UPGRADE_COSTS.rate = data.upgradeCosts.rate;
                if (data.upgradeCosts.speed !== undefined) UPGRADE_COSTS.speed = data.upgradeCosts.speed;
                if (data.upgradeCosts.hp !== undefined) UPGRADE_COSTS.hp = data.upgradeCosts.hp;
            }
        }
    } catch (e) {
        console.error("プレイヤーデータの読み込みに失敗しました:", e);
    }
    // ロード完了時にHPを最大値に初期化
    PLAYER.hp = PLAYER.maxHp;
}

/**
 * プレイヤーの能力、所持銭、強化コストの現在の状態を localStorage に保存します。
 */
export function savePlayerData() {
    try {
        const data = {
            score: STATE.score,
            player: {
                maxHp: PLAYER.maxHp,
                speed: PLAYER.speed,
                power: PLAYER.power,
                fireRate: PLAYER.fireRate
            },
            upgradeCosts: {
                power: UPGRADE_COSTS.power,
                rate: UPGRADE_COSTS.rate,
                speed: UPGRADE_COSTS.speed,
                hp: UPGRADE_COSTS.hp
            }
        };
        localStorage.setItem('non_shogi_player_data', JSON.stringify(data));
    } catch (e) {
        console.error("プレイヤーデータの保存に失敗しました:", e);
    }
}

/**
 * localStorage からクリア済みのステージ番号の配列を取得します。
 * @returns {Array<number>} クリア済みのステージ番号配列
 */
export function getClearedStages() {
    try {
        const data = localStorage.getItem('non_shogi_progress');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("クリア情報の読み込みに失敗しました:", e);
        return [];
    }
}

/**
 * 指定されたステージ番号をクリア済みとして localStorage に保存します。
 * @param {number} stageNum クリアしたステージの番号
 */
export function saveClearedStage(stageNum) {
    try {
        const cleared = getClearedStages();
        if (!cleared.includes(stageNum)) {
            cleared.push(stageNum);
            localStorage.setItem('non_shogi_progress', JSON.stringify(cleared));
        }
    } catch (e) {
        console.error("クリア情報の保存に失敗しました:", e);
    }
}

/**
 * 現在の進捗（クリア済みステージ）に基づき、出現してアンロックされた駒の一覧を取得します。
 * @returns {Set<string>} アンロックされた駒の名前の Set オブジェクト
 */
export function getUnlockedPieces() {
    const unlocked = new Set();
    unlocked.add('歩');

    const stages = EXTENDED_FALLBACK_STAGES || [];
    const cleared = getClearedStages();

    stages.forEach((stg, index) => {
        let isUnlocked = false;
        if (index === 0) {
            isUnlocked = true;
        } else {
            const prevStage = stages[index - 1];
            if (prevStage && cleared.includes(prevStage.stage)) {
                isUnlocked = true;
            }
        }

        if (isUnlocked) {
            const pieces = [
                '歩', '香', '桂', '銀', '金', '角', '飛', '王', 
                'ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング', 'ヨット'
            ];
            pieces.forEach(p => {
                if (stg[p] && stg[p] > 0) {
                    unlocked.add(p);
                }
            });
        }
    });

    return unlocked;
}

/**
 * 指定された能力のアップグレードを処理します。
 * @param {string} type アップグレード対象の種類 ('power', 'rate', 'speed', 'hp')
 */
export function upgrade(type) {
    if (STATE.score < UPGRADE_COSTS[type]) {
        return;
    }

    // 銭の消費
    STATE.score -= UPGRADE_COSTS[type];

    // 各能力の強化反映
    if (type === 'power') {
        PLAYER.power += 1;
    } else if (type === 'rate') {
        PLAYER.fireRate = Math.max(60, PLAYER.fireRate - 40);
    } else if (type === 'speed') {
        PLAYER.speed += 0.06;
    } else if (type === 'hp') {
        PLAYER.maxHp += 50;
        PLAYER.hp += 50;
    }

    // 必要コストの上昇（1.5倍にして端数切り捨て）
    UPGRADE_COSTS[type] = Math.floor(UPGRADE_COSTS[type] * 1.5);

    // 安全にUI表示を更新し、データを保存
    if (typeof window.updateUI === 'function') {
        window.updateUI();
    }
    savePlayerData();
}

/**
 * 強化項目のインデックス番号からアップグレードを行います。
 * @param {number} index アップグレード項目のインデックス
 */
export function upgradeByIndex(index) {
    const key = upgradeKeys[index];
    if (key) {
        upgrade(key);
    }
}

/**
 * デバッグ用の極限能力解放チートを適用します。
 */
export function activateDebugMode() {
    PLAYER.maxHp = 9999;
    PLAYER.hp = 9999;
    PLAYER.power = 100;
    PLAYER.fireRate = 50;
    PLAYER.speed = 1.2;
    STATE.score = 999999;

    if (typeof window.showMsg === 'function') {
        window.showMsg("神変不可思議（全能力極限解放）");
    }
    if (typeof window.updateUI === 'function') {
        window.updateUI();
    }
    savePlayerData();
}