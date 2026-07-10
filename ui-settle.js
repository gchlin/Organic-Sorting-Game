// ui-settle.js - 結算畫面（core 的 render() 分派進來）
const UISettle = (function () {
    let ctx = null; // core 注入的依賴：{ getState, goToScreen, startMode, findImageFor, requestConfirm, getWrongChosenMap }
    function init(context) { ctx = context; }

    function renderSettleScreen() {
        const state = ctx.getState();
        if (!state) return;
        const titleEl = document.getElementById('settle-title');
        const statsEl = document.getElementById('settle-stats');
        const wrongReview = document.getElementById('settle-wrong-review');
        const wrongCards = document.getElementById('settle-wrong-cards');
        if (!titleEl || !statsEl) return;

        if (state.mode === 'duel') {
            titleEl.textContent = state.result && state.result.winner
                ? ((state.result.winner === 'p1' ? '左方' : '右方') + ' 勝利！')
                : '本局結算';
        } else {
            const cleared = (typeof Save !== 'undefined' && Save.isSubLevelCleared
                && Save.isSubLevelCleared(state.family, state.difficulty));
            if (state.queueSource === 'wrongOnly') {
                // Celebrate when every entry in the bucket is now in box ≥4 (mastered).
                let entries = [];
                if (typeof Save !== 'undefined' && Save.getWrongEntriesV2) {
                    entries = Save.getWrongEntriesV2(state.family, state.difficulty);
                }
                const allMastered = entries.length > 0 && entries.every(function (e) { return e.box >= 4; });
                titleEl.textContent = allMastered ? '🎉 該組錯題全部進入「已克服」' : '🎯 錯題重練結算';
            } else {
                titleEl.textContent = cleared ? '已通關該子關 🥉' : '本輪結算';
            }
        }

        // Accuracy now uses correctCount / (correctCount + wrongCount).
        // wrongCount counts wrong submissions, so even if you eventually got
        // the same question right after a mistake, accuracy reflects that mistake.
        const p1 = state.players.p1;
        const totalSubmissions = (p1.correctCount || 0) + (p1.wrongCount || 0);
        const acc = totalSubmissions > 0 ? (p1.correctCount / totalSubmissions) : null;
        statsEl.innerHTML = '';
        _appendStat(statsEl, '得分', String(p1.score || 0));
        _appendStat(statsEl, '答對', String(p1.correctCount || 0));
        if ((p1.wrongCount || 0) > 0) {
            _appendStat(statsEl, '答錯', String(p1.wrongCount || 0));
        }
        if (state.mode === 'duel') {
            const p2 = state.players.p2;
            _appendStat(statsEl, '右方 得分', String(p2.score || 0));
            _appendStat(statsEl, '右方 答對', String(p2.correctCount || 0));
        }
        _appendStat(statsEl, '本輪正確率', acc !== null ? (Math.round(acc * 100) + '%') : '—');
        // Practice: show progress against the sub-level's full question set.
        if (state.mode === 'practice'
            && typeof QuestionEngine !== 'undefined' && QuestionEngine.getQuestionSet
            && typeof Save !== 'undefined' && Save.getAskedHistory) {
            const total = QuestionEngine.getQuestionSet(state.family, state.difficulty).length;
            const asked = Save.getAskedHistory(state.family, state.difficulty).size;
            if (total > 0) {
                _appendStat(statsEl, '子關進度', Math.min(asked, total) + ' / ' + total + ' 題');
            }
        }

        // Wrong review (Practice only)
        if (wrongReview && wrongCards) {
            const wrongs = (state.wrongInRound && state.wrongInRound.size > 0)
                ? Array.from(state.wrongInRound) : [];
            if (state.mode === 'practice' && wrongs.length > 0) {
                wrongReview.classList.remove('empty');
                wrongCards.innerHTML = '';
                for (let i = 0; i < wrongs.length; i++) {
                    const ck = wrongs[i];
                    const entry = (typeof AnswerBank !== 'undefined') ? AnswerBank[ck] : null;
                    const img = ctx.findImageFor(ck);
                    const card = document.createElement('div');
                    card.className = 'v2-wrong-card';

                    const imgEl = document.createElement('img');
                    imgEl.src = img || '';
                    imgEl.alt = '';
                    card.appendChild(imgEl);

                    const nameEl = document.createElement('div');
                    nameEl.className = 'name-zh';
                    nameEl.textContent = entry ? entry.content : ck;
                    card.appendChild(nameEl);

                    // "你選了：XXX"
                    const chosenKey = ctx.getWrongChosenMap()[ck];
                    if (chosenKey) {
                        const chosenEntry = (typeof AnswerBank !== 'undefined') ? AnswerBank[chosenKey] : null;
                        const chosenText = chosenEntry ? chosenEntry.content : chosenKey;
                        const chosenEl = document.createElement('div');
                        chosenEl.className = 'v2-wrong-card-chosen';
                        chosenEl.textContent = '你選了：' + chosenText;
                        card.appendChild(chosenEl);
                    }

                    // "看圖鑑 →" link
                    const codexLink = document.createElement('button');
                    codexLink.className = 'v2-wrong-card-codex-link';
                    codexLink.textContent = '看圖鑑 →';
                    (function (molKey) {
                        codexLink.addEventListener('click', function (e) {
                            e.stopPropagation();
                            ctx.goToScreen('codex');
                            // Scroll to the molecule card after render
                            setTimeout(function () {
                                const target = document.getElementById('codex-mol-' + molKey);
                                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 80);
                        });
                    })(ck);
                    card.appendChild(codexLink);

                    wrongCards.appendChild(card);
                }
            } else {
                wrongReview.classList.add('empty');
            }
        }
    }
    function _appendStat(parent, label, value) {
        const line = document.createElement('div');
        line.className = 'stat-line';
        line.innerHTML = '<span>' + label + '</span><span>' + value + '</span>';
        parent.appendChild(line);
    }

    function _goNextLevel() {
        const state = ctx.getState();
        if (!state) { ctx.goToScreen('main-menu'); return; }
        if (state.mode === 'duel') {
            // Duel: rematch same settings
            ctx.startMode({ mode: 'duel', family: state.family, difficulty: state.difficulty,
                        opponent: state.opponent || 'human' });
            return;
        }
        // Practice: find next family/difficulty in order
        const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
        const famKeys = Object.keys(typeof Families !== 'undefined' ? Families : {});
        // Build flat list of [family, difficulty] pairs valid for the family
        const all = [];
        for (const d of DIFFICULTIES) {
            for (const fk of famKeys) {
                if (Families[fk].difficulties && Families[fk].difficulties.indexOf(d) !== -1) {
                    all.push({ family: fk, difficulty: d });
                }
            }
        }
        // Find current index
        const curIdx = all.findIndex(function (item) {
            return item.family === state.family && item.difficulty === state.difficulty;
        });
        if (curIdx !== -1 && curIdx + 1 < all.length) {
            const next = all[curIdx + 1];
            ctx.startMode({ mode: 'practice', family: next.family, difficulty: next.difficulty, opponent: 'human' });
        } else {
            // Already at the last level
            ctx.requestConfirm('恭喜！你已完成所有關卡。', function () { ctx.goToScreen('main-menu'); });
        }
    }

    return { init, render: renderSettleScreen, goNextLevel: _goNextLevel };
})();
