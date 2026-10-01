/** Efectos de sonido sintetizados con Web Audio (no se descarga ningún archivo). */

const KEY = 'cococorre.muted';
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    /* sin almacenamiento */
  }
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
  gain.gain.setValueAtTime(vol, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  osc.connect(gain).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + dur);
}

export const sfx = {
  hop: () => tone(520, 0.08, 'square', 0.04, 760),
  heart: () => {
    tone(880, 0.1, 'sine', 0.08);
    setTimeout(() => tone(1320, 0.15, 'sine', 0.08), 80);
  },
  crash: () => tone(180, 0.35, 'sawtooth', 0.08, 50),
  splash: () => tone(400, 0.4, 'triangle', 0.08, 80),
  milestone: () => {
    tone(660, 0.12, 'sine', 0.07);
    setTimeout(() => tone(880, 0.12, 'sine', 0.07), 110);
    setTimeout(() => tone(1100, 0.2, 'sine', 0.07), 220);
  },
  bell: () => tone(1200, 0.08, 'square', 0.025),
};
