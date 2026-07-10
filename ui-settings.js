// ui-settings.js - 設定畫面（core 的 render() 分派進來）
const UISettings = (function () {
    let ctx = null; // core 注入的依賴：{ render, syncMusicForScreen, formatKeyCode, escapeHtml, requestConfirm, getCurrentScreen }
    function init(context) { ctx = context; }

    // 快速鍵捕捉：一次只允許一個格子處於捕捉狀態
    let _kbCaptureCleanup = null;

    function renderSettingsScreen() {
        const settings = (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
        // Player tab
        _setChecked('settings-sound-enabled', settings.soundEnabled !== false); // default true
        _setVolumeControl('settings-music-volume', 'settings-music-volume-label', settings.musicVolume, 0.80);
        _setVolumeControl('settings-sfx-volume', 'settings-sfx-volume-label', settings.sfxVolume, 0.30);
        _setChecked('settings-dev-quickwin-enabled', settings.devQuickWin && settings.devQuickWin.enabled);
        _setValue('settings-dev-quickwin-after', settings.devQuickWin && settings.devQuickWin.winAfter);
        _setChecked('settings-dev-quickwin-show-indicator', settings.devQuickWin && settings.devQuickWin.showIndicator);
        _setChecked('settings-dev-character-hat', settings.characterSkin === 'hat');
        _setChecked('settings-dev-show-fps', settings.devShowFps);
        _setChecked('settings-dev-log-actions', settings.devLogActions);
        _setChecked('settings-dev-use-legacy-sounds', settings.devUseLegacySounds);
        // Scoring settings
        const sc = (settings && settings.scoring) ? settings.scoring : {};
        _setValue('settings-score-practice-base',   sc.practiceBaseScore    ?? 10);
        _setValue('settings-score-practice-wrong',  sc.practiceWrongPenalty ?? 10);
        _setValue('settings-score-practice-combo3', sc.practiceCombo3Score  ?? 30);
        _setValue('settings-score-practice-combo5', sc.practiceCombo5Score  ?? 40);
        _setValue('settings-score-practice-combo7', sc.practiceCombo7Score  ?? 60);
        _setValue('settings-score-duel-base',       sc.duelBaseScore        ?? 100);
        _setValue('settings-score-duel-min',        sc.duelMinScore         ?? 20);
        _setValue('settings-score-duel-wrong',      sc.duelWrongPenalty     ?? 50);
        _setValue('settings-score-duel-target',     sc.duelScoreTarget      ?? 300);
        _setValue('settings-dynamic-fast-forward',  sc.dynamicFastForwardMs ?? 900);
        // PvE AI params
        var pveAI = (settings && settings.pveAI) ? settings.pveAI : {};
        ['easy', 'medium', 'hard'].forEach(function (diff) {
            var p = (pveAI[diff] && typeof pveAI[diff] === 'object') ? pveAI[diff] : {};
            _setValue('pveai-' + diff + '-buzzWindowMin',  p.buzzWindowMin);
            _setValue('pveai-' + diff + '-buzzWindowMax',  p.buzzWindowMax);
            _setValue('pveai-' + diff + '-answerThinkMin', p.answerThinkMin);
            _setValue('pveai-' + diff + '-answerThinkMax', p.answerThinkMax);
        });
        _renderKeybindingsList(settings.keybindings || {});
    }

    // 快速鍵分組（顯示順序＝畫面順序；layout: 'grid2x2' 對應 2×2 選項版面）
    const _KEYBIND_GROUPS = [
        { title: '左方 答題', layout: 'grid2x2', rows: [
            { id: 'optionLeft0', label: '左上' },
            { id: 'optionLeft1', label: '右上' },
            { id: 'optionLeft2', label: '左下' },
            { id: 'optionLeft3', label: '右下' }
        ]},
        { title: '右方 答題（PvP）／練習替代輸入', layout: 'grid2x2', rows: [
            { id: 'optionRight0', label: '左上' },
            { id: 'optionRight1', label: '右上' },
            { id: 'optionRight2', label: '左下' },
            { id: 'optionRight3', label: '右下' }
        ]},
        { title: '搶答', layout: 'row2', rows: [
            { id: 'buzzP1', label: '左方 搶答' },
            { id: 'buzzP2', label: '右方 搶答' }
        ]},
        { title: '取消搶答（只對自己回合有效）', layout: 'row2', rows: [
            { id: 'giveUpP1', label: '左方 取消' },
            { id: 'giveUpP2', label: '右方 取消' }
        ]}
    ];

    // 系統快速鍵：只顯示、不可改
    const _KEYBIND_READONLY_GROUPS = [
        { title: '選單操作（不可改）', layout: 'row2', rows: [
            { label: '移動焦點',  code: '↑ ↓ ← →' },
            { label: '啟動所選項', code: 'Enter / Space' }
        ]},
        { title: '畫面導航（不可改）', layout: 'row2', rows: [
            { label: '返回 / 離開', code: 'Esc / M' }
        ]},
        { title: '劇情播放（不可改）', layout: 'row2', rows: [
            { label: '推進對話', code: 'Space / Enter' },
            { label: '離開劇情', code: 'Esc' }
        ]}
    ];

    function _renderKeybindingsList(bindings) {
        const root = document.getElementById('keybindings-list');
        if (!root) return;
        root.innerHTML = '';
        _KEYBIND_GROUPS.forEach(function (group) {
            const h = document.createElement('div');
            h.className = 'v2-kb-group-title';
            h.textContent = group.title;
            root.appendChild(h);
            const grid = document.createElement('div');
            grid.className = 'v2-kb-grid v2-kb-' + (group.layout || 'list');
            group.rows.forEach(function (row) {
                const cell = document.createElement('div');
                cell.className = 'v2-kb-cell';
                const lbl = document.createElement('span');
                lbl.className = 'v2-kb-label';
                lbl.textContent = row.label;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'v2-kb-key';
                btn.setAttribute('data-kb-id', row.id);
                btn.textContent = ctx.formatKeyCode(bindings[row.id]);
                cell.appendChild(lbl);
                cell.appendChild(btn);
                grid.appendChild(cell);
            });
            root.appendChild(grid);
        });
        // Read-only system keys
        _KEYBIND_READONLY_GROUPS.forEach(function (group) {
            const h = document.createElement('div');
            h.className = 'v2-kb-group-title';
            h.textContent = group.title;
            root.appendChild(h);
            const grid = document.createElement('div');
            grid.className = 'v2-kb-grid v2-kb-' + (group.layout || 'list');
            group.rows.forEach(function (row) {
                const cell = document.createElement('div');
                cell.className = 'v2-kb-cell';
                const lbl = document.createElement('span');
                lbl.className = 'v2-kb-label';
                lbl.textContent = row.label;
                const key = document.createElement('span');
                key.className = 'v2-kb-key is-readonly';
                key.textContent = row.code;
                cell.appendChild(lbl);
                cell.appendChild(key);
                grid.appendChild(cell);
            });
            root.appendChild(grid);
        });
    }
    function _setChecked(id, v) {
        const el = document.getElementById(id);
        if (el) el.checked = !!v;
    }
    function _setValue(id, v) {
        const el = document.getElementById(id);
        if (el && typeof v !== 'undefined' && v !== null) el.value = String(v);
    }
    function _setVolumeControl(inputId, labelId, value, fallback) {
        const n = (typeof value === 'number') ? value : fallback;
        const pct = Math.round(Math.max(0, Math.min(1, n)) * 100);
        const input = document.getElementById(inputId);
        const label = document.getElementById(labelId);
        if (input) input.value = String(pct);
        if (label) label.textContent = pct + '%';
    }

    function _wireKeybindingsCapture() {
        const root = document.getElementById('keybindings-list');
        if (!root) return;
        root.addEventListener('click', function (e) {
            const btn = e.target.closest && e.target.closest('.v2-kb-key');
            if (!btn || btn.classList.contains('is-readonly')) return;
            _startKeybindingCapture(btn);
        });
    }
    function _startKeybindingCapture(btn) {
        if (_kbCaptureCleanup) _kbCaptureCleanup();
        const id = btn.getAttribute('data-kb-id');
        btn.classList.add('is-capturing');
        btn.textContent = '按下任一鍵…';
        function onKey(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].indexOf(ev.code) !== -1) {
                return;
            }
            cleanup();
            if (ev.code === 'Escape') { renderSettingsScreen(); return; }
            // 找出衝突的 binding，若有 → 交換到舊鍵
            const current = Save.readSettings().keybindings || {};
            const oldCode = current[id];
            const patch = {};
            patch[id] = ev.code;
            for (const otherId of Object.keys(current)) {
                if (otherId !== id && current[otherId] === ev.code) {
                    patch[otherId] = oldCode;  // 交換
                }
            }
            Save.writeSettings({ keybindings: patch });
            renderSettingsScreen();
        }
        function cleanup() {
            document.removeEventListener('keydown', onKey, true);
            btn.classList.remove('is-capturing');
            _kbCaptureCleanup = null;
        }
        _kbCaptureCleanup = cleanup;
        document.addEventListener('keydown', onKey, true);
    }

    function attachSettingsListeners() {
        const map = [
            ['settings-sound-enabled', 'checkbox', function (v) {
                Save.writeSettings({ soundEnabled: v });
                ctx.syncMusicForScreen(ctx.getCurrentScreen());
            }],
            ['settings-music-volume', 'volume', function (v) {
                Save.writeSettings({ musicVolume: v });
                ctx.syncMusicForScreen(ctx.getCurrentScreen());
                _setVolumeControl('settings-music-volume', 'settings-music-volume-label', v, 0.80);
            }],
            ['settings-sfx-volume', 'volume', function (v) {
                Save.writeSettings({ sfxVolume: v });
                _setVolumeControl('settings-sfx-volume', 'settings-sfx-volume-label', v, 0.30);
            }],
            ['settings-dev-quickwin-enabled', 'checkbox', function (v) {
                Save.writeSettings({ devQuickWin: { enabled: v } });
            }],
            ['settings-dev-quickwin-after', 'number', function (v) {
                Save.writeSettings({ devQuickWin: { winAfter: v } });
            }],
            ['settings-dev-quickwin-show-indicator', 'checkbox', function (v) {
                Save.writeSettings({ devQuickWin: { showIndicator: v } });
            }],
            ['settings-dev-character-hat', 'checkbox', function (v) {
                Save.writeSettings({ characterSkin: v ? 'hat' : 'grimoire' });
            }],
            ['settings-dev-show-fps', 'checkbox', function (v) {
                Save.writeSettings({ devShowFps: v });
            }],
            ['settings-dev-log-actions', 'checkbox', function (v) {
                Save.writeSettings({ devLogActions: v });
            }],
            ['settings-dev-use-legacy-sounds', 'checkbox', function (v) {
                Save.writeSettings({ devUseLegacySounds: v });
            }],
        ];
        // 分數設定（scoring sub-object）
        const scoreMap = [
            ['settings-score-practice-base',   'practiceBaseScore'],
            ['settings-score-practice-wrong',  'practiceWrongPenalty'],
            ['settings-score-practice-combo3', 'practiceCombo3Score'],
            ['settings-score-practice-combo5', 'practiceCombo5Score'],
            ['settings-score-practice-combo7', 'practiceCombo7Score'],
            ['settings-score-duel-base',       'duelBaseScore'],
            ['settings-score-duel-min',        'duelMinScore'],
            ['settings-score-duel-wrong',      'duelWrongPenalty'],
            ['settings-score-duel-target',     'duelScoreTarget'],
            ['settings-dynamic-fast-forward',  'dynamicFastForwardMs'],
        ];
        for (const [id, field] of scoreMap) {
            const el = document.getElementById(id);
            if (!el) continue;
            el.addEventListener('change', function () {
                const v = Math.max(0, Number(el.value) || 0);
                const patch = {}; patch[field] = v;
                Save.writeSettings({ scoring: patch });
            });
        }
        for (let i = 0; i < map.length; i++) {
            const [id, kind, setter] = map[i];
            const el = document.getElementById(id);
            if (!el) continue;
            el.addEventListener(kind === 'volume' ? 'input' : 'change', function () {
                const v = (kind === 'checkbox') ? !!el.checked
                        : (kind === 'number') ? Math.max(1, Number(el.value) || 1)
                        : (kind === 'volume') ? Math.max(0, Math.min(1, (Number(el.value) || 0) / 100))
                        : el.value;
                setter(v);
                ctx.render();
            });
        }
        // PvE AI number inputs (live-update settings.pveAI)
        ['easy', 'medium', 'hard'].forEach(function (diff) {
            ['buzzWindowMin', 'buzzWindowMax', 'answerThinkMin', 'answerThinkMax'].forEach(function (field) {
                const elId = 'pveai-' + diff + '-' + field;
                const el = document.getElementById(elId);
                if (!el) return;
                el.addEventListener('change', function () {
                    const raw = parseFloat(el.value);
                    if (isNaN(raw)) return;
                    const val = (field === 'buzzWindowMin' || field === 'buzzWindowMax')
                        ? Math.min(1, Math.max(0, raw))
                        : Math.max(0, raw);
                    const patch = {};
                    patch[diff] = {};
                    patch[diff][field] = val;
                    Save.writeSettings({ pveAI: patch });
                });
            });
        });
        // PvE AI reset-to-default button
        const pveaiReset = document.getElementById('settings-pveai-reset');
        if (pveaiReset) {
            pveaiReset.addEventListener('click', function () {
                Save.writeSettings({ pveAI: {
                    easy:   { buzzWindowMin: 0.85, buzzWindowMax: 0.95, answerThinkMin: 1500, answerThinkMax: 3000 },
                    medium: { buzzWindowMin: 0.75, buzzWindowMax: 0.90, answerThinkMin: 1200, answerThinkMax: 2500 },
                    hard:   { buzzWindowMin: 0.70, buzzWindowMax: 0.85, answerThinkMin: 1000, answerThinkMax: 2000 }
                }});
                renderSettingsScreen();
            });
        }
        // 快速鍵：點擊任一格 → 進入「按下新鍵」捕捉狀態
        _wireKeybindingsCapture();
        const kbReset = document.getElementById('settings-keys-reset');
        if (kbReset) {
            kbReset.addEventListener('click', function () {
                const def = (Save && Save.defaultKeybindings) ? Save.defaultKeybindings() : {};
                Save.writeSettings({ keybindings: def });
                renderSettingsScreen();
            });
        }
        // Tab switching
        document.querySelectorAll('#screen-settings .v2-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                const which = tab.getAttribute('data-tab');
                document.querySelectorAll('#screen-settings .v2-tab').forEach(function (t) {
                    t.classList.toggle('is-active', t === tab);
                });
                document.querySelectorAll('#screen-settings .v2-tab-panel').forEach(function (p) {
                    p.classList.toggle('is-active', p.getAttribute('data-tab-panel') === which);
                });
            });
        });
        // Save tab buttons
        const resetWrong = document.getElementById('settings-wrong-book-reset');
        if (resetWrong) resetWrong.addEventListener('click', function () {
            ctx.requestConfirm('確定要清空整個錯題本？此動作無法復原。', function () { Save.clearWrongLog(); ctx.render(); });
        });
        const resetBtn = document.getElementById('settings-reset-button');
        if (resetBtn) resetBtn.addEventListener('click', function () {
            ctx.requestConfirm('確定要重置全部存檔？所有進度將消失。', function () { Save.reset(); ctx.render(); });
        });
        const exportBtn = document.getElementById('settings-export-button');
        if (exportBtn) exportBtn.addEventListener('click', function () {
            const text = Save.exportText();
            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'organic-sorting-save.json';
            a.click();
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        });
        const importBtn = document.getElementById('settings-import-button');
        if (importBtn) importBtn.addEventListener('click', function () {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.addEventListener('change', function () {
                const file = input.files && input.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function () {
                    if (Save.importText(String(reader.result))) {
                        ctx.render();
                    }
                };
                reader.readAsText(file);
            });
            input.click();
        });
    }

    return { init, render: renderSettingsScreen, attachListeners: attachSettingsListeners };
})();
