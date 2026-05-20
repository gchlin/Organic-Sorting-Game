// question-engine.js - question selection and answer-option helpers

const QuestionEngine = (function () {
    function shuffle(items) {
        const arr = [...items];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function getQuestions(levelKey) {
        if (typeof QuestionSets === 'undefined') return [];
        return Array.isArray(QuestionSets[levelKey]) ? QuestionSets[levelKey] : [];
    }

    function getAnswer(answerKey) {
        if (typeof AnswerBank === 'undefined') return null;
        return AnswerBank[answerKey] || null;
    }

    function buildRoundQueue(levelKey, options) {
        const opts = options || {};
        const all = getQuestions(levelKey);
        if (!all.length) return [];

        const wrongKeys = new Set(opts.wrongKeys || []);
        const seenKeys = new Set(opts.seenKeys || []);
        const wrongQuestions = all.filter(q => wrongKeys.has(q.aKey));
        const unseenQuestions = all.filter(q => !seenKeys.has(q.aKey));
        const fallback = all.filter(q => !wrongKeys.has(q.aKey));

        const pool = [];
        if (opts.includeUnseen) pool.push(...shuffle(unseenQuestions));
        if (opts.includeWrong) pool.push(...shuffle(wrongQuestions));
        pool.push(...shuffle(fallback));

        const unique = [];
        const used = new Set();
        pool.forEach(q => {
            const key = `${q.qContent}::${q.aKey}`;
            if (!used.has(key)) {
                used.add(key);
                unique.push(q);
            }
        });

        return typeof opts.limit === 'number' ? unique.slice(0, opts.limit) : unique;
    }

    function isCorrect(selectedKey, correctKey) {
        return selectedKey === correctKey;
    }

    function answerText(answerKey) {
        const answer = getAnswer(answerKey);
        return answer ? answer.content : '';
    }

    function preferredByFamily(pool, familyScope, correctAKey) {
        if (!familyScope || typeof Families === 'undefined' || !Families[familyScope]) return pool;
        const fam = Families[familyScope];
        const filter = fam.imageFilter;
        if (filter && filter.type === 'byCategory') {
            const cats = new Set(filter.categories);
            return pool.filter(k => cats.has(AnswerBank[k].category));
        }
        if (filter && filter.type === 'byCompoundKeys') {
            const keys = new Set(filter.keys);
            return pool.filter(k => keys.has(k));
        }
        if (filter && filter.type === 'all') {
            const correct = AnswerBank[correctAKey];
            if (!correct || !correct.category) return pool;
            const familyKeys = Object.keys(Families);
            for (let i = 0; i < familyKeys.length; i++) {
                const candidate = Families[familyKeys[i]];
                const candidateFilter = candidate && candidate.imageFilter;
                if (!candidateFilter || candidateFilter.type !== 'byCategory') continue;
                if (candidateFilter.categories.indexOf(correct.category) === -1) continue;
                const cats = new Set(candidateFilter.categories);
                const inferred = pool.filter(k => cats.has(AnswerBank[k].category));
                if (inferred.length) return inferred;
            }
        }
        return pool;
    }

    function getQuestionSet(familyKey, difficultyKey) {
        if (typeof Families === 'undefined' || typeof Difficulties === 'undefined' || typeof QuestionImages === 'undefined' || typeof AnswerBank === 'undefined') return [];
        const fam = Families[familyKey];
        const dif = Difficulties[difficultyKey];
        if (!fam || !dif || !fam.difficulties.includes(difficultyKey)) return [];

        const images = QuestionImages.filter(img => {
            const compound = AnswerBank[img.compoundKey];
            if (!compound) return false;
            const f = fam.imageFilter;
            if (f.type === 'all') return true;
            if (f.type === 'byCategory') return f.categories.includes(compound.category);
            if (f.type === 'byCompoundKeys') return f.keys.includes(img.compoundKey);
            return false;
        });

        return images.map(img => ({
            qType: 'img',
            qContent: img.src,
            compoundKey: img.compoundKey,
            aKey: dif.aKeyPrefix
                ? dif.aKeyPrefix + AnswerBank[img.compoundKey].category.toUpperCase()
                : img.compoundKey,
        }));
    }

    function buildRoundQueueV2({ family, difficulty, seenSet, wrongSet, includeUnseen, includeWrong, limit }) {
        const all = getQuestionSet(family, difficulty);
        if (!all.length) return [];
        const seen = seenSet instanceof Set ? seenSet : new Set(seenSet || []);
        const wrong = wrongSet instanceof Set ? wrongSet : new Set(wrongSet || []);

        const wrongQuestions = all.filter(q => wrong.has(q.compoundKey));
        const unseenQuestions = all.filter(q => !seen.has(q.compoundKey));
        const fallback = all.filter(q => !wrong.has(q.compoundKey));

        const pool = [];
        if (includeUnseen) pool.push(...shuffle(unseenQuestions));
        if (includeWrong) pool.push(...shuffle(wrongQuestions));
        pool.push(...shuffle(fallback));

        const unique = [];
        const used = new Set();
        pool.forEach(q => {
            const key = q.qContent + '::' + q.aKey;
            if (!used.has(key)) { used.add(key); unique.push(q); }
        });

        return typeof limit === 'number' ? unique.slice(0, limit) : unique;
    }

    function generateOptions({ correctAKey, answerType, familyScope, optionCount, preferredDistractorCount }) {
        if (typeof AnswerBank === 'undefined') return [];
        const N = optionCount || 4;
        const pool = Object.keys(AnswerBank).filter(k => {
            const e = AnswerBank[k];
            if (!e || e.type !== answerType || k === correctAKey) return false;
            if (answerType === 'categoryEn' && !/^CAT_EN_/.test(k)) return false;
            if (answerType === 'categoryZh' && !/^CAT_ZH_/.test(k)) return false;
            return true;
        });
        const preferred = preferredByFamily(pool, familyScope, correctAKey);
        let distractors = shuffle(preferred);
        if (typeof preferredDistractorCount === 'number') {
            const preferredTarget = Math.max(0, Math.min(N - 1, preferredDistractorCount));
            const preferredChosen = distractors.slice(0, preferredTarget);
            const preferredSet = new Set(preferredChosen);
            const outside = shuffle(pool.filter(k => !preferredSet.has(k) && preferred.indexOf(k) === -1));
            distractors = preferredChosen.concat(outside);
            if (distractors.length < N - 1) {
                const fallbackPreferred = shuffle(preferred.filter(k => !preferredSet.has(k)));
                distractors.push(...fallbackPreferred);
            }
        }
        while (distractors.length < N - 1) {
            const extras = shuffle(pool.filter(k => !distractors.includes(k)));
            if (!extras.length) break;
            distractors.push(extras[0]);
        }
        const chosen = distractors.slice(0, N - 1);
        const all = shuffle([correctAKey, ...chosen]);
        return all.map(k => ({ key: k, content: AnswerBank[k] ? AnswerBank[k].content : '' }));
    }

    return {
        shuffle,
        getQuestions,
        getAnswer,
        buildRoundQueue,
        isCorrect,
        answerText,
        getQuestionSet,
        buildRoundQueueV2,
        generateOptions,
    };
})();
