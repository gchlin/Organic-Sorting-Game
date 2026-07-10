// ui-codex.js - 圖鑑畫面（core 的 render() 分派進來）
const UICodex = (function () {
    let ctx = null; // core 注入的依賴：{ goToScreen, openStory, famCompoundKeys }
    function init(context) { ctx = context; }

    let _codexTab = 'molecules'; // 'molecules' | 'levels' | 'badges' | 'story'

    function renderCodexScreen() {
        const root = document.getElementById('codex-content');
        if (!root) return;
        if (typeof Families === 'undefined' || typeof QuestionImages === 'undefined' || typeof AnswerBank === 'undefined') {
            root.innerHTML = '<p style="text-align:center;color:var(--hp-parchment-dark);">資料載入中…</p>';
            return;
        }

        const save = (typeof Save !== 'undefined' && Save.get) ? Save.get() : {};
        const unlockedBadges = save.badges || [];
        const unlockedMols = save.unlockedMols || [];
        const famKeys = Object.keys(Families);

        // ---- Tab nav ----
        // Compute counts for each tab badge.
        let levelsCleared = 0, levelsTotal = 0;
        let molUnlockedTotal = 0, molTotalAll = 0;
        let storyUnlocked = 0, storyTotal = 0;
        for (const fk of famKeys) {
            const fam = Families[fk];
            for (const diff of (fam.difficulties || [])) {
                levelsTotal++;
                if (unlockedBadges.includes(fk + '-' + diff + '-completed')) levelsCleared++;
            }
            const mks = ctx.famCompoundKeys(fam);
            molTotalAll += mks.length;
            molUnlockedTotal += mks.filter(m => unlockedMols.includes(m.ck)).length;
            if (fam.storyKey) {
                storyTotal++;
                if (typeof Save !== 'undefined' && Save.isStoryUnlockedV2 && Save.isStoryUnlockedV2(fam.storyKey)) storyUnlocked++;
            }
        }
        const allDefs = (typeof Save !== 'undefined' && Save.allBadgeDefs) ? Save.allBadgeDefs() : [];
        const badgesUnlocked = allDefs.filter(d => unlockedBadges.includes(d.id)).length;

        const TABS = [
            { key: 'molecules', label: '分子',     count: molUnlockedTotal + '/' + molTotalAll },
            { key: 'levels',    label: '闖關進度', count: levelsCleared + '/' + levelsTotal },
            { key: 'badges',    label: '勳章',     count: badgesUnlocked + '/' + allDefs.length },
            { key: 'story',     label: '劇情',     count: storyUnlocked + '/' + storyTotal },
        ];

        function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

        let html = '<nav class="codex-tabs" role="tablist">';
        for (const t of TABS) {
            const active = (t.key === _codexTab) ? ' active' : '';
            html += '<button type="button" class="tab' + active + '" data-codex-tab="' + t.key + '">'
                  + esc(t.label) + ' <span class="count">' + esc(t.count) + '</span></button>';
        }
        html += '</nav>';

        html += '<div class="codex-content">';

        // ---- Panel: levels (one card per family-difficulty) ----
        let levelsHTML = '<div class="codex-level-grid">';
        const FAM_VARIANT = { mixed: 'boss', englishChallenge: 'genius' };
        let lvIdx = 0;
        for (const fk of famKeys) {
            const fam = Families[fk];
            const variant = FAM_VARIANT[fk] || '';
            for (const diff of (fam.difficulties || [])) {
                lvIdx++;
                const completedId = fk + '-' + diff + '-completed';
                const masteryId = fk + '-' + diff + '-mastery';
                const cleared = unlockedBadges.includes(completedId);
                const mastered = unlockedBadges.includes(masteryId);
                const locked = !cleared && (fam.lockedUntil && !unlockedBadges.includes(fam.lockedUntil));
                const cls = ['codex-level-card', variant, cleared ? 'cleared' : '', locked ? 'locked' : '', mastered ? 'mastered' : ''].filter(Boolean).join(' ');
                const DIFF_LABEL = { beginner: '初', intermediate: '中', advanced: '高' };
                const stateText = mastered ? '★ 精通' : cleared ? '已通關' : locked ? '🔒 未解鎖' : '尚未通關';
                levelsHTML += '<div class="' + cls + '">'
                    + '<div class="codex-level-head">'
                      + '<span class="codex-level-tag">L' + lvIdx + ' · ' + esc(DIFF_LABEL[diff] || diff) + '</span>'
                      + '<span class="codex-level-state">' + esc(stateText) + '</span>'
                    + '</div>'
                    + '<h3>' + esc(fam.nameZh || fk) + '</h3>'
                    + '<p>' + esc(fam.descZh || '') + '</p>'
                  + '</div>';
            }
        }
        levelsHTML += '</div>';
        html += '<section class="codex-panel' + (_codexTab === 'levels' ? ' active' : '') + '" data-codex-panel="levels">' + levelsHTML + '</section>';

        // ---- Panel: badges ----
        let badgesHTML = '<div class="codex-badge-grid">';
        if (allDefs.length === 0) {
            badgesHTML += '<p class="codex-ach-empty">（暫無勳章定義）</p>';
        } else {
            for (const def of allDefs) {
                const u = unlockedBadges.includes(def.id);
                const cls = 'codex-badge-card ' + (u ? 'unlocked' : 'locked');
                const name = u ? (def.label || def.id) : '???';
                const cond = def.needCorrect
                    ? ('累積答對 ' + def.needCorrect + ' 題' + (u ? '' : '解鎖'))
                    : (def.descZh || def.condition || '');
                let progress = '';
                if (!u && def.needCorrect) {
                    const cur = save.correctTotal || 0;
                    const pct = Math.min(100, Math.round((cur / def.needCorrect) * 100));
                    progress = '<div class="codex-badge-progress"><div class="fill" style="width:' + pct + '%"></div></div>';
                }
                badgesHTML += '<div class="' + cls + '">'
                    + '<div class="codex-badge-icon">' + esc(def.emoji || '🏅') + '</div>'
                    + '<div class="codex-badge-name">' + esc(name) + '</div>'
                    + '<div class="codex-badge-cond">' + esc(cond) + '</div>'
                    + progress
                  + '</div>';
            }
        }
        badgesHTML += '</div>';
        html += '<section class="codex-panel' + (_codexTab === 'badges' ? ' active' : '') + '" data-codex-panel="badges">' + badgesHTML + '</section>';

        // ---- Panel: molecules (per-family sections) ----
        const CAT_LABEL_ZH = { alkane:'烷類', alkene:'烯類', alkyne:'炔類', alcohol:'醇',
            ether:'醚', aldehyde:'醛', ketone:'酮', carboxylic:'羧酸',
            ester:'酯', amine:'胺', halide:'鹵化物', aromatic:'芳香烴', phenol:'酚' };
        let molHTML = '';
        let famIdx = 0;
        for (const fk of famKeys) {
            const fam = Families[fk];
            const items = ctx.famCompoundKeys(fam);
            if (items.length === 0) continue;
            famIdx++;
            const unlockedHere = items.filter(it => unlockedMols.includes(it.ck)).length;
            molHTML += '<div class="codex-molecule-section">'
                + '<h3 class="codex-section-title">'
                  + '<span class="codex-level-tag">L' + famIdx + '</span> '
                  + esc(fam.nameZh || fk)
                  + ' <span class="codex-section-count">' + unlockedHere + '/' + items.length + '</span>'
                + '</h3>'
                + '<div class="codex-mol-grid">';
            for (const it of items) {
                const u = (typeof Save !== 'undefined' && Save.isMolUnlocked) ? Save.isMolUnlocked(it.ck) : unlockedMols.includes(it.ck);
                const ab = AnswerBank[it.ck];
                const nameZh = (ab && ab.content) ? ab.content : it.ck;
                if (u) {
                    const catZh = ab ? (CAT_LABEL_ZH[ab.category] || ab.category || '') : '';
                    const factText = (typeof CompoundFacts !== 'undefined' && CompoundFacts[it.ck]) ? CompoundFacts[it.ck] : '';
                    molHTML += '<button type="button" class="codex-mol-card" data-mol="' + esc(it.ck) + '">'
                        + '<img class="codex-mol-img" src="' + esc(it.src) + '" alt="' + esc(nameZh) + '" loading="lazy">'
                        + '<div class="codex-mol-name">' + esc(nameZh) + '</div>'
                        + '<div class="codex-mol-en">' + esc(it.ck) + '</div>'
                        + '<div class="codex-mol-stamps"><span class="codex-mol-stamp">' + esc(catZh) + '</span></div>'
                        + (factText ? '<div class="codex-mol-fact">' + esc(factText) + '</div>' : '')
                      + '</button>';
                } else {
                    molHTML += '<div class="codex-mol-card locked">'
                        + '<div class="codex-mol-img placeholder"></div>'
                        + '<div class="codex-mol-name">???</div>'
                      + '</div>';
                }
            }
            molHTML += '</div></div>';
        }
        html += '<section class="codex-panel' + (_codexTab === 'molecules' ? ' active' : '') + '" data-codex-panel="molecules">' + molHTML + '</section>';

        // ---- Panel: story ----
        let storyHTML = '<div class="codex-story-grid">';
        let chIdx = 0;
        for (const fk of famKeys) {
            const fam = Families[fk];
            if (!fam.storyKey) continue;
            chIdx++;
            const u = (typeof Save !== 'undefined' && Save.isStoryUnlockedV2) ? Save.isStoryUnlockedV2(fam.storyKey) : false;
            const cls = 'codex-story-card' + (u ? '' : ' locked');
            storyHTML += '<div class="' + cls + '" data-story-key="' + esc(fam.storyKey) + '">'
                + '<div class="ch-header">'
                  + '<span class="ch-num">CH.' + chIdx + '</span>'
                  + '<h3 class="ch-title">' + esc(fam.nameZh || fk) + '</h3>'
                + '</div>'
                + '<p class="ch-preview">' + esc(u ? (fam.storyTeaser || '點擊播放劇情') : '通關後解鎖') + '</p>'
                + '<div class="ch-meta"><span>🎩 分類帽</span><span>' + (u ? '已解鎖' : '未解鎖') + '</span></div>'
              + '</div>';
        }
        storyHTML += '</div>';
        html += '<section class="codex-panel' + (_codexTab === 'story' ? ' active' : '') + '" data-codex-panel="story">' + storyHTML + '</section>';

        html += '</div>'; // close .codex-content
        root.innerHTML = html;

        // Wire tab clicks (no re-render needed — just toggle .active).
        root.querySelectorAll('[data-codex-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                const k = btn.getAttribute('data-codex-tab');
                _codexTab = k;
                root.querySelectorAll('[data-codex-tab]').forEach(b => b.classList.toggle('active', b === btn));
                root.querySelectorAll('[data-codex-panel]').forEach(p => p.classList.toggle('active', p.getAttribute('data-codex-panel') === k));
            });
        });

        // Wire molecule card clicks — toggle open/closed.
        root.querySelectorAll('.codex-mol-card:not(.locked)').forEach(card => {
            card.addEventListener('click', () => {
                const isOpen = card.classList.contains('open');
                root.querySelectorAll('.codex-mol-card.open').forEach(c => c.classList.remove('open'));
                if (!isOpen) card.classList.add('open');
            });
        });

        // Wire story-card clicks for unlocked entries.
        root.querySelectorAll('.codex-story-card:not(.locked)').forEach(card => {
            card.addEventListener('click', () => {
                const sk = card.getAttribute('data-story-key');
                if (sk) ctx.openStory(sk, function () { ctx.goToScreen('codex'); });
            });
        });
    }

    // 深連結：切到「分子」tab 後捲動到指定分子卡（結算頁「看圖鑑 →」用）。
    // 未解鎖的分子沒有 data-mol 卡片，找不到就只停在分子 tab。
    function scrollToMol(molKey) {
        _codexTab = 'molecules';
        renderCodexScreen();
        const sel = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(molKey) : molKey;
        const card = document.querySelector('.codex-mol-card[data-mol="' + sel + '"]');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return { init, render: renderCodexScreen, scrollToMol };
})();
