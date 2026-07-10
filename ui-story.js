// ui-story.js - 劇情畫面 + 教學彈窗（core 的 render() 分派進來）
const UIStory = (function () {
    let ctx = null; // core 注入的依賴：{ goToScreen, render, getState, characterSkin, ensureHatChar, setHatExpression, syncHatChars }
    function init(context) { ctx = context; }

    let _tutorialState = null;  // { pages, idx, onDone, key }
    let _storyState = null;     // { lines, idx, playerName, onDone }

    function pagesFor(family, difficulty) {
        if (!family || !difficulty || typeof LevelTutorials === 'undefined') return null;
        const key = family + '-' + difficulty;
        const mapped = (typeof LevelTutorialMap !== 'undefined' && LevelTutorialMap[key]) ? LevelTutorialMap[key] : key;
        const tut = LevelTutorials[mapped];
        return (tut && Array.isArray(tut.pages)) ? tut.pages
             : (tut && Array.isArray(tut)) ? tut
             : null;
    }
    function openTutorialPages(pages, key, onDone) {
        if (!Array.isArray(pages) || !pages.length) return false;
        _tutorialState = {
            pages: pages,
            idx: 0,
            key: key || '',
            onDone: typeof onDone === 'function' ? onDone : function () { ctx.render(); }
        };
        ctx.render();
        return true;
    }

    // 自動教學 gate：有教學頁就開彈窗並回傳 true，沒有則回傳 false。
    function openLevelTutorial(family, difficulty, onDone) {
        const tutKey = family + '-' + difficulty;
        const pages = pagesFor(family, difficulty);
        if (pages && pages.length > 0) {
            _tutorialState = {
                pages: pages,
                idx: 0,
                key: tutKey,
                family: family,
                difficulty: difficulty,
                onDone: onDone
            };
            ctx.render();
            return true;
        }
        return false;
    }

    function renderStory() {
        const whoEl  = document.getElementById('story-who');
        const textEl = document.getElementById('story-text');
        if (!whoEl || !textEl || !_storyState) return;
        const line = _storyState.lines[_storyState.idx];
        if (!line) return;
        const mentorLabel = ctx.characterSkin() === 'grimoire' ? '📖 分類魔導書' : '🎩 分類帽';
        const WHO_LABEL = { hat: mentorLabel, wiz: '🧙 魔法師' };
        whoEl.textContent = WHO_LABEL[line.who] || line.who;
        const raw = line.text || '';
        const name = _storyState.playerName || '';
        textEl.textContent = name ? raw.replace(/\{name\}/g, name) : raw.replace(/\{name\}/g, '你');

        // Drive the sorting-hat character. hat lines use their author-given expr;
        // wiz lines (no other speaker exists) keep the hat present but neutral.
        const hatEl = document.getElementById('story-hat');
        if (hatEl) {
            ctx.ensureHatChar(hatEl);
            const expr = (line.who === 'hat') ? (line.expr || 'neutral') : 'neutral';
            ctx.setHatExpression(hatEl, expr);
        }
    }

    // Open story player. familyKey → looks up StoryScripts[familyKey].
    // onDone() is called after the last line (or if story is empty).
    function openStory(familyKey, onDone) {
        const scripts = (ctx.characterSkin() === 'grimoire' && typeof StoryScriptsGrimoire !== 'undefined')
            ? StoryScriptsGrimoire
            : (typeof StoryScripts !== 'undefined') ? StoryScripts : {};
        const lines = scripts[familyKey];
        if (!lines || lines.length === 0) {
            if (typeof onDone === 'function') onDone();
            return;
        }
        const saveData = (typeof Save !== 'undefined' && Save.get) ? Save.get() : {};
        const playerName = saveData && saveData.playerName ? saveData.playerName : '';
        _storyState = { lines: lines, idx: 0, playerName: playerName, onDone: onDone || null };
        ctx.goToScreen('story');
    }

    function advanceStory() {
        if (!_storyState) return;
        if (_storyState.idx < _storyState.lines.length - 1) {
            _storyState.idx++;
            ctx.render();
        } else {
            // Last line — end story
            const cb = _storyState.onDone;
            _storyState = null;
            if (typeof cb === 'function') {
                cb();
            } else {
                ctx.goToScreen('main-menu');
            }
        }
    }

    function escapeStory() {
        _storyState = null;
        ctx.goToScreen('main-menu');
    }

    function renderTutorialModal() {
        const modal = document.getElementById('modal-tutorial');
        if (!modal) return;
        if (!_tutorialState) { modal.classList.remove('is-open'); return; }
        modal.classList.add('is-open');
        const title = document.getElementById('modal-tutorial-title');
        const body = document.getElementById('modal-tutorial-body');
        const page = _tutorialState.pages[_tutorialState.idx] || {};
        if (title) title.textContent = page.title || '教學';
        if (!body) return;

        // Build slide: [hat + img(s)] on top, text below.
        // page.img may be a string, array, or undefined.
        const imgs = Array.isArray(page.img) ? page.img.slice()
                   : (page.img ? [page.img] : []);
        const expr = page.expr || 'neutral';
        const text = page.text || page.body || page.content || '';

        // Escape helper for src attribute (paths are author-controlled but be safe)
        function attr(s) { return String(s).replace(/"/g, '&quot;'); }
        function esc(s) {
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        let mediaHTML = '';
        if (imgs.length > 0 || expr) {
            const iconClass = imgs.length > 1 ? 'tutorial-icon multi' : 'tutorial-icon';
            const imgHTML = imgs.map(src =>
                '<img class="tutorial-img" src="' + attr(src) + '" alt="">'
            ).join('');
            mediaHTML =
                '<div class="tutorial-slide-media">' +
                    '<div id="tutorial-hat" class="hat-char ' + esc(expr) + '"></div>' +
                    (imgs.length ? '<div class="' + iconClass + '">' + imgHTML + '</div>' : '') +
                '</div>';
        }
        body.innerHTML =
            '<div class="tutorial-slide">' +
                mediaHTML +
                '<p class="tutorial-text">' + esc(text) + '</p>' +
            '</div>';

        // Inject hat inner DOM so CSS face renders.
        const hatEl = body.querySelector('#tutorial-hat');
        ctx.ensureHatChar(hatEl);
    }

    function tutorialPrev() {
        if (_tutorialState && _tutorialState.idx > 0) { _tutorialState.idx--; ctx.render(); }
    }
    function tutorialNext() {
        if (_tutorialState) {
            if (_tutorialState.idx < _tutorialState.pages.length - 1) {
                _tutorialState.idx++;
                ctx.render();
            } else {
                closeTutorialAndContinue();
            }
        }
    }

    function openHelp(kind) {
        if (kind === 'wrong-book') {
            _tutorialState = {
                pages: [
                    {
                        title: '卡片盒記憶法',
                        expr: 'happy',
                        text: '卡片盒記憶法會把題目放進不同熟練度的盒子：越不熟越常練，越熟越往後放，讓複習集中在真正需要訂正的卡片。'
                    },
                    {
                        title: '頁籤代表什麼',
                        expr: 'neutral',
                        text: '待訂正是還沒有訂正成功的卡片；訂正一次、訂正兩次代表已連續答對後升到下一盒；已克服代表已進入第 4 盒，可以批次刪除。'
                    },
                    {
                        title: '訂正規則',
                        expr: 'neutral',
                        text: '訂正答對會累積熟練度並往後升盒；若再次答錯，卡片會回到待訂正。你也可以按單張卡片右上角的 × 自己刪除。'
                    }
                ],
                idx: 0,
                onDone: function () { ctx.goToScreen('wrong-book'); }
            };
            ctx.render();
            return;
        }
        if (kind === 'codex') {
            _tutorialState = {
                pages: [
                    {
                        title: '圖鑑頁籤',
                        expr: 'neutral',
                        text: '分子會顯示已解鎖的化合物；闖關進度記錄各子關完成狀態；勳章是累積成就；劇情會在通關後解鎖。'
                    },
                    {
                        title: '卡片內容',
                        expr: 'happy',
                        text: '已解鎖的分子卡可以點開，查看結構圖、名稱、分類與簡短說明。未解鎖卡片會先以 ??? 顯示。'
                    }
                ],
                idx: 0,
                onDone: function () { ctx.goToScreen('codex'); }
            };
            ctx.render();
        }
    }

    function closeTutorialAndContinue() {
        if (!_tutorialState) return;
        const cb = _tutorialState.onDone;
        if (_tutorialState.family && _tutorialState.difficulty
            && typeof Save !== 'undefined' && Save.markTutorialSeenV2) {
            Save.markTutorialSeenV2(_tutorialState.family, _tutorialState.difficulty);
        }
        _tutorialState = null;
        ctx.render();
        if (typeof cb === 'function') cb();
    }

    return {
        init,
        openStory,
        openTutorialPages,
        openLevelTutorial,
        pagesFor,
        advanceStory,
        escapeStory,
        tutorialPrev,
        tutorialNext,
        closeTutorialAndContinue,
        openHelp,
        renderStory,
        renderTutorialModal
    };
})();
