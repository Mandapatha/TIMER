// Replace this with YOUR Firebase config from the Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyAlXt10sv3vf_y0yetjp1fJ0Oel08NgY8E",
    authDomain: "mechovatetime.firebaseapp.com",
    databaseURL: "https://mechovatetime-default-rtdb.firebaseio.com",
    projectId: "mechovatetime",
    storageBucket: "mechovatetime.firebasestorage.app",
    messagingSenderId: "1096882294133",
    appId: "1:1096882294133:web:2a00d1fe1f75717182973c"
};

// Initialize Firebase (Only if config is provided)
let database;
let commandRef;

try {
    if (firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE") {
        firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        commandRef = database.ref('commands');
    }
} catch (e) {
    console.warn("Firebase initialization failed. Global remote control disabled.", e);
}

// Local Broadcast Channel (Works instantly on same computer)
const bc = new BroadcastChannel('mechovate_controls');

let countdownInterval;
let breakInterval;
let targetDate;
let isPaused = false;
let remainingTimeMs = 0;
let lastSetDurationMs = 0;
let isBreakActive = false;

// DOM Elements
const hoursEl = document.getElementById('hours');
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');

// Popup Elements
const popupOverlay = document.getElementById('popup-overlay');
const popupText = document.getElementById('popup-text');
const popupTimer = document.getElementById('popup-timer');

// Listen for Remote Firebase Commands
if (commandRef) {
    commandRef.on('value', (snapshot) => {
        const data = snapshot.val();
        handleRemoteCommand(data);
    });
}

// Listen for Local Broadcast Commands
bc.onmessage = (event) => {
    handleRemoteCommand(event.data);
};

function handleRemoteCommand(data) {
    if (!data || !data.type) return;
    const { type, value, label, duration, timestamp } = data;

    // Only apply timestamp check for Firebase data
    if (timestamp && Date.now() - timestamp > 5000) return;

    switch (type) {
        case 'SET_TARGET':
            if (countdownInterval) clearInterval(countdownInterval);
            lastSetDurationMs = data.durationMs;
            remainingTimeMs = lastSetDurationMs;
            isPaused = true;

            const totalSecsSet = Math.floor(remainingTimeMs / 1000);
            updateDisplay(
                Math.floor(totalSecsSet / 3600),
                Math.floor((totalSecsSet % 3600) / 60),
                totalSecsSet % 60
            );
            popupOverlay.classList.add('hidden');
            break;
        case 'TOGGLE_PAUSE':
            togglePause();
            break;
        case 'RESET':
            resetTimer(value, data.durationMs);
            break;
        case 'START_BREAK':
            handleBreak(label, duration);
            break;
        case 'END_BREAK':
            endBreak();
            break;
    }
}

function startCountdown() {
    if (isBreakActive) return;
    if (countdownInterval) clearInterval(countdownInterval);
    if (breakInterval) clearInterval(breakInterval);
    popupOverlay.classList.add('hidden');

    isPaused = false;

    countdownInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance <= 0) {
            clearInterval(countdownInterval);
            updateDisplay(0, 0, 0);
            return;
        }

        const h = Math.floor(distance / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);

        updateDisplay(h, m, s);
    }, 1000);
}

function togglePause() {
    if (isBreakActive) return;
    const now = new Date().getTime();

    createBurst();
    playPopSound();

    if (!isPaused) {
        clearInterval(countdownInterval);
        isPaused = true;
        remainingTimeMs = targetDate - now;
    } else {
        targetDate = now + remainingTimeMs;
        isPaused = false;
        startCountdown();
    }
}

function createBurst() {
    const burstCount = 60;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    for (let i = 0; i < burstCount; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const angle = Math.random() * Math.PI * 2;
        const velocity = 200 + Math.random() * 800;
        const tx = Math.cos(angle) * velocity + 'px';
        const ty = Math.sin(angle) * velocity + 'px';
        p.style.left = centerX + 'px';
        p.style.top = centerY + 'px';
        p.style.setProperty('--tx', tx);
        p.style.setProperty('--ty', ty);
        const color = Math.random() > 0.5 ? '#00d4ff' : '#ffffff';
        p.style.background = color;
        p.style.boxShadow = `0 0 15px ${color}`;
        p.style.animation = `burst 1.5s ease-out forwards`;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 1500);
    }
}

function resetTimer(newTarget, durationMs) {
    if (countdownInterval) clearInterval(countdownInterval);
    if (breakInterval) clearInterval(breakInterval);
    isBreakActive = false;
    popupOverlay.classList.add('hidden');

    let durationToUse = durationMs || lastSetDurationMs;
    if (durationToUse > 0) {
        lastSetDurationMs = durationToUse;
        remainingTimeMs = durationToUse;
        isPaused = true;
        const totalSecsReset = Math.floor(remainingTimeMs / 1000);
        updateDisplay(
            Math.floor(totalSecsReset / 3600),
            Math.floor((totalSecsReset % 3600) / 60),
            totalSecsReset % 60
        );
    } else {
        targetDate = null;
        isPaused = false;
        remainingTimeMs = 0;
        updateDisplay(0, 0, 0);
    }
}

function updateDisplay(h, m, s) {
    hoursEl.textContent = h.toString().padStart(2, '0');
    minutesEl.textContent = m.toString().padStart(2, '0');
    secondsEl.textContent = s.toString().padStart(2, '0');
}

function handleBreak(label, durationMins) {
    if (isBreakActive) clearInterval(breakInterval);
    isBreakActive = true;
    clearInterval(countdownInterval);
    countdownInterval = null;
    const now = new Date().getTime();
    if (!isPaused && targetDate) {
        remainingTimeMs = targetDate - now;
    }
    let totalSeconds = durationMins * 60;

    // Animate the label text
    animateText(label, popupText);

    popupOverlay.classList.remove('hidden');
    updatePopupTimer(totalSeconds);
    breakInterval = setInterval(() => {
        totalSeconds--;
        updatePopupTimer(totalSeconds);
        if (totalSeconds <= 0) {
            endBreak();
        }
    }, 1000);
}

function endBreak() {
    clearInterval(breakInterval);
    breakInterval = null;
    isBreakActive = false;
    popupOverlay.classList.add('hidden');
    if (remainingTimeMs > 0 && !isPaused) {
        const resumeNow = new Date().getTime();
        targetDate = resumeNow + remainingTimeMs;
        startCountdown();
    } else {
        const h = Math.floor(remainingTimeMs / (1000 * 60 * 60));
        const m = Math.floor((remainingTimeMs % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((remainingTimeMs % (1000 * 60)) / 1000);
        updateDisplay(h, m, s);
    }
}

function updatePopupTimer(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    popupTimer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
    }
});

updateDisplay(0, 0, 0);

function playPopSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const bufferSize = audioCtx.sampleRate * 2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 1.5);
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.6, audioCtx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.8);
        const boom = audioCtx.createOscillator();
        const boomGain = audioCtx.createGain();
        boom.type = 'triangle';
        boom.frequency.setValueAtTime(100, audioCtx.currentTime);
        boom.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.8);
        boomGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        boomGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        boom.connect(boomGain);
        boomGain.connect(audioCtx.destination);
        noise.start();
        boom.start();
        noise.stop(audioCtx.currentTime + 2);
        boom.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
        console.warn('Audio context failed', e);
    }
}

// Super-Tech Text Scramble Animation
function animateText(finalText, element) {
    const chars = '!@#$%^&*()_+-=[]{}|;:,.<>?/1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const durationCount = 1000; // Duration of scramble in ms
    const frameRate = 33; // ~30 fps
    let frame = 0;
    const totalFrames = durationCount / frameRate;

    const interval = setInterval(() => {
        let scrambled = "";
        const progress = frame / totalFrames;

        for (let i = 0; i < finalText.length; i++) {
            if (i < finalText.length * progress) {
                scrambled += finalText[i];
            } else {
                scrambled += chars[Math.floor(Math.random() * chars.length)];
            }
        }

        element.textContent = scrambled;
        frame++;

        if (frame > totalFrames) {
            clearInterval(interval);
            element.textContent = finalText;
        }
    }, frameRate);
}

updateDisplay(0, 0, 0);

