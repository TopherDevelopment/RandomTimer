// State
const state = {
    isRunning: false,
    endTime: null,
    timerId: null,
    isMuted: false,
    isZenMode: false,
    currentDuration: 0 // ms
};

// --- iOS audio unlock / shared AudioContext ---
const audio = {
    ctx: null,
    unlocked: false
};

const initAudio = () => {
    if (audio.unlocked) return;

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    audio.ctx = audio.ctx || new AC();

    // Must be called from a user gesture on iOS
    audio.ctx.resume?.().catch(() => {
    });

    // Tiny “blip” to fully unlock audio output on iOS
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    gain.gain.value = 0.0001; // basically silent
    osc.connect(gain);
    gain.connect(audio.ctx.destination);

    osc.start();
    osc.stop(audio.ctx.currentTime + 0.02);

    audio.unlocked = true;
};

// As a fallback, unlock on first interaction anywhere
document.addEventListener('touchend', initAudio, {once: true});
document.addEventListener('click', initAudio, {once: true});


// DOM Elements
const els = {
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    minInput: document.getElementById('minInput'),
    maxInput: document.getElementById('maxInput'),
    timeDisplay: document.getElementById('timeDisplay'),
    statusLabel: document.getElementById('statusLabel'),
    controlsPanel: document.getElementById('controlsPanel'),
    runningControls: document.getElementById('runningControls'),
    statusCircle: document.getElementById('statusCircle'),
    statusGlow: document.getElementById('statusGlow'),
    rangeDisplay: document.getElementById('rangeDisplay'),
    alarmOverlay: document.getElementById('alarmOverlay'),
    dismissBtn: document.getElementById('dismissBtn'),
    loopCheck: document.getElementById('loopCheck'),
    muteBtn: document.getElementById('muteBtn'),
    zenBtn: document.getElementById('zenBtn'),
    saveBtn: document.getElementById('saveBtn'),
    shareBtn: document.getElementById('shareBtn'),
    targetMessage: document.getElementById('targetMessage')
};

// Initialize Icons
lucide.createIcons();

// Helpers
const formatTime = (ms) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const getRandomTime = (min, max) => {
    // Convert minutes to ms
    const minMs = min * 60 * 1000;
    const maxMs = max * 60 * 1000;
    return Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
};

// Audio Logic (Oscillator to avoid external files)
const playAlarmSound = () => {
    if (state.isMuted) return;

    const ctx = audio.ctx;
    if (!ctx || !audio.unlocked) return; // iOS will block if not unlocked

    const notes = [880, 1100, 880, 1100, 1320, 880];
    const duration = 0.15;

    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        osc.connect(gain);
        gain.connect(ctx.destination);

        const startTime = ctx.currentTime + (i * duration);
        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration - 0.05);

        osc.start(startTime);
        osc.stop(startTime + duration);
    });
};

// Timer Logic
const updateTimer = () => {
    if (!state.isRunning) return;

    const now = Date.now();
    const remaining = state.endTime - now;

    if (remaining <= 0) {
        triggerAlarm();
    } else {
        if (state.isZenMode) {
            els.timeDisplay.innerText = "Running";
            els.timeDisplay.classList.add('text-2xl', 'animate-pulse');
            els.timeDisplay.classList.remove('text-4xl', 'sm:text-5xl');
        } else {
            els.timeDisplay.innerText = formatTime(remaining);
            els.timeDisplay.classList.remove('text-2xl', 'animate-pulse');
            els.timeDisplay.classList.add('text-4xl', 'sm:text-5xl');
        }

        state.timerId = requestAnimationFrame(updateTimer);
    }
};

const startTimer = () => {
    let min = parseInt(els.minInput.value);
    let max = parseInt(els.maxInput.value);

    // Validation
    if (isNaN(min) || min < 1) min = 1;
    if (isNaN(max) || max < min) max = min;

    els.minInput.value = min;
    els.maxInput.value = max;

    state.currentDuration = getRandomTime(min, max);
    state.endTime = Date.now() + state.currentDuration;
    state.isRunning = true;

    // Update UI
    els.controlsPanel.classList.add('hidden');
    els.runningControls.classList.remove('hidden');
    els.statusCircle.classList.add('animate-breathe', 'border-indigo-500/50');
    els.statusGlow.classList.remove('opacity-0');
    els.statusLabel.innerText = "WAITING...";
    els.statusLabel.classList.add('text-indigo-400');

    els.rangeDisplay.innerText = `${min}m - ${max}m Interval`;
    els.rangeDisplay.classList.remove('opacity-0');

    // Update info text
    els.targetMessage.querySelector('.min-val').innerText = min;
    els.targetMessage.querySelector('.max-val').innerText = max;

    updateTimer();
};

const stopTimer = () => {
    state.isRunning = false;
    cancelAnimationFrame(state.timerId);

    // Reset UI
    els.controlsPanel.classList.remove('hidden');
    els.runningControls.classList.add('hidden');
    els.statusCircle.classList.remove('animate-breathe', 'border-indigo-500/50');
    els.statusGlow.classList.add('opacity-0');
    els.statusLabel.innerText = "READY";
    els.statusLabel.classList.remove('text-indigo-400');
    els.rangeDisplay.classList.add('opacity-0');
    els.timeDisplay.innerText = "00:00";

    // Fix zen mode text size reset
    els.timeDisplay.classList.remove('text-2xl', 'animate-pulse');
    els.timeDisplay.classList.add('text-4xl', 'sm:text-5xl');
};

const triggerAlarm = () => {
    state.isRunning = false;
    cancelAnimationFrame(state.timerId);

    playAlarmSound();

    // Interval backup sound (in case browser throttles single play)
    const alarmInterval = setInterval(playAlarmSound, 2500);

    els.alarmOverlay.classList.remove('hidden');
    els.alarmOverlay.classList.add('flex'); // Ensure flex is added back

    // Handle Dismiss
    els.dismissBtn.onclick = () => {
        clearInterval(alarmInterval);
        els.alarmOverlay.classList.add('hidden');
        els.alarmOverlay.classList.remove('flex');

        if (els.loopCheck.checked) {
            startTimer();
        } else {
            stopTimer();
        }
    };
};

// Event Listeners
els.startBtn.addEventListener('click', () => {
    initAudio();
    startTimer();
});
els.stopBtn.addEventListener('click', stopTimer);

els.muteBtn.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    const icon = state.isMuted ? 'volume-x' : 'volume-2';
    els.muteBtn.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i>`;
    lucide.createIcons();
    els.muteBtn.classList.toggle('text-red-400', state.isMuted);
});

els.zenBtn.addEventListener('click', () => {
    state.isZenMode = !state.isZenMode;
    const icon = state.isZenMode ? 'eye-off' : 'eye';
    els.zenBtn.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i>`;
    lucide.createIcons();
    els.zenBtn.classList.toggle('text-indigo-400', state.isZenMode);

    if (state.isRunning) {
        // Trigger immediate update to toggle text
        cancelAnimationFrame(state.timerId);
        updateTimer();
    }
});

// Common Save Logic
const getFileBlob = () => {
    const htmlContent = document.documentElement.outerHTML;
    return new Blob([htmlContent], {type: 'text/html'});
}

// Save Functionality (Download)
els.saveBtn.addEventListener('click', () => {
    const blob = getFileBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'random-interval-timer.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Share Functionality (Mobile/Native)
els.shareBtn.addEventListener('click', async () => {
    const blob = getFileBlob();
    const file = new File([blob], 'random-interval-timer.html', {type: 'text/html'});

    if (navigator.share && navigator.canShare({files: [file]})) {
        try {
            await navigator.share({
                files: [file],
                title: 'Random Interval Timer',
                text: 'A simple random timer tool.'
            });
        } catch (err) {
            console.log('Share failed or canceled', err);
        }
    } else {
        alert('Sharing files is not supported on this browser. Please use the Save button.');
    }
});

// Click on the big circle acts as Start/Stop depending on state
els.statusCircle.addEventListener('click', () => {
    initAudio();
    if (!state.isRunning && !state.endTime) startTimer();
});


// Clean slate on load
stopTimer();

