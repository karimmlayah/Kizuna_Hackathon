import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

let audioCtx: any = null;
let masterGain: any = null;
let isMuted = false;

export function setCinematicMuted(muted: boolean) {
  isMuted = muted;
  if (muted && masterGain && audioCtx) {
    try {
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    } catch {}
  }
}

export function getCinematicMuted(): boolean {
  return isMuted;
}

function getAudioContext() {
  if (typeof window === "undefined" || isMuted) return null;
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    if (!masterGain && audioCtx) {
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.28, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Phase 1 & 2: Harmonic Solar Awakening Drone (216Hz - 432Hz with resonant filter)
 */
export function playSolarAwakening() {
  if (Platform.OS !== "web") {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    return;
  }
  const ctx = getAudioContext();
  if (!ctx || isMuted) return;

  try {
    const now = ctx.currentTime;

    // Filter to simulate sunrise opening
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(250, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 1.8);

    // Warm multi-oscillator chord (A3 216Hz, E4 324Hz, A4 432Hz)
    const freqs = [216, 324, 432];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.06 / (idx + 1), now + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

      osc.connect(gain);
      gain.connect(filter);
      osc.start(now);
      osc.stop(now + 2.6);
    });

    filter.connect(masterGain);
  } catch {}
}

/**
 * Phase 3: Solar Energy Pulse through PV panels and house
 */
export function playEnergyPulse() {
  if (Platform.OS !== "web") {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    return;
  }
  const ctx = getAudioContext();
  if (!ctx || isMuted) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.5);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.85);
  } catch {}
}

/**
 * Phase 4: Crystal Chime on Logo Reveal (sparkling harmonic bell)
 */
export function playCrystalLogoChime() {
  if (Platform.OS !== "web") {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    return;
  }
  const ctx = getAudioContext();
  if (!ctx || isMuted) return;

  try {
    const now = ctx.currentTime;
    // Chime frequencies (golden major ninth: 864Hz, 1080Hz, 1296Hz, 1728Hz)
    const bellFrequencies = [864, 1080, 1296, 1728];

    bellFrequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.05 / (idx + 1), now + idx * 0.04 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + idx * 0.04);
      osc.stop(now + 1.7);
    });
  } catch {}
}

/**
 * Stop any lingering audio immediately
 */
export function stopCinematicAudio() {
  if (masterGain && audioCtx) {
    try {
      masterGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    } catch {}
  }
}
