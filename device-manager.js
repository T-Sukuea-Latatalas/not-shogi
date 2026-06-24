import { STATE } from './constants.js';

export class DeviceManager {
    constructor(onSelectCallback) {
        this.onSelect = onSelectCallback; // デバイス決定時のコールバック
    }

    init() {
        try {
            const selectScreen = document.getElementById('device-select-screen');
            const titleScreen = document.getElementById('title-screen');
            const btnPC = document.getElementById('btn-select-pc');
            const btnTouch = document.getElementById('btn-select-touch');

            if (selectScreen) {
                selectScreen.style.display = 'flex';
            }
            if (titleScreen) {
                titleScreen.style.display = 'none';
            }

            const handleSelect = (isTouch, e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                try {
                    if (selectScreen) selectScreen.style.display = 'none';
                    if (titleScreen) titleScreen.style.display = 'flex';
                    if (this.onSelect) {
                        this.onSelect(isTouch);
                    }
                } catch (err) {
                    console.error("Device selection process error:", err);
                }
            };

            // マウス環境、タッチ環境、ハイブリッド環境のいずれでも正常に発火するよう両イベントを登録
            if (btnPC) {
                btnPC.addEventListener('touchstart', (e) => handleSelect(false, e), { passive: false });
                btnPC.addEventListener('click', (e) => handleSelect(false, e));
            }

            if (btnTouch) {
                btnTouch.addEventListener('touchstart', (e) => handleSelect(true, e), { passive: false });
                btnTouch.addEventListener('click', (e) => handleSelect(true, e));
            }
        } catch (error) {
            console.error("DeviceManager initialization failed:", error);
        }
    }
}
