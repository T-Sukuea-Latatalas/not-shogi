import { STATE, PLAYER, JUMP_FORCE, joystickVector } from './constants.js';

export class InputHandler {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        this.keys = {};
        this.currentTouchMode = false;
        this.touchControlsSetup = false;
        
        this.lookTouchId = null;
        this.lastLookX = 0;
        this.lastLookY = 0;
        this.joystickTouchId = null;
        this.joystickCenter = { x: 0, y: 0 };
        this.maxRadius = 40;
    }

    setTouchMode(isTouch) {
        this.currentTouchMode = isTouch;
        if (isTouch) {
            this.initTouchControls();
        } else {
            const body = document.body;
            if (body) {
                body.classList.remove('touch-device');
            }
        }
    }

    init() {
        try {
            this.setupKeyboardMouseEvents();
        } catch (error) {
            console.error("Failed to setup keyboard/mouse events in InputHandler:", error);
        }
    }

    resetInputs() {
        for (const key in this.keys) {
            this.keys[key] = false;
        }
        PLAYER.isShooting = false;
        joystickVector.x = 0;
        joystickVector.y = 0;
        
        // ダッシュ状態およびUIクラスの確実なリセット
        STATE.dashActive = false;
        const btnDash = document.getElementById('btn-dash');
        if (btnDash) {
            btnDash.classList.remove('active');
        }

        const knob = document.getElementById('joystick-knob');
        if (knob) {
            knob.style.transform = 'translate(0px, 0px)';
        }
    }

    setupKeyboardMouseEvents() {
        let debugKeys = ['d', 'e', 'b', 'u', 'g'];
        let debugIndex = 0;

        window.addEventListener('keydown', e => {
            // テキスト入力欄など、文字入力を伴う要素にフォーカスがある場合はキー判定を無効化
            if (
                e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA' || 
                e.target.isContentEditable
            ) {
                return;
            }

            const stageSelectMenu = document.getElementById('stage-select-menu');
            const isMapVisible = stageSelectMenu && stageSelectMenu.style.display !== 'none';

            // 1. ステージ選択中（マップ表示中）の入力フィルタリング
            if (isMapVisible) {
                if (this.callbacks.onMapMovement) {
                    this.callbacks.onMapMovement(e);
                }
                // マップ表示中でも、店メニュー（ショップ）のTabキー開閉は可能にする
                if (e.code === 'Tab') {
                    e.preventDefault();
                    if (this.callbacks.onToggleShop) this.callbacks.onToggleShop();
                }
                // ショップが開いている場合のショートカット購入
                if (STATE.shopOpen) {
                    let upgradeIndex = -1;
                    if (e.code === 'Digit1' || e.code === 'Numpad1') upgradeIndex = 0;
                    else if (e.code === 'Digit2' || e.code === 'Numpad2') upgradeIndex = 1;
                    else if (e.code === 'Digit3' || e.code === 'Numpad3') upgradeIndex = 2;
                    else if (e.code === 'Digit4' || e.code === 'Numpad4') upgradeIndex = 3;
                    else if (e.code === 'Digit5' || e.code === 'Numpad5') upgradeIndex = 4;

                    if (upgradeIndex !== -1) {
                        e.preventDefault();
                        if (this.callbacks.onUpgradeByIndex) {
                            this.callbacks.onUpgradeByIndex(upgradeIndex);
                        }
                    }
                }
                return; // マップ表示中は戦闘用の移動キーバッファ登録や通常のジャンプ入力を無効化
            }

            // 2. 一時停止（ポーズ）中の入力フィルタリング
            if (STATE.isPaused) {
                if (e.code === 'Escape') {
                    e.preventDefault();
                    if (this.callbacks.onTogglePause) this.callbacks.onTogglePause();
                }
                if (e.code === 'Tab') {
                    e.preventDefault();
                    if (this.callbacks.onToggleShop) this.callbacks.onToggleShop();
                }
                // ショップが開いている場合のショートカット購入
                if (STATE.shopOpen) {
                    let upgradeIndex = -1;
                    if (e.code === 'Digit1' || e.code === 'Numpad1') upgradeIndex = 0;
                    else if (e.code === 'Digit2' || e.code === 'Numpad2') upgradeIndex = 1;
                    else if (e.code === 'Digit3' || e.code === 'Numpad3') upgradeIndex = 2;
                    else if (e.code === 'Digit4' || e.code === 'Numpad4') upgradeIndex = 3;
                    else if (e.code === 'Digit5' || e.code === 'Numpad5') upgradeIndex = 4;

                    if (upgradeIndex !== -1) {
                        e.preventDefault();
                        if (this.callbacks.onUpgradeByIndex) {
                            this.callbacks.onUpgradeByIndex(upgradeIndex);
                        }
                    }
                }
                return; // 一時停止中は戦闘用の移動キーバッファ登録やジャンプ等のアクションを無視
            }

            // 3. 通常戦闘中のショップショートカットキー購入
            if (STATE.shopOpen) {
                let upgradeIndex = -1;
                if (e.code === 'Digit1' || e.code === 'Numpad1') upgradeIndex = 0;
                else if (e.code === 'Digit2' || e.code === 'Numpad2') upgradeIndex = 1;
                else if (e.code === 'Digit3' || e.code === 'Numpad3') upgradeIndex = 2;
                else if (e.code === 'Digit4' || e.code === 'Numpad4') upgradeIndex = 3;
                else if (e.code === 'Digit5' || e.code === 'Numpad5') upgradeIndex = 4;

                if (upgradeIndex !== -1) {
                    e.preventDefault();
                    if (this.callbacks.onUpgradeByIndex) {
                        this.callbacks.onUpgradeByIndex(upgradeIndex);
                    }
                    return; // ショートカット処理時は戦闘用キーバッファへの登録をスキップ
                }
            }

            // 4. 通常戦闘中のキーバッファ登録とアクション
            this.keys[e.code] = true;

            if (e.code === 'Tab') {
                e.preventDefault();
                if (this.callbacks.onToggleShop) this.callbacks.onToggleShop();
            }
            if (e.code === 'Escape') {
                e.preventDefault();
                if (this.callbacks.onTogglePause) this.callbacks.onTogglePause();
            }
            
            if (e.code === 'Space' && PLAYER.isGrounded && !STATE.shopOpen && STATE.stageActive && !STATE.isPaused && !STATE.introActive) {
                if (STATE.playerStunTime <= 0 && !STATE.isCreativeMode) {
                    PLAYER.vy = JUMP_FORCE;
                    PLAYER.isGrounded = false;
                }
            }

            const k = e.key.toLowerCase();
            if (k === debugKeys[debugIndex]) {
                debugIndex++;
                if (debugIndex === debugKeys.length) {
                    if (this.callbacks.onActivateDebug) this.callbacks.onActivateDebug();
                    debugIndex = 0;
                }
            } else {
                if (k === debugKeys[0]) debugIndex = 1;
                else debugIndex = 0;
            }
        });

        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });

        window.addEventListener('mousemove', e => {
            if (!this.currentTouchMode && document.pointerLockElement && STATE.stageActive && !STATE.isPaused && STATE.camera && !STATE.introActive) {
                STATE.camera.rotation.y -= e.movementX * 0.0025;
                STATE.camera.rotation.x = Math.max(-1.4, Math.min(1.4, STATE.camera.rotation.x - e.movementY * 0.0025));
            }
        });

        window.addEventListener('mousedown', (e) => {
            // 右クリックでのショップ購入処理（一時停止中や非戦闘ステージ選択中でも機能させる）
            if (e.button === 2) {
                if (STATE.shopOpen && this.callbacks.onShopRightClick) {
                    this.callbacks.onShopRightClick();
                }
                return;
            }

            // 通常戦闘用のアクション判定
            if (!STATE.stageActive || STATE.isGameOver || STATE.isPaused || STATE.introActive) return;
            if (STATE.shopOpen || this.currentTouchMode) return;

            if (!document.pointerLockElement) {
                document.body.requestPointerLock();
                return;
            }
            
            if (e.button === 0 && STATE.playerStunTime <= 0) {
                PLAYER.isShooting = true;
                if (this.callbacks.onShoot) this.callbacks.onShoot();
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (this.currentTouchMode) return;
            if (e.button === 0) {
                PLAYER.isShooting = false;
                if (this.callbacks.onShootEnd) this.callbacks.onShootEnd();
            }
        });

        window.addEventListener('wheel', e => {
            if (!STATE.shopOpen) return;
            if (this.callbacks.onShopWheel) {
                this.callbacks.onShopWheel(e.deltaY);
            }
        }, { passive: true });
    }

    initTouchControls() {
        if (this.touchControlsSetup) return;

        // HTMLロード中の場合は構築完了まで待機し、要素取得の失敗を防止
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initTouchControls());
            return;
        }

        try {
            this.setupTouchControls();
            this.setupMapTouchControls();
            this.touchControlsSetup = true;

            const body = document.body;
            if (body) {
                body.classList.add('touch-device');
                body.style.touchAction = 'none';
            }

            const uiLayer = document.getElementById('ui-layer');
            if (uiLayer) {
                uiLayer.style.pointerEvents = 'none';
            }

            const shopCloseDesc = document.getElementById('shop-close-desc');
            if (shopCloseDesc) {
                shopCloseDesc.innerHTML = '[店] ボタン または [Tab] キーで閉じる<br>[控] で一時停止<br>項目タップで購入';
            }
        } catch (error) {
            console.error("Failed to initialize touch controls in InputHandler:", error);
        }
    }

    setupTouchControls() {
        window.addEventListener('touchstart', e => {
            if (STATE.shopOpen || STATE.isGameOver || !STATE.stageActive || STATE.isPaused || STATE.introActive) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                let target = touch.target;
                let isUI = false;
                
                while (target && target !== document.body) {
                    if (target.id === 'joystick-outer' || 
                        target.id === 'joystick-knob' || 
                        target.classList.contains('touch-btn') || 
                        target.id === 'shop-menu' ||
                        target.id === 'pause-menu' ||
                        target.id === 'map-touch-controls' ||
                        target.classList.contains('map-touch-btn')) {
                        isUI = true;
                        break;
                    }
                    target = target.parentNode;
                }
                
                if (!isUI && this.lookTouchId === null) {
                    this.lookTouchId = touch.identifier;
                    this.lastLookX = touch.clientX;
                    this.lastLookY = touch.clientY;
                }
            }
        }, { passive: false });

        window.addEventListener('touchmove', e => {
            if (STATE.shopOpen || STATE.isGameOver || !STATE.stageActive || STATE.isPaused || STATE.introActive) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === this.lookTouchId && STATE.camera) {
                    const dx = touch.clientX - this.lastLookX;
                    const dy = touch.clientY - this.lastLookY;
                    
                    STATE.camera.rotation.y -= dx * 0.005; 
                    STATE.camera.rotation.x = Math.max(-1.4, Math.min(1.4, STATE.camera.rotation.x - dy * 0.005));
                    
                    this.lastLookX = touch.clientX;
                    this.lastLookY = touch.clientY;
                    e.preventDefault(); 
                }
            }
        }, { passive: false });

        const endLook = e => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === this.lookTouchId) {
                    this.lookTouchId = null;
                }
            }
        };
        window.addEventListener('touchend', endLook);
        window.addEventListener('touchcancel', endLook);

        const joystickOuter = document.getElementById('joystick-outer');
        const joystickKnob = document.getElementById('joystick-knob');

        if (joystickOuter && joystickKnob) {
            joystickOuter.addEventListener('touchstart', e => {
                if (STATE.shopOpen || STATE.isGameOver || !STATE.stageActive || STATE.isPaused || STATE.introActive) return;
                e.preventDefault();
                const touch = e.changedTouches[0];
                this.joystickTouchId = touch.identifier;
                
                const rect = joystickOuter.getBoundingClientRect();
                this.joystickCenter.x = rect.left + rect.width / 2;
                this.joystickCenter.y = rect.top + rect.height / 2;
            }, { passive: false });

            window.addEventListener('touchmove', e => {
                if (this.joystickTouchId === null) return;
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    if (touch.identifier === this.joystickTouchId) {
                        e.preventDefault();
                        let dx = touch.clientX - this.joystickCenter.x;
                        let dy = touch.clientY - this.joystickCenter.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance > this.maxRadius) {
                            dx = (dx / distance) * this.maxRadius;
                            dy = (dy / distance) * this.maxRadius;
                        }
                        
                        joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
                        joystickVector.x = dx / this.maxRadius;
                        joystickVector.y = dy / this.maxRadius;
                    }
                }
            }, { passive: false });

            const endJoystick = e => {
                if (this.joystickTouchId === null) return;
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    if (touch.identifier === this.joystickTouchId) {
                        this.joystickTouchId = null;
                        joystickKnob.style.transform = 'translate(0px, 0px)';
                        joystickVector.x = 0;
                        joystickVector.y = 0;
                    }
                }
            };
            window.addEventListener('touchend', endJoystick);
            window.addEventListener('touchcancel', endJoystick);
        }

        const addSafeTouchStart = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('touchstart', handler, { passive: false });
        };

        addSafeTouchStart('btn-shoot', e => {
            e.preventDefault();
            if (STATE.shopOpen || STATE.isGameOver || !STATE.stageActive || STATE.isPaused || STATE.playerStunTime > 0 || STATE.introActive) return;
            PLAYER.isShooting = true;
            if (this.callbacks.onShoot) this.callbacks.onShoot();
        });
        
        const btnShoot = document.getElementById('btn-shoot');
        if (btnShoot) {
            btnShoot.addEventListener('touchend', e => {
                e.preventDefault();
                PLAYER.isShooting = false;
                if (this.callbacks.onShootEnd) this.callbacks.onShootEnd();
            }, { passive: false });
            btnShoot.addEventListener('touchcancel', e => {
                PLAYER.isShooting = false;
                if (this.callbacks.onShootEnd) this.callbacks.onShootEnd();
            });
        }

        addSafeTouchStart('btn-jump', e => {
            e.preventDefault();
            if (STATE.shopOpen || STATE.isGameOver || !STATE.stageActive || STATE.isPaused || STATE.playerStunTime > 0 || STATE.introActive) return;
            if (PLAYER.isGrounded) {
                PLAYER.vy = JUMP_FORCE;
                PLAYER.isGrounded = false;
            }
        });

        const btnDash = document.getElementById('btn-dash');
        if (btnDash) {
            btnDash.addEventListener('touchstart', e => {
                // ポーズ中やショップ展開中などは入力を無視（早期リターンを先行させ、他のUI要素への影響を防ぐ）
                if (STATE.shopOpen || STATE.isGameOver || !STATE.stageActive || STATE.isPaused || STATE.introActive) return;

                // 入力が有効な場合のみ既定動作とイベントのバブリングを防止
                e.preventDefault();
                e.stopPropagation();

                STATE.dashActive = !STATE.dashActive;
                if (STATE.dashActive) {
                    btnDash.classList.add('active');
                } else {
                    btnDash.classList.remove('active');
                }
            }, { passive: false });
        }

        addSafeTouchStart('btn-shop', e => {
            e.preventDefault();
            if (STATE.isGameOver || STATE.introActive) return;
            if (this.callbacks.onToggleShop) this.callbacks.onToggleShop();
        });

        addSafeTouchStart('btn-pause', e => {
            e.preventDefault();
            if (STATE.isGameOver || !STATE.stageActive || STATE.introActive) return;
            if (this.callbacks.onTogglePause) this.callbacks.onTogglePause();
        });
    }

    setupMapTouchControls() {
        const mapControls = document.getElementById('map-touch-controls');
        if (mapControls) {
            const buttonConfigs = [
                { id: 'ctrl-up', action: 'up' },
                { id: 'ctrl-down', action: 'down' },
                { id: 'ctrl-left', action: 'left' },
                { id: 'ctrl-right', action: 'right' },
                { id: 'ctrl-ok', action: 'select' }
            ];
            buttonConfigs.forEach(cfg => {
                const btn = document.getElementById(cfg.id);
                if (btn) {
                    const handleDir = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (cfg.action === 'select') {
                            if (this.callbacks.onMapSelect) this.callbacks.onMapSelect();
                        } else {
                            if (this.callbacks.onMapTouchMovement) this.callbacks.onMapTouchMovement(cfg.action);
                        }
                    };

                    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                        btn.addEventListener('touchstart', handleDir, { passive: false });
                    } else {
                        btn.addEventListener('click', handleDir);
                    }
                }
            });
        }
    }
}