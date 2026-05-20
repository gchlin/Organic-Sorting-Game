// audio-manager.js - centralized sound, music, and AudioContext lifecycle.
//
// Game code should call AudioManager instead of creating Audio/AudioContext
// directly. This keeps BGM, short sound effects, and synth fallbacks on one
// path so combo-tier sounds can be added without another migration.

const AudioManager = (function () {
    const SOUND_FILES = {
        correct: 'sound/correct.mp3',
        wrong: 'sound/incorrect.mp3',
        timeout: 'sound/timeout.mp3',
        buzz: 'sound/bell.mp3'
    };
    const MUSIC_FILES = {
        menu: 'sound/menu.mp3',
        game: 'sound/game.mp3'
    };

    const soundCache = {};
    const musicCache = {};
    let currentMusicName = '';
    let audioCtx = null;
    let unlockArmed = false;

    function readSettings() {
        return (typeof Save !== 'undefined' && Save.readSettings) ? Save.readSettings() : {};
    }

    function isEnabled() {
        return readSettings().soundEnabled !== false;
    }

    function shouldUseLegacySounds() {
        return readSettings().devUseLegacySounds === true;
    }

    function clamp01(value, fallback) {
        const n = Number(value);
        if (isNaN(n)) return fallback;
        return Math.max(0, Math.min(1, n));
    }

    function musicVolume() {
        return clamp01(readSettings().musicVolume, 0.80);
    }

    function sfxVolume() {
        return clamp01(readSettings().sfxVolume, 0.30);
    }

    function preload() {
        if (typeof Audio === 'undefined') return;
        Object.keys(SOUND_FILES).forEach(function (name) {
            ensureSound(name);
        });
        Object.keys(MUSIC_FILES).forEach(function (name) {
            ensureMusic(name);
        });
    }

    function ensureSound(name) {
        const src = SOUND_FILES[name];
        if (!src || typeof Audio === 'undefined') return null;
        if (!soundCache[name]) {
            const audio = new Audio(src);
            audio.preload = 'auto';
            soundCache[name] = audio;
        }
        return soundCache[name];
    }

    function ensureMusic(name) {
        const src = MUSIC_FILES[name];
        if (!src || typeof Audio === 'undefined') return null;
        if (!musicCache[name]) {
            const audio = new Audio(src);
            audio.loop = true;
            audio.preload = 'auto';
            audio.volume = musicVolume();
            musicCache[name] = audio;
        }
        return musicCache[name];
    }

    function getAudioCtx() {
        if (typeof window === 'undefined') return null;
        if (audioCtx) {
            if (audioCtx.state === 'suspended') {
                try { audioCtx.resume(); } catch (e) {}
            }
            return audioCtx;
        }
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            audioCtx = new Ctx();
            return audioCtx;
        } catch (e) {
            return null;
        }
    }

    function playSoundFile(name) {
        const audio = ensureSound(name);
        if (!audio) return false;
        try {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = sfxVolume();
            const played = audio.play();
            if (played && typeof played.catch === 'function') {
                played.catch(function () { playSynthBeep(name); });
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function playSynthBeep(name) {
        const ctx = getAudioCtx();
        if (!ctx) return;
        try {
            const t0 = ctx.currentTime;
            const volume = sfxVolume();
            if (volume <= 0) return;
            function note(freq, type, startMs, durMs, peakGain) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = type || 'sine';
                osc.frequency.value = freq;
                const start = t0 + startMs / 1000;
                const stop = start + durMs / 1000;
                gain.gain.setValueAtTime(0.0001, start);
                gain.gain.exponentialRampToValueAtTime((peakGain || 0.12) * volume, start + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, stop);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(stop);
            }
            if (name === 'correct') {
                note(523, 'sine', 0, 150, 0.12);
                note(784, 'sine', 80, 280, 0.10);
            } else if (name === 'wrong') {
                note(110, 'sawtooth', 0, 350, 0.15);
            } else if (name === 'timeout') {
                note(196, 'triangle', 0, 200, 0.12);
                note(147, 'triangle', 200, 300, 0.12);
            } else if (name === 'buzz') {
                note(880, 'square', 0, 110, 0.14);
                note(1175, 'square', 70, 160, 0.12);
            } else if (name === 'comboGood') {
                note(523, 'triangle', 0, 110, 0.10);
                note(659, 'triangle', 85, 130, 0.10);
                note(784, 'triangle', 180, 190, 0.11);
            } else if (name === 'comboGreat') {
                note(587, 'sine', 0, 95, 0.10);
                note(740, 'sine', 70, 120, 0.10);
                note(880, 'sine', 150, 150, 0.11);
                note(1175, 'sine', 250, 210, 0.09);
            } else if (name === 'comboBrilliant') {
                note(659, 'triangle', 0, 90, 0.10);
                note(880, 'triangle', 60, 115, 0.10);
                note(1047, 'triangle', 135, 145, 0.11);
                note(1319, 'triangle', 230, 230, 0.10);
            }
        } catch (e) {}
    }

    function playSound(name) {
        if (!isEnabled()) return;
        if (!shouldUseLegacySounds() && playSoundFile(name)) return;
        playSynthBeep(name);
    }

    function stopMusic() {
        Object.keys(musicCache).forEach(function (key) {
            const audio = musicCache[key];
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (e) {}
        });
        currentMusicName = '';
    }

    function playMusic(name) {
        if (!isEnabled()) {
            stopMusic();
            return;
        }
        const audio = ensureMusic(name);
        if (!audio) {
            stopMusic();
            return;
        }
        audio.volume = musicVolume();
        if (currentMusicName === name) return;
        stopMusic();
        currentMusicName = name;
        try {
            const played = audio.play();
            if (played && typeof played.catch === 'function') {
                played.catch(function () {
                    if (currentMusicName === name) currentMusicName = '';
                });
            }
        } catch (e) {
            currentMusicName = '';
        }
    }

    function syncMusicForScreen(screenId) {
        playMusic(screenId === 'game' ? 'game' : 'menu');
    }

    function armUnlock(getScreenId) {
        if (typeof document === 'undefined' || unlockArmed) return;
        unlockArmed = true;
        function unlock() {
            unlockArmed = false;
            document.removeEventListener('pointerdown', unlock, true);
            document.removeEventListener('keydown', unlock, true);
            getAudioCtx();
            syncMusicForScreen(typeof getScreenId === 'function' ? getScreenId() : 'main-menu');
        }
        document.addEventListener('pointerdown', unlock, true);
        document.addEventListener('keydown', unlock, true);
    }

    function teardown() {
        if (audioCtx) {
            try { audioCtx.close(); } catch (e) {}
            audioCtx = null;
        }
    }

    return {
        preload: preload,
        playSound: playSound,
        playMusic: playMusic,
        stopMusic: stopMusic,
        syncMusicForScreen: syncMusicForScreen,
        armUnlock: armUnlock,
        teardown: teardown
    };
})();
