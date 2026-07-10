// ui-wrong-book.js - 錯題本畫面（core 的 render() 分派進來）
const UIWrongBook = (function () {
    let ctx = null; // core 注入的依賴：{ findImageFor, startMode, render, goToScreen, requestConfirm }
    function init(context) { ctx = context; }

    let _wrongBookTab = 'category'; // 'category' | 'all' | 'box1' | 'box2' | 'box3' | 'mastered'

    function renderWrongBookScreen() {
        const root = document.getElementById('wrong-book-groups');
        if (!root) return;
        const all = (typeof Save !== 'undefined' && Save.getAllActiveWrongs)
            ? Save.getAllActiveWrongs() : {};
        const keys = Object.keys(all);
        if (keys.length === 0) {
            root.innerHTML = '<div class="v2-wrong-empty">目前沒有錯題</div>';
            return;
        }

        const DIFF_NAME = { beginner: '初級', intermediate: '中級', advanced: '高級' };
        const tabs = [
            { key: 'category', label: '依類別' },
            { key: 'all', label: '全部' },
            { key: 'box1', label: '待訂正' },
            { key: 'box2', label: '訂正一次' },
            { key: 'box3', label: '訂正兩次' },
            { key: 'mastered', label: '已克服' }
        ];

        function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
        function tabMatches(entry) {
            if (_wrongBookTab === 'all' || _wrongBookTab === 'category') return true;
            if (_wrongBookTab === 'box1') return entry.box <= 1;
            if (_wrongBookTab === 'box2') return entry.box === 2;
            if (_wrongBookTab === 'box3') return entry.box === 3;
            if (_wrongBookTab === 'mastered') return entry.box >= 4;
            return true;
        }

        const groups = [];
        const counts = { category: 0, all: 0, box1: 0, box2: 0, box3: 0, mastered: 0 };
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]; // 'family-difficulty'
            const dashIdx = key.lastIndexOf('-');
            if (dashIdx === -1) continue;
            const family = key.slice(0, dashIdx);
            const difficulty = key.slice(dashIdx + 1);
            const fam = (typeof Families !== 'undefined') ? Families[family] : null;
            const entries = (Save.getWrongEntriesV2)
                ? Save.getWrongEntriesV2(family, difficulty)
                : all[key].map(function (ck) { return { compoundKey: ck, box: 1, correctStreak: 0 }; });
            entries.forEach(function (e) {
                counts.category++;
                counts.all++;
                if (e.box <= 1) counts.box1++;
                else if (e.box === 2) counts.box2++;
                else if (e.box === 3) counts.box3++;
                else if (e.box >= 4) counts.mastered++;
            });
            const filtered = entries.filter(tabMatches);
            if (!filtered.length) continue;
            groups.push({ key: key, family: family, difficulty: difficulty, fam: fam, entries: filtered, allEntries: entries });
        }

        let html = '<nav class="codex-tabs v2-wrong-tabs" role="tablist">';
        for (const t of tabs) {
            const active = (_wrongBookTab === t.key) ? ' active' : '';
            html += '<button type="button" class="tab' + active + '" data-wrong-tab="' + t.key + '">'
                + esc(t.label) + ' <span class="count">' + esc(counts[t.key]) + '</span></button>';
        }
        html += '</nav>';

        if (!groups.length) {
            html += '<div class="v2-wrong-empty">這個頁籤目前沒有卡片</div>';
            root.innerHTML = html;
            wireWrongBookTabs(root);
            return;
        }

        html += '<div class="v2-wrong-group-list' + (_wrongBookTab === 'category' ? '' : ' is-flat') + '">';
        for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            const masteredCount = g.allEntries.filter(function (e) { return e.box >= 4; }).length;
            const practiceCount = g.allEntries.length - masteredCount;
            const title = (g.fam ? g.fam.nameZh : g.family) + ' ' + (DIFF_NAME[g.difficulty] || g.difficulty)
                + ' 共' + g.allEntries.length + '題 要練習';
            const groupTag = g.family + '|' + g.difficulty;
            const filteredKeys = g.entries.map(function (e) { return e.compoundKey; }).join(',');

            html += '<details class="v2-wrong-group" open data-wrong-group="' + esc(groupTag) + '">'
                + '<summary class="v2-wrong-summary">'
                    + '<span class="v2-wrong-summary-title">' + esc(title) + '</span>'
                    + '<span class="v2-wrong-summary-meta">練習中 ' + practiceCount + ' / 已克服 ' + masteredCount + '</span>'
                + '</summary>'
                + '<div class="v2-wrong-cards">';

            for (let j = 0; j < g.entries.length; j++) {
                const family = g.family;
                const difficulty = g.difficulty;
                const entry = g.entries[j];
                const ck = entry.compoundKey;
                const bank = (typeof AnswerBank !== 'undefined') ? AnswerBank[ck] : null;
                const img = ctx.findImageFor(ck);
                const boxDots = '●'.repeat(entry.box) + '○'.repeat(5 - entry.box);
                const masteredClass = entry.box >= 4 ? ' mastered' : '';
                html += '<div class="v2-wrong-card box-' + entry.box + masteredClass + '">'
                    + '<img src="' + esc(img || '') + '" alt="">'
                    + '<div class="name-zh">' + esc(bank ? bank.content : ck) + '</div>'
                    + '<div class="box-indicator" title="卡片盒層級 ' + entry.box + '/5">' + boxDots + '</div>'
                    + '<button type="button" class="v2-wrong-delete" data-wrong-delete="' + esc(groupTag + '|' + ck) + '" title="從錯題本移除">×</button>'
                + '</div>';
            }
            html += '</div><div class="v2-wrong-actions">'
                + '<button type="button" data-wrong-retrain="' + esc(groupTag) + '" data-wrong-keys="' + esc(filteredKeys) + '">重練目前篩選 (' + g.entries.length + ' 題)</button>';
            if (masteredCount > 0) {
                html += '<button type="button" class="v2-wrong-purge" data-wrong-purge="' + esc(groupTag) + '">刪除已克服 (' + masteredCount + ' 題)</button>';
            }
            html += '</div></details>';
        }
        html += '</div>';
        root.innerHTML = html;
        wireWrongBookTabs(root);
        wireWrongBookActions(root);
    }

    function wireWrongBookTabs(root) {
        root.querySelectorAll('[data-wrong-tab]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                _wrongBookTab = btn.getAttribute('data-wrong-tab') || 'category';
                renderWrongBookScreen();
            });
        });
    }

    function wireWrongBookActions(root) {
        root.querySelectorAll('[data-wrong-retrain]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const parts = (btn.getAttribute('data-wrong-retrain') || '').split('|');
                const keys = (btn.getAttribute('data-wrong-keys') || '').split(',').filter(Boolean);
                ctx.startMode({ mode: 'practice', family: parts[0], difficulty: parts[1], opponent: 'human', queueSource: 'wrongOnly', wrongKeys: keys });
            });
        });
        root.querySelectorAll('[data-wrong-delete]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                const parts = (btn.getAttribute('data-wrong-delete') || '').split('|');
                if (Save.deleteWrongV2) {
                    Save.deleteWrongV2(parts[0], parts[1], parts[2]);
                    ctx.render();
                }
            });
        });
        root.querySelectorAll('[data-wrong-purge]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const parts = (btn.getAttribute('data-wrong-purge') || '').split('|');
                ctx.requestConfirm('確定要刪除這組已克服的卡片？', function () {
                    if (Save.deleteMasteredWrongsV2) Save.deleteMasteredWrongsV2(parts[0], parts[1]);
                    ctx.render();
                });
            });
        });
    }

    return { init, render: renderWrongBookScreen };
})();
