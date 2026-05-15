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

    return {
        shuffle,
        getQuestions,
        getAnswer,
        buildRoundQueue,
        isCorrect,
        answerText
    };
})();
