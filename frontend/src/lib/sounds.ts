// Short UI sound effects, synthesized with the Web Audio API rather than
// shipped as audio files — no assets to fetch, no licensing to worry
// about, and the whole set adds effectively nothing to bundle size.

const MUTED_KEY = 'sketchsabotage:muted';

let ctx: AudioContext | null = null;
let muted = loadMuted();

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(MUTED_KEY, next ? '1' : '0');
  } catch {
    // Private browsing / storage disabled — the preference just won't
    // persist across visits, not fatal.
  }
}

function getCtx(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Browsers only allow audio after a real user gesture. Our first sound is
// often triggered asynchronously by a server message (e.g. "your turn"),
// which doesn't count as a gesture — so Home calls this from a real
// onClick (Create/Join Room) to unlock the context ahead of time.
export function unlockAudio() {
  try {
    getCtx();
  } catch {
    // Web Audio unsupported — every play() call below fails silently too.
  }
}

interface Tone {
  freq: number;
  at: number; // seconds from now
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

function play(tones: Tone[]) {
  if (muted) return;
  try {
    const c = getCtx();
    for (const t of tones) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = t.type ?? 'sine';
      osc.frequency.value = t.freq;
      const start = c.currentTime + t.at;
      const peak = t.gain ?? 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
      osc.connect(gain).connect(c.destination);
      osc.start(start);
      osc.stop(start + t.dur + 0.02);
    }
  } catch {
    // Cosmetic feature — never let a sound failure affect gameplay.
  }
}

export function playCorrectGuess() {
  play([
    { freq: 880, at: 0, dur: 0.12 },
    { freq: 1318.5, at: 0.09, dur: 0.2 },
  ]);
}

export function playYourTurn() {
  play([
    { freq: 523.25, at: 0, dur: 0.14 },
    { freq: 659.25, at: 0.12, dur: 0.14 },
    { freq: 783.99, at: 0.24, dur: 0.24 },
  ]);
}

export function playTurnEnd() {
  play([
    { freq: 392, at: 0, dur: 0.16, type: 'triangle' },
    { freq: 293.66, at: 0.13, dur: 0.24, type: 'triangle' },
  ]);
}

export function playGameOver() {
  play([
    { freq: 523.25, at: 0, dur: 0.15 },
    { freq: 659.25, at: 0.13, dur: 0.15 },
    { freq: 783.99, at: 0.26, dur: 0.15 },
    { freq: 1046.5, at: 0.39, dur: 0.4 },
  ]);
}

export function playTick() {
  play([{ freq: 1000, at: 0, dur: 0.05, type: 'square', gain: 0.07 }]);
}

export function playRoomCreated() {
  play([
    { freq: 1174.66, at: 0, dur: 0.22 },
    { freq: 1567.98, at: 0, dur: 0.3 },
  ]);
}

export function playRoomJoined() {
  play([
    { freq: 349.23, at: 0, dur: 0.12, type: 'triangle' },
    { freq: 440, at: 0.08, dur: 0.12, type: 'triangle' },
    { freq: 523.25, at: 0.16, dur: 0.18, type: 'triangle' },
  ]);
}

export function playPlayerJoined() {
  play([
    { freq: 660, at: 0, dur: 0.06, gain: 0.1 },
    { freq: 880, at: 0.05, dur: 0.08, gain: 0.1 },
  ]);
}

export function playPlayerLeft() {
  play([
    { freq: 880, at: 0, dur: 0.06, gain: 0.1 },
    { freq: 660, at: 0.05, dur: 0.08, gain: 0.1 },
  ]);
}

export function playGameStart() {
  play([
    { freq: 392, at: 0, dur: 0.16, type: 'square', gain: 0.12 },
    { freq: 392, at: 0, dur: 0.22, type: 'sine' },
    { freq: 587.33, at: 0.1, dur: 0.16, type: 'square', gain: 0.12 },
    { freq: 587.33, at: 0.1, dur: 0.24, type: 'sine' },
  ]);
}
