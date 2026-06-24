import { STATE, SPREADSHEET_ID, SHEET_GID } from './constants.js';
import { MapSystem } from './map-system.js';

/**
 * スプレッドシートのロードに失敗した場合、またはデフォルトとして使用される
 * 予備の 17 件のステージデータ配列。
 */
export const EXTENDED_FALLBACK_STAGES = [
    { stage: 1, name: "第1局", 歩: 3 },
    { stage: 2, name: "第2局", 歩: 5, 香: 1 },
    { stage: 3, name: "第3局", 歩: 4, 香: 2, 桂: 1 },
    { stage: 4, name: "第4局", 歩: 6, 香: 2, 桂: 2, 銀: 1 },
    { stage: 5, name: "第5局", 歩: 5, 香: 3, 桂: 2, 銀: 2, 金: 1 },
    { stage: 6, name: "第6局", 歩: 8, 香: 2, 桂: 2, 銀: 2, 金: 2, 角: 1 },
    { stage: 7, name: "第7局", 歩: 6, 香: 4, 桂: 3, 銀: 3, 金: 2, 角: 1, 飛: 1 },
    { stage: 8, name: "第8局", 歩: 10, 香: 3, 桂: 3, 銀: 3, 金: 3, 角: 2, 飛: 1 },
    { stage: 9, name: "第9局", 歩: 8, 香: 4, 桂: 4, 銀: 4, 金: 4, 角: 2, 飛: 2 },
    { stage: 10, name: "第10局", 歩: 12, 香: 5, 桂: 4, 銀: 4, 金: 4, 角: 2, 飛: 2, 王: 1 },
    { stage: 11, name: "異界の尖兵", 歩: 4, 銀: 2, ポーン: 6, ナイト: 2 },
    { stage: 12, name: "黒鉄の城塞", 歩: 2, 銀: 4, 金: 2, ポーン: 4, ルーク: 3 },
    { stage: 13, name: "天空の支配者", 銀: 2, 金: 2, 角: 2, 飛: 2, ポーン: 2, ナイト: 2, ビショップ: 2, クイーン: 2 },
    { stage: 14, name: "漆黒の盤上遊戯", 歩: 5, 香: 2, 桂: 2, 銀: 3, 金: 3, 角: 2, 飛: 2, ポーン: 8, ナイト: 4, ビショップ: 4, ルーク: 2, クイーン: 1 },
    { stage: 15, name: "覇王と皇帝", 歩: 4, 香: 2, 桂: 2, 銀: 4, 金: 4, 角: 3, 飛: 3, 王: 1, ポーン: 10, ナイト: 6, ビショップ: 4, ルーク: 4, クイーン: 2, キング: 1 },
    { stage: 16, name: "盤上の支配者・ヨット", 歩: 2, ポーン: 2, ヨット: 1 },
    { stage: 50, name: "盤上最終決戦", 歩: 15, 香: 8, 桂: 8, 銀: 8, 金: 8, 角: 5, 飛: 5, 王: 1, ポーン: 20, ナイト: 10, ビショップ: 10, ルーク: 8, クイーン: 4, キング: 2, ヨット: 1 }
];

/**
 * 敵が1体以上存在するステージのみを抽出して配列として返します。
 * @param {Array} stageList フィルタリング対象のステージ配列
 * @returns {Array} 敵が存在するステージのみの配列
 */
export function filterEmptyStages(stageList) {
    if (!stageList) return [];
    const enemyTypes = [
        '歩', '香', '桂', '銀', '金', '角', '飛', '王', 
        'ポーン', 'ナイト', 'ビショップ', 'ルーク', 'クイーン', 'キング', 'ヨット'
    ];
    return stageList.filter(stg => {
        let totalEnemies = 0;
        enemyTypes.forEach(type => {
            totalEnemies += (stg[type] || 0);
        });
        return totalEnemies > 0;
    });
}

/**
 * CSV テキストデータを解析してオブジェクトの配列に変換します。
 * ダブルクォーテーションの剥離処理を安全に行います。
 * @param {string} text CSVデータテキスト
 * @returns {Array} パースされたオブジェクト配列
 */
export function parseCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return [];
    
    let delimiter = ',';
    if (lines[0].includes('\t')) delimiter = '\t';
    else if (lines[0].includes(';')) delimiter = ';';

    function splitCSVLine(line, delim) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' || char === "'") {
                inQuotes = !inQuotes;
            } else if (char === delim && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    const headers = splitCSVLine(lines[0], delimiter).map(h => h.replace(/^[\uFEFF"']|["']$/g, ''));
    const parsed = [];
    
    for (let i = 1; i < lines.length; i++) {
        const cols = splitCSVLine(lines[i], delimiter).map(c => c.replace(/^["']|["']$/g, ''));
        if (cols.length < headers.length) continue;
        
        const rowObj = {};
        headers.forEach((header, index) => {
            const val = cols[index];
            if (header === 'stage') {
                rowObj[header] = parseInt(val, 10);
            } else if (header === 'name') {
                rowObj[header] = val;
            } else {
                rowObj[header] = parseInt(val, 10) || 0;
            }
        });
        parsed.push(rowObj);
    }
    return parsed;
}

/**
 * 予備データ（フォールバック用）を用いてステージマップを初期化します。
 * @param {Function} selectStageCallback ステージが選択された際のコールバック関数
 */
export function startWithFallback(selectStageCallback) {
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    // 予備ステージデータをディープコピーしてフィルタリング
    STATE.stages = filterEmptyStages(JSON.parse(JSON.stringify(EXTENDED_FALLBACK_STAGES)));
    
    // マップシステムの初期化
    MapSystem.init(STATE.stages, selectStageCallback);
    
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    
    const stageSelectMenu = document.getElementById('stage-select-menu');
    if (stageSelectMenu) {
        stageSelectMenu.style.display = 'flex';
        MapSystem.show();
    }
}

/**
 * Google Sheets から動的にステージデータを取得・パースしてマップを初期化します。
 * 取得に失敗した場合は予備データでの初期化処理を呼び出します。
 * @param {Function} selectStageCallback ステージが選択された際のコールバック関数
 */
export async function loadStages(selectStageCallback) {
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    let input = SPREADSHEET_ID.trim();
    let cleanedId = input;
    if (cleanedId.includes('/d/')) {
        cleanedId = cleanedId.split('/d/')[1].split('/')[0];
    }

    const url = `https://docs.google.com/spreadsheets/d/${cleanedId}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

    try {
        if (cleanedId === "" || cleanedId.includes("YOUR_SPREADSHEET_ID")) {
            throw new Error("有効なスプレッドシートID、またはURLが設定されていません。");
        }
        
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Fetch 失敗、ステータス: ${res.status}`);
        }
        
        const csvText = await res.text();
        const parsed = parseCSV(csvText);
        
        STATE.stages = filterEmptyStages(parsed);
        
        if (STATE.stages.length === 0) {
            throw new Error("パースされたステージデータが空です。");
        }

        MapSystem.init(STATE.stages, selectStageCallback);
        
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        const stageSelectMenu = document.getElementById('stage-select-menu');
        if (stageSelectMenu) {
            stageSelectMenu.style.display = 'flex';
            MapSystem.show();
        }
    } catch (e) {
        console.warn("スプレッドシートのロードに失敗しました。ローカル予備ステージデータを使用します。", e);
        startWithFallback(selectStageCallback);
    }
}